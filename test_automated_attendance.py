"""
Comprehensive Test Suite for FaceAttend:
- Organizational Hierarchy (Org -> Departments -> Assigned HR -> Assigned Employees)
- Individual Late Notifications (1-minute lateness, on-time handling, deduplication)
- Configurable Reporting Buffer (Cutoff = Shift start + Buffer, Overnight shifts)
- HR Attendance Reports (8 exact columns, missing check-in handling, snapshot preservation)
- Multi-Shift Support & Safe Execution
"""

import os
import unittest
from datetime import datetime, date, timedelta
from fastapi.testclient import TestClient

from api import app
from attendance import (
    get_connection,
    record_entry,
    record_exit,
    get_daily_summary,
    calculate_daily_summary,
    get_hr_for_employee,
    update_employee_assignment,
    calculate_shift_cutoff,
    get_distinct_shifts,
    get_shift_cutoff_attendance_reports,
    get_all_shift_cutoff_reports,
    get_hr_end_of_day_reports,
    calculate_time_difference,
)
from email_service import (
    send_late_arrival_notification,
    send_hr_attendance_report,
    is_email_already_sent,
    log_email_notification,
    get_email_logs,
)
from scheduler_service import scheduler_service

client = TestClient(app)


class AutomatedAttendanceTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Ensure database is initialized with test fixtures
        from attendance import seed_default_employees
        seed_default_employees()

    @classmethod
    def tearDownClass(cls):
        # Clean up test fixture employees so database stays clean
        conn = get_connection()
        cursor = conn.cursor()
        test_ids = ['6495', '6494', '6488', '12345', '9604', '9605', '9606', '6496', '1234', '9999', 'TEST_NIGHT']
        cursor.execute(f"DELETE FROM employees WHERE employee_id IN ({','.join(['?']*len(test_ids))})", test_ids)
        cursor.execute(f"DELETE FROM attendance_events WHERE employee_id IN ({','.join(['?']*len(test_ids))})", test_ids)
        cursor.execute(f"DELETE FROM daily_attendance WHERE employee_id IN ({','.join(['?']*len(test_ids))})", test_ids)
        conn.commit()
        conn.close()

    def setUp(self):
        self.test_date = "2026-10-21"
        self._clean_test_attendance(self.test_date)

    def tearDown(self):
        self._clean_test_attendance(self.test_date)

    def _clean_test_attendance(self, target_date: str):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM attendance_events WHERE event_date = ?", (target_date,))
        cursor.execute("DELETE FROM daily_attendance WHERE attendance_date = ?", (target_date,))
        cursor.execute("DELETE FROM email_notification_logs WHERE target_date = ?", (target_date,))
        cursor.execute("DELETE FROM scheduled_job_executions WHERE target_date = ?", (target_date,))
        cursor.execute("DELETE FROM cutoff_report_snapshots WHERE target_date = ?", (target_date,))
        conn.commit()
        conn.close()

    # ============================================================
    # TEST 1: Organizational Hierarchy & Dynamic HR Resolution
    # ============================================================
    def test_01_organizational_hierarchy(self):
        """Verify Org -> Departments -> Assigned HR -> Assigned Employees without groups."""
        conn = get_connection()
        cursor = conn.cursor()

        # 1. Verify obsolete employee_groups table has been dropped
        group_table = cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='employee_groups'"
        ).fetchone()
        self.assertIsNone(group_table, "employee_groups table must be completely dropped.")

        # 2. Check departments table has assigned HR names and organizational emails
        depts = [dict(r) for r in cursor.execute("SELECT * FROM departments").fetchall()]
        dept_map = {d["name"]: d for d in depts}
        self.assertIn("Software Services", dept_map)
        self.assertEqual(dept_map["Software Services"]["assigned_hr_name"], "Purnima Devi Kella")
        self.assertEqual(dept_map["Software Services"]["assigned_hr_email"], "kella@miraclesoft.com")

        self.assertIn("Innovation", dept_map)
        self.assertEqual(dept_map["Innovation"]["assigned_hr_name"], "Lohitha Bondi")
        self.assertEqual(dept_map["Innovation"]["assigned_hr_email"], "lhr@miraclesoft.com")

        # 3. Test dynamic HR resolution for employee via get_hr_for_employee
        emp_6495 = cursor.execute("SELECT * FROM employees WHERE employee_id = '6495'").fetchone()
        hr_info_6495 = get_hr_for_employee(dict(emp_6495))
        self.assertEqual(hr_info_6495["hr_name"], "Purnima Devi Kella")
        self.assertEqual(hr_info_6495["hr_email"], "kella@miraclesoft.com")

        emp_9605 = cursor.execute("SELECT * FROM employees WHERE employee_id = '9605'").fetchone()
        hr_info_9605 = get_hr_for_employee(dict(emp_9605))
        self.assertEqual(hr_info_9605["hr_name"], "Lohitha Bondi")
        self.assertEqual(hr_info_9605["hr_email"], "lhr@miraclesoft.com")

        conn.close()

    # ============================================================
    # TEST 2: On-Time Arrival -> No Late Email Sent
    # ============================================================
    def test_02_on_time_arrival(self):
        """Arrival at shift start (14:00) is on time; no late email is sent."""
        emp_id = "6495"  # Shift 14:00-22:00
        res = record_entry(emp_id, timestamp=f"{self.test_date} 14:00:00")
        self.assertTrue(res)

        summary = calculate_daily_summary(emp_id, target_date=self.test_date)
        self.assertTrue(summary["first_in"].startswith("14:00"))
        self.assertEqual(summary["late_minutes"], 0)
        self.assertEqual(summary["arrival_status"], "ON_TIME")

        # Check no late email was sent
        logs = get_email_logs(notification_type="LATE_ARRIVAL", status="SENT")
        matching = [l for l in logs if l["reference_id"] == emp_id and l["target_date"] == self.test_date]
        self.assertEqual(len(matching), 0, "No late arrival email should be sent for on-time arrival.")

    # ============================================================
    # TEST 3: One-Minute Lateness -> Immediate Notification
    # ============================================================
    def test_03_one_minute_lateness(self):
        """Arrival at 14:01 (1 minute late) triggers immediate email to employee, CC assigned HR."""
        emp_id = "6494"  # Shift 14:00-22:00
        res = record_entry(emp_id, timestamp=f"{self.test_date} 14:01:00")
        self.assertTrue(res)

        summary = calculate_daily_summary(emp_id, target_date=self.test_date)
        self.assertTrue(summary["first_in"].startswith("14:01"))
        self.assertEqual(summary["late_minutes"], 1)
        self.assertEqual(summary["arrival_status"], "LATE")

        # Verify email notification was logged with all required fields
        logs = get_email_logs(notification_type="LATE_ARRIVAL")
        matching = [l for l in logs if l["reference_id"] == emp_id and l["target_date"] == self.test_date]
        self.assertGreaterEqual(len(matching), 1)
        log = matching[0]
        self.assertEqual(log["status"], "SENT")
        self.assertIn("1 min", log["subject"])

    # ============================================================
    # TEST 4: Duplicate Prevention and Safe Failure Handling
    # ============================================================
    def test_04_duplicate_prevention_and_error_handling(self):
        """Send only once per attendance event; handle missing emails safely."""
        emp_id = "6488"
        self.assertFalse(is_email_already_sent("LATE_ARRIVAL", emp_id, self.test_date))

        # First delivery
        log_email_notification(
            notification_type="LATE_ARRIVAL",
            recipient_email="ikolla@miraclesoft.com",
            recipient_name="Meena",
            subject="Late Arrival (5 min late)",
            reference_id=emp_id,
            target_date=self.test_date,
            status="SENT",
        )
        self.assertTrue(is_email_already_sent("LATE_ARRIVAL", emp_id, self.test_date))

        # Subsequent call is safely suppressed
        sent_again = send_late_arrival_notification(
            employee_id=emp_id,
            employee_name="Meena",
            employee_email="ikolla@miraclesoft.com",
            department="App Dev",
            practice="App Dev",
            project="Internal",
            office_location="Miracle City (HQ)",
            shift_start="14:00",
            arrival_time="14:05",
            minutes_late=5,
            attendance_status="LATE",
            hr_name="Purnima Devi Kella",
            hr_email="kella@miraclesoft.com",
            target_date=self.test_date,
        )
        self.assertTrue(sent_again)

        # Missing email failure handling: logs failure safely
        no_email_sent = send_late_arrival_notification(
            employee_id="9999",
            employee_name="No Email User",
            employee_email="",  # missing
            department="QA",
            practice="Testing",
            project="Internal",
            office_location="Miracle City (HQ)",
            shift_start="14:00",
            arrival_time="14:10",
            minutes_late=10,
            attendance_status="LATE",
            hr_name="Purnima Devi Kella",
            hr_email="kella@miraclesoft.com",
            target_date=self.test_date,
        )
        self.assertFalse(no_email_sent)
        failed_logs = get_email_logs(status="FAILED")
        self.assertTrue(any(l["reference_id"] == "9999" for l in failed_logs))

    # ============================================================
    # TEST 5: Configurable Reporting Buffer & Overnight Shifts
    # ============================================================
    def test_05_configurable_buffer_and_overnight_shifts(self):
        """Cutoff = Shift start + buffer_minutes (default 30). Modulo wraparound for overnight shifts."""
        # Standard shift
        self.assertEqual(calculate_shift_cutoff("14:00", 30), "14:30")
        self.assertEqual(calculate_shift_cutoff("14:00", 45), "14:45")
        self.assertEqual(calculate_shift_cutoff("09:00", 15), "09:15")

        # Overnight shifts (crossing midnight)
        self.assertEqual(calculate_shift_cutoff("23:45", 30), "00:15")
        self.assertEqual(calculate_shift_cutoff("23:50", 15), "00:05")
        self.assertEqual(calculate_shift_cutoff("00:00", 30), "00:30")

    # ============================================================
    # TEST 6: HR Attendance Report at Cutoff (Exact 8 Columns)
    # ============================================================
    def test_06_hr_attendance_report_exact_columns(self):
        """HR report generated at cutoff contains exact 8 columns and handles missing check-ins."""
        # Check-ins for Purnima's employees
        record_entry("6495", timestamp=f"{self.test_date} 14:00:00")  # On-time
        record_entry("6494", timestamp=f"{self.test_date} 14:10:00")  # Late

        # Check-ins for Lohitha's employees
        record_entry("9605", timestamp=f"{self.test_date} 13:58:00")  # On-time
        record_entry("9606", timestamp=f"{self.test_date} 14:05:00")  # Late

        # Generate reports for 14:00 shift
        reports = get_shift_cutoff_attendance_reports(shift_start="14:00", target_date=self.test_date, buffer_minutes=30)
        self.assertGreaterEqual(len(reports), 2)

        purnima_rep = next(r for r in reports if "kella" in r["hr_email"].lower())
        lohitha_rep = next(r for r in reports if "lhr" in r["hr_email"].lower())

        self.assertEqual(purnima_rep["shift_start"], "14:00")
        self.assertEqual(purnima_rep["cutoff_time"], "14:30")
        self.assertGreaterEqual(len(purnima_rep["employees"]), 5)

        self.assertEqual(lohitha_rep["shift_start"], "14:00")
        self.assertEqual(lohitha_rep["cutoff_time"], "14:30")
        self.assertGreaterEqual(len(lohitha_rep["employees"]), 4)

        # Verify all 8 columns in every row
        for emp in purnima_rep["employees"] + lohitha_rep["employees"]:
            self.assertIn("id", emp)
            self.assertIn("name", emp)
            self.assertIn("department", emp)
            self.assertIn("practice", emp)
            self.assertIn("project", emp)
            self.assertIn("location", emp)
            self.assertIn("status", emp)
            self.assertIn("login_time", emp)

        # Check missing employee representation
        missing_emp = next(e for e in purnima_rep["employees"] if e["id"] == "6488")
        self.assertEqual(missing_emp["status"], "Not Checked In")
        self.assertEqual(missing_emp["login_time"], "—")

        # Test email sending formatting
        sent = send_hr_attendance_report(
            hr_name=purnima_rep["hr_name"],
            hr_email=purnima_rep["hr_email"],
            shift_start="14:00",
            cutoff_time="14:30",
            target_date=self.test_date,
            employees=purnima_rep["employees"],
            totals=purnima_rep.get("totals"),
        )
        self.assertTrue(sent)

    # ============================================================
    # TEST 7: Cutoff Report Preserved as Historical Snapshot
    # ============================================================
    def test_07_historical_snapshot_preservation(self):
        """Late arrival after cutoff updates live attendance without rewriting earlier cutoff snapshot."""
        # 1. At cutoff (14:30), employee 12345 has not checked in
        reps_at_cutoff = get_shift_cutoff_attendance_reports(shift_start="14:00", target_date=self.test_date, buffer_minutes=30)
        purnima_rep_cutoff = next(r for r in reps_at_cutoff if "kella" in r["hr_email"].lower())
        emp_12345_cutoff = next(e for e in purnima_rep_cutoff["employees"] if e["id"] == "12345")
        self.assertEqual(emp_12345_cutoff["status"], "Not Checked In")
        self.assertEqual(emp_12345_cutoff["login_time"], "—")

        # 2. Later arrival occurs at 14:45 (post-cutoff)
        record_entry("12345", timestamp=f"{self.test_date} 14:45:00")

        # 3. Live attendance record updates properly
        summary_live = calculate_daily_summary("12345", target_date=self.test_date)
        self.assertTrue(summary_live["first_in"].startswith("14:45"))
        self.assertEqual(summary_live["late_minutes"], 45)
        self.assertEqual(summary_live["arrival_status"], "LATE")

        # 4. Snapshot remains unchanged
        reps_preserved = get_shift_cutoff_attendance_reports(shift_start="14:00", target_date=self.test_date, buffer_minutes=30)
        purnima_rep_preserved = next(r for r in reps_preserved if "kella" in r["hr_email"].lower())
        emp_12345_preserved = next(e for e in purnima_rep_preserved["employees"] if e["id"] == "12345")
        self.assertEqual(emp_12345_preserved["status"], "Not Checked In", "Historical snapshot must not be rewritten.")
        self.assertEqual(emp_12345_preserved["login_time"], "—")

    # ============================================================
    # TEST 8: Multi-Shift Support
    # ============================================================
    def test_08_multi_shift_support(self):
        """Support distinct employee shift timings and report filtering."""
        # Update employee 6496 to night shift 20:00 - 04:00
        update_employee_assignment("6496", shift_start="20:00", shift_end="04:00")

        distinct_shifts = get_distinct_shifts()
        self.assertIn("14:00", distinct_shifts)
        self.assertIn("20:00", distinct_shifts)

        # Shift cutoff for 20:00 with 30 min buffer is 20:30
        self.assertEqual(calculate_shift_cutoff("20:00", 30), "20:30")

        # Report for 20:00 shift contains only 6496
        night_reports = get_shift_cutoff_attendance_reports(shift_start="20:00", target_date=self.test_date, buffer_minutes=30)
        self.assertEqual(len(night_reports), 1)
        self.assertEqual(night_reports[0]["employees"][0]["id"], "6496")

        # Revert 6496 back to 14:00
        update_employee_assignment("6496", shift_start="14:00", shift_end="22:00")

    # ============================================================
    # TEST 9: REST API Endpoints & Scheduler Control
    # ============================================================
    def test_09_api_endpoints_and_scheduler(self):
        """Verify REST APIs without groups, and scheduler execution control."""
        # 1. /groups endpoint must return 404 (removed)
        res_groups = client.get("/groups")
        self.assertEqual(res_groups.status_code, 404)

        # 2. GET /scheduler/status
        res_status = client.get("/scheduler/status")
        self.assertEqual(res_status.status_code, 200)
        status_data = res_status.json()
        self.assertIn("buffer_minutes", status_data)
        self.assertIn("cutoff_check_time", status_data)

        # 3. PUT /scheduler/config (update buffer)
        res_cfg = client.put("/scheduler/config", json={"buffer_minutes": 35})
        self.assertEqual(res_cfg.status_code, 200)
        self.assertEqual(res_cfg.json()["config"]["buffer_minutes"], 35)

        # Reset buffer to 60
        client.put("/scheduler/config", json={"buffer_minutes": 60})

        # 4. POST /scheduler/run-cutoff
        res_cutoff = client.post(f"/scheduler/run-cutoff?force=true&date={self.test_date}")
        self.assertEqual(res_cutoff.status_code, 200)
        self.assertTrue(res_cutoff.json()["ok"])

        # 5. POST /scheduler/run-eod
        res_eod = client.post(f"/scheduler/run-eod?force=true&date={self.test_date}")
        self.assertEqual(res_eod.status_code, 200)
        self.assertTrue(res_eod.json()["ok"])

        # 6. PUT /employees/6495/assignment
        res_assign = client.put(
            "/employees/6495/assignment",
            json={
                "reporting_hr": "Purnima Devi Kella",
                "work_location": "Miracle Heights",
                "department": "Software Services",
                "practice": "Cloud Services",
                "project": "Cloud Migration",
            },
        )
        self.assertEqual(res_assign.status_code, 200)
        emp = res_assign.json()["employee"]
        self.assertEqual(emp["work_location"], "Miracle Heights")
        self.assertEqual(emp["practice"], "Cloud Services")
        self.assertEqual(emp["project"], "Cloud Migration")

        # Revert location
        update_employee_assignment("6495", work_location="Miracle City (HQ)")


if __name__ == "__main__":
    unittest.main()
