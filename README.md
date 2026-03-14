# AI Knowledge Assistant (RAG Prototype)

A document-based AI assistant that lets users ask questions in natural language and receive answers grounded in their own PDFs, with source citations.

## Overview

This project implements a **Retrieval-Augmented Generation (RAG)** pipeline that allows users to query document collections using natural language.

Instead of relying purely on an LLM's training data, the system retrieves relevant information from indexed documents and uses that context to generate accurate answers.

## How it Works

1. **Document Ingestion**
   - PDFs are placed in the `docs/` folder.
   - Text is extracted and split into overlapping chunks.

2. **Embedding & Indexing**
   - Each chunk is converted into vector embeddings using ONNX (all-MiniLM-L6-v2) or Ollama (nomic-embed-text).
   - The vectors are stored in **ChromaDB** for semantic retrieval.

3. **Query Processing**
   - A user enters a question.
   - The system embeds the query and retrieves the most relevant document chunks.

4. **Answer Generation**
   - The retrieved chunks are passed to an LLM (OpenAI GPT-4o or local Ollama model).
   - The LLM generates a response grounded in the retrieved context and includes source citations.

## Architecture

```
PDF Documents
       ↓
Text Extraction (pypdf)
       ↓
Chunking (1000 chars, 50 overlap)
       ↓
Embeddings (ONNX / Ollama nomic-embed-text)
       ↓
Vector Database (ChromaDB)
       ↓
Semantic Retrieval (top 5 chunks)
       ↓
LLM (OpenAI GPT-4o / Ollama Llama 3)
       ↓
Answer with Citations
```

## Project Structure

```
my-rag-project/
├── docs/              # Source PDFs
├── my_vector_db/      # ChromaDB vector store
├── index.py            # Indexing pipeline
├── query.py            # Query interface
├── requirements.txt
├── .env                # API keys (copy from .env.example)
└── README.md
```

## Setup

Create a virtual environment and install dependencies:

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file (copy from `.env.example`):

```
OPENAI_API_KEY=your_key_here
LLM_PROVIDER=openai
```

**Optional** — for fully local operation:

```
LLM_PROVIDER=ollama
EMBEDDING_PROVIDER=ollama
```

(Requires [Ollama](https://ollama.com) with `ollama pull llama3.1:8b` and `ollama pull nomic-embed-text`)

## Usage

### Step 1 — Index documents

Place PDFs inside the `docs/` directory and run:

```bash
python index.py
```

This extracts text, chunks it, generates embeddings, and stores them in ChromaDB.

### Step 2 — Ask questions

Run:

```bash
python query.py
```

Then enter a question such as:

```
What are the key concepts in RAG?
```

The system retrieves relevant document chunks and generates an answer using the LLM.

**Example output:**

```
Answer:
RAG stands for Retrieval-Augmented Generation. The core idea is to search documents for the 2–5 most relevant paragraphs, then pass those plus the question to an AI model. The embedding model and vector database handle retrieval; the AI only reads what retrieval hands it.

Sources: 01.RAG.pdf
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Python |
| Vector Database | ChromaDB |
| Embeddings | ONNX (all-MiniLM-L6-v2) / Ollama (nomic-embed-text) |
| LLM | OpenAI GPT-4o / Ollama Llama 3.1 |
| PDF Extraction | pypdf |

## Potential Use Cases

This architecture can be adapted for:

- Customer support knowledge assistants
- Internal operations documentation search
- Enterprise document Q&A systems
- Policy and compliance document assistants

## Future Improvements

- Web interface (Streamlit / FastAPI)
- Improved ranking and chunking strategies
- Metadata filtering
- Chat-style conversation memory
