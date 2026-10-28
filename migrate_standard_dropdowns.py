"""
Migration script to standardize Department and Practice values in attendance.db.
Ensures department and practice values match the standardized options without losing employee records.
"""
import sqlite3
from pathlib import Path

DB_FILE = Path(__file__).resolve().parent / "attendance.db"

STANDARDIZED_DEPARTMENTS = [
    "Software Services",
    "Operations",
    "Sales",
    "Marketing",
]

STANDARDIZED_PRACTICES = [
    "DAAPS Integration",
    "MAPPS",
    "QA",
    "SAP",
    "Microsoft",
    "Cloud",
    "Innovation",
]

# Employee specific standardized mappings
EMPLOYEE_UPDATES = {
    "9614": {"department": "Software Services", "practice": "Cloud"},
    "9615": {"department": "Software Services", "practice": "DAAPS Integration"},
    "9616": {"department": "Operations", "practice": "MAPPS"},
    "6028": {"department": "Software Services", "practice": "Innovation"},
    "6029": {"department": "Marketing", "practice": "QA"},
    "9608": {"department": "Sales", "practice": "Microsoft"},
    "9620": {"department": "Software Services", "practice": "SAP"},
}

def migrate():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    print("Migrating employee department and practice records...")
    for emp_id, vals in EMPLOYEE_UPDATES.items():
        cur.execute(
            "UPDATE employees SET department = ?, practice = ? WHERE employee_id = ?",
            (vals["department"], vals["practice"], emp_id)
        )
        print(f"  Updated Employee {emp_id}: Dept='{vals['department']}', Practice='{vals['practice']}'")

    # Update daily_attendance practice column to match employees
    cur.execute("""
        UPDATE daily_attendance
        SET practice = (
            SELECT practice FROM employees WHERE employees.employee_id = daily_attendance.employee_id
        )
        WHERE employee_id IN (SELECT employee_id FROM employees)
    """)
    print("  Synchronized daily_attendance practice values.")

    # Ensure standardized departments exist in departments table with assigned HRs
    dept_defaults = [
        ("Software Services", "Saradhi Prathi", "sprathi@miraclesoft.com"),
        ("Operations", "Saradhi Prathi", "sprathi@miraclesoft.com"),
        ("Sales", "Lohitha Bondi", "lbondi@miraclesoft.com"),
        ("Marketing", "Lohitha Bondi", "lbondi@miraclesoft.com"),
    ]
    for dept_name, hr_name, hr_email in dept_defaults:
        cur.execute("SELECT id FROM departments WHERE LOWER(name) = LOWER(?)", (dept_name,))
        row = cur.fetchone()
        if not row:
            cur.execute(
                "INSERT INTO departments (name, assigned_hr_name, assigned_hr_email) VALUES (?, ?, ?)",
                (dept_name, hr_name, hr_email)
            )
            print(f"  Inserted department record: {dept_name}")

    conn.commit()

    # Verify results
    print("\nVerification:")
    cur.execute("SELECT employee_id, employee_name, department, practice, hr_contact FROM employees")
    for r in cur.fetchall():
        print(f"  {r['employee_id']} - {r['employee_name']}: {r['department']} | {r['practice']} (HR: {r['hr_contact']})")
        assert r["department"] in STANDARDIZED_DEPARTMENTS, f"Invalid dept: {r['department']}"
        assert r["practice"] in STANDARDIZED_PRACTICES, f"Invalid practice: {r['practice']}"

    conn.close()
    print("\nDatabase migration completed successfully!")

if __name__ == "__main__":
    migrate()
