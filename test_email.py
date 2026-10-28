"""
Test FaceAttend Email Notifications with CC to HR: sprathi@miraclesoft.com
1. Late Arrival Notification Email (with CC: sprathi@miraclesoft.com)
2. Shift Arrival Status Report (with CC: sprathi@miraclesoft.com)
3. End-of-Day Attendance Report (with CC: sprathi@miraclesoft.com)
"""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from email_service import (
    send_late_arrival_notification,
    send_hr_attendance_report,
    send_eod_report_email,
    get_email_logs,
)
import attendance as db

HR_NAME = "Saradhi Prathi"
HR_EMAIL = "sprathi@miraclesoft.com"
CC_EMAIL = "sprathi@miraclesoft.com"
PRIMARY_TO = os.getenv("EMAIL_SENDER", "amujurimallesh8@gmail.com")
TODAY = datetime.now().strftime("%Y-%m-%d")


def test_late_arrival():
    print("\n============================================================")
    print("1. Testing Late Arrival Notification Email (CC: sprathi@miraclesoft.com)")
    print("============================================================")
    conn = db.get_connection()
    conn.execute(
        "DELETE FROM email_notification_logs WHERE target_date = ? AND notification_type = 'LATE_ARRIVAL'",
        (TODAY,),
    )
    conn.commit()
    conn.close()

    sent = send_late_arrival_notification(
        employee_id="9614",
        employee_name="Indhu Sanapathi",
        employee_email=PRIMARY_TO,
        department="Software Services",
        practice="DAAPS",
        project="Attendance Modernization",
        office_location="Miracle City (HQ)",
        shift_start="14:00",
        arrival_time="14:35:00",
        minutes_late=35,
        attendance_status="LATE",
        hr_name=HR_NAME,
        hr_email=HR_EMAIL,
        target_date=TODAY,
        late_count=2,  # Stage 2 red progression
        cc_email=CC_EMAIL,
    )
    print(f"Late Arrival Notification sent: {sent}")
    return sent


def test_shift_cutoff_report():
    print("\n============================================================")
    print("2. Testing Shift Arrival Status Report (CC: sprathi@miraclesoft.com)")
    print("============================================================")
    conn = db.get_connection()
    conn.execute(
        "DELETE FROM email_notification_logs WHERE target_date = ? AND notification_type IN ('HR_ATTENDANCE_REPORT', 'CUTOFF_SUMMARY')",
        (TODAY,),
    )
    conn.commit()
    conn.close()

    sample_employees = [
        {
            "id": "9615",
            "name": "Nooka Naveenth Chowdari",
            "department": "Software Services",
            "practice": "DAAPS",
            "project": "Cloud Services",
            "location": "Miracle City (HQ)",
            "status": "PRESENT",
            "login_time": "13:55",
        },
        {
            "id": "9616",
            "name": "Durga Mallesh Amujuri",
            "department": "Software Services",
            "practice": "DAAPS",
            "project": "Internal",
            "location": "Miracle City (HQ)",
            "status": "PRESENT",
            "login_time": "14:00",
        },
        {
            "id": "9614",
            "name": "Indhu Sanapathi",
            "department": "Software Services",
            "practice": "DAAPS",
            "project": "Attendance Modernization",
            "location": "Miracle City (HQ)",
            "status": "LATE",
            "login_time": "14:35",
        },
        {
            "id": "9608",
            "name": "Meenamrutha Bhasyam",
            "department": "Software Services",
            "practice": "Innovation",
            "project": "FaceAttend",
            "location": "Miracle City (HQ)",
            "status": "Not Checked In",
            "login_time": "00:00",
        },
    ]

    sent = send_hr_attendance_report(
        hr_name=HR_NAME,
        hr_email=HR_EMAIL,
        shift_start="14:00",
        cutoff_time="15:00",
        target_date=TODAY,
        employees=sample_employees,
        practice="DAAPS",
        to_email=PRIMARY_TO,
        cc_email=CC_EMAIL,
    )
    print(f"Shift Arrival Status Report sent: {sent}")
    return sent


def test_eod_report():
    print("\n============================================================")
    print("3. Testing End-of-Day Attendance Report (CC: sprathi@miraclesoft.com)")
    print("============================================================")
    conn = db.get_connection()
    conn.execute(
        "DELETE FROM email_notification_logs WHERE target_date = ? AND notification_type = 'EOD_REPORT'",
        (TODAY,),
    )
    conn.commit()
    conn.close()

    sample_eod_employees = [
        {
            "employee_id": "9615",
            "employee_name": "Nooka Naveenth Chowdari",
            "shift_start": "14:00",
            "shift_end": "22:00",
            "first_in": "13:55",
            "late_minutes": 0,
            "last_out": "22:05",
            "practice": "DAAPS",
            "department": "Software Services",
            "work_location": "Miracle City (HQ)",
            "status": "PRESENT",
            "is_provisional": False,
            "worked_hours": "8h 10m",
        },
        {
            "employee_id": "9614",
            "employee_name": "Indhu Sanapathi",
            "shift_start": "14:00",
            "shift_end": "23:00",
            "first_in": "14:35",
            "late_minutes": 35,
            "last_out": "23:02",
            "practice": "DAAPS",
            "department": "Software Services",
            "work_location": "Miracle City (HQ)",
            "status": "LATE",
            "is_provisional": False,
            "worked_hours": "8h 27m",
        },
        {
            "employee_id": "9608",
            "employee_name": "Meenamrutha Bhasyam",
            "shift_start": "09:00",
            "shift_end": "17:00",
            "first_in": None,
            "late_minutes": 0,
            "last_out": None,
            "practice": "Innovation",
            "department": "Software Services",
            "work_location": "Miracle City (HQ)",
            "status": "ABSENT",
            "is_provisional": False,
            "worked_hours": "0h 0m",
        },
    ]

    sent = send_eod_report_email(
        hr_name=HR_NAME,
        hr_email=HR_EMAIL,
        target_date=TODAY,
        employees_data=sample_eod_employees,
        practice="DAAPS",
        to_email=PRIMARY_TO,
        cc_email=CC_EMAIL,
    )
    print(f"End-of-Day Attendance Report sent: {sent}")
    return sent


if __name__ == "__main__":
    print(f"Dispatching FaceAttend email tests via SMTP:")
    print(f"  Primary 'To:' : {PRIMARY_TO}")
    print(f"  Carbon Copy 'Cc:' : {CC_EMAIL}")
    print(f"  Assigned HR   : {HR_NAME} <{HR_EMAIL}>")
    print(f"  Target Date   : {TODAY}")

    r1 = test_late_arrival()
    r2 = test_shift_cutoff_report()
    r3 = test_eod_report()

    print("\n============================================================")
    print("Summary of Email Notification Logs (Latest 5 records):")
    print("============================================================")
    logs = get_email_logs(limit=5)
    for l in logs:
        print(f"ID #{l.get('id')}: [{l.get('status')}] {l.get('notification_type')} -> To: {l.get('recipient_email')} | Cc: {l.get('cc_email')} | Subject: {l.get('subject')}")

    if r1 and r2 and r3:
        print("\nAll 3 email notifications sent successfully with sprathi@miraclesoft.com CC'd!")
    else:
        print("\nWarning: One or more emails encountered an issue.")