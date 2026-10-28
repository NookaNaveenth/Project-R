import os
import smtplib
import sqlite3
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE = BASE_DIR / "attendance.db"

EMAIL_SENDER = os.getenv("EMAIL_SENDER")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
DEFAULT_CC_EMAIL = os.getenv("DEFAULT_CC_EMAIL", "sprathi@miraclesoft.com").strip()


def _get_db():
    connection = sqlite3.connect(DATABASE, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def log_email_notification(
    notification_type: str,
    recipient_email: str,
    recipient_name: str | None,
    subject: str,
    reference_id: str | None,
    target_date: str,
    status: str,
    error_message: str | None = None,
    cc_email: str | None = None,
) -> int:
    try:
        conn = _get_db()
        cursor = conn.cursor()
        cursor.execute(
            """CREATE TABLE IF NOT EXISTS email_notification_logs (
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
            )"""
        )
        try:
            cursor.execute("ALTER TABLE email_notification_logs ADD COLUMN cc_email TEXT")
            conn.commit()
        except Exception:
            pass

        cursor.execute(
            """INSERT INTO email_notification_logs
            (notification_type, recipient_email, recipient_name, subject, reference_id, target_date, status, error_message, created_at, cc_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                notification_type,
                recipient_email or "",
                recipient_name or "",
                subject,
                reference_id or "",
                target_date,
                status,
                error_message,
                datetime.now().isoformat(),
                cc_email or "",
            ),
        )
        log_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return log_id
    except Exception as e:
        print(f"Error logging email notification: {e}")
        return -1


def is_email_already_sent(
    notification_type: str,
    reference_id: str | None,
    target_date: str,
    recipient_email: str | None = None,
) -> bool:
    try:
        conn = _get_db()
        cursor = conn.cursor()
        cursor.execute(
            """CREATE TABLE IF NOT EXISTS email_notification_logs (
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
            )"""
        )
        query = """SELECT id FROM email_notification_logs
                   WHERE notification_type = ? AND target_date = ? AND status = 'SENT'"""
        params = [notification_type, target_date]
        if reference_id is not None:
            query += " AND reference_id = ?"
            params.append(str(reference_id))
        if recipient_email is not None:
            query += " AND LOWER(recipient_email) = LOWER(?)"
            params.append(recipient_email.strip())

        row = cursor.execute(query, tuple(params)).fetchone()
        conn.close()
        return row is not None
    except Exception as e:
        print(f"Error checking email duplication: {e}")
        return False


def _send_smtp_message(message: EmailMessage) -> tuple[bool, str | None]:
    if not EMAIL_SENDER or not EMAIL_PASSWORD:
        err = "Email configuration (EMAIL_SENDER/EMAIL_PASSWORD) is missing."
        print(err)
        return False, err

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(EMAIL_SENDER, EMAIL_PASSWORD)
            server.send_message(message)
        return True, None
    except Exception as error:
        err_msg = str(error)
        print(f"Failed to send email via SMTP: {err_msg}")
        return False, err_msg


def _apply_cc_recipients(
    message: EmailMessage,
    primary_to: str,
    explicit_cc: str | list[str] | None = None,
    include_default_cc: bool = True,
    allow_to_in_cc: bool = False,
) -> list[str]:
    """
    Parse and set CC recipients on the EmailMessage.
    Includes explicit_cc and DEFAULT_CC_EMAIL if configured.
    Deduplicates CC addresses and prevents duplicates with primary_to unless allow_to_in_cc is True.
    """
    to_addrs = {a.strip().lower() for a in (primary_to or "").split(",") if a.strip()}

    candidates: list[str] = []
    if explicit_cc:
        if isinstance(explicit_cc, str):
            candidates.extend([a.strip() for a in explicit_cc.split(",") if a.strip()])
        elif isinstance(explicit_cc, (list, tuple, set)):
            for item in explicit_cc:
                if isinstance(item, str):
                    candidates.extend([a.strip() for a in item.split(",") if a.strip()])
                elif item:
                    candidates.append(str(item).strip())

    if include_default_cc and DEFAULT_CC_EMAIL:
        for a in DEFAULT_CC_EMAIL.split(","):
            if a.strip():
                candidates.append(a.strip())

    final_cc: list[str] = []
    seen = set()
    if not allow_to_in_cc:
        seen = set(to_addrs)

    for addr in candidates:
        lower = addr.lower()
        if lower and lower not in seen:
            seen.add(lower)
            final_cc.append(addr)

    if final_cc:
        message["Cc"] = ", ".join(final_cc)

    return final_cc


# ============================================================
# LATE ARRIVAL NOTIFICATION (REFERENCE IMAGE 1)
# ============================================================

def get_late_notification_colors(late_count: int) -> dict:
    """
    Returns stage-based header background and table badge colors:
    - Stage 1 (Count 1): Coral/Rose (#f26f78), badge bg (#fee2e2), badge text (#dc2626)
    - Stage 2 (Count 2): Medium Coral Red (#df4b57), badge bg (#fd747b), badge text (#ffffff)
    - Stage 3 (Count 3): Vibrant Deep Red (#da1b2a), badge bg (#da1b2a), badge text (#ffffff)
    - Stage 4+ (Count >= 4): Dark Maroon/Wine (#830f18), badge bg (#830f18), badge text (#ffffff)
    """
    if late_count <= 1:
        return {
            "header_bg": "#f26f78",
            "badge_bg": "#fee2e2",
            "badge_text": "#dc2626",
            "stage": 1,
        }
    elif late_count == 2:
        return {
            "header_bg": "#df4b57",
            "badge_bg": "#fd747b",
            "badge_text": "#ffffff",
            "stage": 2,
        }
    elif late_count == 3:
        return {
            "header_bg": "#da1b2a",
            "badge_bg": "#da1b2a",
            "badge_text": "#ffffff",
            "stage": 3,
        }
    else:
        return {
            "header_bg": "#830f18",
            "badge_bg": "#830f18",
            "badge_text": "#ffffff",
            "stage": 4,
        }


def send_late_arrival_notification(
    employee_id: str,
    employee_name: str,
    employee_email: str,
    department: str = "Software Services",
    practice: str = "Software Services",
    project: str = "Internal",
    office_location: str = "Miracle City (HQ)",
    shift_start: str = "14:00",
    arrival_time: str = "",
    minutes_late: int = 0,
    attendance_status: str = "LATE",
    hr_name: str | None = None,
    hr_email: str | None = None,
    target_date: str | None = None,
    group_name: str | None = None,
    late_count: int | None = None,
    cc_email: str | list[str] | None = None,
) -> bool:
    """
    Send redesigned late-arrival notification email matching Reference Image 1.
    Includes:
    - Header with stage-based red color progression (stages 1-4, remaining at stage 4 thereafter)
    - Late duration badge and cumulative late count badge in header
    - Personalized greeting with employee name
    - Clean bordered table: Employee ID, Employee Name, Practice, Office Location, Scheduled Shift, Actual Arrival, Minutes Late
    - Professional adherence reminder
    - CC to assigned HR and default CC recipients
    - Deduplication per attendance event
    """
    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")

    # Prevent duplicate notification for the same attendance event
    if is_email_already_sent("LATE_ARRIVAL", employee_id, target_date):
        print(f"Late arrival notification already sent for {employee_id} on {target_date}.")
        return True

    if not employee_email:
        print(f"No email address configured for employee {employee_id}.")
        log_email_notification(
            notification_type="LATE_ARRIVAL",
            recipient_email=hr_email or "",
            recipient_name=hr_name or "",
            subject=f"Late Arrival: {employee_name} ({employee_id})",
            reference_id=employee_id,
            target_date=target_date,
            status="FAILED",
            error_message="Employee email missing",
        )
        return False

    # Dynamically resolve persistent cumulative late count if not explicitly passed
    if late_count is None:
        try:
            import attendance as db
            late_count = db.get_or_record_employee_late_count(
                employee_id=employee_id,
                target_date=target_date,
                minutes_late=minutes_late,
                arrival_time=arrival_time,
                increment_if_new=True,
            )
        except Exception:
            late_count = 1

    colors = get_late_notification_colors(late_count)

    message = EmailMessage()
    message["From"] = EMAIL_SENDER or "noreply@miraclesoft.com"
    message["To"] = employee_email

    explicit_ccs = []
    if hr_email and hr_email.strip():
        explicit_ccs.append(hr_email.strip())
    if cc_email:
        if isinstance(cc_email, list):
            explicit_ccs.extend(cc_email)
        else:
            explicit_ccs.append(str(cc_email))
    applied_ccs = _apply_cc_recipients(
        message,
        primary_to=employee_email,
        explicit_cc=explicit_ccs,
        include_default_cc=True,
    )

    subject = f"Late Arrival Notification ({minutes_late} min late) — {employee_name} ({employee_id})"
    message["Subject"] = subject

    body_text = f"""Late Arrival Notification
Late By: {minutes_late} min | Late Count: {late_count}

Hello {employee_name},
Your first arrival today was recorded later than your scheduled shift start time.

--------------------------------------------------
Employee ID       : {employee_id}
Employee Name     : {employee_name}
Practice          : {practice or 'Software Services'}
Office Location   : {office_location or 'Miracle City (HQ)'}
Scheduled Shift   : {shift_start}
Actual Arrival    : {arrival_time}
Minutes Late      : {minutes_late} min
--------------------------------------------------

Please ensure that you adhere to your scheduled shift timings.

This is an automated attendance notification from FaceAttend.
Miracle Software Systems
"""

    body_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Late Arrival Notification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px 12px; background-color: #f8fafc;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
    <!-- Header banner with stage-based red color progression -->
    <div style="background-color: {colors['header_bg']}; padding: 18px 24px;">
      <table style="width: 100%; border-collapse: collapse; border: none;">
        <tr>
          <td style="vertical-align: middle; padding: 0;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px;">Late Arrival Notification</h2>
          </td>
          <td style="vertical-align: middle; text-align: right; padding: 0; white-space: nowrap;">
            <span style="display: inline-block; background-color: #ffffff; color: #0f172a; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 6px; margin-right: 6px;">Late By: {minutes_late} min</span>
            <span style="display: inline-block; background-color: #ffffff; color: #0f172a; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 6px;">Late Count: {late_count}</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body content -->
    <div style="padding: 24px;">
      <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Hello {employee_name},</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">Your first arrival today was recorded later than your scheduled shift start time.</p>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 22px;">
        <tr>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #64748b; width: 42%;">Employee ID</td>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #0f172a; font-weight: 700;">{employee_id}</td>
        </tr>
        <tr>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #64748b;">Employee Name</td>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #0f172a; font-weight: 700;">{employee_name}</td>
        </tr>
        <tr>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #64748b;">Practice</td>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #0f172a; font-weight: 700;">{practice or 'Software Services'}</td>
        </tr>
        <tr>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #64748b;">Office Location</td>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #0f172a; font-weight: 700;">{office_location or 'Miracle City (HQ)'}</td>
        </tr>
        <tr>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #64748b;">Scheduled Shift</td>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #0f172a; font-weight: 700;">{shift_start}</td>
        </tr>
        <tr>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #64748b;">Actual Arrival</td>
          <td style="padding: 11px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; color: #0f172a; font-weight: 700;">{arrival_time}</td>
        </tr>
        <tr>
          <td style="padding: 11px 16px; font-size: 13.5px; color: #64748b;">Minutes Late</td>
          <td style="padding: 11px 16px;">
            <span style="display: inline-block; background-color: {colors['badge_bg']}; color: {colors['badge_text']}; font-size: 13px; font-weight: 700; padding: 4px 14px; border-radius: 6px;">{minutes_late} min</span>
          </td>
        </tr>
      </table>

      <p style="margin: 0; font-size: 13.5px; color: #475569;">Please ensure that you adhere to your scheduled shift timings.</p>
    </div>
  </div>
</body>
</html>"""

    message.set_content(body_text)
    message.add_alternative(body_html, subtype="html")

    success, error = _send_smtp_message(message)
    log_email_notification(
        notification_type="LATE_ARRIVAL",
        recipient_email=employee_email,
        recipient_name=employee_name,
        subject=subject,
        reference_id=employee_id,
        target_date=target_date,
        status="SENT" if success else "FAILED",
        error_message=error,
        cc_email=", ".join(applied_ccs),
    )
    return success


# ============================================================
# SHIFT ARRIVAL STATUS REPORT (REFERENCE IMAGE 2)
# ============================================================

def send_hr_attendance_report(
    hr_name: str,
    hr_email: str,
    shift_start: str,
    cutoff_time: str,
    target_date: str,
    employees: list[dict],
    totals: dict | None = None,
    practice: str | None = None,
    cc_email: str | list[str] | None = None,
    to_email: str | None = None,
) -> bool:
    """
    Sends the redesigned Shift Arrival Status Report to the assigned HR matching Reference Image 2.
    Header: Dark-blue banner with date, assigned HR, practice, Miracle Software Systems branding.
    Summary cards: Total Assigned, Present, Late, Absent / Pending.
    Table columns: ID, Name, Department, Practice, Project, Location, Status, Login Time.
    Callout note: Explains Not Checked In cutoff status and live record updates.
    """
    reference_id = f"{hr_email}_{shift_start}"

    if is_email_already_sent("HR_ATTENDANCE_REPORT", reference_id, target_date, hr_email) or \
       is_email_already_sent("CUTOFF_SUMMARY", reference_id, target_date, hr_email):
        print(f"Shift arrival status report already sent for {hr_email} shift {shift_start} on {target_date}.")
        return True

    if not hr_email:
        print(f"No HR email provided for {shift_start} cutoff report.")
        return False

    # Determine reporting practice
    if not practice:
        practices = [e.get("practice") for e in employees if e.get("practice")]
        practice = practices[0] if practices else "DAAPS"

    message = EmailMessage()
    message["From"] = EMAIL_SENDER or "noreply@miraclesoft.com"
    primary_to = (to_email or hr_email or "").strip()
    message["To"] = primary_to
    applied_ccs = _apply_cc_recipients(
        message,
        primary_to=primary_to,
        explicit_cc=cc_email,
        include_default_cc=True,
    )
    subject = f"Shift Arrival Status Report — {hr_name} ({target_date})"
    message["Subject"] = subject

    total_emps = len(employees)
    present_cnt = sum(1 for e in employees if e.get("status") == "PRESENT")
    late_cnt = sum(1 for e in employees if e.get("status") == "LATE")
    not_checked_in_cnt = sum(1 for e in employees if e.get("status") in ("Not Checked In", "ABSENT"))

    # Plain text summary
    lines = [
        "Shift Arrival Status Report",
        f"Date: {target_date} | Assigned HR: {hr_name} | Practice: {practice}",
        "Miracle Software Systems",
        "",
        f"TOTAL ASSIGNED: {total_emps} | PRESENT: {present_cnt} | LATE: {late_cnt} | ABSENT / PENDING: {not_checked_in_cnt}",
        "",
        f"{'ID':<8} {'Name':<22} {'Department':<18} {'Practice':<18} {'Project':<16} {'Location':<18} {'Status':<16} {'Login Time':<12}",
        "=" * 130,
    ]

    for e in employees:
        emp_id = str(e.get("id") or e.get("employee_id") or "")
        emp_name = str(e.get("name") or e.get("employee_name") or "")[:21]
        dept = str(e.get("department") or "Software Services")[:17]
        prac = str(e.get("practice") or dept)[:17]
        proj = str(e.get("project") or "Internal")[:15]
        loc = str(e.get("location") or e.get("work_location") or "Miracle City (HQ)")[:17]
        status = str(e.get("status") or "Not Checked In")
        if status in ("Not Checked In", "ABSENT"):
            login_time = "00:00"
        else:
            login_time = str(e.get("login_time") or e.get("first_in") or "—")

        lines.append(f"{emp_id:<8} {emp_name:<22} {dept:<18} {prac:<18} {proj:<16} {loc:<18} {status:<16} {login_time:<12}")

    lines.extend([
        "=" * 130,
        "",
        f"Note: Employees marked Not Checked In with login time — have not checked in by the {cutoff_time} cutoff.",
        "This is not a permanent absence determination; any later check-ins will update live records.",
        "",
        "This is an automated email from FaceAttend. Please do not reply.",
        "Miracle Software Systems",
    ])
    body_text = "\n".join(lines)

    # HTML table rows
    rows_html = ""
    for e in employees:
        emp_id = str(e.get("id") or e.get("employee_id") or "")
        emp_name = str(e.get("name") or e.get("employee_name") or "")
        dept = str(e.get("department") or "Software Services")
        prac = str(e.get("practice") or dept)
        proj = str(e.get("project") or "Internal")
        loc = str(e.get("location") or e.get("work_location") or "Miracle City (HQ)")
        status = str(e.get("status") or "Not Checked In")

        if status in ("Not Checked In", "ABSENT"):
            badge_html = "<span style='display:inline-block;background-color:#e0f2fe;color:#0284c7;font-size:12.5px;font-weight:700;padding:6px 14px;border-radius:8px;'>Not Checked In</span>"
            login_time_html = "<span style='font-weight:700;color:#0f172a;'>00:00</span>"
        elif status == "LATE":
            badge_html = "<span style='display:inline-block;background-color:#fee2e2;color:#991b1b;font-size:12.5px;font-weight:700;padding:6px 14px;border-radius:8px;'>LATE</span>"
            login_val = str(e.get("login_time") or e.get("first_in") or "—")
            login_time_html = f"<span style='font-weight:700;color:#0f172a;'>{login_val}</span>"
        else:
            badge_html = "<span style='display:inline-block;background-color:#dcfce7;color:#166534;font-size:12.5px;font-weight:700;padding:6px 14px;border-radius:8px;'>PRESENT</span>"
            login_val = str(e.get("login_time") or e.get("first_in") or "—")
            login_time_html = f"<span style='font-weight:700;color:#0f172a;'>{login_val}</span>"

        rows_html += f"""<tr>
          <td style='padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;'>{emp_id}</td>
          <td style='padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:500;'>{emp_name}</td>
          <td style='padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#334155;'>{dept}</td>
          <td style='padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#334155;'>{prac}</td>
          <td style='padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#334155;'>{proj}</td>
          <td style='padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#334155;'>{loc}</td>
          <td style='padding:14px 16px;border-bottom:1px solid #e2e8f0;'>{badge_html}</td>
          <td style='padding:14px 16px;border-bottom:1px solid #e2e8f0;'>{login_time_html}</td>
        </tr>"""

    body_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shift Arrival Status Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px 12px; background-color: #f8fafc;">
  <div style="max-width: 960px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
    <!-- Header banner -->
    <div style="background-color: #003a70; padding: 22px 28px;">
      <table style="width: 100%; border-collapse: collapse; border: none;">
        <tr>
          <td style="vertical-align: middle; padding: 0;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">Shift Arrival Status Report</h1>
            <div style="margin-top: 6px; color: #e2e8f0; font-size: 13.5px;">
              Date: {target_date} &nbsp;|&nbsp; Assigned HR: {hr_name} &nbsp;|&nbsp; Practice: {practice}
            </div>
          </td>
          <td style="vertical-align: middle; text-align: right; padding: 0; white-space: nowrap;">
            <div style="border-left: 1.5px solid rgba(255, 255, 255, 0.35); padding-left: 20px; display: inline-block; text-align: left;">
              <span style="color: #ffffff; font-size: 20px; font-weight: 800;">Miracle</span>
              <span style="color: #cbd5e1; font-size: 15px; font-weight: 400; display: inline-block; margin-left: 4px;">Software Systems</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Summary cards -->
    <div style="padding: 20px 28px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <table style="width: 100%; border-collapse: separate; border-spacing: 14px 0;">
        <tr>
          <td style="width: 25%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">TOTAL ASSIGNED</div>
            <div style="font-size: 28px; font-weight: 700; color: #0284c7; margin-top: 4px;">{total_emps}</div>
          </td>
          <td style="width: 25%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">PRESENT</div>
            <div style="font-size: 28px; font-weight: 700; color: #16a34a; margin-top: 4px;">{present_cnt}</div>
          </td>
          <td style="width: 25%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">LATE</div>
            <div style="font-size: 28px; font-weight: 700; color: #dc2626; margin-top: 4px;">{late_cnt}</div>
          </td>
          <td style="width: 25%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">ABSENT / PENDING</div>
            <div style="font-size: 28px; font-weight: 700; color: #ea580c; margin-top: 4px;">{not_checked_in_cnt}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Report table -->
    <div style="padding: 24px 28px;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 13.5px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 12px 16px; text-align: left; font-weight: 700; color: #334155;">ID</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 700; color: #334155;">Name</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 700; color: #334155;">Department</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 700; color: #334155;">Practice</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 700; color: #334155;">Project</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 700; color: #334155;">Location</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 700; color: #334155;">Status</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 700; color: #334155;">Login Time</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>
    </div>

    <!-- Callout note box -->
    <div style="margin: 0 28px 24px 28px; padding: 14px 18px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #dbeafe;">
      <table style="width: 100%; border-collapse: collapse; border: none;">
        <tr>
          <td style="width: 28px; vertical-align: top; padding: 2px 0 0 0;">
            <div style="width: 20px; height: 20px; border-radius: 50%; background-color: #3b82f6; color: #ffffff; text-align: center; line-height: 20px; font-weight: 700; font-size: 13px;">i</div>
          </td>
          <td style="padding: 0 0 0 10px; font-size: 13px; color: #1e40af; line-height: 1.5;">
            <strong>Note:</strong> Employees marked <strong>Not Checked In</strong> with login time — have not checked in by the {cutoff_time} cutoff. This is not a permanent absence determination; any later check-ins will update live records.
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding: 18px 28px; border-top: 1px solid #e2e8f0; background-color: #ffffff;">
      <table style="border-collapse: collapse; border: none;">
        <tr>
          <td style="padding: 0 16px 0 0; vertical-align: middle;">
            <strong style="font-size: 20px; color: #003a70;">Miracle</strong>
          </td>
          <td style="padding: 0 0 0 16px; border-left: 1.5px solid #cbd5e1; vertical-align: middle; color: #64748b; font-size: 13px;">
            This is an automated email from FaceAttend. Please do not reply.
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>"""

    message.set_content(body_text)
    message.add_alternative(body_html, subtype="html")

    success, error = _send_smtp_message(message)
    log_email_notification(
        notification_type="HR_ATTENDANCE_REPORT",
        recipient_email=primary_to,
        recipient_name=hr_name,
        subject=subject,
        reference_id=reference_id,
        target_date=target_date,
        status="SENT" if success else "FAILED",
        error_message=error,
        cc_email=", ".join(applied_ccs),
    )
    return success


def send_cutoff_summary_email(
    hr_name: str,
    hr_email: str,
    group_name: str = None,
    shift_start: str = "14:00",
    cutoff_time: str = "15:00",
    target_date: str = None,
    on_time_list: list[dict] = None,
    late_list: list[dict] = None,
    missing_list: list[dict] = None,
    employees: list[dict] = None,
    totals: dict = None,
    practice: str = None,
    cc_email: str | list[str] | None = None,
    to_email: str | None = None,
) -> bool:
    """
    Backward-compatible wrapper routing to send_hr_attendance_report.
    """
    if employees is None:
        employees = []
        for r in (on_time_list or []):
            employees.append({
                "id": r.get("employee_id"),
                "name": r.get("employee_name"),
                "department": r.get("department") or "Software Services",
                "practice": r.get("practice") or "Software Services",
                "project": r.get("project") or "Internal",
                "location": r.get("work_location") or "Miracle City (HQ)",
                "status": "PRESENT",
                "login_time": r.get("first_in") or "—",
            })
        for r in (late_list or []):
            employees.append({
                "id": r.get("employee_id"),
                "name": r.get("employee_name"),
                "department": r.get("department") or "Software Services",
                "practice": r.get("practice") or "Software Services",
                "project": r.get("project") or "Internal",
                "location": r.get("work_location") or "Miracle City (HQ)",
                "status": "LATE",
                "login_time": r.get("first_in") or "—",
            })
        for r in (missing_list or []):
            employees.append({
                "id": r.get("employee_id"),
                "name": r.get("employee_name"),
                "department": r.get("department") or "Software Services",
                "practice": r.get("practice") or "Software Services",
                "project": r.get("project") or "Internal",
                "location": r.get("work_location") or "Miracle City (HQ)",
                "status": "Not Checked In",
                "login_time": "00:00",
            })

    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")

    return send_hr_attendance_report(
        hr_name=hr_name,
        hr_email=hr_email,
        shift_start=shift_start,
        cutoff_time=cutoff_time,
        target_date=target_date,
        employees=employees,
        totals=totals,
        practice=practice,
        cc_email=cc_email,
        to_email=to_email,
    )


# ============================================================
# END-OF-DAY ATTENDANCE REPORT (REFERENCE IMAGE 3)
# ============================================================

def send_eod_report_email(
    hr_name: str,
    hr_email: str,
    target_date: str,
    employees_data: list[dict],
    totals: dict | None = None,
    practice: str | None = None,
    group_name: str | None = None,
    cc_email: str | list[str] | None = None,
    to_email: str | None = None,
) -> bool:
    """
    Generate and email final End-of-Day Attendance Report matching Reference Image 3.
    Header: Dark-blue banner with date, assigned HR, practice, Miracle Software Systems branding.
    Summary cards: Total Assigned, On-Time, Late, Absent / Pending.
    Table columns: ID, Name, Shift, Arrival, Late, Checkout, Practice, Location, Status, Working Hours.
    Callout note: Explains absent employees with live update handling.
    """
    reference_id = hr_email or "hr_eod"
    if is_email_already_sent("EOD_REPORT", reference_id, target_date, hr_email):
        print(f"EOD report email already sent for {hr_email} on {target_date}.")
        return True

    if not hr_email:
        print(f"No HR email provided for EOD report.")
        return False

    # Determine reporting practice
    if not practice:
        practices = [e.get("practice") for e in employees_data if e.get("practice")]
        practice = practices[0] if practices else "DAAPS"

    if totals is None:
        total_cnt = len(employees_data)
        ontime_cnt = sum(1 for e in employees_data if str(e.get("status", "")).upper() in ("PRESENT", "ON_TIME", "FULL_DAY") and not e.get("late_minutes"))
        late_cnt = sum(1 for e in employees_data if str(e.get("status", "")).upper() == "LATE" or (e.get("late_minutes") and int(e.get("late_minutes")) > 0))
        absent_cnt = sum(1 for e in employees_data if str(e.get("status", "")).upper() in ("ABSENT", "NOT CHECKED IN"))
        totals = {"total": total_cnt, "on_time": ontime_cnt, "late": late_cnt, "absent": absent_cnt}

    message = EmailMessage()
    message["From"] = EMAIL_SENDER or "noreply@miraclesoft.com"
    primary_to = (to_email or hr_email or "").strip()
    message["To"] = primary_to
    applied_ccs = _apply_cc_recipients(
        message,
        primary_to=primary_to,
        explicit_cc=cc_email,
        include_default_cc=True,
    )
    subject = f"End-of-Day Attendance Report — {hr_name} ({target_date})"
    message["Subject"] = subject

    total_cnt = totals.get("total", len(employees_data))
    ontime_cnt = totals.get("on_time", 0)
    late_cnt = totals.get("late", 0)
    absent_cnt = totals.get("absent", 0)

    # Plain text formatting
    lines = [
        "End-of-Day Attendance Report",
        f"Date: {target_date} | Assigned HR: {hr_name} | Practice: {practice}",
        "Miracle Software Systems",
        "",
        f"TOTAL ASSIGNED: {total_cnt} | ON-TIME: {ontime_cnt} | LATE: {late_cnt} | ABSENT / PENDING: {absent_cnt}",
        "",
        f"{'ID':<8} {'Name':<22} {'Shift':<15} {'Arrival':<10} {'Late':<8} {'Checkout':<10} {'Practice':<16} {'Location':<18} {'Status':<12} {'Working Hours':<15}",
        "=" * 140,
    ]

    for e in employees_data:
        emp_id = str(e.get("employee_id") or "")
        name = str(e.get("employee_name") or "")[:21]
        shift = f"{e.get('shift_start') or '14:00'} – {e.get('shift_end') or '22:00'}"
        first_in = str(e.get("first_in") or "--")
        late = f"{e.get('late_minutes')} min" if e.get("late_minutes") else "--"
        last_out = str(e.get("last_out") or "--")
        prac = str(e.get("practice") or e.get("department") or "Software Services")[:15]
        loc = str(e.get("work_location") or "Miracle City (HQ)")[:17]
        status = str(e.get("status") or "ABSENT")
        is_prov = bool(e.get("is_provisional"))
        worked = str(e.get("worked_hours") or "0h 0m")
        if is_prov and e.get("first_in"):
            worked += " (Provisional)"

        lines.append(f"{emp_id:<8} {name:<22} {shift:<15} {first_in:<10} {late:<8} {last_out:<10} {prac:<16} {loc:<18} {status:<12} {worked:<15}")

    lines.extend([
        "=" * 140,
        "",
        "Note: Employees marked Absent with login time — have not checked in by the end of the day.",
        "This is not a permanent absence determination; any later check-ins will update live records.",
        "",
        "This is an automated email from FaceAttend. Please do not reply.",
        "Miracle Software Systems",
    ])
    body_text = "\n".join(lines)

    # HTML table rows
    rows_html = ""
    for e in employees_data:
        emp_id = str(e.get("employee_id") or "")
        name = str(e.get("employee_name") or "")
        shift_s = e.get("shift_start") or "14:00"
        shift_e = e.get("shift_end") or "22:00"
        shift = f"{shift_s} – {shift_e}"
        first_in = str(e.get("first_in") or "--")
        late = f"{e.get('late_minutes')} min" if e.get("late_minutes") else "--"
        last_out = str(e.get("last_out") or "--")
        prac = str(e.get("practice") or e.get("department") or "Software Services")
        loc = str(e.get("work_location") or "Miracle City (HQ)")
        status = str(e.get("status") or "ABSENT")
        is_prov = bool(e.get("is_provisional"))
        worked = str(e.get("worked_hours") or "0h 0m")

        prov_badge = ""
        if is_prov and e.get("first_in"):
            prov_badge = " <span style='font-size:10.5px;color:#d97706;background:#fef3c7;padding:2px 5px;border-radius:3px;font-weight:600;'>Provisional</span>"

        if status == "ABSENT":
            status_badge = "<span style='display:inline-block;background-color:#fee2e2;color:#dc2626;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.5px;'>ABSENT</span>"
        elif status in ("PRESENT", "FULL_DAY", "ON_TIME"):
            status_badge = "<span style='display:inline-block;background-color:#dcfce7;color:#166534;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;'>PRESENT</span>"
        else:
            status_badge = f"<span style='display:inline-block;background-color:#fef3c7;color:#92400e;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;'>{status}</span>"

        rows_html += f"""<tr>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a;'>{emp_id}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:500;'>{name}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;white-space:nowrap;'>{shift}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;'>{first_in}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;'>{late}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;'>{last_out}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;'>{prac}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#334155;'>{loc}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;'>{status_badge}</td>
          <td style='padding:12px 14px;border-bottom:1px solid #e2e8f0;'><strong style='color:#0f172a;'>{worked}</strong>{prov_badge}</td>
        </tr>"""

    body_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>End-of-Day Attendance Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px 12px; background-color: #f8fafc;">
  <div style="max-width: 980px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
    <!-- Header banner -->
    <div style="background-color: #003a70; padding: 22px 28px;">
      <table style="width: 100%; border-collapse: collapse; border: none;">
        <tr>
          <td style="vertical-align: middle; padding: 0;">
            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.3px;">End-of-Day Attendance Report</h1>
            <div style="margin-top: 6px; color: #e2e8f0; font-size: 13.5px;">
              Date: {target_date} &nbsp;|&nbsp; Assigned HR: {hr_name} &nbsp;|&nbsp; Practice: {practice}
            </div>
          </td>
          <td style="vertical-align: middle; text-align: right; padding: 0; white-space: nowrap;">
            <div style="border-left: 1.5px solid rgba(255, 255, 255, 0.35); padding-left: 20px; display: inline-block; text-align: left;">
              <span style="color: #ffffff; font-size: 20px; font-weight: 800;">Miracle</span>
              <span style="color: #cbd5e1; font-size: 15px; font-weight: 400; display: inline-block; margin-left: 4px;">Software Systems</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Summary cards -->
    <div style="padding: 20px 28px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <table style="width: 100%; border-collapse: separate; border-spacing: 14px 0;">
        <tr>
          <td style="width: 25%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">TOTAL ASSIGNED</div>
            <div style="font-size: 28px; font-weight: 700; color: #0284c7; margin-top: 4px;">{total_cnt}</div>
          </td>
          <td style="width: 25%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">ON-TIME</div>
            <div style="font-size: 28px; font-weight: 700; color: #16a34a; margin-top: 4px;">{ontime_cnt}</div>
          </td>
          <td style="width: 25%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">LATE</div>
            <div style="font-size: 28px; font-weight: 700; color: #dc2626; margin-top: 4px;">{late_cnt}</div>
          </td>
          <td style="width: 25%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">ABSENT / PENDING</div>
            <div style="font-size: 28px; font-weight: 700; color: #ea580c; margin-top: 4px;">{absent_cnt}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Report table -->
    <div style="padding: 24px 28px;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 13.5px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">ID</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Name</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Shift</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Arrival</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Late</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Checkout</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Practice</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Location</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Status</th>
            <th style="padding: 12px 14px; text-align: left; font-weight: 700; color: #334155;">Working Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows_html}
        </tbody>
      </table>
    </div>

    <!-- Callout note box -->
    <div style="margin: 0 28px 24px 28px; padding: 14px 18px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #dbeafe;">
      <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
        <strong>Note:</strong> Employees marked <strong>Absent</strong> with login time — have not checked in by the end of the day. This is not a permanent absence determination; any later check-ins will update live records.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 18px 28px; border-top: 1px solid #e2e8f0; background-color: #ffffff;">
      <table style="border-collapse: collapse; border: none;">
        <tr>
          <td style="padding: 0 16px 0 0; vertical-align: middle;">
            <strong style="font-size: 20px; color: #003a70;">Miracle</strong>
          </td>
          <td style="padding: 0 0 0 16px; border-left: 1.5px solid #cbd5e1; vertical-align: middle; color: #64748b; font-size: 13px;">
            This is an automated email from FaceAttend. Please do not reply.
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>"""

    message.set_content(body_text)
    message.add_alternative(body_html, subtype="html")

    success, error = _send_smtp_message(message)
    log_email_notification(
        notification_type="EOD_REPORT",
        recipient_email=primary_to,
        recipient_name=hr_name,
        subject=subject,
        reference_id=reference_id,
        target_date=target_date,
        status="SENT" if success else "FAILED",
        error_message=error,
        cc_email=", ".join(applied_ccs),
    )
    return success


# ============================================================
# COMPATIBILITY WRAPPER
# ============================================================

def send_arrival_email(
    employee_name,
    employee_email,
    shift_start,
    first_in,
    status,
    minutes,
    cc_email=None,
):
    """
    Backward-compatible wrapper for existing arrival notifications.
    """
    if status == "LATE":
        return send_late_arrival_notification(
            employee_id="N/A",
            employee_name=employee_name,
            employee_email=employee_email,
            shift_start=shift_start,
            arrival_time=first_in,
            minutes_late=minutes,
            department="Software Services",
            practice="Software Services",
            project="Internal",
            office_location="Miracle City (HQ)",
            hr_name="HR Manager",
            hr_email=cc_email,
            cc_email=cc_email,
        )

    # Early arrival
    message = EmailMessage()
    message["From"] = EMAIL_SENDER or "noreply@miraclesoft.com"
    message["To"] = employee_email
    applied_ccs = _apply_cc_recipients(
        message,
        primary_to=employee_email,
        explicit_cc=cc_email,
        include_default_cc=True,
    )

    message["Subject"] = "Early Arrival Notification"
    message.set_content(
        f"""Hello {employee_name},

This is an automated attendance notification.

Your first arrival today was recorded earlier than your scheduled shift.

Employee       : {employee_name}
Shift Start    : {shift_start}
First IN       : {first_in}
Arrival Status : EARLY
Early By       : {minutes} minutes

Regards,
Employee Attendance System
"""
    )
    success, error = _send_smtp_message(message)
    log_email_notification(
        notification_type="EARLY_ARRIVAL",
        recipient_email=employee_email,
        recipient_name=employee_name,
        subject="Early Arrival Notification",
        reference_id=employee_name,
        target_date=datetime.now().strftime("%Y-%m-%d"),
        status="SENT" if success else "FAILED",
        error_message=error,
    )
    return success


def get_email_logs(limit: int = 100, status: str | None = None, notification_type: str | None = None) -> list[dict]:
    try:
        conn = _get_db()
        cursor = conn.cursor()
        query = "SELECT * FROM email_notification_logs WHERE 1=1"
        params = []
        if status:
            query += " AND status = ?"
            params.append(status.upper())
        if notification_type:
            query += " AND notification_type = ?"
            params.append(notification_type.upper())
        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        rows = cursor.execute(query, tuple(params)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"Error fetching email logs: {e}")
        return []