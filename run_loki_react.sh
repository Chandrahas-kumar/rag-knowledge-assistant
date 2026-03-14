#!/bin/bash
# Run LOKI with React UI
# Start API and frontend. Run from project root.

cd "$(dirname "$0")"

# Start API in background
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 &
API_PID=$!

# Start frontend
cd frontend && npm run dev &
FRONT_PID=$!

echo "LOKI running:"
echo "  API: http://localhost:8000"
echo "  UI:  http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"
wait $API_PID $FRONT_PID
