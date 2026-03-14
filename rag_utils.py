"""
Shared RAG utilities for LOKI - indexing and querying with per-chat collections.
"""

import os
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pypdf import PdfReader
import chromadb
from chromadb.utils import embedding_functions

load_dotenv()

DB_PATH = Path(__file__).parent / "my_vector_db"
DOCS_DIR = Path(__file__).parent / "docs"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 50
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "onnx").lower()

# Model provider detection: ollama | openai | none
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")


def get_model_provider(settings: Optional[dict] = None) -> tuple[str, str, str]:
    """
    Detect active model provider. Returns (provider, model_name, mode).
    provider: 'ollama' | 'openai' | 'none'
    model_name: e.g. 'llama3.1:8b', 'gpt-4o'
    mode: 'local' | 'cloud' | 'none'
    Settings override env when provided.
    """
    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if settings and (settings.get("openai_api_key") or "").strip():
        openai_key = (settings.get("openai_api_key") or "").strip()

    explicit = (settings.get("llm_provider") or "") if settings else ""
    explicit = explicit or os.getenv("LLM_PROVIDER", "")
    explicit = str(explicit).lower().strip()
    ollama_url = os.getenv("OLLAMA_BASE_URL", "").strip()
    ollama_model = (settings.get("ollama_model") or "") if settings else ""
    ollama_model = str(ollama_model).strip()
    if ollama_model in ("", "_custom"):
        ollama_model = os.getenv("OLLAMA_MODEL", "") or OLLAMA_MODEL
    openai_model = (settings.get("openai_model") or OPENAI_MODEL) if settings else OPENAI_MODEL
    openai_model = str(openai_model).strip() or OPENAI_MODEL

    # Explicit LLM_PROVIDER override (from settings or env)
    if explicit == "ollama":
        return ("ollama", ollama_model, "local")
    if explicit == "openai":
        if openai_key:
            return ("openai", openai_model, "cloud")
        return ("none", "", "none")

    # Auto-detect: Ollama first if configured
    if ollama_url or os.getenv("OLLAMA_MODEL", "").strip():
        return ("ollama", ollama_model or os.getenv("OLLAMA_MODEL", "") or OLLAMA_MODEL, "local")
    if openai_key:
        return ("openai", openai_model, "cloud")
    return ("none", "", "none")


def get_embedding_fn():
    if EMBEDDING_PROVIDER == "ollama":
        return embedding_functions.OllamaEmbeddingFunction(model_name="nomic-embed-text")
    return embedding_functions.ONNXMiniLM_L6_V2()


def get_embedding_model_name() -> str:
    """Return human-readable embedding model name for status display."""
    if EMBEDDING_PROVIDER == "ollama":
        return "nomic-embed-text"
    return "all-MiniLM-L6-v2"


def extract_text_from_pdf(pdf_path: Path) -> list[tuple[str, str, int]]:
    """Extract text from a PDF. Returns list of (text, filename, page_num)."""
    results = []
    try:
        reader = PdfReader(str(pdf_path))
        name = pdf_path.name
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text()
            if text and text.strip():
                results.append((text.strip(), name, i))
    except Exception as e:
        raise RuntimeError(f"Failed to read PDF: {e}") from e
    return results


def split_into_chunks(texts, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    chunks = []
    for text, source_file, page_num in texts:
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end]
            chunks.append({"text": chunk_text, "source_file": source_file, "page_num": page_num})
            start = end - overlap
            if start >= len(text):
                break
    return chunks


def get_or_create_chat_collection(chat_id: str):
    """Get or create ChromaDB collection for a chat. Returns (collection, embedding_fn)."""
    db_path = Path(DB_PATH)
    db_path.mkdir(parents=True, exist_ok=True)
    coll_name = f"loki_chat_{chat_id}"
    embedding_fn = get_embedding_fn()
    client = chromadb.PersistentClient(path=str(db_path))
    try:
        collection = client.get_collection(name=coll_name, embedding_function=embedding_fn)
    except Exception:
        collection = client.create_collection(
            name=coll_name,
            embedding_function=embedding_fn,
        )
    return collection, embedding_fn


