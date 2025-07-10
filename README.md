# SoulScript: Spiritual Chatbot Platform

**Built on the [FastAPI Full Stack Template](https://github.com/fastapi/full-stack-fastapi-template)**

---

## Table of Contents
- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Features](#features)
- [Implementation Details](#implementation-details)
- [Setup & Local Development](#setup--local-development)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Known Issues & Limitations](#known-issues--limitations)
- [References](#references)
- [License](#license)

---

## Project Overview
SoulScript is a spiritual chatbot web application that enables group administrators to upload religious texts (PDFs) and provides users with AI-powered, context-aware chat experiences. The platform supports content filtering, feature flags, robust session management, and a modern, responsive UI/UX. It is designed for multi-group (e.g., church, mosque, temple) use, with strong separation of user data and feature configuration.

**Note:** All user authentication, registration, password reset, and related flows are inherited from the [FastAPI Full Stack Template](https://github.com/tiangolo/full-stack-fastapi-template). These flows were not custom-built, ensuring robust, secure, and production-ready user management out of the box.

---

## Architecture
- **Backend:** Python, FastAPI, SQLModel, PostgreSQL, LangChain, OpenAI Embeddings, ChromaDB (vector store)
- **Frontend:** React, TypeScript, Chakra UI, Vite, Playwright (E2E tests)
- **Containerization:** Docker Compose (multi-service: backend, frontend, db, traefik)
- **Reverse Proxy:** Traefik (for HTTPS, routing, and load balancing)
- **CI/CD:** GitHub Actions (test, build, deploy)
- **Deployment:** AWS EC2 (Docker Compose), with public endpoint

---

## Features
### Core Functionalities
- **User Registration & Authentication:** Email-based sign-up, JWT authentication, password reset, superuser/admin roles. (All inherited from FastAPI Full Stack Template)
- **PDF Upload & RAG:** Admins upload religious texts (PDF, max 10MB, validated on both frontend and backend). PDFs are embedded using OpenAI embeddings (not LangChain's), stored in ChromaDB, and used for Retrieval-Augmented Generation (RAG) in chat.
- **Chat Interface:** Real-time, streaming AI chat with markdown support, session/memory management, and auto-naming of sessions.
- **Content Filtering:** All user and AI messages are filtered using OpenAI Moderation API. Blocked content is logged, users are notified, and sessions can be blocked with persistent state.
- **Feature Flags:** Admins can enable/disable features (e.g., spiritual parenting, grief support) per group. Feature flags are auto-initialized on backend startup and exposed to the AI prompt for nuanced responses.
- **Admin Dashboard:** Manage users, PDFs, feature flags, and view content filter logs with pagination and filtering.
- **Dark Mode & Theming:** Full support for light/dark themes, with adaptive UI elements throughout.
- **Robust UI/UX:** Professional error handling, confirmation dialogs, auto-scroll, and accessibility considerations.

---

## Implementation Details

### Custom Features vs. Template Features

**Features Inherited from FastAPI Full Stack Template:**
- User authentication, registration, and password reset flows
- JWT token management
- Email-based password recovery
- Admin user management
- Basic CRUD operations for items
- Docker Compose setup with Traefik
- Database migrations with Alembic
- Pre-commit hooks and code formatting
- GitHub Actions CI/CD pipeline
- Testing infrastructure (Pytest, Playwright)

**Custom Features Added:**
- PDF upload and embedding with OpenAI
- AI chat interface with streaming responses
- Content filtering with OpenAI Moderation API
- Feature flags system
- Chat session management
- Admin dashboard for PDFs, feature flags, and content logs
- Dark mode theming
- Markdown rendering in chat

### Backend
- **Framework:** FastAPI (with SQLModel for ORM, Pydantic for validation, and Alembic for migrations)
- **User Management:** All authentication, registration, password reset, and superuser flows are inherited from the FastAPI Full Stack Template. No custom code was written for these flows, ensuring security and maintainability.
- **PDF Upload & Embedding:**
  - File size limit: 10MB (enforced in both backend and frontend)
  - Embedding pipeline uses `OpenAIEmbeddings` from `langchain_openai` directly
  - Text chunking is performed using `RecursiveCharacterTextSplitter` (chunk_size=1000, chunk_overlap=200)
  - Embeddings are stored in `ChromaDB` (via `langchain_chroma.Chroma`), with a persistent directory (`/app/chroma_db`)
  - PDF files are stored on disk (`/app/pdf_storage`)
  - All embedding and storage logic is encapsulated in `PDFService` (`backend/app/services/pdf_service.py`)
- **Chat & Session Management:**
  - Chat sessions and messages are stored in PostgreSQL via SQLModel models (`ChatSession`, `ChatMessage`)
  - Each session is associated with a user and has a title (auto-generated from the first message)
  - Chat memory is managed using `ConversationSummaryBufferMemory` from LangChain, which summarizes long conversations and maintains context window (`CHAT_CONTEXT_WINDOW_SIZE`, `CHAT_MEMORY_K`, `CHAT_SUMMARY_THRESHOLD` in config)
  - The main chat logic is encapsulated in `ChatService` (`backend/app/services/chat_service.py`)
  - AI responses are generated using `ChatOpenAI` (model: `gpt-4o-mini`), with prompt engineering to inject PDF context and active feature flags
  - Streaming responses are implemented via FastAPI's async generator endpoints (`stream_message` method in `ChatService`)
- **Content Filtering:**
  - All user and AI messages are filtered using OpenAI's Moderation API (`openai.Moderation.create`)
  - Filtering logic is in `ContentFilterService` (`backend/app/services/content_filter_service.py`)
  - Blocked content is logged in the `ContentFilterLog` table, with user/session context
  - If a message is blocked, the session is marked as blocked, a warning is shown, and further input is disabled
  - Blocked sessions cannot be deleted by users
- **Feature Flags:**
  - Feature flags are defined in the `FeatureFlag` model and managed by `FeatureFlagService`
  - Predefined feature flags are auto-initialized on backend startup (see `init_db` in `backend/app/core/db.py`)
  - Active feature flags are injected into the AI prompt for context-aware responses
  - Admins can toggle feature flags via the admin dashboard
- **Configuration:**
  - All secrets and environment-specific settings are managed via `.env` and Docker Compose
  - Config is loaded using Pydantic's `BaseSettings` and `SettingsConfigDict`
- **Security:**
  - Secure password hashing with Passlib (bcrypt)
  - JWT authentication
  - CORS configuration via `.env`
  - Environment-based secret enforcement (raises error if defaults are used in production)

### Frontend
- **Framework:** React (TypeScript, Vite)
- **UI Library:** Chakra UI (with custom theming and dark mode support)
- **API Client:** Auto-generated from OpenAPI spec
- **Chat Interface:**
  - Real-time streaming of AI responses using the browser's `fetch` streaming API
  - Markdown rendering with `react-markdown` and `remark-gfm`
  - Auto-scroll and loading indicators for chat
  - Blocked state disables input and shows a persistent warning
  - Session list auto-updates and supports blocked state
- **Admin Dashboard:**
  - Manage users, PDFs, feature flags, and content filter logs
  - Pagination and filtering for logs and user lists
  - Feature flag toggles with confirmation dialogs
- **PDF Upload:**
  - File size validation on the client
  - User feedback for errors and upload progress
- **Theming:**
  - All components use `useColorModeValue` for adaptive colors
  - Accessibility and color contrast are considered throughout
- **Testing:**
  - Playwright for E2E tests (login)
  - Unit tests for utility functions and hooks

### DevOps & Deployment
- **Docker Compose:** Multi-service setup (backend, frontend, db, traefik)
- **Traefik:** Handles HTTPS, routing, and load balancing. No account required.
- **AWS EC2:** Recommended for production; instructions provided for setup and DNS
- **CI/CD:** GitHub Actions for test, build, and deploy
- **Database Migrations:** Alembic for schema changes

---

## Setup & Local Development

### Prerequisites

#### For All Platforms
- [Docker](https://www.docker.com/) and Docker Compose
- OpenAI API Key

#### For Unix/Linux/macOS
- [uv](https://docs.astral.sh/uv/) for Python package management (recommended) or pip
- Node.js (for frontend development) - use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm)

#### For Windows
- Python 3.10+ (install from [python.org](https://www.python.org/downloads/))
- Node.js (install from [nodejs.org](https://nodejs.org/))
- Git Bash or WSL2 (Windows Subsystem for Linux) for better Unix-like experience
- Docker Desktop for Windows

### Quickstart with Docker Compose (Recommended)

```bash
# Clone the repo
git clone <your-repo-url>
cd SoulScript

# Copy and configure environment variables
cp example.env .env
# Edit .env to set your OpenAI API key, database, and email settings
# Make sure to change at least:
# - SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")
# - FIRST_SUPERUSER_PASSWORD
# - POSTGRES_PASSWORD
# - OPENAI_API_KEY

# Start the local development stack
docker compose watch

# Access the application:
# Frontend: http://localhost:80
# Backend API: http://localhost:8000
# Swagger UI (API docs): http://localhost:8000/docs
# ReDoc (alternative API docs): http://localhost:8000/redoc
# Adminer (database admin): http://localhost:8080
# Traefik UI: http://localhost:8090
# MailCatcher (email testing): http://localhost:1080
```

**Note:** The first time you start the stack, it might take a minute for all services to be ready. You can monitor the logs with `docker compose logs` or `docker compose logs backend`.

### Local Development

#### Frontend Development
```bash
# Navigate to frontend directory
cd frontend

# Install Node.js version (if using fnm/nvm)
fnm install  # or nvm install
fnm use      # or nvm use

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Development Workflow

1. **Start with Docker Compose:** Use `docker compose watch` for the full stack
2. **Switch to local development:** Stop specific services and run them locally for faster iteration
```bash
   # Stop frontend container and run locally
   docker compose stop frontend
   cd frontend && npm run dev
   
   # Stop backend container and run locally
   docker compose stop backend
   cd backend && fastapi dev app/main.py
   ```

3. **Database Migrations:** When you change models, create and run migrations
```bash
   # Enter backend container
   docker compose exec backend bash
   
   # Create migration
   alembic revision --autogenerate -m "Description of changes"
   
   # Run migration
   alembic upgrade head
   ```

4. **Generate Frontend Client:** After backend API changes
```bash
   # From project root
   ./scripts/generate-client.sh
```

### Testing Local Domains

To test with subdomains (like production), edit `.env`:
```bash
DOMAIN=localhost.tiangolo.com
```

Then restart: `docker compose watch`

Access via:
- Frontend: http://dashboard.localhost.tiangolo.com
- Backend: http://api.localhost.tiangolo.com
- API docs: http://api.localhost.tiangolo.com/docs

---

## Environment Variables

The `.env` file contains all configurations, generated keys, and passwords. **Never commit this file to Git** if your project is public.

### Key Variables to Configure

**Required for basic functionality:**
- `SECRET_KEY`: JWT signing key (generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`)
- `FIRST_SUPERUSER`: Email of the first superuser (default: `admin@example.com`)
- `FIRST_SUPERUSER_PASSWORD`: Password for the first superuser
- `POSTGRES_PASSWORD`: PostgreSQL database password

**Required for AI features:**
- `OPENAI_API_KEY`: Your OpenAI API key (required for chat, PDF embedding, and content filtering)

**Email configuration (optional but recommended):**
- `SMTP_HOST`: SMTP server host
- `SMTP_USER`: SMTP server username
- `SMTP_PASSWORD`: SMTP server password
- `EMAILS_FROM_EMAIL`: Email address to send emails from

**Deployment configuration:**
- `DOMAIN`: Domain for the application (default: `localhost`)
- `FRONTEND_HOST`: Frontend URL (default: `http://localhost:80`)
- `ENVIRONMENT`: Environment type (`local`, `staging`, `production`)

### Environment Variable Security

- All secrets and credentials must be set via environment variables
- Never commit sensitive values to Git
- For production, set environment variables in your CI/CD system
- The application enforces non-default secrets in production environments

### Frontend Environment Variables

For frontend-specific configuration, create a `frontend/.env` file:
```env
VITE_API_URL=https://api.my-domain.example.com
```

---

## Testing

### Backend Tests
```bash
# Run all backend tests
bash ./scripts/test.sh

# Or if stack is already running
docker compose exec backend bash scripts/tests-start.sh

# Run with specific pytest options (e.g., stop on first error)
docker compose exec backend bash scripts/tests-start.sh -x

# Run locally (from backend directory)
cd backend
uv sync
source .venv/bin/activate
pytest
```

**Test Coverage:** When tests run, a file `htmlcov/index.html` is generated. Open it in your browser to see test coverage.

### Frontend Tests
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if not already done)
npm install

# Run unit tests
npm run test

# Run end-to-end tests with Playwright
# First, ensure the backend is running
docker compose up -d --wait backend

# Then run Playwright tests
npx playwright test

# Run tests in UI mode (interactive)
npx playwright test --ui

# Clean up test data
docker compose down -v
```

### Pre-commit Hooks
The project uses pre-commit for code linting and formatting:
```bash
# Install pre-commit hooks
uv run pre-commit install

# Run manually on all files
uv run pre-commit run --all-files
```

---

## Deployment
- **Production:** Deploy on AWS EC2 (or any Docker host). Set `ENVIRONMENT=production` and configure your domain and secrets.
- **Traefik:** Handles HTTPS and routing. No account required.
- **CI/CD:** GitHub Actions workflow provided for automated test/build/deploy.
- **Database Migrations:** Use Alembic for schema changes.

---

## Security
- All secrets and credentials must be set via environment variables.
- Never commit sensitive values to git.
- Passwords are hashed with bcrypt.
- JWT tokens are short-lived and securely signed.
- CORS is restricted to allowed origins.
- All user input is validated and filtered.

---

## Known Issues & Limitations
- **OpenAI Dependency:** Requires a valid OpenAI API key for all AI features.
- **No Social Login:** Only email/password authentication is provided out of the box.
- **No Multi-Tenancy Isolation:** While groups are supported, full multi-tenant data isolation is not implemented.
- **No Mobile App:** Responsive web only.

---

## References
- [FastAPI Full Stack Template](https://github.com/fastapi/full-stack-fastapi-template)
- [FastAPI](https://fastapi.tiangolo.com)
- [LangChain](https://python.langchain.com)
- [ChromaDB](https://www.trychroma.com/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Chakra UI](https://chakra-ui.com)
- [Playwright](https://playwright.dev)
- [Traefik](https://traefik.io)

---

## License
- The Full Stack FastAPI Template is licensed under the terms of the MIT license.

**For any questions or issues, please contact the project maintainer.**
