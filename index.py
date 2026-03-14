"""
RAG Indexing Pipeline - Run once to index PDFs into ChromaDB.
Run again only when adding new PDFs to docs/.
"""

import os
from pathlib import Path

from pypdf import PdfReader
import chromadb
from chromadb.utils import embedding_functions

# Set EMBEDDING_PROVIDER=ollama to use Ollama nomic-embed-text (fully local, no download)
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "onnx").lower()


DOCS_DIR = Path(__file__).parent / "docs"
DB_PATH = Path(__file__).parent / "my_vector_db"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 50
COLLECTION_NAME = "rag_docs"


def load_pdfs(docs_dir: Path) -> list[tuple[str, str, int]]:
    """
    Read all PDFs in docs_dir, extract text per page.
    Returns list of (text, source_file, page_num).
    """
    results = []
    docs_path = Path(docs_dir)

    if not docs_path.exists():
        print(f"Docs directory not found: {docs_path}")
        return results

    pdf_files = sorted(docs_path.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found in {docs_path}")
        return results

    for pdf_path in pdf_files:
        try:
            reader = PdfReader(str(pdf_path))
            source_file = pdf_path.name
            for page_num, page in enumerate(reader.pages, start=1):
                text = page.extract_text()
                if text and text.strip():
                    results.append((text.strip(), source_file, page_num))
        except Exception as e:
            print(f"Error reading {pdf_path}: {e}")

    return results


def split_into_chunks(
    texts: list[tuple[str, str, int]],
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[dict]:
    """
    Split text into overlapping chunks, preserve metadata.
    Returns list of dicts with keys: text, source_file, page_num.
    """
    chunks = []

    for text, source_file, page_num in texts:
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end]
            chunks.append({
                "text": chunk_text,
                "source_file": source_file,
                "page_num": page_num,
            })
            start = end - overlap
            if start >= len(text):
                break

    return chunks


def index_documents(chunks: list[dict], db_path: Path, clear_existing: bool = False) -> None:
    """
    Embed chunks and store in ChromaDB with metadata.
    Uses sentence-transformers for embeddings (all-MiniLM-L6-v2 is ChromaDB default).
    """
    if EMBEDDING_PROVIDER == "ollama":
        embedding_fn = embedding_functions.OllamaEmbeddingFunction(
            model_name="nomic-embed-text"
        )
    else:
        # ONNXMiniLM_L6_V2: local ONNX model, downloads from Chroma S3
        embedding_fn = embedding_functions.ONNXMiniLM_L6_V2()

    client = chromadb.PersistentClient(path=str(db_path))

    if clear_existing:
        try:
            client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"description": "RAG document chunks"},
    )

    if not chunks:
        print("No chunks to index.")
        return

    documents = [c["text"] for c in chunks]
    metadatas = [
        {"source_file": c["source_file"], "page_num": c["page_num"]}
        for c in chunks
    ]
    ids = [f"chunk_{i}" for i in range(len(chunks))]

    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids,
    )
    print(f"Indexed {len(chunks)} chunks into ChromaDB.")


def main() -> None:
    print("RAG Indexing Pipeline")
    print("-" * 40)

    # Load PDFs
    pages = load_pdfs(DOCS_DIR)
    if not pages:
        print("No content to index. Add PDFs to docs/ and try again.")
        return

    print(f"Loaded {len(pages)} pages from PDFs.")

    # Split into chunks
    chunks = split_into_chunks(pages)
    print(f"Created {len(chunks)} chunks (size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP}).")

    # Check if DB exists and has data (use get_collection to avoid creating with default embedding)
    db_path = Path(DB_PATH)
    db_path.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(db_path))
    try:
        existing = client.get_collection(COLLECTION_NAME)
        count = existing.count()
    except Exception:
        count = 0

    clear_existing = False
    if count > 0:
        response = input("Clear existing index and rebuild? (yes/no): ").strip().lower()
        clear_existing = response in ("yes", "y")
        if not clear_existing:
            print("Keeping existing index. Exiting.")
            return

    # Index
    index_documents(chunks, db_path, clear_existing=clear_existing)
    print("Indexing complete. Run query.py to ask questions.")


if __name__ == "__main__":
    main()
