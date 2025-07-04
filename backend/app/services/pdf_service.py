import os
import uuid
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sqlmodel import Session, select
from app.models import PDFDocument
from app.core.config import settings

# Set up logging
logger = logging.getLogger(__name__)


class PDFService:
    def __init__(self):
        self.pdf_storage_path = Path("/app/pdf_storage")
        self.pdf_storage_path.mkdir(exist_ok=True)

        # Check if OpenAI API key is available
        if not settings.OPENAI_API_KEY:
            logger.warning("OpenAI API key not found. PDF processing will be limited.")
            self.embedding = None
        else:
            try:
                # Initialize OpenAI embeddings
                self.embedding = OpenAIEmbeddings(
                    openai_api_key=settings.OPENAI_API_KEY
                )
                logger.info("OpenAI embeddings initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI embeddings: {e}")
                self.embedding = None

        # Initialize text splitter with optimized settings
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""],
        )

        # Persist directory for ChromaDB
        self.persist_directory = "/app/chroma_db"
        Path(self.persist_directory).mkdir(exist_ok=True)

        # Initialize or load existing vector store
        self.vectordb = self._get_or_create_vectordb()

    def _get_or_create_vectordb(self) -> Optional[Chroma]:
        """Get existing vector store or create new one"""
        if not self.embedding:
            logger.warning(
                "No embedding function available. ChromaDB will not be initialized."
            )
            return None

        try:
            # Try to load existing vector store
            vectordb = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embedding,
            )
            logger.info("ChromaDB vector store loaded successfully")
            return vectordb
        except Exception as e:
            logger.error(f"Failed to load existing ChromaDB: {e}")
            try:
                # Create new vector store if it doesn't exist
                vectordb = Chroma(
                    persist_directory=self.persist_directory,
                    embedding_function=self.embedding,
                )
                logger.info("New ChromaDB vector store created successfully")
                return vectordb
            except Exception as e2:
                logger.error(f"Failed to create new ChromaDB: {e2}")
                return None

    def save_pdf_file(self, file_content: bytes, filename: str) -> str:
        """Save PDF file to storage and return the file path"""
        # Create date-based directory structure
        today = datetime.now()
        date_path = self.pdf_storage_path / str(today.year) / str(today.month).zfill(2)
        date_path.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        file_uuid = str(uuid.uuid4())
        file_extension = Path(filename).suffix
        unique_filename = f"{file_uuid}{file_extension}"
        file_path = date_path / unique_filename

        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)

        return str(file_path)

    def process_pdf(self, pdf_document: PDFDocument, db: Session) -> Dict[str, Any]:
        """Process PDF document using LangChain approach"""
        try:
            logger.info(f"Starting PDF processing for document: {pdf_document.title}")

            # Update status to processing
            pdf_document.processing_status = "processing"
            db.commit()

            # Check if file exists
            if not os.path.exists(pdf_document.filename):
                raise Exception(f"PDF file not found: {pdf_document.filename}")

            # Use PyPDFLoader to load the specific PDF file
            logger.info(f"Loading PDF from: {pdf_document.filename}")
            loader = PyPDFLoader(pdf_document.filename)
            pdf_docs = loader.load()

            if not pdf_docs:
                raise Exception("No documents found in PDF")

            logger.info(f"Loaded {len(pdf_docs)} pages from PDF")

            # Split documents into chunks
            logger.info("Splitting documents into chunks...")
            chunks = self.text_splitter.split_documents(pdf_docs)
            logger.info(f"Created {len(chunks)} chunks from PDF")

            # Add metadata to chunks
            logger.info("Adding metadata to chunks...")
            for i, chunk in enumerate(chunks):
                chunk.metadata.update(
                    {
                        "pdf_id": str(pdf_document.id),
                        "pdf_title": pdf_document.title,
                        "owner_id": str(pdf_document.owner_id),
                        "source": "pdf_upload",
                        "upload_date": pdf_document.created_at.isoformat(),
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                        "file_size": pdf_document.file_size,
                    }
                )

            # Debug log: Confirm embedding function and API key
            if self.embedding:
                logger.info(f"Embedding function: {self.embedding}")
                api_key = getattr(self.embedding, "openai_api_key", None)
                if api_key:
                    # Handle SecretStr object properly
                    api_key_str = (
                        str(api_key.get_secret_value())
                        if hasattr(api_key, "get_secret_value")
                        else str(api_key)
                    )
                    logger.info(
                        f"OpenAI API key (first 8 chars): {api_key_str[:8]}... (length: {len(api_key_str)})"
                    )
                else:
                    logger.warning("OpenAI API key not found in embedding instance!")
            else:
                logger.warning("No embedding function available!")

            # Try to get or reinitialize ChromaDB for background task
            vectordb = self.vectordb
            if not vectordb and self.embedding:
                try:
                    logger.info("Reinitializing ChromaDB for background task...")
                    vectordb = Chroma(
                        persist_directory=self.persist_directory,
                        embedding_function=self.embedding,
                    )
                    logger.info("ChromaDB reinitialized successfully")
                except Exception as e:
                    logger.error(f"Failed to reinitialize ChromaDB: {e}")
                    vectordb = None
            if not vectordb:
                logger.error(
                    f"vectordb is None. self.embedding: {self.embedding}, self.persist_directory: {self.persist_directory}"
                )
            # Add documents to vector store if available
            vector_store_updated = False
            if vectordb:
                try:
                    logger.info("Adding chunks to ChromaDB...")
                    vectordb.add_documents(chunks)

                    # Persist the vector store (new langchain_chroma handles this automatically)
                    logger.info("Successfully saved to ChromaDB")
                    vector_store_updated = True
                except Exception as e:
                    logger.error(f"Error saving to ChromaDB: {e}")
                    vector_store_updated = False
            else:
                logger.warning("ChromaDB not available. Skipping vector storage.")

            # Update document status - this should happen regardless of ChromaDB status
            try:
                pdf_document.is_processed = True
                pdf_document.processing_status = "completed"
                pdf_document.page_count = len(pdf_docs)
                db.add(pdf_document)
                db.commit()
                logger.info(f"Database status updated for: {pdf_document.title}")
            except Exception as e:
                logger.error(f"Error updating database status: {e}")
                db.rollback()
                raise

            logger.info(
                f"PDF processing completed successfully for: {pdf_document.title}"
            )

            return {
                "status": "success",
                "chunks_processed": len(chunks),
                "page_count": len(pdf_docs),
                "vector_store_updated": vector_store_updated,
            }

        except Exception as e:
            logger.error(f"Error processing PDF {pdf_document.title}: {str(e)}")

            # Update status to failed
            pdf_document.processing_status = "failed"
            pdf_document.error_message = str(e)
            db.commit()

            return {"status": "error", "error": str(e)}

    def search_similar_chunks(
        self, query: str, owner_id: uuid.UUID, limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Search for similar chunks in the user's documents using LangChain retriever"""
        try:
            # Create retriever
            retriever = self.vectordb.as_retriever(search_kwargs={"k": limit})

            # Get relevant documents
            docs = retriever.get_relevant_documents(query)

            # Filter by owner_id and format results
            formatted_results = []
            for doc in docs:
                if doc.metadata.get("owner_id") == str(owner_id):
                    formatted_results.append(
                        {
                            "content": doc.page_content,
                            "metadata": doc.metadata,
                            "score": None,  # LangChain doesn't provide scores by default
                        }
                    )

            return formatted_results

        except Exception as e:
            raise Exception(f"Error searching similar chunks: {str(e)}")

    def delete_pdf_embeddings(self, pdf_id: uuid.UUID) -> bool:
        """Delete all embeddings for a specific PDF document"""
        try:
            if not self.vectordb:
                logger.warning("ChromaDB not available. Skipping embedding deletion.")
                return True

            logger.info(f"Attempting to delete embeddings for PDF ID: {pdf_id}")

            # Use the correct ChromaDB deletion method
            # First, get all documents with metadata filter
            results = self.vectordb.get(where={"pdf_id": str(pdf_id)})

            if not results or not results.get("ids"):
                logger.info(f"No documents found for PDF ID: {pdf_id}")
                return True

            # Delete documents using the where clause (more efficient)
            logger.info(
                f"Deleting {len(results['ids'])} documents from ChromaDB for PDF {pdf_id}"
            )
            self.vectordb.delete(where={"pdf_id": str(pdf_id)})
            logger.info(
                f"Successfully deleted {len(results['ids'])} documents from ChromaDB"
            )

            # Compact the collection to reclaim space
            try:
                logger.info("Compacting ChromaDB collection to reclaim space...")
                import sqlite3
                import os

                # Get the database path
                db_path = os.path.join(self.persist_directory, "chroma.sqlite3")

                if os.path.exists(db_path):
                    # Connect and run VACUUM to reclaim space
                    conn = sqlite3.connect(db_path)
                    conn.execute("VACUUM")
                    conn.close()
                    logger.info(
                        "Successfully compacted ChromaDB collection using SQLite VACUUM"
                    )
                else:
                    logger.warning("ChromaDB database file not found for compaction")
            except Exception as e:
                logger.warning(f"Failed to compact ChromaDB collection: {e}")

            return True

        except Exception as e:
            logger.error(f"Error deleting PDF embeddings: {str(e)}")
            # Don't raise the exception, just log it and continue
            return False

    def get_retriever(self, owner_id: uuid.UUID = None, search_kwargs: Dict = None):
        """Get a retriever for the vector store with optional filtering"""
        if not self.vectordb:
            logger.warning("ChromaDB not available. Cannot create retriever.")
            return None

        if search_kwargs is None:
            search_kwargs = {"k": 5}

        retriever = self.vectordb.as_retriever(search_kwargs=search_kwargs)

        # If owner_id is provided, we need to filter results
        if owner_id:
            # This is a simplified approach - in practice, you might want to implement
            # a custom retriever that filters by owner_id
            pass

        return retriever

    def get_chroma_stats(self) -> Dict[str, Any]:
        """Get statistics about the ChromaDB collection"""
        if not self.vectordb:
            return {"error": "ChromaDB not available"}

        try:
            # Get collection info
            collection = self.vectordb._collection
            count = collection.count()

            logger.info(f"ChromaDB collection has {count} documents")

            # Get unique PDFs
            if count > 0:
                try:
                    results = collection.get()
                    pdf_ids = set()
                    for metadata in results.get("metadatas", []):
                        if metadata and "pdf_id" in metadata:
                            pdf_ids.add(metadata["pdf_id"])

                    return {
                        "total_documents": count,
                        "unique_pdfs": len(pdf_ids),
                        "pdf_ids": list(pdf_ids),
                        "status": "active",
                    }
                except Exception as e:
                    logger.error(f"Error getting collection data: {e}")
                    return {
                        "total_documents": count,
                        "unique_pdfs": 0,
                        "pdf_ids": [],
                        "status": "active",
                        "warning": "Could not retrieve PDF metadata",
                    }
            else:
                return {
                    "total_documents": 0,
                    "unique_pdfs": 0,
                    "pdf_ids": [],
                    "status": "empty",
                }
        except Exception as e:
            logger.error(f"Error getting ChromaDB stats: {e}")
            return {"error": str(e)}

    def reprocess_pdf(self, pdf_document: PDFDocument, db: Session) -> Dict[str, Any]:
        """Reprocess a PDF document (useful for failed documents)"""
        logger.info(f"Reprocessing PDF: {pdf_document.title}")

        # First, delete existing embeddings for this PDF
        try:
            self.delete_pdf_embeddings(pdf_document.id)
            logger.info(f"Deleted existing embeddings for PDF: {pdf_document.title}")
        except Exception as e:
            logger.warning(f"Could not delete existing embeddings: {e}")

        # Then reprocess
        return self.process_pdf(pdf_document, db)

    def compact_chromadb(self) -> Dict[str, Any]:
        """Compact the ChromaDB collection to reclaim space"""
        try:
            if not self.vectordb:
                return {"error": "ChromaDB not available"}

            logger.info("Compacting ChromaDB collection to reclaim space...")

            # For ChromaDB 0.6.3, we need to use SQLite VACUUM
            import sqlite3
            import os

            # Get the database path
            db_path = os.path.join(self.persist_directory, "chroma.sqlite3")

            if os.path.exists(db_path):
                # Connect and run VACUUM to reclaim space
                conn = sqlite3.connect(db_path)
                conn.execute("VACUUM")
                conn.close()
                logger.info(
                    "Successfully compacted ChromaDB collection using SQLite VACUUM"
                )

                # Get file size after
                size_after = os.path.getsize(db_path)
                logger.info(
                    f"ChromaDB file size after compaction: {size_after / (1024*1024):.2f} MB"
                )

                return {
                    "status": "success",
                    "message": "ChromaDB collection compacted successfully using SQLite VACUUM",
                    "file_size_mb": round(size_after / (1024 * 1024), 2),
                }
            else:
                return {"error": "ChromaDB database file not found"}

        except Exception as e:
            logger.error(f"Error compacting ChromaDB: {e}")
            return {"error": str(e)}


# Global instance
pdf_service = PDFService()