def index_pdfs_into_chat(chat_id: str, pdf_paths: list[Path], append: bool = True) -> int:
    """Index PDFs into a chat's collection. Returns number of chunks added."""
    collection, embedding_fn = get_or_create_chat_collection(chat_id)
    all_chunks = []
    for pdf_path in pdf_paths:
        pages = extract_text_from_pdf(pdf_path)
        all_chunks.extend(split_into_chunks(pages))

    if not all_chunks:
        return 0

    docs = [c["text"] for c in all_chunks]
    metas = [{"source_file": c["source_file"], "page_num": c["page_num"]} for c in all_chunks]
    ids = [f"{chat_id}_{uuid.uuid4().hex[:12]}_{i}" for i in range(len(all_chunks))]
    collection.add(documents=docs, metadatas=metas, ids=ids)
    return len(all_chunks)


def get_chat_chunk_count(chat_id: str) -> int:
    """Return number of chunks in a chat's collection."""
    try:
        coll, _ = get_or_create_chat_collection(chat_id)
        return coll.count()
    except Exception:
        return 0


def remove_document_from_chat(chat_id: str, source_filename: str) -> int:
    """Remove all chunks for a document from a chat's collection. Returns chunks removed."""
    try:
        coll, _ = get_or_create_chat_collection(chat_id)
        # ChromaDB delete by metadata filter
        coll.delete(where={"source_file": source_filename})
        return coll.count()  # Return remaining count; caller can compute removed
    except Exception:
        return 0


def query_chat(chat_id: str, question: str, n_results: int = 5) -> tuple[list[dict], Optional[str]]:
    """
    Query a chat's collection. Returns (chunks, error_message).
    If error_message is not None, chunks will be empty.
    """
    try:
        collection, embedding_fn = get_or_create_chat_collection(chat_id)
    except Exception as e:
        return [], str(e)

    if collection.count() == 0:
        return [], "No documents in this chat. Upload PDFs first."

    results = collection.query(
        query_texts=[question],
        n_results=min(n_results, collection.count()),
        include=["documents", "metadatas"],
    )
    chunks = []
    if results["documents"] and results["documents"][0]:
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            chunks.append({
                "text": doc,
                "source_file": meta.get("source_file", "unknown"),
                "page_num": meta.get("page_num", 0),
            })
    return chunks, None


def generate_answer(question: str, chunks: list[dict], settings: Optional[dict] = None) -> tuple[str, list[dict]]:
    """Generate answer using detected LLM. Returns (answer, sources)."""
    provider, model_name, _ = get_model_provider(settings)
    if provider == "none":
        raise ValueError(
            "No model provider configured. Install and run Ollama locally (ollama.com), "
            "or add OPENAI_API_KEY in Settings for cloud mode."
        )

    context = "\n\n---\n\n".join(
        f"[From {c['source_file']} p.{c['page_num']}]\n{c['text']}" for c in chunks
    )
    prompt = f"""Answer only from the following context. Do not make up information.
If the context does not contain relevant information, say so clearly.

Context:
{context}

Question: {question}
"""

    if provider == "ollama":
        import ollama
        r = ollama.chat(
            model=model_name or "llama3.1:8b",
            messages=[
                {"role": "system", "content": "Answer only from the provided context."},
                {"role": "user", "content": prompt},
            ],
        )
        answer = r["message"]["content"]
    else:
        from openai import OpenAI
        api_key = (settings.get("openai_api_key") if settings else "") or os.getenv("OPENAI_API_KEY")
        api_key = (api_key or "").strip()
        if not api_key:
            raise ValueError(
                "OpenAI API key required. Add it in Settings (AI Provider → OpenAI) "
                "or set OPENAI_API_KEY in .env."
            )
        client = OpenAI(api_key=api_key)
        r = client.chat.completions.create(
            model=model_name or "gpt-4o",
            messages=[
                {"role": "system", "content": "Answer only from the provided context."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        answer = r.choices[0].message.content

    # Return unique (file, page) pairs for citation display
    seen = set()
    sources = []
    for c in chunks:
        key = (c["source_file"], c.get("page_num", 0))
        if key not in seen:
            seen.add(key)
            sources.append({"file": c["source_file"], "page": c.get("page_num", 0)})
    return answer, sources
