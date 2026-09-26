import datetime
from simulator import HospitalSimulator, DIAGNOSES
from database import SessionLocal, engine, Base
import models
import adapter

def test_simulator_statistics():
    print("=== TEST 1: SIMULATOR STATISTICAL PROPERTIES ===")
    sim = HospitalSimulator(seed=123)
    
    # 1. Check beds initialization
    assert len(sim.beds) == 30, f"Expected 30 beds, got {len(sim.beds)}"
    print(f"[PASS] Beds initialized: {len(sim.beds)} beds across WARD_A, WARD_B, ICU")
    
    # 2. Sample 1000 patients to test the 15% complication rate statistically
    test_sim = HospitalSimulator(seed=42)
    complication_count = 0
    sample_size = 1000
    for i in range(sample_size):
        p = test_sim._admit_new_patient(bed_id=f"TEST-{i}", ward="WARD_A")
        if p["has_complication"]:
            complication_count += 1
    
    comp_rate = complication_count / sample_size
    print(f"[PASS] Sampled {sample_size} patients: {complication_count} had complications ({comp_rate*100:.1f}%)")
    assert 0.11 <= comp_rate <= 0.19, f"Complication rate {comp_rate:.3f} outside expected 11-19% bound"

def test_bimodal_doctor_rounds():
    print("\n=== TEST 2: DOCTOR ROUND BURSTS & BIMODAL SURGEON ROUNDS ===")
    sim = HospitalSimulator(seed=42)
    
    # Thursday (weekday = 3) -> Dr Rao has OT scheduled! Round should be 16:30 - 17:30
    thursday = datetime.date(2026, 9, 10) # 2026-09-10 is a Thursday
    ot_round = sim.get_doctor_round_time("DR_RAO", thursday)
    print(f"[PASS] Dr. Rao on OT day (Thursday): Round predicted at {ot_round.strftime('%H:%M')}")
    assert ot_round.hour >= 16, f"Expected afternoon round on OT day, got {ot_round.hour}"
    
    # Wednesday (weekday = 2) -> Dr Rao has NO OT. Round should be early morning 08:30 - 09:30
    wednesday = datetime.date(2026, 9, 9)
    non_ot_round = sim.get_doctor_round_time("DR_RAO", wednesday)
    print(f"[PASS] Dr. Rao on non-OT day (Wednesday): Round predicted at {non_ot_round.strftime('%H:%M')}")
    assert non_ot_round.hour <= 9, f"Expected morning round on non-OT day, got {non_ot_round.hour}"

def test_database_persistence():
    print("\n=== TEST 3: DATABASE SCHEMA & ADAPTER PERSISTENCE ===")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    sim = HospitalSimulator(seed=777)
    adapter.sync_payers_to_db(db)
    adapter.sync_simulator_to_db(sim, db)
    
    bed_count = db.query(models.Bed).count()
    enc_count = db.query(models.Encounter).count()
    payer_count = db.query(models.Payer).count()
    
    print(f"[PASS] Database sync verified:")
    print(f"       - Beds in DB: {bed_count}")
    print(f"       - Active Encounters in DB: {enc_count}")
    print(f"       - Payer profiles in DB: {payer_count}")
    
    assert bed_count == 30
    assert enc_count > 0
    assert payer_count == 5
    
    # Test sample encounter visible signs
    sample_enc = db.query(models.Encounter).first()
    print(f"[PASS] Sample patient: {sample_enc.patient_name} ({sample_enc.diagnosis_name})")
    print(f"       Payer: {sample_enc.payer_type}, LOS: {sample_enc.los_days} days, IV-to-oral: {sample_enc.iv_to_oral}, O2 removed: {sample_enc.oxygen_removed}")
    
    db.close()
    print("\nALL PHASE 1 AUTOMATED TESTS PASSED SUCCESSFULLY!")

def test_ward_documentation_lag():
    print("\n=== TEST 4: WARD DOCUMENTATION LAG (ACTUAL VS. LOGGED TIMESTAMPS) ===")
    sim = HospitalSimulator(seed=888)
    
    # Check that admissions and events have both timestamps and realistic ward lag
    assert len(sim.events) > 0, "Expected events to be logged during initialization"
    
    icu_lags = [sim.get_ward_documentation_lag("ICU") for _ in range(100)]
    ward_a_lags = [sim.get_ward_documentation_lag("WARD_A") for _ in range(100)]
    ward_b_lags = [sim.get_ward_documentation_lag("WARD_B") for _ in range(100)]
    
    avg_icu = sum(icu_lags) / len(icu_lags)
    avg_ward_a = sum(ward_a_lags) / len(ward_a_lags)
    avg_ward_b = sum(ward_b_lags) / len(ward_b_lags)
    
    print(f"[PASS] Sampled documentation lag across wards:")
    print(f"       - ICU lag avg: {avg_icu:.1f} mins (bounds 5-15 min)")
    print(f"       - WARD_A lag avg: {avg_ward_a:.1f} mins (bounds 15-30 min)")
    print(f"       - WARD_B lag avg: {avg_ward_b:.1f} mins (bounds 45-90 min - delayed entry)")
    
    # Assert ward ordering and bounds
    assert 5 <= avg_icu <= 15
    assert 15 <= avg_ward_a <= 30
    assert 45 <= avg_ward_b <= 90
    assert avg_ward_b > avg_ward_a > avg_icu, "Expected Ward B > Ward A > ICU documentation lag"
    
    # Check event log records
    sample_event = sim.events[0]
    print(f"[PASS] Sample event verification:")
    print(f"       Action: {sample_event['action']} in {sample_event['ward']}")
    print(f"       Actual time: {sample_event['actual_time']}")
    print(f"       Logged time: {sample_event['logged_time']}")
    print(f"       Doc lag: {sample_event['doc_lag_minutes']} minutes")
    
    assert sample_event['logged_time'] >= sample_event['actual_time']
    assert sample_event['doc_lag_minutes'] >= 0

if __name__ == "__main__":
    test_simulator_statistics()
    test_bimodal_doctor_rounds()
    test_ward_documentation_lag()
    test_database_persistence()

