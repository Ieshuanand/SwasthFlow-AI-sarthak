import sys
import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_api_endpoints():
    print("=== TESTING FASTAPI ENDPOINTS FOR PHASE 1 ===")
    
    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.status_code}"
    print(f"[PASS] GET /api/health -> {res.json()}")
    
    # 2. Simulator status
    res = client.get("/api/simulator/status")
    assert res.status_code == 200
    status_data = res.json()
    print(f"[PASS] GET /api/simulator/status -> Total Beds: {status_data['total_beds']}, Occupied: {status_data['occupied_beds']}, Ready: {status_data['ready_beds']}")
    assert status_data["total_beds"] == 30
    assert status_data["occupied_beds"] > 0
    
    # 3. Beds list
    res = client.get("/api/beds")
    assert res.status_code == 200
    beds = res.json()
    print(f"[PASS] GET /api/beds -> {len(beds)} beds retrieved")
    assert len(beds) == 30
    sample_bed = next(b for b in beds if b["state"] == "OCCUPIED")
    print(f"       Sample occupied bed: {sample_bed['id']} ({sample_bed['ward']}) -> Patient: {sample_bed['current_encounter']['patient_name']}")
    
    # 4. Encounters list
    res = client.get("/api/encounters")
    assert res.status_code == 200
    encs = res.json()
    print(f"[PASS] GET /api/encounters -> {len(encs)} active patient encounters")
    assert len(encs) > 0
    sample_enc = encs[0]
    print(f"       Encounter: {sample_enc['id']} | Patient: {sample_enc['patient_name']} | Payer: {sample_enc['payer_type']}")
    print(f"       Clinical signs: {sample_enc['clinical_signs']}")
    
    # 5. Advance simulator time (+60 mins)
    res = client.post("/api/simulator/tick", json={"minutes": 60})
    assert res.status_code == 200
    tick_data = res.json()
    print(f"[PASS] POST /api/simulator/tick (+60m) -> {tick_data['message']}, active patients: {tick_data['active_patients']}")
    
    # 6. Payers list
    res = client.get("/api/payers")
    assert res.status_code == 200
    payers = res.json()
    print(f"[PASS] GET /api/payers -> {len(payers)} payer rules configured")
    assert len(payers) == 5
    
    print("\nALL FASTAPI INTEGRATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_api_endpoints()
