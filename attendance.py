import sqlite3
import os
import pickle
import json
import secrets
import hashlib
import hmac
from datetime import datetime

try:
    import bcrypt
except ImportError:
    bcrypt = None

from email_service import send_arrival_email

DATABASE = os.path.join(
    os.path.dirname(
        os.path.abspath(__file__)
    ),
    "attendance.db"
)


# ============================================================
# DATABASE
# ============================================================

def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"pbkdf2_sha256$100000${salt}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or not plain_password:
        return False
    try:
        if hashed_password.startswith("pbkdf2_sha256$"):
            parts = hashed_password.split("$")
            iterations = int(parts[1])
            salt = parts[2].encode("utf-8")
            expected_key = parts[3]
            key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
            return hmac.compare_digest(key.hex(), expected_key)
        if bcrypt and (hashed_password.startswith("$2a$") or hashed_password.startswith("$2b$")):
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        return False
    except Exception:
        return False


def create_database():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            employee_id TEXT PRIMARY KEY,
            employee_name TEXT NOT NULL,
            shift_start TEXT NOT NULL,
            shift_end TEXT DEFAULT '22:00',
            email TEXT,
            login_id TEXT,
            hubble_id TEXT,
            reports_to TEXT,
            reports_to_mail_id TEXT,
            hr_contact TEXT,
            hr_email TEXT,
            department TEXT,
            designation TEXT,
            team_name TEXT,
            work_location TEXT DEFAULT 'Miracle City (HQ)',
            is_flexible_shift INTEGER DEFAULT 0,
            is_enrolled INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            event_date TEXT NOT NULL,
            event_time TEXT NOT NULL,
            event_type TEXT NOT NULL
                CHECK(event_type IN ('IN', 'OUT')),
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            attendance_date TEXT NOT NULL,
            first_in TEXT,
            last_out TEXT,
            arrival_status TEXT,
            early_minutes INTEGER DEFAULT 0,
            late_minutes INTEGER DEFAULT 0,
            worked_minutes INTEGER DEFAULT 0,
            status TEXT,
            break_minutes INTEGER DEFAULT 0,
            email_sent INTEGER DEFAULT 0,
            UNIQUE(employee_id, attendance_date)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employee_late_counts (
            employee_id TEXT PRIMARY KEY,
            cumulative_late_count INTEGER NOT NULL DEFAULT 0,
            last_late_date TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS employee_late_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            attendance_date TEXT NOT NULL,
            arrival_time TEXT,
            minutes_late INTEGER NOT NULL,
            late_count INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(employee_id, attendance_date)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leave_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT NOT NULL,
            leave_date TEXT NOT NULL,
            leave_type TEXT NOT NULL DEFAULT 'Leave',
            reason TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(employee_id, leave_date)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('superior', 'admin', 'hr')),
            department TEXT,
            display_name TEXT,
            must_change_password INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            created_by TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_username TEXT NOT NULL,
            actor_role TEXT NOT NULL,
            action_type TEXT NOT NULL,
            target_id TEXT,
            target_date TEXT,
            before_value TEXT,
            after_value TEXT,
            reason TEXT,
            timestamp TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            role TEXT NOT NULL,
            department TEXT,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_events_employee_date
        ON attendance_events(employee_id, event_date)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_events_date
        ON attendance_events(event_date)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_leave_employee_date
        ON leave_records(employee_id, leave_date)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
        ON audit_logs(actor_username, actor_role)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_users_username
        ON users(username)
    """)

    connection.commit()

    cursor.execute("PRAGMA table_info(employees)")
    employee_columns = [
        column["name"]
        for column in cursor.fetchall()
    ]

    if "shift_end" not in employee_columns:
        cursor.execute("""
            ALTER TABLE employees
            ADD COLUMN shift_end TEXT DEFAULT '22:00'
        """)

    hubble_columns = {
        "login_id": "TEXT",
        "hubble_id": "TEXT",
        "reports_to": "TEXT",
        "reports_to_mail_id": "TEXT",
        "hr_contact": "TEXT",
        "hr_email": "TEXT",
        "department": "TEXT",
        "designation": "TEXT",
        "team_name": "TEXT",
        "work_location": "TEXT DEFAULT 'Miracle City (HQ)'",
        "is_flexible_shift": "INTEGER DEFAULT 0",
        "group_name": "TEXT DEFAULT 'Group 1'",
        "reporting_hr": "TEXT",
    }

    for column_name, column_type in hubble_columns.items():
        if column_name not in employee_columns:
            cursor.execute(
                f"ALTER TABLE employees ADD COLUMN {column_name} {column_type}"
            )
            employee_columns.append(column_name)

    if "is_enrolled" not in employee_columns:
        cursor.execute("ALTER TABLE employees ADD COLUMN is_enrolled INTEGER DEFAULT 0")
        employee_columns.append("is_enrolled")

    # Sync existing employees with valid face embeddings to is_enrolled = 1
    emb_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "embeddings", "face_embeddings.pkl")
    if os.path.exists(emb_file):
        try:
            with open(emb_file, "rb") as ef:
                loaded_embs = pickle.load(ef)
                if isinstance(loaded_embs, dict) and loaded_embs:
                    for eid in loaded_embs.keys():
                        cursor.execute("UPDATE employees SET is_enrolled = 1 WHERE employee_id = ?", (str(eid).strip(),))
        except Exception:
            pass
    connection.commit()

    cursor.execute("PRAGMA table_info(daily_attendance)")
    daily_columns = [col["name"] for col in cursor.fetchall()]
    daily_extra_columns = {
        "status": "TEXT",
        "break_minutes": "INTEGER DEFAULT 0",
        "group_name": "TEXT DEFAULT 'Group 1'",
        "reporting_hr": "TEXT",
        "hr_email": "TEXT",
        "shift_start": "TEXT",
        "shift_end": "TEXT",
        "practice": "TEXT",
        "work_location": "TEXT",
        "is_provisional": "INTEGER DEFAULT 1",
    }
    for col_name, col_type in daily_extra_columns.items():
        if col_name not in daily_columns:
            cursor.execute(f"ALTER TABLE daily_attendance ADD COLUMN {col_name} {col_type}")

    # Remove obsolete employee groups table
    cursor.execute("DROP TABLE IF EXISTS employee_groups")

    # Ensure departments table has assigned HR columns
    cursor.execute("PRAGMA table_info(departments)")
    dept_cols = {col[1] for col in cursor.fetchall()}
    if "assigned_hr_name" not in dept_cols:
        cursor.execute("ALTER TABLE departments ADD COLUMN assigned_hr_name TEXT")
    if "assigned_hr_email" not in dept_cols:
        cursor.execute("ALTER TABLE departments ADD COLUMN assigned_hr_email TEXT")

    # Ensure employees table has project and practice columns
    cursor.execute("PRAGMA table_info(employees)")
    emp_cols = {col[1] for col in cursor.fetchall()}
    if "project" not in emp_cols:
        cursor.execute("ALTER TABLE employees ADD COLUMN project TEXT")
    if "practice" not in emp_cols:
        cursor.execute("ALTER TABLE employees ADD COLUMN practice TEXT")
    if "sub_practice" not in emp_cols:
        cursor.execute("ALTER TABLE employees ADD COLUMN sub_practice TEXT")

    # Ensure users table has email column
    cursor.execute("PRAGMA table_info(users)")
    user_cols = {col[1] for col in cursor.fetchall()}
    if "email" not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN email TEXT")

    # Create email notification logs table for deduplication and retry tracking
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_notification_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_type TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            recipient_name TEXT,
            subject TEXT NOT NULL,
            reference_id TEXT,
            target_date TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('SENT', 'FAILED', 'PENDING')),
            error_message TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # Create scheduled job executions table for idempotent scheduler runs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scheduled_job_executions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_name TEXT NOT NULL,
            target_date TEXT NOT NULL,
            status TEXT NOT NULL,
            executed_at TEXT NOT NULL,
            details TEXT,
            UNIQUE(job_name, target_date)
        )
    """)

    # Seed departments
    # Seed departments with their assigned HR
    initial_departments = [
        ("Software Services", "Purnima Devi Kella", "kella@miraclesoft.com"),
        ("App Dev", "Purnima Devi Kella", "kella@miraclesoft.com"),
        ("Human Resources", "Purnima Devi Kella", "kella@miraclesoft.com"),
        ("Innovation", "Lohitha Bondi", "lhr@miraclesoft.com"),
        ("DAAPS", "Lohitha Bondi", "lhr@miraclesoft.com"),
        ("Daapps", "Lohitha Bondi", "lhr@miraclesoft.com"),
        ("MAPPS", "Lohitha Bondi", "lhr@miraclesoft.com"),
        ("Software Training", "Purnima Devi Kella", "kella@miraclesoft.com"),
        ("Quality Assurance", "Lohitha Bondi", "lhr@miraclesoft.com"),
        ("Operations", "Lohitha Bondi", "lhr@miraclesoft.com"),
        ("Delivery", "Purnima Devi Kella", "kella@miraclesoft.com"),
    ]
    for dname, hrname, hremail in initial_departments:
        cursor.execute("INSERT OR IGNORE INTO departments (name) VALUES (?)", (dname,))
        cursor.execute("""
            UPDATE departments
            SET assigned_hr_name = COALESCE(NULLIF(assigned_hr_name, ''), ?),
                assigned_hr_email = COALESCE(NULLIF(assigned_hr_email, ''), ?)
            WHERE name = ?
        """, (hrname, hremail, dname))

    cursor.execute("SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department != ''")
    for row in cursor.fetchall():
        cursor.execute("INSERT OR IGNORE INTO departments (name) VALUES (?)", (row[0],))

    # Seed default users if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        now_str = datetime.now().isoformat()
        sup_pass = os.getenv("SUPERIOR_PASSWORD", "superior123")
        sup_hash = hash_password(sup_pass)
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, department, display_name, must_change_password, created_at, created_by, email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ("superior", sup_hash, "superior", "ALL", "Executive Superior", 0, now_str, "SYSTEM", "superior@miraclesoft.com"))

        adm_pass = os.getenv("ADMIN_PASSWORD", "admin123")
        adm_hash = hash_password(adm_pass)
        cursor.execute("""
            INSERT INTO users (username, password_hash, role, department, display_name, must_change_password, created_at, created_by, email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ("admin", adm_hash, "admin", "ALL", "System Administrator", 0, now_str, "SYSTEM", "admin@miraclesoft.com"))

        hr_pass = os.getenv("HR_PASSWORD", "hr123")
        hr_hash = hash_password(hr_pass)
        default_hrs = [
            ("hr", "Software Services", "HR Manager (Software Services)", "kella@miraclesoft.com"),
            ("purnima", "Human Resources", "HR Manager (Human Resources)", "kella@miraclesoft.com"),
            ("hr_innovation", "Innovation", "HR Manager (Innovation)", "lhr@miraclesoft.com"),
            ("hr_daapps", "Daapps", "HR Manager (DAAPS)", "lhr@miraclesoft.com"),
            ("hr_mapps", "MAPPS", "HR Manager (MAPPS)", "lhr@miraclesoft.com"),
            ("hr_training", "Software Training", "HR Manager (Software Training)", "kella@miraclesoft.com"),
            ("sprathi", "Software Services", "Saradhi Prathi", "sprathi@miraclesoft.com"),
            ("lbondi", "Innovation", "Lohitha Bondi", "lbondi@miraclesoft.com"),
            ("manasa", "Software Services", "Manasa", "manasa@miraclesoft.com"),
        ]
        for u, d, dn, em in default_hrs:
            cursor.execute("""
                INSERT OR IGNORE INTO users (username, password_hash, role, department, display_name, must_change_password, created_at, created_by, email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (u, hr_hash, "hr", d, dn, 0, now_str, "SYSTEM", em))

    # Ensure default user hashes are valid if they were seeded with older dummy strings
    default_logins = [
        ("superior", "superior123"),
        ("admin", "admin123"),
        ("hr", "hr123"),
        ("purnima", "hr123"),
        ("hr_innovation", "hr123"),
        ("hr_daapps", "hr123"),
        ("hr_mapps", "hr123"),
        ("hr_training", "hr123"),
        ("sprathi", "hr123"),
        ("lbondi", "hr123"),
        ("manasa", "hr123"),
    ]
    for usr, pwd in default_logins:
        cursor.execute("SELECT password_hash FROM users WHERE username = ?", (usr,))
        row = cursor.fetchone()
        if row and not verify_password(pwd, row[0]):
            cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (hash_password(pwd), usr))

    connection.commit()
    connection.close()


