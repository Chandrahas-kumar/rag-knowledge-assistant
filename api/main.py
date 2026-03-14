"""
LOKI API - FastAPI backend for RAG document assistant.
"""

import json
import tempfile
import uuid
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Union
from pydantic import BaseModel

# Add parent to path for rag_utils
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from rag_utils import (
    index_pdfs_into_chat,
    get_chat_chunk_count,
    remove_document_from_chat,
    query_chat,
    generate_answer,
    get_model_provider,
    get_embedding_model_name,
    DOCS_DIR,
)

app = FastAPI(title="LOKI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

META_PATH = Path(__file__).parent.parent / "chat_metadata.json"

# In-memory state for status bar
_last_latency_seconds: Optional[float] = None
_indexing_in_progress: bool = False
_last_error: Optional[str] = None


def load_metadata():
    if META_PATH.exists():
        return json.loads(META_PATH.read_text())
    return {}


def save_metadata(data: dict):
    META_PATH.write_text(json.dumps(data, indent=2))


# --- Models ---

class ChatCreate(BaseModel):
    name: str = "New Chat"


class ChatUpdate(BaseModel):
    name: str


class QueryRequest(BaseModel):
    message: str


class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    n_results: Optional[int] = None
    streaming: Optional[bool] = None
    show_citations: Optional[bool] = None
    sound_notifications: Optional[bool] = None
    llm_provider: Optional[str] = None
    ollama_model: Optional[str] = None
    openai_model: Optional[str] = None
    openai_api_key: Optional[str] = None


# --- Chat endpoints ---

@app.get("/api/chats")
def list_chats():
    meta = load_metadata()
    chats = []
    for cid, data in meta.items():
        doc_list = data.get("documents", [])
        chats.append({
            "id": cid,
            "name": data.get("name", "Chat"),
            "document_count": len(doc_list),
            "created_at": data.get("created_at", ""),
        })
    return {"chats": sorted(chats, key=lambda x: x["created_at"], reverse=True)}


@app.post("/api/chats")
def create_chat(body: Optional[ChatCreate] = None):
    cid = str(uuid.uuid4())[:8]
    meta = load_metadata()
    meta[cid] = {
        "name": body.name if body else "New Chat",
        "created_at": datetime.utcnow().isoformat(),
        "documents": [],
    }
    save_metadata(meta)
    return {"id": cid, "name": meta[cid]["name"], "created_at": meta[cid]["created_at"]}


@app.get("/api/chats/{chat_id}")
def get_chat(chat_id: str):
    meta = load_metadata()
    if chat_id not in meta:
        raise HTTPException(404, "Chat not found")
    try:
        count = get_chat_chunk_count(chat_id)
    except Exception:
        count = 0
    return {
        "id": chat_id,
        "name": meta[chat_id].get("name", "Chat"),
        "document_count": count,
        "created_at": meta[chat_id].get("created_at", ""),
    }


@app.patch("/api/chats/{chat_id}")
def update_chat(chat_id: str, body: ChatUpdate):
    meta = load_metadata()
    if chat_id not in meta:
        raise HTTPException(404, "Chat not found")
    meta[chat_id]["name"] = body.name
    save_metadata(meta)
    return {"ok": True}


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: str):
    meta = load_metadata()
    if chat_id not in meta:
        raise HTTPException(404, "Chat not found")
    del meta[chat_id]
    save_metadata(meta)
    # Delete ChromaDB collection
    try:
        import chromadb
        from rag_utils import DB_PATH, get_embedding_fn
        client = chromadb.PersistentClient(path=str(DB_PATH))
        try:
            client.delete_collection(f"loki_chat_{chat_id}")
        except Exception:
            pass
    except Exception:
        pass
    return {"ok": True}


# --- Documents ---

@app.post("/api/chats/{chat_id}/documents")
async def upload_documents(chat_id: str, files: list[UploadFile] = File(...)):
    meta = load_metadata()
    if chat_id not in meta:
        raise HTTPException(404, "Chat not found")
    if "documents" not in meta[chat_id]:
        meta[chat_id]["documents"] = []

    paths = []
    for f in files:
        if not f.filename or not f.filename.lower().endswith(".pdf"):
            continue
        content = await f.read()
        tmp = Path(tempfile.mkdtemp()) / f.filename
        tmp.write_bytes(content)
        paths.append(tmp)

    if not paths:
        raise HTTPException(400, "No valid PDF files")

    global _indexing_in_progress, _last_error
    _indexing_in_progress = True
    _last_error = None
    try:
        n = index_pdfs_into_chat(chat_id, paths)
        for p in paths:
            meta[chat_id]["documents"].append({
                "id": str(uuid.uuid4())[:12],
                "name": p.name,
                "size": p.stat().st_size,
            })
        save_metadata(meta)
        return {"chunks_added": n, "files": len(paths)}
    except Exception as e:
        _last_error = str(e)
        raise HTTPException(500, str(e))
    finally:
        _indexing_in_progress = False


