import os
import sys
import unittest
from datetime import date, datetime
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from api import app
import attendance as db

client = TestClient(app)

class TestDashboardImprovements(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        db.create_database()
        # Login as superior
        login_resp = client.post("/auth/login", json={"username": "superior", "password": "superior123"})
        cls.superior_token = login_resp.json()["token"]
        cls.sup_headers = {"Authorization": f"Bearer {cls.superior_token}"}

    def test_01_historical_date_and_live_attendance(self):
        # Today's attendance endpoint
        today_resp = client.get("/attendance/today", headers=self.sup_headers)
        self.assertEqual(today_resp.status_code, 200)
        today_data = today_resp.json()
        self.assertIsInstance(today_data, list)

        # Historical date attendance endpoint
        hist_date = "2026-10-15"
        hist_resp = client.get(f"/attendance/date/{hist_date}", headers=self.sup_headers)
        self.assertEqual(hist_resp.status_code, 200)
        hist_data = hist_resp.json()
        self.assertIsInstance(hist_data, list)

    def test_02_workforce_distribution_departments_deduplication(self):
        # Departments list should contain clean unique names
        depts_resp = client.get("/departments")
        self.assertEqual(depts_resp.status_code, 200)
        depts = depts_resp.json()
        self.assertIsInstance(depts, list)
        # Verify no duplicate department names (case-insensitive)
        lower_depts = [d.strip().lower() for d in depts if d]
        self.assertEqual(len(lower_depts), len(set(lower_depts)), "Department list contains duplicate entries!")

    def test_03_employees_practice_and_subpractice_hierarchy(self):
        emp_resp = client.get("/employees", headers=self.sup_headers)
        self.assertEqual(emp_resp.status_code, 200)
        emps = emp_resp.json()
        self.assertIsInstance(emps, list)
        for emp in emps:
            self.assertIn("department", emp)
            self.assertIn("practice", emp)
            self.assertIn("sub_practice", emp)

    def test_04_username_lookup_does_not_activate_or_create_duplicates(self):
        # Count employees before lookup
        conn = db.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM employees")
        count_before = cur.fetchone()[0]
        conn.close()

        # Lookup an existing employee or Hubble candidate
        lookup_resp = client.get("/employees/lookup/mamujuri")
        if lookup_resp.status_code == 200:
            data = lookup_resp.json()
            self.assertIn("login_id", data)

        # Count after lookup - must NOT increase merely on lookup
        conn = db.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM employees")
        count_after = cur.fetchone()[0]
        conn.close()
        self.assertEqual(count_before, count_after, "Lookup modified employees table without enrollment!")

    def test_05_load_employee_attendance_status_for_date(self):
        # Fetch enrolled employees
        emps_resp = client.get("/employees", headers=self.sup_headers).json()
        if emps_resp:
            test_emp_id = emps_resp[0]["employee_id"]
            # Call /attendance/employee/{id}/date/{date}
            target_date = "2026-10-22"
            att_resp = client.get(f"/attendance/employee/{test_emp_id}/date/{target_date}", headers=self.sup_headers)
            self.assertEqual(att_resp.status_code, 200)
            att_data = att_resp.json()
            self.assertIn("status", att_data)
            self.assertIn("employee_id", att_data)
            self.assertIn("worked_minutes", att_data)

    def test_06_manual_attendance_override_and_audit_trail(self):
        emps_resp = client.get("/employees", headers=self.sup_headers).json()
        if not emps_resp:
            self.skipTest("No employees in database to test override")
        test_emp_id = emps_resp[0]["employee_id"]
        override_date = "2026-10-22"
        reason_text = "Device connectivity disruption; confirmed by facility manager"

        # Attempt override without reason - must fail
        bad_resp = client.post("/attendance/manual-correction", json={
            "employee_id": test_emp_id,
            "attendance_date": override_date,
            "status": "FULL_DAY",
            "first_in": "14:00:00",
            "last_out": "23:00:00",
            "worked_minutes": 540,
            "reason": "",
        }, headers=self.sup_headers)
        self.assertEqual(bad_resp.status_code, 400)

        # Valid override
        override_resp = client.post("/attendance/manual-correction", json={
            "employee_id": test_emp_id,
            "attendance_date": override_date,
            "status": "FULL_DAY",
            "first_in": "14:00:00",
            "last_out": "23:00:00",
            "worked_minutes": 540,
            "reason": reason_text,
        }, headers=self.sup_headers)
        self.assertEqual(override_resp.status_code, 200)
        res_data = override_resp.json()
        self.assertTrue(res_data.get("success"))

        # Verify audit logs record the change
        audit_resp = client.get(f"/audit/logs?target_date={override_date}", headers=self.sup_headers)
        self.assertEqual(audit_resp.status_code, 200)
        logs = audit_resp.json()
        found = any(
            log.get("target_id") == test_emp_id and
            log.get("action_type") == "MANUAL_ATTENDANCE_CORRECTION" and
            reason_text in (log.get("reason") or "")
            for log in logs
        )
        self.assertTrue(found, "Audit log did not record the manual correction!")

    def test_07_activity_date_filtering(self):
        today_str = date.today().isoformat()
        logs_resp = client.get(f"/audit/logs?target_date={today_str}", headers=self.sup_headers)
        self.assertEqual(logs_resp.status_code, 200)
        logs = logs_resp.json()
        for log in logs:
            target_date = log.get("target_date")
            ts = log.get("timestamp") or ""
            # Must match today either by target_date or timestamp date prefix
            self.assertTrue(target_date == today_str or ts.startswith(today_str),
                            f"Audit log {log} does not belong to {today_str}!")

    def test_08_hr_report_preview_does_not_send_emails(self):
        conn = db.get_connection()
        cur = conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS email_notification_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_type TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            recipient_name TEXT,
            subject TEXT NOT NULL,
            reference_id TEXT,
            target_date TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL
        )""")
        conn.commit()
        cur.execute("SELECT COUNT(*) FROM email_notification_logs")
        email_count_before = cur.fetchone()[0]
        conn.close()

        target_date = "2026-10-22"
        # 1. Preview Arrival Status Report
        arrival_preview = client.get(f"/reports/preview/arrival-status?date={target_date}")
        self.assertEqual(arrival_preview.status_code, 200)
        arr_data = arrival_preview.json()
        self.assertIsInstance(arr_data, list)

        # 2. Preview EOD Report
        eod_preview = client.get(f"/reports/preview/eod?date={target_date}")
        self.assertEqual(eod_preview.status_code, 200)
        eod_data = eod_preview.json()
        self.assertIsInstance(eod_data, list)

        # Verify NO emails were sent into email_notification_logs
        conn = db.get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM email_notification_logs")
        email_count_after = cur.fetchone()[0]
        conn.close()
        self.assertEqual(email_count_before, email_count_after, "Previewing reports triggered automated emails!")

if __name__ == "__main__":
    unittest.main()