def seed_default_employees():
    """
    Seed default employees helper (no-op in database-driven mode to preserve database integrity).
    """
    pass


# ============================================================
# USER & AUDIT MANAGEMENT
# ============================================================

def map_designation_to_role(designation: str) -> str | None:
    if not designation:
        return None
    d = str(designation).strip().lower()
    if any(k in d for k in ("superior", "director", "vice president", "vp", "chief", "executive", "ceo", "coo", "cto")):
        return "superior"
    if any(k in d for k in ("administrator", "admin", "system admin", "sysadmin")):
        return "admin"
    if any(k in d for k in ("hr", "human resource", "talent", "people ops", "recruiter")):
        return "hr"
    return None


def get_user_by_username(username: str):
    if not username:
        return None
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("""
        SELECT id, username, password_hash, role, department, display_name, email, must_change_password, created_at, created_by
        FROM users WHERE LOWER(username) = LOWER(?)
    """, (username.strip(),))
    row = cursor.fetchone()
    if not row:
        # Check if username matches an employee login_id or employee_id linked to a user
        cursor.execute("""
            SELECT u.id, u.username, u.password_hash, u.role, u.department, u.display_name, u.email, u.must_change_password, u.created_at, u.created_by
            FROM employees e
            JOIN users u ON LOWER(u.username) = LOWER(e.login_id) OR LOWER(u.username) = LOWER(e.employee_id)
            WHERE LOWER(e.login_id) = LOWER(?) OR LOWER(e.employee_id) = LOWER(?)
        """, (username.strip(), username.strip()))
        row = cursor.fetchone()
    connection.close()
    if not row:
        return None
    user_dict = dict(row)
    if not user_dict.get("role"):
        mapped = map_designation_to_role(user_dict.get("display_name") or "")
        user_dict["role"] = mapped or "hr"
    return user_dict


def get_hr_assigned_employee_ids(user: dict | None) -> list[str] | None:
    """
    Returns the list of employee_ids assigned to the given user if the user is HR.
    Returns None if the user is Admin, Superior, or no HR restriction applies.
    """
    if not user:
        return None
    role = str(user.get("role", "")).strip().lower()
    if role in ("admin", "superior"):
        return None  # Full organization-wide access for Admin and Superior

    if role != "hr":
        return []

    # HR User: identify through username, display_name, email, or department
    username = str(user.get("username") or "").strip()
    display_name = str(user.get("display_name") or "").strip()
    email = str(user.get("email") or "").strip()
    department = str(user.get("department") or "").strip()

    name_keys = set()
    if username:
        name_keys.add(username.lower())
    if display_name:
        name_keys.add(display_name.lower())

    conn = get_connection()
    cursor = conn.cursor()
    if department and department.upper() != "ALL":
        cursor.execute("SELECT assigned_hr_name, assigned_hr_email FROM departments WHERE LOWER(name) = LOWER(?)", (department,))
        dept_row = cursor.fetchone()
        if dept_row:
            if dept_row["assigned_hr_name"]:
                name_keys.add(dept_row["assigned_hr_name"].strip().lower())
            if dept_row["assigned_hr_email"] and not email:
                email = dept_row["assigned_hr_email"].strip()

    cursor.execute("""
        SELECT employee_id, employee_name, hr_contact, reporting_hr, hr_email, department, practice
        FROM employees
    """)
    rows = cursor.fetchall()
    conn.close()

    matched_ids = []
    user_email_lower = email.lower() if email else ""

    for r in rows:
        eid = str(r["employee_id"])
        hr_c = (r["hr_contact"] or "").strip().lower()
        rep_hr = (r["reporting_hr"] or "").strip().lower()
        hr_m = (r["hr_email"] or "").strip().lower()

        # 1. Direct or substring match on hr_contact or reporting_hr
        if (hr_c and any(k == hr_c or (len(k) > 3 and k in hr_c) or (len(hr_c) > 3 and hr_c in k) for k in name_keys)) or \
           (rep_hr and any(k == rep_hr or (len(k) > 3 and k in rep_hr) or (len(rep_hr) > 3 and rep_hr in k) for k in name_keys)):
            matched_ids.append(eid)
            continue

        # 2. Match on email
        if user_email_lower and hr_m and (user_email_lower == hr_m or hr_m.startswith(username.lower() + "@")):
            matched_ids.append(eid)
            continue
        if username and hr_m and hr_m.startswith(username.lower() + "@"):
            matched_ids.append(eid)
            continue

        # 3. Match on username initial pattern: e.g. "sprathi" matches "Saradhi Prathi"
        if username and hr_c:
            parts = hr_c.split()
            if len(parts) >= 2:
                initial_alias = (parts[0][0] + parts[-1]).lower()
                if initial_alias == username.lower():
                    matched_ids.append(eid)
                    continue

    return matched_ids


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

PRACTICE_NORMALIZATION_MAP = {
    "daaps": "DAAPS Integration",
    "daapps": "DAAPS Integration",
    "daaps integration": "DAAPS Integration",
    "mapps": "MAPPS",
    "qa": "QA",
    "quality assurance": "QA",
    "testing": "QA",
    "sap": "SAP",
    "microsoft": "Microsoft",
    "cloud": "Cloud",
    "cloud services": "Cloud",
    "cloud & devops": "Cloud",
    "innovation": "Innovation",
}

DEPARTMENT_NORMALIZATION_MAP = {
    "software services": "Software Services",
    "software training": "Software Services",
    "training": "Software Services",
    "app dev": "Software Services",
    "delivery": "Software Services",
    "it support": "Software Services",
    "operations": "Operations",
    "human resources": "Operations",
    "hr": "Operations",
    "sales": "Sales",
    "marketing": "Marketing",
    "sales & marketing": "Marketing",
    "finance": "Operations",
    "finance & accounts": "Operations",
}

def normalize_department(dept: str | None) -> str:
    if not dept:
        return "Software Services"
    d_clean = dept.strip()
    return DEPARTMENT_NORMALIZATION_MAP.get(d_clean.lower(), d_clean if d_clean in STANDARDIZED_DEPARTMENTS else "Software Services")

def normalize_practice(prac: str | None) -> str:
    if not prac:
        return "Innovation"
    p_clean = prac.strip()
    return PRACTICE_NORMALIZATION_MAP.get(p_clean.lower(), p_clean if p_clean in STANDARDIZED_PRACTICES else "Innovation")


def get_practices_for_user(user: dict | None) -> list[str]:
    """
    Returns available practices for the user.
    Wherever a practice dropdown appears, it must contain the seven standardized practice options.
    """
    return list(STANDARDIZED_PRACTICES)



def is_employee_accessible_by_user(employee_id: str, user: dict | None) -> bool:
    """Checks whether the user is authorized to access the given employee record."""
    if not user:
        return True
    role = str(user.get("role", "")).strip().lower()
    if role in ("admin", "superior"):
        return True
    if role != "hr":
        return False
    assigned_ids = get_hr_assigned_employee_ids(user)
    if assigned_ids is None:
        return True
    return str(employee_id) in assigned_ids



