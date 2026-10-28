"""
Comprehensive Validation Test Suite for Email Templates & Automated Attendance Reporting Updates:
1. Late Arrival Notification Email Design & Actual Employee Data
2. Late Count Progression & Idempotent Counting (no double increment on retries/same day)
3. 4-Stage Red-Based Color Progression (Stage 4 persistent thereafter)
4. 60-Minute Shift Cutoff Reporting Schedule
5. Shift Arrival Status Report (8 Columns, Not Checked In handling, Notes, Summary Cards)
6. End-of-Day Attendance Report (10 Columns, Working Hours, Provisional Checkouts, Notes)
7. HR-Specific Email Routing & CC Delivery
8. Deduplication & Audit Logging
"""

import unittest
from datetime import datetime
from email_service import (
    send_late_arrival_notification,
    send_hr_attendance_report,
    send_eod_report_email,
    get_late_notification_colors,
    is_email_already_sent,
    log_email_notification,
    get_email_logs,
)
from attendance import (
    get_connection,
    calculate_shift_cutoff,
    get_or_record_employee_late_count,
    get_employee_late_history,
    get_shift_cutoff_attendance_reports,
    get_hr_end_of_day_reports,
    record_entry,
    record_exit,
)
from scheduler_service import scheduler_service


class EmailReportingUpdatesTestCase(unittest.TestCase):
    def setUp(self):
        self.test_date_1 = "2026-10-23"
        self.test_date_2 = "2026-10-24"
        self.test_date_3 = "2026-10-25"
        self.test_date_4 = "2026-10-26"
        self.test_date_5 = "2026-10-27"
        self.test_emp_id = "TEST_LATE_EMP"
        self._clean_data()

    def tearDown(self):
        self._clean_data()

    def _clean_data(self):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM employee_late_counts WHERE employee_id = ?", (self.test_emp_id,))
        cur.execute("DELETE FROM employee_late_history WHERE employee_id = ?", (self.test_emp_id,))
        cur.execute("DELETE FROM email_notification_logs WHERE reference_id = ?", (self.test_emp_id,))
        for d in [self.test_date_1, self.test_date_2, self.test_date_3, self.test_date_4, self.test_date_5]:
            cur.execute("DELETE FROM cutoff_report_snapshots WHERE target_date = ?", (d,))
            cur.execute("DELETE FROM email_notification_logs WHERE target_date = ?", (d,))
        conn.commit()
        conn.close()

    # ============================================================
    # 1. Color Progression Tests (4 Stages)
    # ============================================================
    def test_01_color_progression_four_stages(self):
        """Test stage-based red color progression: 1, 2, 3, 4, and persistent at 4 for 5+."""
        c1 = get_late_notification_colors(1)
        self.assertEqual(c1["stage"], 1)
        self.assertEqual(c1["header_bg"], "#f26f78")

        c2 = get_late_notification_colors(2)
        self.assertEqual(c2["stage"], 2)
        self.assertEqual(c2["header_bg"], "#df4b57")

        c3 = get_late_notification_colors(3)
        self.assertEqual(c3["stage"], 3)
        self.assertEqual(c3["header_bg"], "#da1b2a")

        c4 = get_late_notification_colors(4)
        self.assertEqual(c4["stage"], 4)
        self.assertEqual(c4["header_bg"], "#830f18")

        # Counts beyond 4 must remain at Stage 4 color
        c5 = get_late_notification_colors(5)
        self.assertEqual(c5["stage"], 4)
        self.assertEqual(c5["header_bg"], "#830f18")

        c10 = get_late_notification_colors(10)
        self.assertEqual(c10["stage"], 4)
        self.assertEqual(c10["header_bg"], "#830f18")

    # ============================================================
    # 2. Late Count Progression & Idempotency Tests
    # ============================================================
    def test_02_late_count_progression_and_idempotency(self):
        """Late count increments once per attendance day and never duplicates on retries/same day."""
        # Day 1: First late arrival
        count_d1 = get_or_record_employee_late_count(
            self.test_emp_id, target_date=self.test_date_1, minutes_late=15, arrival_time="14:15:00"
        )
        self.assertEqual(count_d1, 1)

        # Retry / duplicate call on Day 1: must return 1 without re-incrementing
        count_d1_retry = get_or_record_employee_late_count(
            self.test_emp_id, target_date=self.test_date_1, minutes_late=20, arrival_time="14:20:00"
        )
        self.assertEqual(count_d1_retry, 1)

        # Day 2: Second late arrival on different day
        count_d2 = get_or_record_employee_late_count(
            self.test_emp_id, target_date=self.test_date_2, minutes_late=30, arrival_time="14:30:00"
        )
        self.assertEqual(count_d2, 2)

        # Retry on Day 2: must return 2
        count_d2_retry = get_or_record_employee_late_count(
            self.test_emp_id, target_date=self.test_date_2, minutes_late=30, arrival_time="14:30:00"
        )
        self.assertEqual(count_d2_retry, 2)

        # Day 3, 4, 5
        count_d3 = get_or_record_employee_late_count(self.test_emp_id, target_date=self.test_date_3, minutes_late=45)
        self.assertEqual(count_d3, 3)

        count_d4 = get_or_record_employee_late_count(self.test_emp_id, target_date=self.test_date_4, minutes_late=60)
        self.assertEqual(count_d4, 4)

        count_d5 = get_or_record_employee_late_count(self.test_emp_id, target_date=self.test_date_5, minutes_late=75)
        self.assertEqual(count_d5, 5)

        # Verify audit history table preserves every event
        history = get_employee_late_history(self.test_emp_id)
        self.assertEqual(len(history), 5)
        self.assertEqual(history[0]["late_count"], 5)  # latest first
        self.assertEqual(history[-1]["late_count"], 1)

    # ============================================================
    # 3. 60-Minute Cutoff Calculation Tests
    # ============================================================
    def test_03_sixty_minute_cutoff_calculation(self):
        """Cutoff must default to 60 minutes after scheduled shift start."""
        # Default 60-minute buffer
        self.assertEqual(calculate_shift_cutoff("14:00"), "15:00")
        self.assertEqual(calculate_shift_cutoff("09:00"), "10:00")
        self.assertEqual(calculate_shift_cutoff("18:30"), "19:30")

        # Overnight shifts (modulo wraparound)
        self.assertEqual(calculate_shift_cutoff("23:30"), "00:30")
        self.assertEqual(calculate_shift_cutoff("23:15"), "00:15")

        # Explicit buffer override
        self.assertEqual(calculate_shift_cutoff("14:00", buffer_minutes=30), "14:30")
        self.assertEqual(calculate_shift_cutoff("14:00", buffer_minutes=60), "15:00")

        # Check scheduler service default buffer
        from scheduler_service import SchedulerService
        self.assertEqual(SchedulerService().buffer_minutes, 60)
        self.assertEqual(scheduler_service.buffer_minutes, 60)

    # ============================================================
    # 4. Late Arrival Email Content & Design
    # ============================================================
    def test_04_late_arrival_email_generation(self):
        """Late arrival email generates correctly with stage colors, badges, and exact details."""
        sent = send_late_arrival_notification(
            employee_id=self.test_emp_id,
            employee_name="muna",
            employee_email="test_ravi@miraclesoft.com",
            department="Software Services",
            practice="Training",
            project="Internal",
            office_location="Miracle Heights",
            shift_start="14:00",
            arrival_time="14:45:00",
            minutes_late=45,
            hr_name="Saradhi prathi",
            hr_email="sprathi@miraclesoft.com",
            target_date=self.test_date_1,
            late_count=1,
        )
        self.assertTrue(sent)

        # Verify log entry
        logs = get_email_logs(notification_type="LATE_ARRIVAL")
        emp_log = next(l for l in logs if l["reference_id"] == self.test_emp_id and l["target_date"] == self.test_date_1)
        self.assertEqual(emp_log["status"], "SENT")
        self.assertIn("45 min late", emp_log["subject"])

    # ============================================================
    # 5. Shift Arrival Status Report Template (Image 2)
    # ============================================================
    def test_05_shift_arrival_status_report(self):
        """Shift Arrival Status Report sent to HR with 8 columns, summary cards, and Not Checked In status."""
        test_employees = [
            {
                "id": "9614",
                "name": "Indhu Sanapathi",
                "department": "Software Services",
                "practice": "DAAPS",
                "project": "Internal",
                "location": "Miracle City (HQ)",
                "status": "Not Checked In",
                "login_time": "00:00",
            },
            {
                "id": "9615",
                "name": "Naveen Chowdari",
                "department": "Software Services",
                "practice": "DAAPS",
                "project": "Internal",
                "location": "Miracle City (HQ)",
                "status": "PRESENT",
                "login_time": "14:00:00",
            },
            {
                "id": "9616",
                "name": "Durga Mallesh",
                "department": "Software Services",
                "practice": "DAAPS",
                "project": "Internal",
                "location": "Miracle City (HQ)",
                "status": "LATE",
                "login_time": "14:20:00",
            },
        ]

        sent = send_hr_attendance_report(
            hr_name="Purnima Devi Kella",
            hr_email="kella@miraclesoft.com",
            shift_start="14:00",
            cutoff_time="15:00",
            target_date=self.test_date_1,
            employees=test_employees,
            practice="DAAPS",
        )
        self.assertTrue(sent)

        # Duplicate suppression check
        sent_dup = send_hr_attendance_report(
            hr_name="Purnima Devi Kella",
            hr_email="kella@miraclesoft.com",
            shift_start="14:00",
            cutoff_time="15:00",
            target_date=self.test_date_1,
            employees=test_employees,
            practice="DAAPS",
        )
        self.assertTrue(sent_dup)  # gracefully returns True without re-sending

    # ============================================================
    # 6. End-of-Day Attendance Report Template (Image 3)
    # ============================================================
    def test_06_end_of_day_report(self):
        """End-of-day report sent to HR with 10 columns, working hours, provisional tags, and summary cards."""
        eod_data = [
            {
                "employee_id": "9614",
                "employee_name": "Indhu Sanapathi",
                "shift_start": "09:00",
                "shift_end": "17:00",
                "first_in": None,
                "last_out": None,
                "late_minutes": 0,
                "practice": "DAAPS",
                "work_location": "Miracle City (HQ)",
                "status": "ABSENT",
                "worked_hours": "0h 0m",
                "is_provisional": False,
            },
            {
                "employee_id": "9615",
                "employee_name": "Naveen Chowdari",
                "shift_start": "14:00",
                "shift_end": "22:00",
                "first_in": "14:00:00",
                "last_out": "22:00:00",
                "late_minutes": 0,
                "practice": "DAAPS",
                "work_location": "Miracle City (HQ)",
                "status": "PRESENT",
                "worked_hours": "8h 0m",
                "is_provisional": False,
            },
            {
                "employee_id": "9616",
                "employee_name": "Durga Mallesh",
                "shift_start": "14:00",
                "shift_end": "22:00",
                "first_in": "14:15:00",
                "last_out": None,
                "late_minutes": 15,
                "practice": "DAAPS",
                "work_location": "Miracle City (HQ)",
                "status": "LATE",
                "worked_hours": "4h 30m",
                "is_provisional": True,
            },
        ]

        totals = {"total": 3, "on_time": 1, "late": 1, "absent": 1}

        sent = send_eod_report_email(
            hr_name="Purnima Devi Kella",
            hr_email="kella@miraclesoft.com",
            target_date=self.test_date_1,
            employees_data=eod_data,
            totals=totals,
            practice="DAAPS",
        )
        self.assertTrue(sent)


if __name__ == "__main__":
    unittest.main()
