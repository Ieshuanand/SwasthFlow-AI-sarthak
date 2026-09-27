import subprocess
import sys
import time
import os

def run():
    print("=" * 60)
    print("  SwasthFlow AI — Starting Backend & Frontend Services")
    print("=" * 60)
    
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "swasthflow-web")

    print(f"[1/2] Launching FastAPI Backend on http://localhost:8000 ...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
        cwd=backend_dir
    )

    time.sleep(2)

    print(f"[2/2] Launching Next.js Web Frontend on http://localhost:3000 ...")
    frontend_proc = subprocess.Popen(
        ["cmd", "/c", "npm run dev -- -p 3000"],
        cwd=frontend_dir
    )

    print("\nSwasthFlow AI is running!")
    print("-> Open Dashboard: http://localhost:3000")
    print("-> API Docs (Swagger): http://localhost:8000/docs")
    print("\nPress Ctrl+C to stop both servers.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down SwasthFlow servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    run()