def create_user(username: str, password: str, role: str, department: str = None, display_name: str = None, must_change_password: int = 0, created_by: str = None):
    username = username.strip()
    role = role.strip().lower()
    if role not in ("superior", "admin", "hr"):
        raise ValueError("Invalid role. Must be superior, admin, or hr.")
    if not username:
        raise ValueError("Username cannot be empty.")
    if not password or len(password) < 4:
        raise ValueError("Password must be at least 4 characters long.")

    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    if cursor.fetchone():
        connection.close()
        raise ValueError(f"User '{username}' already exists.")

    password_hash = hash_password(password)
    now_str = datetime.now().isoformat()
    cursor.execute("""
        INSERT INTO users (username, password_hash, role, department, display_name, must_change_password, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        username,
        password_hash,
        role,
        department.strip() if department else ("ALL" if role != "hr" else None),
        display_name.strip() if display_name else username,
        1 if must_change_password else 0,
        now_str,
        created_by,
    ))
    user_id = cursor.lastrowid
    connection.commit()
    connection.close()

    create_audit_log(
        actor_username=created_by or "SYSTEM",
        actor_role="superior" if role == "admin" else ("admin" if role == "hr" else "system"),
        action_type=f"CREATE_{role.upper()}",
        target_id=username,
        reason=f"Account created for role {role} (department: {department or 'ALL'})",
    )
    return get_user_by_username(username)


def update_user_password(username: str, new_password: str, actor_username: str = None):
    if not new_password or len(new_password) < 4:
        raise ValueError("New password must be at least 4 characters long.")
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT id, username, role FROM users WHERE LOWER(username) = LOWER(?)", (username.strip(),))
    user = cursor.fetchone()
    if not user:
        connection.close()
        raise ValueError(f"User '{username}' not found.")

    new_hash = hash_password(new_password)
    cursor.execute("""
        UPDATE users
        SET password_hash = ?, must_change_password = 0
        WHERE id = ?
    """, (new_hash, user["id"]))
    connection.commit()
    connection.close()

    create_audit_log(
        actor_username=actor_username or username,
        actor_role=user["role"],
        action_type="PASSWORD_CHANGE",
        target_id=username,
        reason="Password updated successfully",
    )
    return True


def list_users(role: str = None, department: str = None, created_date: str = None):
    connection = get_connection()
    cursor = connection.cursor()
    query = """
        SELECT id, username, role, department, display_name, must_change_password, created_at, created_by
        FROM users WHERE 1=1
    """
    params = []
    if role:
        query += " AND LOWER(role) = LOWER(?)"
        params.append(role.strip())
    if department and department.upper() != "ALL":
        query += " AND LOWER(department) = LOWER(?)"
        params.append(department.strip())
    if created_date:
        query += " AND DATE(created_at) = DATE(?)"
        params.append(created_date.strip())
    query += " ORDER BY id ASC"
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    connection.close()
    return [dict(row) for row in rows]


def create_audit_log(
    actor_username: str,
    actor_role: str,
    action_type: str,
    target_id: str = None,
    target_date: str = None,
    before_value: str = None,
    after_value: str = None,
    reason: str = None,
    target_employee_id: str = None,
    details: str = None,
):
    connection = get_connection()
    cursor = connection.cursor()
    final_target = target_id or target_employee_id or ""
    final_reason = reason or details or ""
    cursor.execute("""
        INSERT INTO audit_logs (actor_username, actor_role, action_type, target_id, target_date, before_value, after_value, reason, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        actor_username,
        actor_role,
        action_type,
        final_target,
        target_date,
        before_value,
        after_value,
        final_reason,
        datetime.now().isoformat(),
    ))
    connection.commit()
    connection.close()


def get_audit_logs(limit: int = 200, actor_role: str = None, action_type: str = None, target_date: str = None):
    connection = get_connection()
    cursor = connection.cursor()
    query = "SELECT id, actor_username, actor_role, action_type, target_id, target_date, before_value, after_value, reason, timestamp FROM audit_logs WHERE 1=1"
    params = []
    if actor_role:
        query += " AND LOWER(actor_role) = LOWER(?)"
        params.append(actor_role.strip())
    if action_type:
        query += " AND LOWER(action_type) = LOWER(?)"
        params.append(action_type.strip())
    if target_date:
        query += " AND (target_date = ? OR timestamp LIKE ?)"
        params.extend([target_date.strip(), f"{target_date.strip()}%"])
    query += f" ORDER BY id DESC LIMIT {int(limit)}"
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    connection.close()
    return [dict(row) for row in rows]


def create_session(username: str, role: str, department: str = None) -> str:
    token = secrets.token_hex(32)
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO user_sessions (token, username, role, department, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (token, username, role, department, datetime.now().isoformat()))
    connection.commit()
    connection.close()
    return token


def get_session(token: str):
    if not token:
        return None
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("""
        SELECT token, username, role, department, created_at
        FROM user_sessions WHERE token = ?
    """, (token,))
    row = cursor.fetchone()
    connection.close()
    return dict(row) if row else None


def delete_session(token: str):
    if not token:
        return
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
    connection.commit()
    connection.close()


def get_departments_list():
    return list(STANDARDIZED_DEPARTMENTS)


def get_practices_list():
    return list(STANDARDIZED_PRACTICES)



# ============================================================
# EMPLOYEE MANAGEMENT
# ============================================================

def is_flexible_shift_employee(employee_or_designation, is_flexible_shift=None):
    if employee_or_designation is None:
        return bool(is_flexible_shift)
    if isinstance(employee_or_designation, (dict, sqlite3.Row)):
        employee = employee_or_designation
        try:
            if bool(employee["is_flexible_shift"]):
                return True
        except Exception:
            pass
        designation = str(employee["designation"] if "designation" in employee.keys() else "").lower()
        shift_start = str(employee["shift_start"] if "shift_start" in employee.keys() else "").lower()
        shift_end = str(employee["shift_end"] if "shift_end" in employee.keys() else "").lower()
        if shift_start == "flexible" or shift_end == "flexible":
            return True
    else:
        designation = str(employee_or_designation or "").lower()
        if bool(is_flexible_shift):
            return True

    director_keywords = ["director", "managing director", "associate director", "executive director", "vp", "vice president", "chief", "president", "head of", "cxo"]
    for keyword in director_keywords:
        if keyword in designation:
            return True
    return False


def calculate_attendance_status(worked_minutes, is_leave=False, is_weekend=False):
    if is_weekend:
        return "WEEKEND"
    if is_leave:
        return "LEAVE"
    worked_minutes = int(worked_minutes or 0)
    if worked_minutes < 240:
        return "ABSENT"
    elif worked_minutes <= 450:
        return "HALF_DAY"
    else:
        return "FULL_DAY"


def calculate_break_minutes(sessions, shift_start, shift_end, worked_minutes, is_flexible=False):
    if not sessions or worked_minutes <= 0:
        return 0
    if is_flexible:
        break_mins = 0
        sorted_sessions = sorted(sessions, key=lambda s: s.get("check_in") or "")
        for i in range(len(sorted_sessions) - 1):
            s1_out = sorted_sessions[i].get("check_out")
            s2_in = sorted_sessions[i + 1].get("check_in")
            if s1_out and s2_in:
                gap = calculate_time_difference(s1_out, s2_in)
                break_mins += gap
        return max(0, break_mins)
    else:
        sched_mins = _scheduled_shift_minutes(shift_start, shift_end)
        if sched_mins <= 0:
            sched_mins = 480
        return max(0, sched_mins - worked_minutes)


def add_employee(
    employee_id,
    employee_name,
    shift_start,
    email,
    shift_end="22:00",
    login_id=None,
    hubble_id=None,
    reports_to=None,
    reports_to_mail_id=None,
    hr_contact=None,
    hr_email=None,
    department=None,
    designation=None,
    team_name=None,
    work_location="Miracle City (HQ)",
    is_flexible_shift=0,
    reporting_hr=None,
    practice=None,
    project=None,
    group_name=None,
    is_enrolled=None,
):
    connection = get_connection()
    cursor = connection.cursor()

    if is_enrolled is not None:
        final_enrolled = 1 if is_enrolled else 0
    else:
        cursor.execute("SELECT is_enrolled FROM employees WHERE employee_id = ?", (str(employee_id).strip(),))
        existing_row = cursor.fetchone()
        if existing_row and existing_row["is_enrolled"] is not None:
            final_enrolled = existing_row["is_enrolled"]
        else:
            final_enrolled = 1

    cursor.execute("""
        INSERT OR REPLACE INTO employees
        (
            employee_id,
            employee_name,
            shift_start,
            shift_end,
            email,
            login_id,
            hubble_id,
            reports_to,
            reports_to_mail_id,
            hr_contact,
            hr_email,
            department,
            designation,
            team_name,
            work_location,
            is_flexible_shift,
            reporting_hr,
            practice,
            project,
            is_enrolled
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        employee_id,
        employee_name,
        shift_start,
        shift_end,
        email,
        login_id,
        hubble_id,
        reports_to,
        reports_to_mail_id,
        hr_contact or reporting_hr,
        hr_email,
        department,
        designation,
        team_name,
        work_location or "Miracle City (HQ)",
        1 if is_flexible_shift else 0,
        reporting_hr or hr_contact,
        practice or department,
        project or "Internal",
        final_enrolled,
    ))

    connection.commit()
    connection.close()

    print(
        f"Employee {employee_id} added successfully."
    )


def set_employee_enrolled(employee_id: str, is_enrolled: int = 1):
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("UPDATE employees SET is_enrolled = ? WHERE TRIM(employee_id) = TRIM(?)", (1 if is_enrolled else 0, str(employee_id).strip()))
    connection.commit()
    connection.close()


def get_employee_by_login_id(login_id: str):
    if not login_id:
        return None
    connection = get_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM employees WHERE LOWER(login_id) = LOWER(?)", (str(login_id).strip(),))
    row = cursor.fetchone()
    connection.close()
    return dict(row) if row else None


def get_employee(employee_id):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            employee_id,
            employee_name,
            shift_start,
            shift_end,
            email,
            login_id,
            hubble_id,
            reports_to,
            reports_to_mail_id,
            hr_contact,
            hr_email,
            department,
            designation,
            team_name,
            work_location,
            is_flexible_shift,
            reporting_hr,
            practice,
            project,
            is_enrolled
        FROM employees
        WHERE employee_id = ?
    """, (employee_id,))

    employee = cursor.fetchone()

    connection.close()

    return dict(employee) if employee else None


# ============================================================
# DELETE EMPLOYEE COMPLETELY
# ============================================================

def delete_employee(employee_id):
    """
    Delete employee and all related attendance data.
    """

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT employee_id
        FROM employees
        WHERE employee_id = ?
    """, (employee_id,))

    employee = cursor.fetchone()

    if employee is None:
        connection.close()
        return False

    cursor.execute("""
        DELETE FROM attendance_events
        WHERE employee_id = ?
    """, (employee_id,))

    cursor.execute("""
        DELETE FROM daily_attendance
        WHERE employee_id = ?
    """, (employee_id,))

    cursor.execute("""
        DELETE FROM leave_records
        WHERE employee_id = ?
    """, (employee_id,))

    cursor.execute("""
        DELETE FROM employees
        WHERE employee_id = ?
    """, (employee_id,))

    connection.commit()
    connection.close()

    return True


# ============================================================
# DELETE ATTENDANCE BY DATE
# ============================================================

def delete_attendance_by_date(attendance_date):
    """
    Delete attendance events and summaries for one date.

    Employee details are NOT deleted.
    Face embeddings are NOT deleted.
    """

    try:
        datetime.strptime(
            attendance_date,
            "%Y-%m-%d"
        )
    except ValueError:
        raise ValueError(
            "Invalid date format. Use YYYY-MM-DD."
        )

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        DELETE FROM attendance_events
        WHERE event_date = ?
    """, (attendance_date,))

    events_deleted = cursor.rowcount

    cursor.execute("""
        DELETE FROM daily_attendance
        WHERE attendance_date = ?
    """, (attendance_date,))

    summaries_deleted = cursor.rowcount

    cursor.execute("""
        DELETE FROM leave_records
        WHERE leave_date = ?
    """, (attendance_date,))

    leaves_deleted = cursor.rowcount

    connection.commit()
    connection.close()

    return {
        "date": attendance_date,
        "events_deleted": events_deleted,
        "summaries_deleted": summaries_deleted,
        "leaves_deleted": leaves_deleted,
    }


