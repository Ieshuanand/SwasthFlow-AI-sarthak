@echo off
echo ===================================================
echo Starting SwasthFlow AI (Backend + Next.js Frontend)
echo ===================================================

echo [1/2] Launching Python FastAPI Backend on http://localhost:8000 ...
start "SwasthFlow Backend (FastAPI)" cmd /k "cd Backend && python -m uvicorn main:app --reload --port 8000"

echo [2/2] Launching Next.js Web Frontend on http://localhost:3000 ...
start "SwasthFlow Frontend (Next.js)" cmd /k "cd swasthflow-web && npm run dev"

echo.
echo All services launched!
echo - Web Dashboard: http://localhost:3000
echo - Swagger API Docs: http://localhost:8000/docs
echo ===================================================
pause
