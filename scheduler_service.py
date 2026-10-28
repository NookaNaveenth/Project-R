"""Background scheduling service for automated attendance cutoff and EOD reports."""

import os
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATABASE = BASE_DIR / "attendance.db"


def _get_db():
    connection = sqlite3.connect(DATABASE, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def get_configured_timezone():
    tz_str = os.getenv("TIMEZONE", "Asia/Kolkata").strip()
    if tz_str.lower() in ("asia/kolkata", "ist", "+05:30", "+0530"):
        return timezone(timedelta(hours=5, minutes=30))
    if tz_str.lower() in ("utc", "gmt"):
        return timezone.utc
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(tz_str)
    except Exception:
        # Fallback to local system timezone
        return datetime.now().astimezone().tzinfo


class SchedulerService:
    def __init__(self):
        self.cutoff_time = os.getenv("CUTOFF_CHECK_TIME", "15:00").strip()
        self.eod_time = os.getenv("EOD_REPORT_TIME", "22:30").strip()
        self.tz_name = os.getenv("TIMEZONE", "Asia/Kolkata").strip()
        try:
            self.buffer_minutes = int(os.getenv("REPORTING_BUFFER_MINUTES", "60").strip())
        except Exception:
            self.buffer_minutes = 60
        self._running = False
        self._thread = None
        self._lock = threading.Lock()

    def get_tz(self):
        return get_configured_timezone()

    def get_now(self):
        return datetime.now(self.get_tz())

    def start(self):
        with self._lock:
            if self._running:
                return
            self._running = True
            self._thread = threading.Thread(
                target=self._worker_loop,
                name="faceattend-scheduler",
                daemon=True,
            )
            self._thread.start()
            print(f"FaceAttend Scheduler started: Timezone={self.tz_name}, Buffer={self.buffer_minutes}m, EOD={self.eod_time}")

    def stop(self):
        with self._lock:
            self._running = False
        if self._thread and self._thread.is_alive() and self._thread is not threading.current_thread():
            self._thread.join(timeout=2.0)
        print("FaceAttend Scheduler stopped.")

    def is_running(self):
        return self._running and self._thread is not None and self._thread.is_alive()

    def _worker_loop(self):
        import attendance as db
        while self._running:
            try:
                now = self.get_now()
                target_date = now.strftime("%Y-%m-%d")
                current_time = now.strftime("%H:%M")

                # Dynamic shift cutoff evaluations (Cutoff = Shift start + buffer_minutes)
                shifts = db.get_distinct_shifts()
                if not shifts:
                    shifts = ["14:00"]

                for shift in shifts:
                    cutoff_time = db.calculate_shift_cutoff(shift, self.buffer_minutes)
                    job_key = f"cutoff_shift_{shift}"
                    if current_time >= cutoff_time:
                        if not self._is_job_executed(job_key, target_date):
                            print(f"Executing automated cutoff check for shift {shift} at {current_time} (cutoff: {cutoff_time})...")
                            self.process_cutoff_check(shift_start=shift, target_date=target_date)

                # End-of-Day HR Report
                if current_time >= self.eod_time:
                    if not self._is_job_executed("eod_report", target_date):
                        print(f"Executing automated EOD report for {target_date} at {current_time}...")
                        self.process_eod_reports(target_date=target_date)

            except Exception as e:
                print(f"Error in scheduler tick: {e}")

            # Sleep 15 seconds between evaluations
            for _ in range(15):
                if not self._running:
                    break
                time.sleep(1)

    def _is_job_executed(self, job_name: str, target_date: str) -> bool:
        try:
            conn = _get_db()
            cursor = conn.cursor()
            cursor.execute(
                """CREATE TABLE IF NOT EXISTS scheduled_job_executions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_name TEXT NOT NULL,
                    target_date TEXT NOT NULL,
                    status TEXT NOT NULL,
                    executed_at TEXT NOT NULL,
                    details TEXT,
                    UNIQUE(job_name, target_date)
                )"""
            )
            row = cursor.execute(
                "SELECT id FROM scheduled_job_executions WHERE job_name = ? AND target_date = ? AND status = 'COMPLETED'",
                (job_name, target_date),
            ).fetchone()
            conn.close()
            return row is not None
        except Exception as e:
            print(f"Error checking job execution: {e}")
            return False

    def _record_job_execution(self, job_name: str, target_date: str, status: str, details: str = ""):
        try:
            conn = _get_db()
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO scheduled_job_executions (job_name, target_date, status, executed_at, details)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(job_name, target_date)
                   DO UPDATE SET status = excluded.status, executed_at = excluded.executed_at, details = excluded.details""",
                (job_name, target_date, status, datetime.now().isoformat(), details),
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error recording job execution: {e}")

    def process_cutoff_check(self, shift_start: str | None = None, target_date: str | None = None, force: bool = False) -> dict:
        """
        Processes shift cutoff attendance reports for assigned HRs.
        If shift_start is specified, evaluates only that shift's cutoff.
        Otherwise, evaluates all configured shifts.
        """
        import attendance as db
        from email_service import send_hr_attendance_report

        if not target_date:
            target_date = self.get_now().strftime("%Y-%m-%d")

        job_key = f"cutoff_shift_{shift_start}" if shift_start else "cutoff_check"

        if not force and self._is_job_executed(job_key, target_date):
            return {
                "ok": True,
                "executed": False,
                "already_executed": True,
                "message": f"Cutoff check already executed for {job_key} on {target_date}",
            }

        if shift_start:
            reports = db.get_shift_cutoff_attendance_reports(
                shift_start=shift_start,
                target_date=target_date,
                buffer_minutes=self.buffer_minutes,
            )
        else:
            reports = db.get_all_shift_cutoff_reports(
                target_date=target_date,
                buffer_minutes=self.buffer_minutes,
            )

        results = []
        for rep in reports:
            hr_name = rep["hr_name"]
            hr_email = rep["hr_email"]
            s_start = rep["shift_start"]
            c_time = rep["cutoff_time"]
            employees = rep["employees"]
            totals = rep.get("totals")

            email_sent = False
            if hr_email and "@" in hr_email:
                email_sent = send_hr_attendance_report(
                    hr_name=hr_name,
                    hr_email=hr_email,
                    shift_start=s_start,
                    cutoff_time=c_time,
                    target_date=target_date,
                    employees=employees,
                    totals=totals,
                    practice=rep.get("practice"),
                )

            results.append({
                "assigned_hr": hr_name,
                "assigned_hr_email": hr_email,
                "shift_start": s_start,
                "cutoff_time": c_time,
                "employees_count": len(employees),
                "totals": totals,
                "email_sent": email_sent,
                "report": rep,
            })

        self._record_job_execution(
            job_key,
            target_date,
            "COMPLETED",
            details=f"Processed {len(results)} HR reports for {job_key}",
        )

        return {
            "ok": True,
            "executed": True,
            "target_date": target_date,
            "shift_start": shift_start,
            "buffer_minutes": self.buffer_minutes,
            "hr_reports_processed": len(results),
            "results": results,
        }

    def process_eod_reports(self, target_date: str | None = None, force: bool = False) -> dict:
        """
        Generate and send the final End-of-Day report for each HR covering only their assigned employees.
        """
        import attendance as db
        from email_service import send_eod_report_email

        if not target_date:
            target_date = self.get_now().strftime("%Y-%m-%d")

        if not force and self._is_job_executed("eod_report", target_date):
            return {
                "ok": True,
                "executed": False,
                "already_executed": True,
                "message": f"EOD report already executed for {target_date}",
            }

        reports = db.get_hr_end_of_day_reports(target_date=target_date)
        results = []

        for rep in reports:
            hr_name = rep["hr_name"]
            hr_email = rep["hr_email"]

            email_sent = False
            if hr_email and "@" in hr_email:
                email_sent = send_eod_report_email(
                    hr_name=hr_name,
                    hr_email=hr_email,
                    target_date=target_date,
                    employees_data=rep["employees"],
                    totals=rep["totals"],
                    practice=rep.get("practice"),
                )

            results.append({
                "assigned_hr": hr_name,
                "assigned_hr_email": hr_email,
                "totals": rep["totals"],
                "email_sent": email_sent,
                "employees_count": len(rep["employees"]),
            })

        self._record_job_execution(
            "eod_report",
            target_date,
            "COMPLETED",
            details=f"Processed EOD reports for {len(results)} HRs",
        )

        return {
            "ok": True,
            "executed": True,
            "target_date": target_date,
            "eod_time": self.eod_time,
            "reports_processed": len(results),
            "results": results,
        }

    def get_status(self) -> dict:
        conn = _get_db()
        cursor = conn.cursor()
        cursor.execute(
            """CREATE TABLE IF NOT EXISTS scheduled_job_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_name TEXT NOT NULL,
                target_date TEXT NOT NULL,
                status TEXT NOT NULL,
                executed_at TEXT NOT NULL,
                details TEXT,
                UNIQUE(job_name, target_date)
            )"""
        )
        recent_jobs = [dict(r) for r in cursor.execute("SELECT * FROM scheduled_job_executions ORDER BY id DESC LIMIT 20").fetchall()]
        conn.close()

        now = self.get_now()
        return {
            "is_running": self.is_running(),
            "timezone": self.tz_name,
            "current_time": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
            "buffer_minutes": self.buffer_minutes,
            "cutoff_check_time": self.cutoff_time,
            "eod_report_time": self.eod_time,
            "recent_jobs": recent_jobs,
        }

    def update_config(self, cutoff_time: str | None = None, eod_time: str | None = None, timezone_name: str | None = None, buffer_minutes: int | None = None):
        if cutoff_time:
            self.cutoff_time = cutoff_time.strip()
        if eod_time:
            self.eod_time = eod_time.strip()
        if timezone_name:
            self.tz_name = timezone_name.strip()
        if buffer_minutes is not None:
            self.buffer_minutes = int(buffer_minutes)
        return self.get_status()


# Global Singleton
scheduler_service = SchedulerService()


def start_scheduler():
    scheduler_service.start()


def stop_scheduler():
    scheduler_service.stop()