# ============================================================
# TIME HELPERS
# ============================================================

def get_today():
    return datetime.now().strftime("%Y-%m-%d")


def get_current_time():
    return datetime.now().strftime("%H:%M:%S")


def time_to_minutes(time_string):
    if not time_string or ":" not in str(time_string):
        return 0
    parts = str(time_string).split(":")
    try:
        hour = int(parts[0])
        minute = int(parts[1])
        return hour * 60 + minute
    except (ValueError, IndexError):
        return 0


def calculate_time_difference(
    start_time,
    end_time
):
    start = time_to_minutes(start_time)
    end = time_to_minutes(end_time)

    if end < start:
        # Handles overnight shifts crossing midnight (e.g. 18:00 to 01:00)
        return (end + 1440) - start

    return end - start


# ============================================================
# ARRIVAL STATUS
# ============================================================

def calculate_arrival_status(
    first_in,
    shift_start
):
    arrival_minutes = time_to_minutes(
        first_in
    )

    shift_minutes = time_to_minutes(
        shift_start
    )

    difference = arrival_minutes - shift_minutes

    if difference < 0:
        return (
            "EARLY",
            abs(difference),
            0
        )

    if difference > 0:
        return (
            "LATE",
            0,
            difference
        )

    return (
        "ON_TIME",
        0,
        0
    )


# ============================================================
# EVENTS
# ============================================================

def get_today_events(employee_id):

    today = get_today()

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            employee_id,
            event_date,
            event_time,
            event_type,
            created_at
        FROM attendance_events
        WHERE employee_id = ?
        AND event_date = ?
        ORDER BY event_time ASC, id ASC
    """, (
        employee_id,
        today
    ))

    events = cursor.fetchall()

    connection.close()

    return events


def get_events_by_date(
    employee_id,
    attendance_date
):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            id,
            employee_id,
            event_date,
            event_time,
            event_type,
            created_at
        FROM attendance_events
        WHERE employee_id = ?
        AND event_date = ?
        ORDER BY event_time ASC, id ASC
    """, (
        employee_id,
        attendance_date
    ))

    events = cursor.fetchall()

    connection.close()

    return events


def get_employee_events(
    employee_id,
    attendance_date=None
):
    connection = get_connection()
    cursor = connection.cursor()

    if attendance_date:

        cursor.execute("""
            SELECT
                id,
                employee_id,
                event_date,
                event_time,
                event_type,
                created_at
            FROM attendance_events
            WHERE employee_id = ?
            AND event_date = ?
            ORDER BY event_time ASC, id ASC
        """, (
            employee_id,
            attendance_date
        ))

    else:

        cursor.execute("""
            SELECT
                id,
                employee_id,
                event_date,
                event_time,
                event_type,
                created_at
            FROM attendance_events
            WHERE employee_id = ?
            ORDER BY
                event_date DESC,
                event_time DESC,
                id DESC
        """, (
            employee_id
        ))

    events = cursor.fetchall()

    connection.close()

    return events


# ============================================================
# CURRENT STATE
# ============================================================

def get_current_state(employee_id, target_date=None):
    if target_date:
        events = get_events_by_date(employee_id, target_date)
    else:
        events = get_today_events(employee_id)

    if not events:
        return "OUTSIDE"

    last_event = events[-1]

    if last_event["event_type"] == "IN":
        return "INSIDE"

    return "OUTSIDE"


def get_first_in(employee_id, target_date=None):
    if target_date:
        events = get_events_by_date(employee_id, target_date)
    else:
        events = get_today_events(employee_id)

    for event in events:
        if event["event_type"] == "IN":
            return event["event_time"]

    return None


# ============================================================
# EMAIL
# ============================================================

def send_arrival_notification(
    employee,
    first_in,
    status,
    early_minutes,
    late_minutes,
    target_date=None,
):
    if not employee.get("email"):
        print(
            "Employee email is not configured."
        )
        return False

    if not target_date:
        target_date = get_today()

    if status == "LATE" and late_minutes >= 1:
        from email_service import send_late_arrival_notification

        late_count = get_or_record_employee_late_count(
            employee_id=employee["employee_id"],
            target_date=target_date,
            minutes_late=late_minutes,
            arrival_time=first_in,
            increment_if_new=True,
        )

        department = employee.get("department") or ""
        practice = employee.get("practice") or "Innovation"
        project = employee.get("project") or employee.get("team_name") or practice or "General"
        location = employee.get("work_location") or "Miracle City (HQ)"
        hr_info = get_hr_for_employee(employee)
        hr_name = hr_info.get("hr_name")
        hr_email = hr_info.get("hr_email")

        return send_late_arrival_notification(
            employee_id=employee["employee_id"],
            employee_name=employee["employee_name"],
            employee_email=employee["email"],
            department=department,
            practice=practice,
            project=project,
            shift_start=employee["shift_start"],
            arrival_time=first_in,
            minutes_late=late_minutes,
            attendance_status="LATE",
            office_location=location,
            hr_name=hr_name,
            hr_email=hr_email,
            target_date=target_date,
            late_count=late_count,
        )

    return False


# ============================================================
# RECORD ENTRY
# ============================================================

def record_entry(
    employee_id,
    event_time=None,
    event_date=None,
    timestamp=None,
):
    if timestamp:
        try:
            parts = str(timestamp).strip().split()
            if len(parts) == 2:
                event_date = parts[0]
                event_time = parts[1]
            elif len(parts) == 1:
                if "-" in parts[0]:
                    event_date = parts[0]
                else:
                    event_time = parts[0]
        except Exception:
            pass

    employee = get_employee(
        employee_id
    )

    if employee is None:

        print(
            "Employee not found."
        )

        return False

    today = event_date if event_date else get_today()
    if event_time is None:
        event_time = get_current_time()

    current_state = get_current_state(
        employee_id,
        target_date=today,
    )

    if current_state == "INSIDE":

        print()
        print("ENTRY IGNORED")
        print("-------------")
        print(
            f"Employee : {employee['employee_name']}"
        )
        print(
            "Reason   : Employee is already inside."
        )

        return False

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO attendance_events
        (
            employee_id,
            event_date,
            event_time,
            event_type,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
    """, (
        employee_id,
        today,
        event_time,
        "IN",
        datetime.now().isoformat()
    ))

    connection.commit()
    connection.close()

    first_in = get_first_in(
        employee_id,
        target_date=today,
    )

    is_first_arrival = (
        first_in == event_time
    )

    print()
    print("ENTRY RECORDED")
    print("--------------")
    print(
        f"Employee : {employee['employee_name']}"
    )
    print(
        f"ID       : {employee_id}"
    )
    print(
        f"Time     : {event_time}"
    )

    if is_first_arrival:

        (
            status,
            early_minutes,
            late_minutes
        ) = calculate_arrival_status(
            first_in,
            employee["shift_start"]
        )

        print(
            f"Shift    : {employee['shift_start']}"
        )

        print(
            f"Status   : {status}"
        )

        if status == "EARLY":

            print(
                f"Early by : {early_minutes} minutes"
            )

        elif status == "LATE":

            print(
                f"Late by  : {late_minutes} minutes"
            )

        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO daily_attendance
            (
                employee_id,
                attendance_date,
                first_in,
                arrival_status,
                early_minutes,
                late_minutes,
                reporting_hr,
                hr_email,
                shift_start,
                shift_end,
                practice,
                work_location,
                is_provisional
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(employee_id, attendance_date)
            DO UPDATE SET
                first_in = excluded.first_in,
                arrival_status = excluded.arrival_status,
                early_minutes = excluded.early_minutes,
                late_minutes = excluded.late_minutes,
                reporting_hr = excluded.reporting_hr,
                hr_email = excluded.hr_email,
                shift_start = excluded.shift_start,
                shift_end = excluded.shift_end,
                practice = excluded.practice,
                work_location = excluded.work_location,
                is_provisional = 1
        """, (
            employee_id,
            today,
            first_in,
            status,
            early_minutes,
            late_minutes,
            employee.get("reporting_hr") or employee.get("hr_contact") or "",
            employee.get("hr_email") or "",
            employee.get("shift_start") or "14:00",
            employee.get("shift_end") or "22:00",
            employee.get("department") or employee.get("team_name") or "Software Services",
            employee.get("work_location") or "Miracle City (HQ)",
        ))

        connection.commit()
        connection.close()

        if status == "LATE" and late_minutes >= 1:

            print()
            print(
                "Sending arrival notification..."
            )

            email_sent = send_arrival_notification(
                employee,
                first_in,
                status,
                early_minutes,
                late_minutes,
                target_date=today,
            )

            if email_sent:

                connection = get_connection()
                cursor = connection.cursor()

                cursor.execute("""
                    UPDATE daily_attendance
                    SET email_sent = 1
                    WHERE employee_id = ?
                    AND attendance_date = ?
                """, (
                    employee_id,
                    today
                ))

                connection.commit()
                connection.close()

                print(
                    "Arrival notification sent."
                )

    # Recalculate summary and persistent daily record
    get_daily_summary(employee_id, target_date=today)

    return True


# ============================================================
# RECORD EXIT
# ============================================================

