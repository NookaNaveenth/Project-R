"""Shared camera configuration storage and frame-source abstraction."""

from __future__ import annotations

import atexit
import json
import os
import sqlite3

os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit

import cv2
from dotenv import dotenv_values

BASE_DIR = Path(__file__).resolve().parent
CAMERA_DATABASE = BASE_DIR / "camera_config.db"
_VALID_ROLES = {"ENTRY", "EXIT", "ENROLLMENT"}
_CAMERA_LOCK = threading.RLock()
_PREVIEW_LOCK = threading.RLock()
_ACTIVE_PREVIEWS: dict[str, dict[str, tuple["CameraSource", threading.Event]]] = {}


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(CAMERA_DATABASE, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


_STORE_INITIALIZED = False
_CAMERA_CACHE: dict[str, dict] = {}
_CAMERA_CACHE_LOCK = threading.Lock()


def initialize_camera_store() -> None:
    global _STORE_INITIALIZED
    if _STORE_INITIALIZED:
        return
    with _CAMERA_LOCK:
        if _STORE_INITIALIZED:
            return
        connection = _connect()
        connection.execute(
            """CREATE TABLE IF NOT EXISTS cameras (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source TEXT NOT NULL,
                roles TEXT NOT NULL DEFAULT '[]',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        connection.execute(
            "CREATE TABLE IF NOT EXISTS camera_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        migrated = connection.execute(
            "SELECT value FROM camera_meta WHERE key='legacy_env_imported'"
        ).fetchone()
        if migrated is None:
            _migrate_legacy_env(connection)
            connection.execute(
                "INSERT INTO camera_meta(key,value) VALUES('legacy_env_imported','1')"
            )
        connection.commit()
        connection.close()
        _STORE_INITIALIZED = True


def _migrate_legacy_env(connection: sqlite3.Connection) -> None:
    """Import existing ENTRY_CAMERA/EXIT_CAMERA values once, if present."""
    values = dotenv_values(BASE_DIR / ".env")
    imported: set[tuple[str, str]] = set()
    for role, key, default_name in (
        ("ENTRY", "ENTRY_CAMERA", "Entry camera"),
        ("EXIT", "EXIT_CAMERA", "Exit camera"),
    ):
        source = (values.get(key) or os.getenv(key) or "").strip().strip("'\"")
        if not source:
            continue
        source_type = "ip" if urlsplit(source).scheme.lower() in {"rtsp", "rtsps", "http", "https"} else "webcam"
        identity = (source_type, source)
        if identity in imported:
            existing_id = connection.execute(
                "SELECT id FROM cameras WHERE source_type=? AND source=?", identity
            ).fetchone()[0]
            row = connection.execute("SELECT roles FROM cameras WHERE id=?", (existing_id,)).fetchone()
            roles = set(json.loads(row[0]))
            roles.add(role)
            connection.execute("UPDATE cameras SET roles=? WHERE id=?", (json.dumps(sorted(roles)), existing_id))
            continue
        imported.add(identity)
        connection.execute(
            "INSERT INTO cameras(id,name,source_type,source,roles,enabled) VALUES(?,?,?,?,?,1)",
            (str(uuid.uuid4()), default_name, source_type, source, json.dumps([role])),
        )


def validate_source(source_type: str, source: str) -> str:
    normalized_type = source_type.strip().lower()
    normalized_source = source.strip()
    if normalized_type == "webcam":
        if not normalized_source or not (normalized_source.isdigit() or normalized_source.startswith("/dev/") or os.path.exists(normalized_source)):
            raise ValueError("Webcam source must be a device index (for example 0 or 1) or a local device path.")
        return normalized_source
    if normalized_type == "ip":
        parsed = urlsplit(normalized_source)
        try:
            valid_port = parsed.port is None or 1 <= parsed.port <= 65535
        except ValueError:
            valid_port = False
        if parsed.scheme.lower() not in {"rtsp", "rtsps", "http", "https"} or not parsed.hostname or not valid_port:
            raise ValueError("IP camera source must be a valid RTSP, RTSPS, HTTP, or HTTPS stream URL.")
        return normalized_source
    raise ValueError("Camera type must be webcam or ip.")


def normalize_roles(roles: list[str]) -> list[str]:
    normalized = sorted({role.strip().upper() for role in roles})
    if any(role not in _VALID_ROLES for role in normalized):
        raise ValueError("Camera roles may only be ENTRY, EXIT, and ENROLLMENT.")
    return normalized


def _public_camera(row: sqlite3.Row) -> dict:
    source_type = row["source_type"]
    source = row["source"]
    parsed = urlsplit(source) if source_type == "ip" else None
    device = source
    if parsed and parsed.hostname:
        port = f":{parsed.port}" if parsed.port else ""
        device = f"{parsed.scheme.lower()}://{parsed.hostname}{port}/…"
    return {
        "id": row["id"],
        "name": row["name"],
        "source_type": source_type,
        "device": device,
        "roles": json.loads(row["roles"]),
        "enabled": bool(row["enabled"]),
        "connected": None,
        "configured": True,
    }


def list_cameras(*, enabled_only: bool = False, include_source: bool = False) -> list[dict]:
    initialize_camera_store()
    connection = _connect()
    query = "SELECT * FROM cameras"
    if enabled_only:
        query += " WHERE enabled=1"
    query += " ORDER BY name COLLATE NOCASE"
    rows = connection.execute(query).fetchall()
    connection.close()
    cameras = [_public_camera(row) for row in rows]
    if include_source:
        for camera, row in zip(cameras, rows):
            camera["source"] = row["source"]
    return cameras


def get_camera(camera_id: str) -> dict | None:
    if not _STORE_INITIALIZED:
        initialize_camera_store()
    with _CAMERA_CACHE_LOCK:
        if camera_id in _CAMERA_CACHE:
            return dict(_CAMERA_CACHE[camera_id])
    connection = _connect()
    row = connection.execute("SELECT * FROM cameras WHERE id=?", (camera_id,)).fetchone()
    connection.close()
    if row is None:
        return None
    item = _public_camera(row)
    item["source"] = row["source"]
    with _CAMERA_CACHE_LOCK:
        _CAMERA_CACHE[camera_id] = dict(item)
    return item


def save_camera(*, name: str, source_type: str, source: str, roles: list[str], enabled: bool, camera_id: str | None = None) -> dict:
    initialize_camera_store()
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("Camera name is required.")
    validated_source = validate_source(source_type, source)
    role_values = normalize_roles(roles)
    identity = camera_id or str(uuid.uuid4())
    connection = _connect()
    existing = connection.execute("SELECT id FROM cameras WHERE id=?", (identity,)).fetchone()
    if camera_id and existing is None:
        connection.close()
        raise KeyError("Camera not found.")
    if existing:
        stop_camera_previews(identity)
        STREAM_HUB.stop_camera(identity)
        connection.execute(
            "UPDATE cameras SET name=?,source_type=?,source=?,roles=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (clean_name, source_type.strip().lower(), validated_source, json.dumps(role_values), int(enabled), identity),
        )
    else:
        connection.execute(
            "INSERT INTO cameras(id,name,source_type,source,roles,enabled) VALUES(?,?,?,?,?,?)",
            (identity, clean_name, source_type.strip().lower(), validated_source, json.dumps(role_values), int(enabled)),
        )
    connection.commit()
    connection.close()
    with _CAMERA_CACHE_LOCK:
        _CAMERA_CACHE.clear()
    return next(item for item in list_cameras() if item["id"] == identity)


def set_camera_enabled(camera_id: str, enabled: bool) -> dict | None:
    initialize_camera_store()
    if not enabled:
        stop_camera_previews(camera_id)
        STREAM_HUB.stop_camera(camera_id)
    connection = _connect()
    cursor = connection.execute(
        "UPDATE cameras SET enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (int(enabled), camera_id),
    )
    connection.commit()
    connection.close()
    with _CAMERA_CACHE_LOCK:
        _CAMERA_CACHE.clear()
    return next((item for item in list_cameras() if item["id"] == camera_id), None) if cursor.rowcount else None


def delete_camera(camera_id: str) -> bool:
    stop_camera_previews(camera_id)
    STREAM_HUB.stop_camera(camera_id)
    initialize_camera_store()
    connection = _connect()
    cursor = connection.execute("DELETE FROM cameras WHERE id=?", (camera_id,))
    connection.commit()
    connection.close()
    with _CAMERA_CACHE_LOCK:
        _CAMERA_CACHE.clear()
    return cursor.rowcount > 0


def register_camera_preview(camera_id: str, stream_id: str, source: "CameraSource", stop_event: threading.Event) -> None:
    with _PREVIEW_LOCK:
        previews = _ACTIVE_PREVIEWS.setdefault(camera_id, {})
        previous = previews.pop(stream_id, None)
        if previous is not None:
            previous[1].set()
        previews[stream_id] = (source, stop_event)


def stop_camera_preview(camera_id: str, stream_id: str) -> bool:
    with _PREVIEW_LOCK:
        previews = _ACTIVE_PREVIEWS.get(camera_id, {})
        preview = previews.pop(stream_id, None)
        if not previews:
            _ACTIVE_PREVIEWS.pop(camera_id, None)
    if preview is None:
        return False
    _, stop_event = preview
    # Do not call VideoCapture.release() here: the stream generator may be
    # inside VideoCapture.read() on another thread. It owns release in finally.
    stop_event.set()
    return True


def stop_camera_previews(camera_id: str) -> int:
    with _PREVIEW_LOCK:
        previews = _ACTIVE_PREVIEWS.pop(camera_id, {})
    for _, stop_event in previews.values():
        # Signal each generator; it releases its capture after read() returns.
        stop_event.set()
    return len(previews)


def stop_all_camera_previews() -> int:
    """Stop and release all currently running camera preview streams."""
    with _PREVIEW_LOCK:
        camera_ids = list(_ACTIVE_PREVIEWS.keys())
    total_stopped = 0
    for camera_id in camera_ids:
        total_stopped += stop_camera_previews(camera_id)
    return total_stopped


atexit.register(stop_all_camera_previews)


class CameraSource:
    """OpenCV source that drops queued frames and delivers the newest frame."""

    def __init__(self, source: str, source_type: str | None = None):
        if source_type is None:
            source_type = "ip" if urlsplit(str(source)).scheme.lower() in {"rtsp", "rtsps", "http", "https"} else "webcam"
        self.source_type = source_type
        self.source = source
        if source_type == "ip":
            # On Windows, TCP transport avoids UDP packet loss and Windows Firewall drops.
            # On Linux/LAN with reliable network, UDP can still be selected via FACE_RTSP_TRANSPORT.
            default_transport = "tcp" if os.name == "nt" else "udp"
            transport = os.getenv("FACE_RTSP_TRANSPORT", default_transport).strip().lower()
            if transport not in {"tcp", "udp"}:
                transport = default_transport
            try:
                reorder_queue_size = max(
                    16, min(4096, int(os.getenv("FACE_RTSP_REORDER_QUEUE_SIZE", "128")))
                )
            except ValueError:
                reorder_queue_size = 128
            try:
                max_delay_us = max(
                    0, min(500000, int(os.getenv("FACE_RTSP_MAX_DELAY_US", "100000")))
                )
            except ValueError:
                max_delay_us = 100000
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
                f"rtsp_transport;{transport}|reorder_queue_size;{reorder_queue_size}|max_delay;{max_delay_us}"
            )
            self.capture = cv2.VideoCapture()
            try:
                self.capture.open(
                    source,
                    cv2.CAP_FFMPEG,
                    [
                        cv2.CAP_PROP_OPEN_TIMEOUT_MSEC,
                        5000,
                        cv2.CAP_PROP_READ_TIMEOUT_MSEC,
                        2000,
                    ],
                )
            except (TypeError, cv2.error):
                self.capture.open(source, cv2.CAP_FFMPEG)
        else:
            device: int | str = int(source) if str(source).isdigit() else source
            if os.name == "nt":
                self.capture = cv2.VideoCapture(device, cv2.CAP_DSHOW)
            else:
                self.capture = cv2.VideoCapture(device, cv2.CAP_V4L2)
                if not self.capture.isOpened():
                    self.capture = cv2.VideoCapture(device)
        self._frame_condition = threading.Condition()
        self._stop_event = threading.Event()
        self._latest_frame = None
        self._frame_sequence = 0
        self._last_delivered_sequence = 0
        self._reader_finished = False
        self._release_lock = threading.Lock()
        self._reader_thread = None
        if self.capture.isOpened():
            if source_type != "ip":
                if os.name == "nt":
                    # DirectShow MJPG fourcc enables high FPS at 720p/1080p for USB webcams
                    try:
                        self.capture.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
                    except Exception:
                        pass
                try:
                    requested_width = max(640, int(os.getenv("FACE_CAMERA_WIDTH", "1280")))
                    requested_height = max(480, int(os.getenv("FACE_CAMERA_HEIGHT", "720")))
                except ValueError:
                    requested_width, requested_height = 1280, 720
                try:
                    self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, requested_width)
                    self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, requested_height)
                except Exception:
                    pass
            # Not all backends honor this; the reader thread below also drops
            # stale frames regardless of backend buffering behavior.
            try:
                self.capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass
            self._reader_thread = threading.Thread(
                target=self._capture_latest_frame,
                name="camera-frame-reader",
                daemon=True,
            )
            self._reader_thread.start()

    def _capture_latest_frame(self) -> None:
        try:
            while not self._stop_event.is_set():
                success, frame = self.capture.read()
                if not success or frame is None:
                    # Avoid a hot loop on a disconnected stream while allowing
                    # OpenCV to recover from a brief network interruption.
                    self._stop_event.wait(0.01)
                    continue
                with self._frame_condition:
                    self._latest_frame = frame
                    self._frame_sequence += 1
                    self._frame_condition.notify_all()
        except cv2.error:
            pass
        finally:
            with self._frame_condition:
                self._reader_finished = True
                self._frame_condition.notify_all()

    def isOpened(self) -> bool:
        return self.capture.isOpened()

    def read(self):
        # Wait for a new frame, but return the most recent one rather than
        # allowing inference/encoding to build up a queue of old frames.
        with self._frame_condition:
            ready = self._frame_condition.wait_for(
                lambda: (
                    self._frame_sequence > self._last_delivered_sequence
                    or self._reader_finished
                    or self._stop_event.is_set()
                ),
                timeout=2.5,
            )
            if not ready or self._frame_sequence <= self._last_delivered_sequence:
                return False, None
            self._last_delivered_sequence = self._frame_sequence
            return True, self._latest_frame

    def read_latest(self):
        """Return a newly captured frame immediately, without waiting."""
        with self._frame_condition:
            if self._frame_sequence <= self._last_delivered_sequence:
                return False, None
            self._last_delivered_sequence = self._frame_sequence
            return True, self._latest_frame

    def release(self) -> None:
        with self._release_lock:
            self._stop_event.set()
            with self._frame_condition:
                self._frame_condition.notify_all()
            reader = self._reader_thread
            if reader is not None and reader.is_alive() and reader is not threading.current_thread():
                reader.join(timeout=2.5)
                if reader.is_alive():
                    # A blocked backend read can outlive its timeout; release
                    # the handle to interrupt it, then allow the worker to exit.
                    self.capture.release()
                    reader.join(timeout=0.5)
                    return
            try:
                self.capture.release()
            except cv2.error:
                pass


def open_camera(camera: dict) -> CameraSource:
    if not camera.get("enabled", True):
        raise ValueError("Camera is disabled.")
    source = camera.get("source")
    if source is None and camera.get("id"):
        full_cam = get_camera(camera["id"])
        if full_cam and full_cam.get("source"):
            source = full_cam["source"]
    if source is None:
        raise KeyError("Camera dictionary is missing 'source' configuration.")
    return CameraSource(source, camera["source_type"])


class SharedCameraStream:
    """Manages a single underlying camera source shared across multiple preview consumers."""

    def __init__(self, camera: dict):
        self.camera_id = camera["id"]
        self.camera = dict(camera)
        if "source" not in self.camera and self.camera_id:
            full_cam = get_camera(self.camera_id)
            if full_cam and "source" in full_cam:
                self.camera["source"] = full_cam["source"]
        self.lock = threading.RLock()
        self.condition = threading.Condition(self.lock)
        self.subscribers: dict[str, threading.Event] = {}
        self.stop_event = threading.Event()
        self.latest_jpeg: bytes | None = None
        self.frame_sequence = 0
        self.is_running = True
        self.idle_timer: threading.Timer | None = None
        self.source: CameraSource | None = None
        self.worker_thread = threading.Thread(
            target=self._run_capture_loop,
            name=f"stream-hub-{str(self.camera_id)[:8]}",
            daemon=True,
        )
        self.worker_thread.start()

    def _ensure_source(self) -> bool:
        if self.source is not None and self.source.isOpened():
            return True
        try:
            self.source = open_camera(self.camera)
            return self.source.isOpened()
        except Exception as err:
            print(f"[StreamHub] Error opening camera {self.camera.get('name')}: {err}")
            return False

    def _run_capture_loop(self) -> None:
        if not self._ensure_source():
            with self.lock:
                self.is_running = False
                self.condition.notify_all()
            return

        consecutive_failures = 0
        try:
            while not self.stop_event.is_set():
                if self.source is None or not self.source.isOpened():
                    if not self._ensure_source():
                        time.sleep(0.5)
                        continue

                success, frame = self.source.read()
                if self.stop_event.is_set():
                    break

                if not success or frame is None:
                    consecutive_failures += 1
                    if consecutive_failures > 50:
                        if self.source:
                            self.source.release()
                            self.source = None
                        consecutive_failures = 0
                        time.sleep(0.5)
                    else:
                        time.sleep(0.02)
                    continue

                consecutive_failures = 0

                # Downsample excessively high resolution for fast web delivery
                h, w = frame.shape[:2]
                if w > 1280:
                    scale = 1280.0 / w
                    frame = cv2.resize(frame, (1280, int(h * scale)), interpolation=cv2.INTER_LINEAR)

                # Single JPEG encode for all subscribers
                encoded, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
                if encoded:
                    jpeg_bytes = buffer.tobytes()
                    with self.lock:
                        self.latest_jpeg = jpeg_bytes
                        self.frame_sequence += 1
                        self.condition.notify_all()

                # Pace stream to avoid excessive CPU usage (cap at ~25-30 FPS)
                time.sleep(0.03)
        except Exception as err:
            print(f"[StreamHub] Capture loop error for {self.camera.get('name')}: {err}")
        finally:
            with self.lock:
                self.is_running = False
                self.condition.notify_all()
            if self.source:
                self.source.release()
                self.source = None

    def subscribe(self, stream_id: str):
        stop_sub = threading.Event()
        with self.lock:
            if self.idle_timer:
                self.idle_timer.cancel()
                self.idle_timer = None
            old_sub = self.subscribers.get(stream_id)
            if old_sub is not None and old_sub is not stop_sub:
                old_sub.set()
            self.subscribers[stream_id] = stop_sub
            last_seq = self.frame_sequence
            initial_jpeg = self.latest_jpeg

        try:
            # Deliver cached latest frame immediately for 0ms initial frame latency with standard Content-Length
            if initial_jpeg and not stop_sub.is_set():
                content_length = len(initial_jpeg)
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(content_length).encode("ascii") + b"\r\n\r\n"
                    + initial_jpeg + b"\r\n"
                )

            while not stop_sub.is_set() and not self.stop_event.is_set():
                with self.condition:
                    ready = self.condition.wait_for(
                        lambda: self.frame_sequence > last_seq or not self.is_running or stop_sub.is_set(),
                        timeout=1.5,
                    )
                    if stop_sub.is_set() or not self.is_running:
                        break
                    if not ready:
                        continue
                    jpeg = self.latest_jpeg
                    last_seq = self.frame_sequence

                if jpeg and not stop_sub.is_set():
                    content_length = len(jpeg)
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n"
                        b"Content-Length: " + str(content_length).encode("ascii") + b"\r\n\r\n"
                        + jpeg + b"\r\n"
                    )
        finally:
            self.unsubscribe(stream_id, stop_sub)

    def unsubscribe(self, stream_id: str, stop_sub: threading.Event | None = None) -> None:
        with self.lock:
            current_sub = self.subscribers.get(stream_id)
            if current_sub is None:
                return
            if stop_sub is not None and current_sub is not stop_sub:
                # An older generator is exiting after a newer one has replaced it on this stream_id; do not kill the new subscriber!
                return
            sub = self.subscribers.pop(stream_id, None)
            if sub:
                sub.set()
            if not self.subscribers and not self.stop_event.is_set():
                if self.idle_timer:
                    self.idle_timer.cancel()
                self.idle_timer = threading.Timer(8.0, self._stop_if_idle)
                self.idle_timer.daemon = True
                self.idle_timer.start()

    def _stop_if_idle(self) -> None:
        with self.lock:
            if not self.subscribers:
                # Keep active Entry and Exit attendance cameras warm so previews and recognition are instantaneous
                roles = self.camera.get("roles") or []
                if any(r in ("ENTRY", "EXIT") for r in roles) and self.camera.get("enabled", True):
                    return
                self.stop_event.set()
                self.condition.notify_all()

    def stop(self) -> None:
        with self.lock:
            if self.idle_timer:
                self.idle_timer.cancel()
                self.idle_timer = None
            self.stop_event.set()
            for sub in self.subscribers.values():
                sub.set()
            self.condition.notify_all()
        if self.worker_thread.is_alive() and threading.current_thread() != self.worker_thread:
            self.worker_thread.join(timeout=1.0)


class CameraStreamHub:
    """Singleton registry managing active shared camera preview streams."""

    def __init__(self):
        self._streams: dict[str, SharedCameraStream] = {}
        self._lock = threading.RLock()

    def get_stream(self, camera: dict) -> SharedCameraStream:
        cam_id = camera["id"]
        with self._lock:
            existing = self._streams.get(cam_id)
            if existing is not None and existing.is_running and not existing.stop_event.is_set():
                return existing
            if existing is not None:
                existing.stop()
            stream = SharedCameraStream(camera)
            self._streams[cam_id] = stream
            return stream

    def get_latest_frame_jpeg(self, camera: dict) -> bytes | None:
        cam_id = camera["id"]
        with self._lock:
            stream = self._streams.get(cam_id)
            if stream and stream.is_running and stream.latest_jpeg:
                return stream.latest_jpeg
        return None

    def stop_camera(self, camera_id: str) -> bool:
        with self._lock:
            stream = self._streams.pop(camera_id, None)
            if stream:
                stream.stop()
                return True
        return False

    def stop_stream(self, camera_id: str, stream_id: str) -> bool:
        with self._lock:
            stream = self._streams.get(camera_id)
            if stream:
                stream.unsubscribe(stream_id)
                return True
        return False

    def stop_all(self) -> int:
        with self._lock:
            streams = list(self._streams.values())
            self._streams.clear()
        for stream in streams:
            stream.stop()
        return len(streams)


STREAM_HUB = CameraStreamHub()
atexit.register(STREAM_HUB.stop_all)


def warmup_enabled_cameras() -> None:
    """Pre-connect enabled Entry/Exit IP cameras in the background so frames are cached immediately."""
    try:
        cameras = list_cameras(enabled_only=True, include_source=True)
        for cam in cameras:
            if cam.get("source_type") == "ip" and cam.get("enabled"):
                STREAM_HUB.get_stream(cam)
    except Exception as err:
        print(f"[StreamHub] Camera warmup error: {err}")

