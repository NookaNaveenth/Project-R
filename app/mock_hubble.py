import json
import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = BASE_DIR / "data" / "mock_employees.json"
DB_FILE = BASE_DIR / "attendance.db"
router = APIRouter(prefix="/mock-hubble", tags=["Mock Hubble"])


def load_employees() -> list[dict]:
    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
            employees = []
            for item in data:
                if isinstance(item, dict) and "data" in item and isinstance(item["data"], dict):
                    merged = dict(item["data"])
                    employees.append(merged)
                elif isinstance(item, dict):
                    employees.append(item)
            return employees
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=500, detail="mock_employees.json not found"
        ) from error
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=500, detail="mock_employees.json contains invalid JSON"
        ) from error


@router.get("/employee/{login_id}")
def get_mock_employee(login_id: str):
    clean = login_id.strip().casefold()
    if not clean:
        raise HTTPException(status_code=400, detail="login_id is required")

    # 1. Search mock employees file
    try:
        employees = load_employees()
    except Exception:
        employees = []

    # First try exact match on loginId, id, or mailId
    for employee in employees:
        emp_login = str(employee.get("loginId", "")).strip().casefold()
        emp_id = str(employee.get("id", "")).strip().casefold()
        emp_mail = str(employee.get("mailId", "")).strip().casefold()
        emp_pmail = str(employee.get("personalEmail", "")).strip().casefold()
        if clean in (emp_login, emp_id, emp_mail, emp_pmail):
            return employee

    # Second try partial / prefix match on loginId, name, or email
    for employee in employees:
        emp_login = str(employee.get("loginId", "")).strip().casefold()
        emp_name = str(employee.get("name", "")).strip().casefold()
        emp_mail = str(employee.get("mailId", "")).strip().casefold()
        if (clean in emp_login) or (clean in emp_name) or (clean in emp_mail):
            return employee

    # 2. Check database for existing employee details
    if DB_FILE.exists():
        try:
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM employees
                WHERE LOWER(TRIM(login_id)) = ? OR LOWER(TRIM(employee_id)) = ? OR LOWER(TRIM(email)) = ?
            """, (clean, clean, clean))
            row = cursor.fetchone()
            conn.close()
            if row:
                d = dict(row)
                return {
                    "id": int(d["employee_id"]) if str(d["employee_id"]).isdigit() else d["employee_id"],
                    "name": d.get("employee_name") or "",
                    "mailId": d.get("email") or "",
                    "loginId": d.get("login_id") or login_id,
                    "department": d.get("department") or "",
                    "designation": d.get("designation") or "",
                    "teamName": d.get("team_name") or "",
                    "reportsTo": d.get("reports_to") or "",
                    "reportsToMailId": d.get("reports_to_mail_id") or "",
                    "hrContact": d.get("hr_contact") or d.get("reporting_hr") or "",
                    "hrEmail": d.get("hr_email") or "",
                    "work_location": d.get("work_location") or "Miracle City (HQ)",
                    "shift_start": d.get("shift_start") or "14:00",
                    "shift_end": d.get("shift_end") or "22:00",
                    "is_enrolled": bool(d.get("is_enrolled")),
                }
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="Employee not found in mock Hubble data")