def record_exit(
    employee_id,
    event_time=None,
    event_date=None,
    timestamp=None,
):
    if timestamp:
        try:
            parts = str(timestamp).strip().split()
            if len(parts) == 2:
                event_date = parts[0]
                event_time = parts[1]
            elif len(parts) == 1:
                if "-" in parts[0]:
                    event_date = parts[0]
                else:
                    event_time = parts[0]
        except Exception:
            pass

    employee = get_employee(
        employee_id
    )

    if employee is None:

        print(
            "Employee not found."
        )

        return False

    today = event_date if event_date else get_today()
    if event_time is None:
        event_time = get_current_time()

    current_state = get_current_state(
        employee_id,
        target_date=today,
    )

    if current_state == "OUTSIDE":

        print()
        print("EXIT IGNORED")
        print("------------")
        print(
            f"Employee : {employee['employee_name']}"
        )
        print(
            "Reason   : Employee is already outside."
        )

        return False

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO attendance_events
        (
            employee_id,
            event_date,
            event_time,
            event_type,
            created_at
        )
        VALUES (?, ?, ?, ?, ?)
    """, (
        employee_id,
        today,
        event_time,
        "OUT",
        datetime.now().isoformat()
    ))

    connection.commit()
    connection.close()

    print()
    print("EXIT RECORDED")
    print("-------------")
    print(
        f"Employee : {employee['employee_name']}"
    )
    print(
        f"ID       : {employee_id}"
    )
    print(
        f"Time     : {event_time}"
    )

    summary = calculate_daily_summary(
        employee_id,
        target_date=today,
    )
    get_daily_summary(
        employee_id,
        target_date=today,
    )

    print(
        f"Worked today : "
        f"{summary['worked_hours']}"
    )

    return True


# ============================================================
# WORK SESSIONS
# ============================================================

def calculate_sessions(employee_id):

    events = get_today_events(
        employee_id
    )

    return calculate_sessions_from_events(
        events
    )


def calculate_sessions_from_events(events):

    sessions = []
    open_in = None

    for event in events:

        if event["event_type"] == "IN":

            if open_in is None:
                open_in = event["event_time"]

        elif event["event_type"] == "OUT":

            if open_in is not None:

                minutes = calculate_time_difference(
                    open_in,
                    event["event_time"]
                )

                sessions.append({
                    "check_in": open_in,
                    "check_out": event["event_time"],
                    "worked_minutes": minutes,
                    "worked_hours": _format_worked_minutes(minutes),
                })

                open_in = None

    open_session = None

    if open_in is not None:

        open_session = {
            "check_in": open_in,
            "check_out": None,
            "worked_minutes": 0,
            "worked_hours": "0h 0m",
        }

    return sessions, open_session


# ============================================================
# DAILY SUMMARY
# ============================================================

def calculate_daily_summary(employee_id, target_date=None):

    employee = get_employee(
        employee_id
    )

    if employee is None:
        return None

    if not target_date:
        target_date = get_today()

    events = get_events_by_date(
        employee_id,
        target_date
    )

    sessions, open_session = calculate_sessions_from_events(
        events
    )

    total_worked_minutes = sum(
        session["worked_minutes"]
        for session in sessions
    )

    first_in = None

    for event in events:

        if event["event_type"] == "IN":

            first_in = event["event_time"]
            break

    last_out = None

    for event in reversed(events):

        if event["event_type"] == "OUT":

            last_out = event["event_time"]
            break

    is_flexible = is_flexible_shift_employee(employee)

    arrival_status = None
    early_minutes = 0
    late_minutes = 0

    if is_flexible:
        if first_in:
            arrival_status = "FLEXIBLE"
    else:
        if first_in:
            (
                arrival_status,
                early_minutes,
                late_minutes
            ) = calculate_arrival_status(
                first_in,
                employee["shift_start"]
            )

    break_minutes = calculate_break_minutes(
        sessions,
        employee["shift_start"],
        employee["shift_end"],
        total_worked_minutes,
        is_flexible
    )
    break_duration = _format_worked_minutes(break_minutes)
    status = calculate_attendance_status(total_worked_minutes)

    worked_hours = (
        f"{total_worked_minutes // 60}h "
        f"{total_worked_minutes % 60}m"
    )

    practice = employee.get("practice") or "Innovation"
    work_location = employee.get("work_location") or "Miracle City (HQ)"
    group_name = employee.get("group_name") or "Group 1"
    reporting_hr = employee.get("reporting_hr") or employee.get("hr_contact") or "Assigned HR"
    hr_email = employee.get("hr_email") or ""

    # Working hours are provisional until valid checkout is available
    is_provisional = bool(first_in and (open_session is not None or last_out is None))

    current_state = "OUTSIDE"
    if events and events[-1]["event_type"] == "IN":
        current_state = "INSIDE"

    return {
        "employee_id": employee_id,
        "employee_name": employee["employee_name"],
        "date": target_date,
        "shift_start": "Flexible" if is_flexible else employee["shift_start"],
        "shift_end": "Flexible" if is_flexible else employee["shift_end"],
        "department": employee.get("department", ""),
        "practice": practice,
        "work_location": work_location,
        "designation": employee.get("designation", ""),
        "group_name": group_name,
        "reporting_hr": reporting_hr,
        "hr_email": hr_email,
        "first_in": first_in,
        "last_out": last_out,
        "arrival_status": arrival_status,
        "early_minutes": early_minutes,
        "late_minutes": late_minutes,
        "worked_minutes": total_worked_minutes,
        "worked_hours": worked_hours,
        "break_minutes": break_minutes,
        "break_duration": break_duration,
        "status": status,
        "is_provisional": is_provisional,
        "session_count": len(sessions),
        "is_flexible_shift": is_flexible,
        "sessions": sessions,
        "open_session": open_session,
        "current_state": current_state,
        "event_count": len(events)
    }


def get_daily_summary(employee_id, target_date=None):

    summary = calculate_daily_summary(
        employee_id,
        target_date=target_date
    )

    if summary is None:
        return None

    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO daily_attendance
        (
            employee_id,
            attendance_date,
            first_in,
            last_out,
            arrival_status,
            early_minutes,
            late_minutes,
            worked_minutes,
            status,
            break_minutes,
            group_name,
            reporting_hr,
            hr_email,
            shift_start,
            shift_end,
            practice,
            work_location,
            is_provisional
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id, attendance_date)
        DO UPDATE SET
            first_in = excluded.first_in,
            last_out = excluded.last_out,
            arrival_status = excluded.arrival_status,
            early_minutes = excluded.early_minutes,
            late_minutes = excluded.late_minutes,
            worked_minutes = excluded.worked_minutes,
            status = excluded.status,
            break_minutes = excluded.break_minutes,
            group_name = excluded.group_name,
            reporting_hr = excluded.reporting_hr,
            hr_email = excluded.hr_email,
            shift_start = excluded.shift_start,
            shift_end = excluded.shift_end,
            practice = excluded.practice,
            work_location = excluded.work_location,
            is_provisional = excluded.is_provisional
    """, (
        employee_id,
        summary["date"],
        summary["first_in"],
        summary["last_out"],
        summary["arrival_status"],
        summary["early_minutes"],
        summary["late_minutes"],
        summary["worked_minutes"],
        summary["status"],
        summary["break_minutes"],
        summary.get("group_name", "Group 1"),
        summary.get("reporting_hr", ""),
        summary.get("hr_email", ""),
        summary.get("shift_start", "14:00"),
        summary.get("shift_end", "22:00"),
        summary.get("practice", "Software Services"),
        summary.get("work_location", "Miracle City (HQ)"),
        1 if summary.get("is_provisional") else 0,
    ))

    connection.commit()
    connection.close()

    return summary


# ============================================================
# TODAY ATTENDANCE
# ============================================================

