# LOKI - React UI

Modern React-based UI for LOKI (Local Omniscient Knowledge Interface).

## Run

### 1. Start the API

```bash
cd my-rag-project
source venv/bin/activate
pip install fastapi uvicorn
uvicorn api.main:app --reload --port 8000
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Architecture

- **API** (FastAPI): `/api/chats`, `/api/chats/{id}/documents`, `/api/chats/{id}/query`, `/api/settings`
- **Frontend** (React + Vite + Tailwind + Headless UI): 3-region layout
  - Left: Sidebar (chats, new chat, documents, settings)
  - Center: Chat window
  - Modals: Upload, Settings

## Design

- Purple/blue gradient accent
- Dark neutral background
- Responsive (mobile sidebar collapses to hamburger)
- Typing indicator, copy button, expandable citations