@app.get("/api/chats/{chat_id}/documents")
def list_documents(chat_id: str):
    meta = load_metadata()
    if chat_id not in meta:
        raise HTTPException(404, "Chat not found")
    docs = meta[chat_id].get("documents", [])
    return {"documents": docs}


@app.delete("/api/chats/{chat_id}/documents/{doc_id}")
def remove_document(chat_id: str, doc_id: str):
    meta = load_metadata()
    if chat_id not in meta:
        raise HTTPException(404, "Chat not found")
    docs = meta[chat_id].get("documents", [])
    doc = next((d for d in docs if d.get("id") == doc_id), None)
    if not doc:
        raise HTTPException(404, "Document not found")
    source_name = doc.get("name", "")
    remove_document_from_chat(chat_id, source_name)
    meta[chat_id]["documents"] = [d for d in docs if d.get("id") != doc_id]
    save_metadata(meta)
    return {"ok": True}


# --- Query ---

@app.post("/api/chats/{chat_id}/query")
def chat_query(chat_id: str, body: QueryRequest):
    import time
    global _last_latency_seconds, _last_error
    meta = load_metadata()
    if chat_id not in meta:
        raise HTTPException(404, "Chat not found")

    n_results = 5
    if SETTINGS_PATH.exists():
        try:
            s = json.loads(SETTINGS_PATH.read_text())
            n_results = int(s.get("n_results", 5))
        except Exception:
            pass

    start = time.perf_counter()
    chunks, err = query_chat(chat_id, body.message, n_results=n_results)
    if err:
        _last_error = err
        return {"answer": err, "sources": []}

    try:
        settings_data = get_settings() if SETTINGS_PATH.exists() else {}
        answer, sources = generate_answer(body.message, chunks, settings_data)
        _last_latency_seconds = time.perf_counter() - start
        _last_error = None
        # Format sources for frontend: [{file, page}, ...]
        return {"answer": answer, "sources": sources}
    except Exception as e:
        _last_error = str(e)
        raise HTTPException(500, str(e))


# --- System ---

@app.get("/api/system/status")
def system_status(chat_id: Optional[str] = Query(None)):
    """Return AI system health and configuration for status bar."""
    global _last_latency_seconds, _indexing_in_progress, _last_error
    settings_data = get_settings() if SETTINGS_PATH.exists() else {}
    provider, model_name, mode = get_model_provider(settings_data)
    embedding_model = get_embedding_model_name()

    documents = 0
    chunks = 0
    if chat_id:
        meta = load_metadata()
        if chat_id in meta:
            documents = len(meta[chat_id].get("documents", []))
            try:
                chunks = get_chat_chunk_count(chat_id)
            except Exception:
                chunks = 0

    # Status: green=ok, yellow=indexing, red=error
    if _last_error:
        status = "error"
    elif _indexing_in_progress:
        status = "indexing"
    else:
        status = "ok"

    latency_str = None
    if _last_latency_seconds is not None:
        latency_str = f"{_last_latency_seconds:.1f}s"

    # Human-readable model name (e.g. "Llama3" from "llama3.1:8b")
    display_name = model_name.split(":")[0].replace(".", "").replace("-", " ").title() if model_name else ""
    if provider == "openai":
        display_name = display_name or "GPT-4"

    return {
        "model_provider": provider,
        "model_name": model_name,
        "model_display_name": display_name,
        "mode": mode,
        "embedding_model": embedding_model,
        "documents": documents,
        "chunks": chunks,
        "latency": latency_str,
        "status": status,
    }


# --- Settings ---

SETTINGS_PATH = Path(__file__).parent.parent / "app_settings.json"


def _default_settings():
    return {
        "theme": "dark",
        "n_results": 5,
        "streaming": False,
        "show_citations": True,
        "sound_notifications": False,
        "llm_provider": "",
        "ollama_model": "llama3.1:8b",
        "openai_model": "gpt-4o",
        "openai_api_key": "",
    }


@app.get("/api/settings")
def get_settings():
    if SETTINGS_PATH.exists():
        data = json.loads(SETTINGS_PATH.read_text())
        defaults = _default_settings()
        for k, v in defaults.items():
            if k not in data:
                data[k] = v
        return data
    return _default_settings()


@app.put("/api/settings")
def update_settings(body: SettingsUpdate):
    data = get_settings()
    if body.theme is not None:
        data["theme"] = body.theme
    if body.n_results is not None:
        data["n_results"] = body.n_results
    if body.streaming is not None:
        data["streaming"] = body.streaming
    if body.show_citations is not None:
        data["show_citations"] = body.show_citations
    if body.sound_notifications is not None:
        data["sound_notifications"] = body.sound_notifications
    if body.llm_provider is not None:
        data["llm_provider"] = body.llm_provider
    if body.ollama_model is not None:
        data["ollama_model"] = body.ollama_model
    if body.openai_model is not None:
        data["openai_model"] = body.openai_model
    if body.openai_api_key is not None:
        data["openai_api_key"] = body.openai_api_key
    SETTINGS_PATH.write_text(json.dumps(data, indent=2))
    return data


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
