import { useQuery } from "@tanstack/react-query"
import {
  Box,
  Heading,
  HStack,
  Text,
  VStack,
  Badge,
  IconButton,
  Button,
  Input,
  Spinner,
} from "@chakra-ui/react"
import { FaTrash, FaEye } from "react-icons/fa"
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { useState } from "react"
import React from "react"

interface PDFDocument {
  id: string
  title: string
  description?: string
  filename: string
  file_size: number
  page_count: number
  is_processed: boolean
  processing_status: string
  created_at: string
  updated_at: string
}

interface PDFDocumentsResponse {
  data: PDFDocument[]
  count: number
}

const PdfList = () => {
  const { showErrorToast, showSuccessToast } = useCustomToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPdf, setDeletingPdf] = useState<PDFDocument | null>(null)
  const [confirmTitle, setConfirmTitle] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStep, setDeleteStep] = useState("")

  // Fetch PDF documents with auto-refresh for processing status
  const { data: pdfsResponse, isLoading, error, refetch } = useQuery<PDFDocumentsResponse>({
    queryKey: ["pdfs"],
    queryFn: async () => {
      const token = localStorage.getItem("access_token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch("http://api.localhost/api/v1/pdfs/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch PDFs")
      }

      return await response.json()
    },
    // Auto-refresh every 5 seconds if there are processing PDFs
    refetchInterval: (query: any) => {
      const data = query.state.data as PDFDocumentsResponse | undefined
      const hasProcessingPdfs = data?.data?.some((pdf: PDFDocument) =>
        pdf.processing_status === "pending" || pdf.processing_status === "processing"
      )
      return hasProcessingPdfs ? 5000 : false
    },
    refetchIntervalInBackground: true,
  })

  const handleViewPdf = async (pdf: PDFDocument) => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      showErrorToast("Please log in to view PDFs")
      return
    }
    
    try {
      const response = await fetch(`http://api.localhost/api/v1/pdfs/${pdf.id}/download`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      console.error('Error fetching PDF:', error)
      showErrorToast('Failed to open PDF')
    }
  }

  const handleDeleteClick = (pdf: PDFDocument) => {
    setDeletingPdf(pdf)
    setDeleteDialogOpen(true)
    setConfirmTitle("")
  }

  const handleDeleteConfirm = async () => {
    if (!deletingPdf) return
    
    if (confirmTitle !== deletingPdf.title) {
      showErrorToast("Title doesn't match. Please enter the exact title to confirm deletion.")
      return
    }

    setIsDeleting(true)
    setDeleteStep("Starting deletion...")

    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        throw new Error("No access token found")
      }

      setDeleteStep("Deleting PDF file and database record...")

      const response = await fetch(`http://api.localhost/api/v1/pdfs/${deletingPdf.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete PDF: ${response.status}`)
      }

      setDeleteStep("Deletion completed successfully!")

      showSuccessToast("PDF deleted successfully")
      
      // Close dialog first, then refresh
      setDeleteDialogOpen(false)
      
      // Refresh after a small delay to ensure dialog is closed
      setTimeout(() => {
        refetch()
      }, 100)
      
    } catch (error) {
      console.error('Error deleting PDF:', error)
      showErrorToast(`Failed to delete PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDeleting(false)
      setDeleteStep("")
      setConfirmTitle("")
      setDeletingPdf(null)
    }
  }

  const getStatusBadge = (status: string, isProcessed: boolean) => {
    if (isProcessed) {
      return <Badge colorPalette="green">Processed</Badge>
    }
    
    switch (status) {
      case "pending":
        return <Badge colorPalette="yellow">Pending</Badge>
      case "processing":
        return <Badge colorPalette="blue">Processing</Badge>
      case "failed":
        return <Badge colorPalette="red">Failed</Badge>
      default:
        return <Badge colorPalette="gray">Unknown</Badge>
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (isLoading) {
    return (
      <Box p={4}>
        <Text>Loading PDFs...</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={4}>
        <Text color="red.500">Error loading PDFs: {error.message}</Text>
      </Box>
    )
  }

  return (
    <Box p={4}>
      <Heading size="md" mb={4}>
        PDF Documents ({pdfsResponse && 'count' in pdfsResponse ? pdfsResponse.count : 0})
      </Heading>
      
      <VStack gap={4} align="stretch">
        {pdfsResponse && 'data' in pdfsResponse && Array.isArray(pdfsResponse.data) && pdfsResponse.data.map((pdf: PDFDocument) => (
          <Box key={pdf.id} border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
            <HStack justify="space-between" mb={3}>
              <VStack align="start" gap={1}>
                <Heading size="sm">{pdf.title}</Heading>
                {pdf.description && (
                  <Text fontSize="sm" color="gray.600">
                    {pdf.description}
                  </Text>
                )}
              </VStack>
              <HStack gap={2}>
                {getStatusBadge(pdf.processing_status, pdf.is_processed)}
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="View PDF"
                  onClick={() => handleViewPdf(pdf)}
                >
                  <FaEye />
                </IconButton>
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="Delete PDF"
                  onClick={() => handleDeleteClick(pdf)}
                >
                  <FaTrash />
                </IconButton>
              </HStack>
            </HStack>
            <HStack gap={4} fontSize="sm" color="gray.600">
              <Text>Size: {formatFileSize(pdf.file_size)}</Text>
              {pdf.page_count > 0 && (
                <Text>Pages: {pdf.page_count}</Text>
              )}
              <Text>Created: {new Date(pdf.created_at).toLocaleDateString()}</Text>
            </HStack>
          </Box>
        ))}
        
        {(!pdfsResponse || !('data' in pdfsResponse) || pdfsResponse.data.length === 0) && (
          <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
            <Text textAlign="center" color="gray.500">
              No PDF documents uploaded yet.
            </Text>
          </Box>
        )}
      </VStack>

      {/* Delete Confirmation Dialog */}
      <DialogRoot
        size={{ base: "xs", md: "md" }}
        placement="center"
        role="alertdialog"
        open={deleteDialogOpen}
        onOpenChange={(args: { open: boolean }) => setDeleteDialogOpen(args.open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle color="red.600">Delete PDF</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {isDeleting ? (
              <VStack gap={4}>
                <Text color="red.600" fontWeight="medium">Deleting PDF: {deletingPdf?.title}</Text>
                <Spinner size="md" color="red.500" />
                <Text fontSize="sm" color="gray.600">{deleteStep}</Text>
              </VStack>
            ) : (
              <VStack gap={4} align="stretch">
                <Text color="red.600" fontWeight="medium">
                  Warning: This action cannot be undone!
                </Text>
                <Text>
                  Are you sure you want to delete <strong>{deletingPdf?.title}</strong>?
                </Text>
                
                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                  This action will:
                </Text>
                <VStack align="start" gap={1} ml={4}>
                  <Text fontSize="sm" color="gray.600">• Remove the PDF file from storage</Text>
                  <Text fontSize="sm" color="gray.600">• Delete all associated database records</Text>
                  <Text fontSize="sm" color="gray.600">• Remove from vector database</Text>
                  <Text fontSize="sm" color="red.600" fontWeight="bold">• This action cannot be undone</Text>
                </VStack>
                
                <Text fontSize="sm" color="gray.600" mt={2}>
                  To confirm deletion, please enter the exact title: <strong>{deletingPdf?.title}</strong>
                </Text>
                <Input
                  placeholder="Enter PDF title to confirm"
                  value={confirmTitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmTitle(e.target.value)}
                  disabled={isDeleting}
                  borderColor={confirmTitle === deletingPdf?.title ? "green.300" : "gray.300"}
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
                />
              </VStack>
            )}
          </DialogBody>
          <DialogFooter gap={3}>
            <DialogCloseTrigger asChild>
              <Button 
                variant="outline" 
                disabled={isDeleting}
                flex={1}
              >
                Cancel
              </Button>
            </DialogCloseTrigger>
            <DialogActionTrigger asChild>
              <Button
                bg="red.600"
                color="white"
                _hover={{ bg: "red.700" }}
                _active={{ bg: "red.800" }}
                onClick={handleDeleteConfirm}
                disabled={isDeleting || confirmTitle !== deletingPdf?.title}
                flex={1}
              >
                {isDeleting ? "Deleting..." : "Delete PDF"}
              </Button>
            </DialogActionTrigger>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </Box>
  )
}

export default PdfList 