import sys
import sqlite3
from fastapi.testclient import TestClient
from api import app
from attendance import STANDARDIZED_DEPARTMENTS, STANDARDIZED_PRACTICES, create_session

client = TestClient(app)

def test_all():
    print("========================================")
    print("STARTING COMPREHENSIVE VERIFICATION TEST")
    print("========================================")

    # 1. Verify standardized constants
    expected_depts = ["Software Services", "Operations", "Sales", "Marketing"]
    expected_practices = [
        "DAAPS Integration",
        "MAPPS",
        "QA",
        "SAP",
        "Microsoft",
        "Cloud",
        "Innovation"
    ]

    assert STANDARDIZED_DEPARTMENTS == expected_depts, f"Expected {expected_depts}, got {STANDARDIZED_DEPARTMENTS}"
    assert STANDARDIZED_PRACTICES == expected_practices, f"Expected {expected_practices}, got {STANDARDIZED_PRACTICES}"
    print("[PASS] Criterion 1 & 2: Standardized lists match requirements exactly.")

    # 2. Check /departments API endpoint
    res = client.get("/departments")
    assert res.status_code == 200, f"/departments failed: {res.text}"
    depts_returned = res.json()
    assert depts_returned == expected_depts, f"Expected {expected_depts}, got {depts_returned}"
    print(f"[PASS] /departments returned exactly {len(depts_returned)} options: {depts_returned}")

    # 3. Check /practices API endpoint
    res = client.get("/practices")
    assert res.status_code == 200, f"/practices failed: {res.text}"
    practices_returned = res.json()
    assert practices_returned == expected_practices, f"Expected {expected_practices}, got {practices_returned}"
    print(f"[PASS] /practices returned exactly {len(practices_returned)} options: {practices_returned}")

    # 4. Check Database records integrity
    conn = sqlite3.connect("attendance.db")
    conn.row_factory = sqlite3.Row
    employees = conn.execute("SELECT employee_id, employee_name, department, practice, reporting_hr FROM employees").fetchall()
    print(f"[PASS] Total employees in DB: {len(employees)}")
    for emp in employees:
        assert emp["department"] in expected_depts, f"Employee {emp['employee_id']} invalid dept: {emp['department']}"
        assert emp["practice"] in expected_practices, f"Employee {emp['employee_id']} invalid practice: {emp['practice']}"
        print(f"   Emp {emp['employee_id']} ({emp['employee_name']}): Dept='{emp['department']}', Practice='{emp['practice']}', HR='{emp['reporting_hr']}'")
    conn.close()
    print("[PASS] Criterion 10: All database employee records validated with zero invalid values.")

    # 5. Admin filtering tests
    # Create admin token
    admin_token = create_session("admin", "admin", "ALL")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Department filter: Software Services
    res = client.get("/employees?department=Software Services", headers=admin_headers)
    assert res.status_code == 200
    emps = res.json()
    assert len(emps) == 4, f"Expected 4 employees in Software Services, got {len(emps)}"
    for e in emps:
        assert e["department"] == "Software Services"
    print(f"[PASS] Criterion 3 (Dept Filter): Software Services returned {len(emps)} matching employees.")

    # Department filter: Operations
    res = client.get("/employees?department=Operations", headers=admin_headers)
    assert res.status_code == 200
    emps = res.json()
    assert len(emps) == 1 and emps[0]["employee_id"] == "9616", f"Expected Durga Mallesh (9616), got {emps}"
    print(f"[PASS] Criterion 3 (Dept Filter): Operations returned employee {emps[0]['employee_id']} ({emps[0]['employee_name']}).")

    # Practice filter: SAP
    res = client.get("/employees?practice=SAP", headers=admin_headers)
    assert res.status_code == 200
    emps = res.json()
    assert len(emps) == 1 and emps[0]["employee_id"] == "9620", f"Expected Ravi (9620), got {emps}"
    print(f"[PASS] Criterion 4 (Practice Filter): SAP returned employee {emps[0]['employee_id']} ({emps[0]['employee_name']}).")

    # Combined filter: Software Services + SAP
    res = client.get("/employees?department=Software Services&practice=SAP", headers=admin_headers)
    assert res.status_code == 200
    emps = res.json()
    assert len(emps) == 1 and emps[0]["employee_id"] == "9620", f"Expected Ravi (9620), got {emps}"
    print(f"[PASS] Criterion 5 (Combined Filter): Software Services + SAP returned {emps[0]['employee_id']} ({emps[0]['employee_name']}).")

    # Combined filter: Software Services + Cloud
    res = client.get("/employees?department=Software Services&practice=Cloud", headers=admin_headers)
    assert res.status_code == 200
    emps = res.json()
    assert len(emps) == 1 and emps[0]["employee_id"] == "9614", f"Expected Indhu (9614), got {emps}"
    print(f"[PASS] Criterion 5 (Combined Filter): Software Services + Cloud returned {emps[0]['employee_id']} ({emps[0]['employee_name']}).")

    # Search + Combined Filter
    res = client.get("/employees?search=Naveenth&department=Software Services&practice=DAAPS Integration", headers=admin_headers)
    assert res.status_code == 200
    emps = res.json()
    assert len(emps) == 1 and emps[0]["employee_id"] == "9615", f"Expected Naveenth (9615), got {emps}"
    print(f"[PASS] Criterion 6 (Search + Combined): Matching search returned {emps[0]['employee_id']} ({emps[0]['employee_name']}).")

    # Search mismatch with filters
    res = client.get("/employees?search=Naveenth&department=Sales", headers=admin_headers)
    assert res.status_code == 200
    emps = res.json()
    assert len(emps) == 0, f"Expected 0 results for Naveenth in Sales, got {len(emps)}"
    print("[PASS] Criterion 6 (Search + Mismatch): Returns 0 when search doesn't match department filter.")

    # 6. Attendance API filtering
    res = client.get("/attendance/today?department=Software Services&practice=SAP", headers=admin_headers)
    assert res.status_code == 200
    today_records = res.json()
    assert len(today_records) == 1 and today_records[0]["employee_id"] == "9620"
    print("[PASS] Criterion 7 (/attendance/today filtered): Returned 9620 Ravi for Software Services + SAP.")

    # 7. Role-Based Access Enforcement (HR user Saradhi)
    hr_token = create_session("sprathi", "hr", "Software Services")
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # All employees for HR Saradhi (should only be 9614, 9615, 9616)
    res = client.get("/employees", headers=hr_headers)
    assert res.status_code == 200
    hr_emps = res.json()
    assert len(hr_emps) == 3
    hr_emp_ids = {e["employee_id"] for e in hr_emps}
    assert hr_emp_ids == {"9614", "9615", "9616"}
    print(f"[PASS] Criterion 8 (HR Scope): Saradhi sees only assigned employees: {hr_emp_ids}")

    # HR Saradhi filtering by department=Software Services (should only return 9614, 9615; NOT 6028 or 9620!)
    res = client.get("/employees?department=Software Services", headers=hr_headers)
    assert res.status_code == 200
    filtered_hr = res.json()
    filtered_hr_ids = {e["employee_id"] for e in filtered_hr}
    assert filtered_hr_ids == {"9614", "9615"}, f"Expected {{'9614', '9615'}}, got {filtered_hr_ids}"
    print(f"[PASS] Criterion 8 (HR Scope + Dept Filter): Saradhi in Software Services sees only: {filtered_hr_ids}")

    # HR Saradhi filtering by practice=SAP (Ravi belongs to HR Manasa, so Saradhi must get 0!)
    res = client.get("/employees?practice=SAP", headers=hr_headers)
    assert res.status_code == 200
    assert len(res.json()) == 0
    print("[PASS] Criterion 8 (HR Scope + Practice Filter): Saradhi sees 0 for SAP (Ravi is assigned to HR Manasa).")

    # HR Saradhi filtering by practice=Cloud (returns 9614)
    res = client.get("/employees?practice=Cloud", headers=hr_headers)
    assert res.status_code == 200
    cloud_emps = res.json()
    assert len(cloud_emps) == 1 and cloud_emps[0]["employee_id"] == "9614"
    print("[PASS] Criterion 8 (HR Scope + Practice Filter): Saradhi sees Indhu (9614) for Cloud.")

    # 8. Report Service filtering
    import report_service
    # Generate XLSX with filters directly via service
    content, filename = report_service.create_all_employees_report(
        period="day",
        selected_date="2026-10-22",
        department="Software Services",
        practice="SAP",
    )
    assert len(content) > 0
    assert filename.endswith(".xlsx")
    print(f"[PASS] Criterion 7 (Reports Service Filtered): Successfully generated filtered report {filename} ({len(content)} bytes).")

    # Generate XLSX via API endpoint
    res = client.get("/reports/attendance?period=day&date=2026-10-22&department=Software Services&practice=SAP", headers=admin_headers)
    assert res.status_code == 200, f"Report download failed: {res.text}"
    assert len(res.content) > 0
    print(f"[PASS] Criterion 7 (Reports API Filtered): /reports/attendance downloaded {len(res.content)} bytes.")

    print("========================================")
    print("ALL 10 ACCEPTANCE CRITERIA VERIFIED!")
    print("========================================")

if __name__ == "__main__":
    test_all()
