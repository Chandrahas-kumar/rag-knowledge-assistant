#!/bin/bash
# Run LOKI - Local Omniscient Knowledge Interface
# Starts the FastAPI backend. Run the frontend separately: cd frontend && npm run dev
cd "$(dirname "$0")"
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null
uvicorn api.main:app --reload --port 8000
