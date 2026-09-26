@echo off
echo Starting SwasthFlow FastAPI Backend on http://localhost:8000 ...
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