def get_today_attendance(department=None, current_user=None, practice=None):
    assigned_ids = get_hr_assigned_employee_ids(current_user)

    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT
            employee_id,
            employee_name,
            shift_start,
            shift_end,
            email,
            login_id,
            hubble_id,
            reports_to,
            reports_to_mail_id,
            hr_contact,
            hr_email,
            department,
            designation,
            team_name,
            work_location,
            is_flexible_shift,
            reporting_hr,
            practice,
            project,
            is_enrolled
        FROM employees
        WHERE is_enrolled = 1
    """
    params = []

    if assigned_ids is not None:
        if not assigned_ids:
            connection.close()
            return []
        placeholders = ",".join("?" for _ in assigned_ids)
        query += f" AND employee_id IN ({placeholders})"
        params.extend(assigned_ids)

    if practice and practice.upper() != "ALL":
        query += " AND LOWER(TRIM(practice)) = LOWER(?)"
        params.append(practice.strip())

    if department and department.upper() != "ALL":
        query += " AND LOWER(TRIM(department)) = LOWER(?)"
        params.append(department.strip())

    query += " ORDER BY employee_id"
    cursor.execute(query, tuple(params))

    employees = cursor.fetchall()
    connection.close()

    results = []

    for employee in employees:

        summary = calculate_daily_summary(
            employee["employee_id"]
        )

        results.append(summary)

    return results


# ============================================================
# HISTORICAL ATTENDANCE
# ============================================================

def get_attendance_by_date(
    attendance_date,
    department=None,
    current_user=None,
    practice=None
):

    try:

        datetime.strptime(
            attendance_date,
            "%Y-%m-%d"
        )

    except ValueError:

        raise ValueError(
            "Invalid date format. Use YYYY-MM-DD."
        )

    assigned_ids = get_hr_assigned_employee_ids(current_user)

    connection = get_connection()
    cursor = connection.cursor()

    query = """
        SELECT
            employee_id,
            employee_name,
            shift_start,
            shift_end,
            email,
            login_id,
            hubble_id,
            reports_to,
            reports_to_mail_id,
            hr_contact,
            hr_email,
            department,
            designation,
            team_name,
            work_location,
            is_flexible_shift,
            reporting_hr,
            practice,
            project,
            is_enrolled
        FROM employees
        WHERE is_enrolled = 1
    """
    params = []

    if assigned_ids is not None:
        if not assigned_ids:
            connection.close()
            return []
        placeholders = ",".join("?" for _ in assigned_ids)
        query += f" AND employee_id IN ({placeholders})"
        params.extend(assigned_ids)

    if practice and practice.upper() != "ALL":
        query += " AND LOWER(TRIM(practice)) = LOWER(?)"
        params.append(practice.strip())

    if department and department.upper() != "ALL":
        query += " AND LOWER(TRIM(department)) = LOWER(?)"
        params.append(department.strip())

    query += " ORDER BY employee_id"
    cursor.execute(query, tuple(params))

    employees = cursor.fetchall()

    cursor.execute("SELECT employee_id, leave_type, reason FROM leave_records WHERE leave_date = ?", (attendance_date,))
    leaves_by_emp = {row["employee_id"]: dict(row) for row in cursor.fetchall()}

    connection.close()

    results = []

    for employee_row in employees:
        employee = dict(employee_row)

        events = get_events_by_date(
            employee["employee_id"],
            attendance_date
        )

        sessions, open_session = (
            calculate_sessions_from_events(
                events
            )
        )

        worked_minutes = sum(
            session["worked_minutes"]
            for session in sessions
        )

        worked_hours = (
            f"{worked_minutes // 60}h "
            f"{worked_minutes % 60}m"
        )

        first_in = None

        for event in events:

            if event["event_type"] == "IN":

                first_in = event["event_time"]
                break

        last_out = None

        for event in reversed(events):

            if event["event_type"] == "OUT":

                last_out = event["event_time"]
                break

        is_flexible = is_flexible_shift_employee(employee)

        arrival_status = None
        early_minutes = 0
        late_minutes = 0

        if is_flexible:
            if first_in:
                arrival_status = "FLEXIBLE"
        else:
            if first_in:
                (
                    arrival_status,
                    early_minutes,
                    late_minutes
                ) = calculate_arrival_status(
                    first_in,
                    employee["shift_start"]
                )

        current_date_obj = datetime.strptime(attendance_date, "%Y-%m-%d").date()
        is_weekend = current_date_obj.weekday() >= 5
        leave = leaves_by_emp.get(employee["employee_id"])

        status = calculate_attendance_status(worked_minutes, is_leave=bool(leave), is_weekend=is_weekend)

        break_minutes = calculate_break_minutes(
            sessions,
            employee["shift_start"],
            employee["shift_end"],
            worked_minutes,
            is_flexible
        )
        break_duration = _format_worked_minutes(break_minutes)

        current_state = "OUTSIDE"

        if events:

            last_event = events[-1]

            if last_event["event_type"] == "IN":
                current_state = "INSIDE"

        results.append({
            "employee_id": employee["employee_id"],
            "employee_name": employee["employee_name"],
            "date": attendance_date,
            "shift_start": "Flexible" if is_flexible else employee["shift_start"],
            "shift_end": "Flexible" if is_flexible else employee["shift_end"],
            "department": employee["department"] if "department" in employee.keys() else "",
            "work_location": employee["work_location"] if "work_location" in employee.keys() else "Miracle City (HQ)",
            "designation": employee["designation"] if "designation" in employee.keys() else "",
            "first_in": first_in,
            "last_out": last_out,
            "arrival_status": arrival_status,
            "early_minutes": early_minutes,
            "late_minutes": late_minutes,
            "worked_minutes": worked_minutes,
            "worked_hours": worked_hours,
            "break_minutes": break_minutes,
            "break_duration": break_duration,
            "status": status,
            "group_name": employee.get("group_name") or "Group 1",
            "reporting_hr": employee.get("reporting_hr") or employee.get("hr_contact") or "Assigned HR",
            "hr_email": employee.get("hr_email") or "",
            "practice": employee.get("practice") or "Innovation",
            "is_provisional": bool(first_in and (open_session is not None or last_out is None)),
            "session_count": len(sessions),
            "is_flexible_shift": is_flexible,
            "leave_type": leave["leave_type"] if leave else None,
            "reason": leave["reason"] if leave else None,
            "sessions": sessions,
            "open_session": open_session,
            "current_state": current_state,
            "event_count": len(events)
        })

    return results


# ============================================================
# MONTHLY EMPLOYEE ATTENDANCE CALENDAR AND LEAVE
# ============================================================

def _format_worked_minutes(worked_minutes):
    worked_minutes = max(0, int(worked_minutes or 0))
    return f"{worked_minutes // 60}h {worked_minutes % 60}m"


def _scheduled_shift_minutes(shift_start, shift_end):
    start = time_to_minutes(shift_start)
    end = time_to_minutes(shift_end)
    if end <= start:
        end += 24 * 60
    return end - start


def _elapsed_minutes(start_time, end_time):
    difference = time_to_minutes(end_time) - time_to_minutes(start_time)
    return difference + 24 * 60 if difference < 0 else difference


def get_employee_attendance_history(employee_id, year, month):
    """Return calendar-ready attendance and leave records for one month."""
    import calendar
    from datetime import date

    if month < 1 or month > 12:
        raise ValueError("Month must be between 1 and 12.")
    if year < 2000 or year > 2100:
        raise ValueError("Year must be between 2000 and 2100.")

    employee = get_employee(employee_id)
    if employee is None:
        return None

    is_flexible = is_flexible_shift_employee(employee)

    first_date = f"{year:04d}-{month:02d}-01"
    last_day = calendar.monthrange(year, month)[1]
    last_date = f"{year:04d}-{month:02d}-{last_day:02d}"

    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT id, employee_id, event_date, event_time, event_type, created_at
            FROM attendance_events
            WHERE employee_id = ? AND event_date BETWEEN ? AND ?
            ORDER BY event_date ASC, event_time ASC, id ASC
        """, (employee_id, first_date, last_date))
        event_rows = cursor.fetchall()

        cursor.execute("""
            SELECT leave_date, leave_type, reason
            FROM leave_records
            WHERE employee_id = ? AND leave_date BETWEEN ? AND ?
            ORDER BY leave_date ASC
        """, (employee_id, first_date, last_date))
        leave_rows = cursor.fetchall()
    finally:
        connection.close()

    events_by_date = {}
    for row in event_rows:
        event = dict(row)
        events_by_date.setdefault(event["event_date"], []).append(event)

    leaves_by_date = {row["leave_date"]: dict(row) for row in leave_rows}
    attendance = []

    for day_number in range(1, last_day + 1):
        current_date = date(year, month, day_number)
        date_string = current_date.isoformat()
        events = events_by_date.get(date_string, [])
        leave = leaves_by_date.get(date_string)
        sessions, open_session = calculate_sessions_from_events(events)

        worked_minutes = sum(
            session["worked_minutes"]
            for session in sessions
        )

        is_weekend = current_date.weekday() >= 5
        status = calculate_attendance_status(worked_minutes, is_leave=bool(leave), is_weekend=is_weekend)

        first_in = next(
            (event["event_time"] for event in events if event["event_type"] == "IN"),
            None,
        )
        last_out = next(
            (event["event_time"] for event in reversed(events) if event["event_type"] == "OUT"),
            None,
        )

        arrival_status = None
        early_minutes = 0
        late_minutes = 0
        if is_flexible:
            if first_in:
                arrival_status = "FLEXIBLE"
        elif first_in:
            arrival_status, early_minutes, late_minutes = calculate_arrival_status(
                first_in, employee["shift_start"]
            )

        break_minutes = calculate_break_minutes(
            sessions,
            employee["shift_start"],
            employee["shift_end"],
            worked_minutes,
            is_flexible
        )
        break_duration = _format_worked_minutes(break_minutes)

        attendance.append({
            "date": date_string,
            "day": day_number,
            "weekday": current_date.strftime("%A"),
            "status": status,
            "first_in": first_in,
            "last_out": last_out,
            "worked_minutes": worked_minutes if status not in {"LEAVE", "WEEKEND", "ABSENT"} else 0,
            "worked_hours": _format_worked_minutes(worked_minutes) if status not in {"LEAVE", "WEEKEND", "ABSENT"} else "0h 0m",
            "break_minutes": break_minutes if status not in {"LEAVE", "WEEKEND", "ABSENT"} else 0,
            "break_duration": break_duration if status not in {"LEAVE", "WEEKEND", "ABSENT"} else "0h 0m",
            "session_count": len(sessions),
            "event_count": len(events),
            "is_flexible_shift": is_flexible,
            "arrival_status": arrival_status,
            "early_minutes": early_minutes,
            "late_minutes": late_minutes,
            "leave_type": leave["leave_type"] if leave else None,
            "reason": leave["reason"] if leave else None,
            "events": events,
            "sessions": sessions,
            "open_session": open_session,
        })

    return {
        "employee": {
            "employee_id": employee["employee_id"],
            "employee_name": employee["employee_name"],
            "email": employee["email"],
            "shift_start": "Flexible" if is_flexible else employee["shift_start"],
            "shift_end": "Flexible" if is_flexible else employee["shift_end"],
            "department": employee["department"] if "department" in employee.keys() else "",
            "work_location": employee["work_location"] if "work_location" in employee.keys() else "Miracle City (HQ)",
            "designation": employee["designation"] if "designation" in employee.keys() else "",
            "is_flexible_shift": is_flexible,
        },
        "year": year,
        "month": month,
        "attendance": attendance,
    }


# ============================================================
# SUPERIOR MANUAL ATTENDANCE CORRECTION
# ============================================================

