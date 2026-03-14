"""
RAG Query Pipeline - Run every time to ask questions.
Loads ChromaDB, retrieves relevant chunks, generates answer via LLM.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
import chromadb
from chromadb.utils import embedding_functions

load_dotenv()

DB_PATH = Path(__file__).parent / "my_vector_db"
COLLECTION_NAME = "rag_docs"
N_RESULTS = 5
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "onnx").lower()


def get_llm_provider() -> str:
    """Return 'openai' or 'ollama' based on env."""
    return os.getenv("LLM_PROVIDER", "openai").lower()


def load_db():
    """
    Load existing ChromaDB. Exit with message if empty or not found.
    Returns (collection, embedding_fn) or None.
    """
    db_path = Path(DB_PATH)
    if not db_path.exists():
        print("No database found. Run index.py first to index your PDFs.")
        return None

    # Must match index.py
    if EMBEDDING_PROVIDER == "ollama":
        embedding_fn = embedding_functions.OllamaEmbeddingFunction(
            model_name="nomic-embed-text"
        )
    else:
        embedding_fn = embedding_functions.ONNXMiniLM_L6_V2()
    client = chromadb.PersistentClient(path=str(db_path))

    try:
        collection = client.get_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_fn,
        )
    except Exception:
        print("Collection not found. Run index.py first to index your PDFs.")
        return None

    if collection.count() == 0:
        print("Database is empty. Run index.py first to index your PDFs.")
        return None

    return (collection, embedding_fn)


def retrieve(collection, embedding_fn, query: str, n_results: int = N_RESULTS) -> list[dict]:
    """
    Embed query, search ChromaDB, return chunks with metadata.
    """
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
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
    return chunks


def generate_answer_openai(question: str, chunks: list[dict]) -> tuple[str, list[str]]:
    """Generate answer using OpenAI GPT-4o."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not api_key.strip():
        raise ValueError(
            "OPENAI_API_KEY not set. Add it to .env file (copy from .env.example)."
        )

    from openai import OpenAI
    client = OpenAI(api_key=api_key)

    context = "\n\n---\n\n".join(
        f"[From {c['source_file']} p.{c['page_num']}]\n{c['text']}"
        for c in chunks
    )

    prompt = f"""Answer only from the following context. Do not make up information.
If the context does not contain relevant information, say so clearly.

Context:
{context}

Question: {question}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Answer only from the provided context."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        answer = response.choices[0].message.content
        sources = list({c["source_file"] for c in chunks})
        return (answer, sources)
    except Exception as e:
        err_msg = str(e).lower()
        if "rate" in err_msg or "429" in err_msg:
            raise RuntimeError("OpenAI rate limit exceeded. Wait a moment and try again.") from e
        if "network" in err_msg or "connection" in err_msg:
            raise RuntimeError("Network error. Check your connection and try again.") from e
        raise RuntimeError(f"OpenAI API error: {e}") from e


def generate_answer_ollama(question: str, chunks: list[dict]) -> tuple[str, list[str]]:
    """Generate answer using Ollama (llama3.1:8b)."""
    try:
        import ollama
    except ImportError:
        raise RuntimeError("ollama package not installed. Run: pip install ollama")

    context = "\n\n---\n\n".join(
        f"[From {c['source_file']} p.{c['page_num']}]\n{c['text']}"
        for c in chunks
    )

    prompt = f"""Answer only from the following context. Do not make up information.
If the context does not contain relevant information, say so clearly.

Context:
{context}

Question: {question}
"""

    try:
        response = ollama.chat(
            model="llama3.1:8b",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Answer only from the provided context."},
                {"role": "user", "content": prompt},
            ],
        )
        answer = response["message"]["content"]
        sources = list({c["source_file"] for c in chunks})
        return (answer, sources)
    except Exception as e:
        raise RuntimeError(f"Ollama error: {e}. Ensure Ollama is running and llama3.1:8b is pulled.") from e


def generate_answer(question: str, chunks: list[dict]) -> tuple[str, list[str]]:
    """Generate answer using configured LLM provider."""
    provider = get_llm_provider()
    if provider == "ollama":
        return generate_answer_ollama(question, chunks)
    return generate_answer_openai(question, chunks)


def main() -> None:
    print("RAG Query Pipeline")
    print("-" * 40)

    provider = get_llm_provider()
    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or not api_key.strip():
            print("OPENAI_API_KEY not set. Add it to .env (copy from .env.example).")
            return

    db = load_db()
    if db is None:
        return

    collection, embedding_fn = db
    print(f"Loaded {collection.count()} chunks. Ask questions (or 'quit' to exit).\n")

    while True:
        try:
            question = input("Question: ").strip()
            if not question:
                continue
            if question.lower() in ("quit", "exit", "q"):
                print("Goodbye.")
                break

            chunks = retrieve(collection, embedding_fn, question)
            if not chunks:
                print("No relevant chunks found. Try a more specific question.\n")
                continue

            try:
                answer, sources = generate_answer(question, chunks)
                print("\nAnswer:")
                print(answer)
                print(f"\nSources: {', '.join(sources)}\n")
            except ValueError as e:
                print(f"\nError: {e}\n")
            except RuntimeError as e:
                print(f"\nError: {e}\n")

        except KeyboardInterrupt:
            print("\nGoodbye.")
            break


if __name__ == "__main__":
    main()
