# SwasthFlow AI (SwasthAI) — Autonomous Inpatient Hospital Flow Engine

> **Tagline:** Hospitals aren’t short of beds; beds are vacant at 4 PM instead of 10 AM. SwasthFlow AI sequences non-clinical logistics (phlebotomy, insurance pre-auth, housekeeping, porter transfers) backwards from doctor rounds to accelerate discharge velocity and protect critical capacity.

---

## 🚀 Quick Start Guide (Run in 2 Minutes)

### Prerequisites
- **Node.js**: v18.0 or higher ([Download Node.js](https://nodejs.org/))
- **Python**: v3.10, v3.11, or v3.12 ([Download Python](https://www.python.org/))

---

### Step 1: Install Dependencies (First-Time Setup)

#### 1. Backend (Python FastAPI)
Open a terminal in the project root:
```bash
cd Backend
pip install -r requirements.txt
```

#### 2. Frontend (Next.js 14 Web Dashboard)
Open another terminal:
```bash
cd swasthflow-web
npm install
```

---

### Step 2: Launch the System

#### Option A: One-Click Launch (Windows)
Double-click `start.bat` in the project root.  
It automatically starts both the FastAPI backend and Next.js frontend in separate terminal windows.

#### Option B: Manual Launch
1. **Backend**:
   ```bash
   cd Backend
   python -m uvicorn main:app --reload --port 8000
   ```
   - API Docs: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/health`

2. **Frontend**:
   ```bash
   cd swasthflow-web
   npm run dev
   ```
   - Web App: `http://localhost:3000`

---

## 🩺 System Tour & Features

1. **Public Landing Page (`/`)**:
   - Modern slate-blue clinical aesthetic with animated interactive canvas.
   - Click **"Select Role"** to explore hospital personas.

2. **Hospital Roles & Personas**:
   - **Operations Coordinator**: Hospital-wide capacity command center, OR-Tools CP-SAT Master Plan, Live Bed Grid, Regional Blood & ICU Network Map, and coordinator-exclusive WhatsApp messaging drawer.
   - **Ward Sister / Nurse**: Ward A & B bedside clinical checklist, family consent tracking, and patient preparation before doctor rounds.
   - **Attending Consultant / Doctor**: Dr. Anand Sharma & Dr. S. Rao round census, clinical discharge authorization gate (Guardrail #1).
   - **Housekeeping & Phlebotomy (Support)**: Terminal bed disinfection tracking, backwards-scheduled fasting blood draws before doctor arrival.
   - **Patient & Family Portal**: Dedicated patient-facing shell with recovery trajectory milestones, **Rapid Emergency Intake** form, **Scheduled Pre-Admission** form, and **Guardrail #6 Bounded Bill Estimate** breakdown with statutory disclaimer.

3. **Regional Map & Capacity Coordination**:
   - Real interactive Leaflet map linking SRM Global Hospital with regional network facilities (Metro General, Apollo First Med, Fortis Malar).
   - Real-time alerts for blood deficits (3u O- deficit) and ICU capacity overflow (0 free beds) deep-linking and auto-centering on partner hospitals.

4. **10 Canonical Clinical Guardrails**:
   - Hard programmatic stops ensuring patient safety, physician authorization, bounded financial estimates, and fatigue capping.

---

## 🧪 Automated Test Suite
To verify the system end-to-end:
```bash
python -m pytest
```
All 45 automated clinical, scheduling, and API test cases run and pass.