def manual_attendance_correction(
    employee_id: str,
    attendance_date: str,
    status: str,
    first_in: str = None,
    last_out: str = None,
    worked_minutes: int = None,
    reason: str = None,
    actor_username: str = "superior",
    actor_role: str = "superior",
):
    """
    Manually correct any employee's attendance with before/after audit logging.
    Can mark employee present or absent even when no check-in was recorded.
    """
    try:
        datetime.strptime(attendance_date, "%Y-%m-%d")
    except ValueError:
        raise ValueError("Invalid date format. Use YYYY-MM-DD.")

    employee = get_employee(employee_id)
    if not employee:
        raise LookupError(f"Employee '{employee_id}' not found.")

    if not reason or not reason.strip():
        raise ValueError("A reason must be provided for manual attendance correction.")

    connection = get_connection()
    cursor = connection.cursor()

    # Capture before values
    cursor.execute("""
        SELECT first_in, last_out, arrival_status, worked_minutes, status, break_minutes
        FROM daily_attendance WHERE employee_id = ? AND attendance_date = ?
    """, (employee_id, attendance_date))
    existing_daily = cursor.fetchone()
    before_state = dict(existing_daily) if existing_daily else {"status": "NO_RECORD", "worked_minutes": 0}

    is_flexible = is_flexible_shift_employee(employee)
    norm_status = status.strip().upper()

    now_iso = datetime.now().isoformat()

    if norm_status == "ABSENT":
        # Remove events for this date
        cursor.execute("DELETE FROM attendance_events WHERE employee_id = ? AND event_date = ?", (employee_id, attendance_date))
        cursor.execute("""
            INSERT INTO daily_attendance (employee_id, attendance_date, first_in, last_out, arrival_status, early_minutes, late_minutes, worked_minutes, status, break_minutes)
            VALUES (?, ?, NULL, NULL, 'ABSENT', 0, 0, 0, 'ABSENT', 0)
            ON CONFLICT(employee_id, attendance_date) DO UPDATE SET
                first_in = NULL,
                last_out = NULL,
                arrival_status = 'ABSENT',
                early_minutes = 0,
                late_minutes = 0,
                worked_minutes = 0,
                status = 'ABSENT',
                break_minutes = 0
        """, (employee_id, attendance_date))
        after_state = {
            "status": "ABSENT",
            "worked_minutes": 0,
            "first_in": None,
            "last_out": None,
        }
    else:
        # Present / Full Day / Half Day
        resolved_in = first_in or (employee["shift_start"] if employee["shift_start"] and employee["shift_start"] != "Flexible" else "09:00")
        if not last_out:
            if norm_status == "HALF_DAY":
                # 4.5 hours later
                in_mins = time_to_minutes(resolved_in)
                out_mins = in_mins + 270
                resolved_out = f"{(out_mins // 60) % 24:02d}:{out_mins % 60:02d}"
            else:
                resolved_out = employee["shift_end"] if employee["shift_end"] and employee["shift_end"] != "Flexible" else "17:30"
        else:
            resolved_out = last_out

        if worked_minutes is None:
            calc_mins = calculate_time_difference(resolved_in, resolved_out)
            resolved_worked = calc_mins if calc_mins > 0 else (480 if norm_status in ("FULL_DAY", "PRESENT") else 240)
        else:
            resolved_worked = int(worked_minutes)

        final_status = calculate_attendance_status(resolved_worked)
        if norm_status in ("FULL_DAY", "HALF_DAY") and final_status == "ABSENT":
            final_status = norm_status

        # Update events
        cursor.execute("DELETE FROM attendance_events WHERE employee_id = ? AND event_date = ?", (employee_id, attendance_date))
        cursor.execute("""
            INSERT INTO attendance_events (employee_id, event_date, event_time, event_type, created_at)
            VALUES (?, ?, ?, 'IN', ?)
        """, (employee_id, attendance_date, resolved_in, now_iso))
        cursor.execute("""
            INSERT INTO attendance_events (employee_id, event_date, event_time, event_type, created_at)
            VALUES (?, ?, ?, 'OUT', ?)
        """, (employee_id, attendance_date, resolved_out, now_iso))

        break_mins = calculate_break_minutes(
            [{"check_in": resolved_in, "check_out": resolved_out, "worked_minutes": resolved_worked}],
            employee["shift_start"],
            employee["shift_end"],
            resolved_worked,
            is_flexible
        )

        arr_status = "FLEXIBLE" if is_flexible else "ON_TIME"

        cursor.execute("""
            INSERT INTO daily_attendance (employee_id, attendance_date, first_in, last_out, arrival_status, early_minutes, late_minutes, worked_minutes, status, break_minutes)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
            ON CONFLICT(employee_id, attendance_date) DO UPDATE SET
                first_in = excluded.first_in,
                last_out = excluded.last_out,
                arrival_status = excluded.arrival_status,
                early_minutes = 0,
                late_minutes = 0,
                worked_minutes = excluded.worked_minutes,
                status = excluded.status,
                break_minutes = excluded.break_minutes
        """, (employee_id, attendance_date, resolved_in, resolved_out, arr_status, resolved_worked, final_status, break_mins))

        after_state = {
            "status": final_status,
            "worked_minutes": resolved_worked,
            "first_in": resolved_in,
            "last_out": resolved_out,
        }

    # Record in audit log
    cursor.execute("""
        INSERT INTO audit_logs (actor_username, actor_role, action_type, target_id, target_date, before_value, after_value, reason, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        actor_username,
        actor_role,
        "MANUAL_ATTENDANCE_CORRECTION",
        employee_id,
        attendance_date,
        json.dumps(before_state),
        json.dumps(after_state),
        reason.strip(),
        now_iso,
    ))

    connection.commit()
    connection.close()

    return {
        "success": True,
        "employee_id": employee_id,
        "attendance_date": attendance_date,
        "before": before_state,
        "after": after_state,
        "reason": reason.strip(),
    }


def add_leave(employee_id, leave_date, leave_type="Leave", reason=None):
    if get_employee(employee_id) is None:
        return False
    try:
        datetime.strptime(leave_date, "%Y-%m-%d")
    except (TypeError, ValueError) as error:
        raise ValueError("Invalid leave date. Use YYYY-MM-DD.") from error

    connection = get_connection()
    try:
        connection.execute("""
            INSERT INTO leave_records (employee_id, leave_date, leave_type, reason, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(employee_id, leave_date) DO UPDATE SET
                leave_type = excluded.leave_type,
                reason = excluded.reason,
                created_at = excluded.created_at
        """, (
            employee_id,
            leave_date,
            (leave_type or "Leave").strip() or "Leave",
            reason,
            datetime.now().isoformat(),
        ))
        connection.commit()
    finally:
        connection.close()
    return get_leave(employee_id, leave_date)


def get_leave(employee_id, leave_date):
    connection = get_connection()
    try:
        row = connection.execute("""
            SELECT id, employee_id, leave_date, leave_type, reason, created_at
            FROM leave_records WHERE employee_id = ? AND leave_date = ?
        """, (employee_id, leave_date)).fetchone()
        return dict(row) if row else None
    finally:
        connection.close()


def delete_leave(employee_id, leave_date):
    connection = get_connection()
    try:
        cursor = connection.execute(
            "DELETE FROM leave_records WHERE employee_id = ? AND leave_date = ?",
            (employee_id, leave_date),
        )
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()


# ============================================================
# BACKWARD COMPATIBILITY
# ============================================================

def check_employee_attendance(employee_id):

    return record_entry(
        employee_id
    )


# ============================================================
# ORGANIZATIONAL HIERARCHY & SHIFT-BASED HR ATTENDANCE REPORTS
# ============================================================

def get_hr_for_employee(employee):
    """
    Resolves the assigned HR for an employee following the hierarchy:
    Organization -> Department -> Assigned HR -> Assigned Employee.
    Prioritizes employee's assigned reporting_hr / hr_email if present,
    otherwise resolves from the employee's department record in departments table.
    """
    if isinstance(employee, str):
        employee = get_employee(employee)
    if not employee:
        return {"hr_name": "Assigned HR", "hr_email": ""}

    emp_dict = dict(employee)
    hr_name = (emp_dict.get("reporting_hr") or emp_dict.get("hr_contact") or "").strip()
    hr_email = (emp_dict.get("hr_email") or "").strip()

    dept_name = (emp_dict.get("department") or "").strip()
    if (not hr_name or not hr_email) and dept_name:
        conn = get_connection()
        cursor = conn.cursor()
        dept_row = cursor.execute(
            "SELECT assigned_hr_name, assigned_hr_email FROM departments WHERE LOWER(name) = LOWER(?)",
            (dept_name,)
        ).fetchone()
        conn.close()
        if dept_row:
            dept = dict(dept_row)
            if not hr_name:
                hr_name = (dept.get("assigned_hr_name") or "").strip()
            if not hr_email:
                hr_email = (dept.get("assigned_hr_email") or "").strip()

    return {
        "hr_name": hr_name or "Assigned HR",
        "hr_email": hr_email or ""
    }


def update_employee_assignment(
    employee_id: str,
    reporting_hr: str = None,
    hr_email: str = None,
    shift_start: str = None,
    shift_end: str = None,
    work_location: str = None,
    department: str = None,
    practice: str = None,
    project: str = None,
    is_flexible_shift: bool = None,
):
    connection = get_connection()
    cursor = connection.cursor()
    emp = cursor.execute("SELECT * FROM employees WHERE employee_id = ?", (employee_id,)).fetchone()
    if not emp:
        connection.close()
        return None

    updates = []
    params = []
    if reporting_hr is not None:
        updates.append("reporting_hr = ?")
        params.append(reporting_hr.strip())
        updates.append("hr_contact = ?")
        params.append(reporting_hr.strip())
    if hr_email is not None:
        updates.append("hr_email = ?")
        params.append(hr_email.strip())
    if shift_start is not None:
        updates.append("shift_start = ?")
        params.append(shift_start.strip())
    if shift_end is not None:
        updates.append("shift_end = ?")
        params.append(shift_end.strip())
    if work_location is not None:
        updates.append("work_location = ?")
        params.append(work_location.strip())
    if department is not None:
        updates.append("department = ?")
        params.append(department.strip())
    if practice is not None:
        updates.append("practice = ?")
        params.append(practice.strip())
    if project is not None:
        updates.append("project = ?")
        params.append(project.strip())
    if is_flexible_shift is not None:
        updates.append("is_flexible_shift = ?")
        params.append(1 if is_flexible_shift else 0)

    if updates:
        params.append(employee_id)
        cursor.execute(f"UPDATE employees SET {', '.join(updates)} WHERE employee_id = ?", tuple(params))
        connection.commit()

    connection.close()
    return get_employee(employee_id)


def get_or_record_employee_late_count(
    employee_id: str,
    target_date: str = None,
    minutes_late: int = 0,
    arrival_time: str = "",
    increment_if_new: bool = True,
) -> int:
    """
    Returns the persistent cumulative late count for the employee.
    Idempotent & restart-safe:
    - If a late arrival event is already recorded for (employee_id, target_date),
      returns that event's late_count without re-incrementing.
    - If this is a new late arrival event on a new attendance date and increment_if_new=True,
      increments cumulative_late_count by 1, saves to history, and returns the new count.
    - If increment_if_new=False, returns the current cumulative count without modifying history.
    """
    if not target_date:
        target_date = get_today()

    connection = get_connection()
    cursor = connection.cursor()

    # 1. Check if late event already recorded for this employee and date
    row = cursor.execute("""
        SELECT late_count FROM employee_late_history
        WHERE employee_id = ? AND attendance_date = ?
    """, (str(employee_id), target_date)).fetchone()

    if row:
        connection.close()
        return int(row[0])

    if not increment_if_new:
        count_row = cursor.execute("""
            SELECT cumulative_late_count FROM employee_late_counts
            WHERE employee_id = ?
        """, (str(employee_id),)).fetchone()
        connection.close()
        return int(count_row[0]) if count_row else 0

    # 2. Compute next cumulative count
    count_row = cursor.execute("""
        SELECT cumulative_late_count FROM employee_late_counts
        WHERE employee_id = ?
    """, (str(employee_id),)).fetchone()

    if count_row:
        new_count = int(count_row[0]) + 1
    else:
        # Check historical daily_attendance for any prior late arrivals on different dates
        prior_rows = cursor.execute("""
            SELECT COUNT(DISTINCT attendance_date) FROM daily_attendance
            WHERE employee_id = ? AND arrival_status = 'LATE' AND attendance_date < ?
        """, (str(employee_id), target_date)).fetchone()
        prior_cnt = int(prior_rows[0]) if prior_rows else 0
        new_count = prior_cnt + 1

    # 3. Persist to history and update tracking table
    cursor.execute("""
        INSERT INTO employee_late_history
        (employee_id, attendance_date, arrival_time, minutes_late, late_count)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(employee_id, attendance_date) DO UPDATE SET
            arrival_time = excluded.arrival_time,
            minutes_late = excluded.minutes_late
    """, (str(employee_id), target_date, arrival_time or "", int(minutes_late), new_count))

    cursor.execute("""
        INSERT INTO employee_late_counts
        (employee_id, cumulative_late_count, last_late_date, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(employee_id) DO UPDATE SET
            cumulative_late_count = excluded.cumulative_late_count,
            last_late_date = excluded.last_late_date,
            updated_at = CURRENT_TIMESTAMP
    """, (str(employee_id), new_count, target_date))

    connection.commit()
    connection.close()
    return new_count


def get_employee_late_history(employee_id: str = None) -> list[dict]:
    """Retrieves late arrival history records for audit and compliance reporting."""
    connection = get_connection()
    cursor = connection.cursor()
    if employee_id:
        rows = cursor.execute("""
            SELECT * FROM employee_late_history
            WHERE employee_id = ?
            ORDER BY attendance_date DESC, id DESC
        """, (str(employee_id),)).fetchall()
    else:
        rows = cursor.execute("""
            SELECT * FROM employee_late_history
            ORDER BY attendance_date DESC, id DESC
        """).fetchall()
    connection.close()
    return [dict(r) for r in rows]


def calculate_shift_cutoff(shift_start: str, buffer_minutes: int = 60) -> str:
    """
    Calculates shift cutoff time: Shift start + buffer_minutes (default 60).
    Properly handles normal and overnight shifts using 24-hour modulo wraparound.
    Returns cutoff formatted as 'HH:MM'.
    """
    if not shift_start:
        return "15:00"
    try:
        sh, sm = map(int, shift_start.strip().split(":"))
        total_mins = (sh * 60 + sm + int(buffer_minutes)) % 1440
        return f"{total_mins // 60:02d}:{total_mins % 60:02d}"
    except Exception:
        return "15:00"


def get_distinct_shifts():
    """
    Returns a sorted list of unique shift_start times configured across active employees.
    """
    connection = get_connection()
    cursor = connection.cursor()
    rows = cursor.execute("""
        SELECT DISTINCT shift_start FROM employees 
        WHERE shift_start IS NOT NULL AND TRIM(shift_start) != ''
        ORDER BY shift_start
    """).fetchall()
    connection.close()
    return [r[0] for r in rows if r[0]]


def get_shift_cutoff_attendance_reports(shift_start: str = None, target_date: str = None, buffer_minutes: int = 60):
    """
    Generates HR attendance reports at shift cutoff for each HR whose assigned employees
    belong to the specified shift_start.
    Columns in each employee row:
    ID, Name, Department, Practice, Project, Location, Status, Login Time.
    Preserves reports as historical snapshots in cutoff_report_snapshots table.
    """
    if not target_date:
        target_date = get_today()

    connection = get_connection()
    cursor = connection.cursor()

    # Ensure snapshots table exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cutoff_report_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hr_email TEXT NOT NULL,
            shift_start TEXT NOT NULL,
            cutoff_time TEXT NOT NULL,
            target_date TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(hr_email, shift_start, target_date)
        )
    """)
    connection.commit()

    # Query matching employees
    if shift_start:
        rows = cursor.execute("""
            SELECT * FROM employees
            WHERE shift_start = ?
            ORDER BY employee_id
        """, (shift_start.strip(),)).fetchall()
    else:
        rows = cursor.execute("""
            SELECT * FROM employees
            ORDER BY shift_start, employee_id
        """).fetchall()

    employees = [dict(r) for r in rows]
    connection.close()

    # Group employees by assigned HR email
    hr_groups = {}
    for emp in employees:
        hr_info = get_hr_for_employee(emp)
        h_email = (hr_info.get("hr_email") or "").strip().lower()
        if not h_email:
            h_email = "unassigned@miraclesoft.com"
        
        emp_shift = emp.get("shift_start") or shift_start or "14:00"
        group_key = (h_email, emp_shift)

        if group_key not in hr_groups:
            hr_groups[group_key] = {
                "hr_name": hr_info.get("hr_name") or "Assigned HR",
                "hr_email": hr_info.get("hr_email") or h_email,
                "shift_start": emp_shift,
                "cutoff_time": calculate_shift_cutoff(emp_shift, buffer_minutes),
                "employees": []
            }
        hr_groups[group_key]["employees"].append(emp)

    reports = []
    conn = get_connection()
    cur = conn.cursor()

    for (h_email, emp_shift), grp in hr_groups.items():
        actual_hr_email = grp["hr_email"]
        cutoff_time = grp["cutoff_time"]

        # Check for existing snapshot
        snap = cur.execute("""
            SELECT snapshot_json FROM cutoff_report_snapshots
            WHERE hr_email = ? AND shift_start = ? AND target_date = ?
        """, (actual_hr_email, emp_shift, target_date)).fetchone()

        if snap and snap[0]:
            try:
                import json
                saved_report = json.loads(snap[0])
                reports.append(saved_report)
                continue
            except Exception:
                pass

        # Build fresh snapshot
        emp_rows = []
        seen_ids = set()
        shift_mins = time_to_minutes(emp_shift)

        for emp in grp["employees"]:
            emp_id = emp["employee_id"]
            if emp_id in seen_ids:
                continue
            seen_ids.add(emp_id)

            summary = calculate_daily_summary(emp_id, target_date=target_date)
            first_in = summary.get("first_in") if summary else None

            if not first_in:
                status = "Not Checked In"
                login_time = "—"
                late_minutes = 0
            else:
                in_mins = time_to_minutes(first_in)
                if in_mins <= shift_mins:
                    status = "PRESENT"
                    late_minutes = 0
                else:
                    status = "LATE"
                    late_minutes = max(0, in_mins - shift_mins)
                login_time = first_in

            emp_rows.append({
                "id": emp_id,
                "name": emp.get("employee_name", ""),
                "department": emp.get("department") or "Software Services",
                "practice": emp.get("practice") or emp.get("department") or "Software Services",
                "project": emp.get("project") or "Internal",
                "location": emp.get("work_location") or "Miracle City (HQ)",
                "status": status,
                "login_time": login_time,
                "shift_start": emp_shift,
                "late_minutes": late_minutes,
            })

        total = len(emp_rows)
        present = sum(1 for e in emp_rows if e["status"] == "PRESENT")
        late = sum(1 for e in emp_rows if e["status"] == "LATE")
        not_checked_in = sum(1 for e in emp_rows if e["status"] == "Not Checked In")

        # Determine dominant practice for the report header
        practices = [e.get("practice") for e in emp_rows if e.get("practice")]
        grp_practice = practices[0] if practices else "Software Services"

        report_data = {
            "hr_name": grp["hr_name"],
            "hr_email": actual_hr_email,
            "shift_start": emp_shift,
            "cutoff_time": cutoff_time,
            "target_date": target_date,
            "practice": grp_practice,
            "employees": emp_rows,
            "totals": {
                "total": total,
                "present": present,
                "late": late,
                "not_checked_in": not_checked_in,
            }
        }

        # Save snapshot
        import json
        cur.execute("""
            INSERT OR REPLACE INTO cutoff_report_snapshots 
            (hr_email, shift_start, cutoff_time, target_date, snapshot_json)
            VALUES (?, ?, ?, ?, ?)
        """, (actual_hr_email, emp_shift, cutoff_time, target_date, json.dumps(report_data)))
        conn.commit()

        reports.append(report_data)

    conn.close()
    return reports


def get_all_shift_cutoff_reports(target_date: str = None, buffer_minutes: int = 60):
    """
    Generates reports for all configured shifts for target_date.
    """
    if not target_date:
        target_date = get_today()
    shifts = get_distinct_shifts()
    all_reports = []
    if not shifts:
        shifts = ["14:00"]
    for s in shifts:
        reps = get_shift_cutoff_attendance_reports(shift_start=s, target_date=target_date, buffer_minutes=buffer_minutes)
        all_reports.extend(reps)
    return all_reports


def get_hr_end_of_day_reports(target_date: str = None):
    """
    Generates end-of-day attendance reports grouped by assigned HR.
    """
    if not target_date:
        target_date = get_today()

    connection = get_connection()
    cursor = connection.cursor()
    employees = [dict(r) for r in cursor.execute("SELECT * FROM employees WHERE is_enrolled = 1 ORDER BY employee_id").fetchall()]
    connection.close()

    hr_groups = {}
    for emp in employees:
        hr_info = get_hr_for_employee(emp)
        h_email = (hr_info.get("hr_email") or "").strip().lower()
        if not h_email:
            h_email = "unassigned@miraclesoft.com"

        if h_email not in hr_groups:
            hr_groups[h_email] = {
                "hr_name": hr_info.get("hr_name") or "Assigned HR",
                "hr_email": hr_info.get("hr_email") or h_email,
                "employees": []
            }
        hr_groups[h_email]["employees"].append(emp)

    reports = []
    for h_email, grp in hr_groups.items():
        emp_data = []
        on_time = 0
        late = 0
        absent = 0

        for emp in grp["employees"]:
            emp_id = emp["employee_id"]
            summary = get_daily_summary(emp_id, target_date=target_date)

            first_in = summary.get("first_in")
            last_out = summary.get("last_out")
            status = summary.get("status") or "ABSENT"
            is_prov = summary.get("is_provisional", False)
            late_mins = summary.get("late_minutes", 0)

            if not first_in:
                absent += 1
            elif late_mins > 0:
                late += 1
            else:
                on_time += 1

            emp_data.append({
                "employee_id": emp_id,
                "employee_name": emp["employee_name"],
                "shift_start": emp.get("shift_start", "14:00"),
                "shift_end": emp.get("shift_end", "23:00"),
                "first_in": first_in,
                "last_out": last_out,
                "late_minutes": late_mins,
                "department": emp.get("department") or "Software Services",
                "practice": emp.get("practice") or emp.get("department") or "Software Services",
                "project": emp.get("project") or "Internal",
                "work_location": emp.get("work_location") or "Miracle City (HQ)",
                "status": status,
                "worked_hours": summary.get("worked_hours") or "0h 0m",
                "worked_minutes": summary.get("worked_minutes", 0),
                "break_duration": summary.get("break_duration", "0h 0m"),
                "is_provisional": is_prov,
            })

        practices = [e.get("practice") for e in emp_data if e.get("practice")]
        grp_practice = practices[0] if practices else "Software Services"

        reports.append({
            "hr_name": grp["hr_name"],
            "hr_email": grp["hr_email"],
            "target_date": target_date,
            "practice": grp_practice,
            "employees": emp_data,
            "totals": {
                "total": len(emp_data),
                "on_time": on_time,
                "late": late,
                "absent": absent,
            }
        })

    return reports


# ============================================================
# INITIALIZE DATABASE
# ============================================================

create_database()


# ============================================================
# DIRECT TEST
# ============================================================

if __name__ == "__main__":

    print()
    print("======================================")
    print("Event-Based Attendance System")
    print("======================================")
    print()
    print("Database initialized.")
    print()
    print("Available functions:")
    print("record_entry(employee_id)")
    print("record_exit(employee_id)")
    print("get_current_state(employee_id)")
    print("calculate_sessions(employee_id)")
    print("calculate_daily_summary(employee_id)")
    print("get_today_attendance()")
    print("get_attendance_by_date('YYYY-MM-DD')")
    print("get_employee_events(employee_id)")
    print("delete_employee(employee_id)")
    print("delete_attendance_by_date('YYYY-MM-DD')")