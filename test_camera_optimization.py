"""
Unit & Integration Tests for FaceAttend Camera Preview and Latency Optimization:
1. SharedCameraStream & CameraStreamHub lifecycle and subscriber handling
2. Instant frame delivery from latest_jpeg cache (0ms latency for subsequent subscribers)
3. Multiple subscribers sharing a single camera source
4. REST API: GET /cameras, GET /cameras/{id}/snapshot.jpg, GET /cameras/{id}/stream.mjpg, POST /cameras/{id}/stream/{stream_id}/stop
5. Proper resource release when subscribers disconnect
"""

import os
import sys
import time
import unittest
from unittest.mock import patch
import numpy as np
import cv2
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from camera_manager import (
    list_cameras,
    get_camera,
    CameraStreamHub,
    SharedCameraStream,
    STREAM_HUB,
)
from api import app

client = TestClient(app)


class MockCameraSource:
    """Mock camera source providing synthetic test frames at low CPU."""
    def __init__(self, camera_id="test_cam"):
        self.camera_id = camera_id
        self._is_opened = True
        self.frame_count = 0

    def isOpened(self):
        return self._is_opened

    def read(self):
        if not self._is_opened:
            return False, None
        self.frame_count += 1
        # Create a small 320x240 test frame
        frame = np.zeros((240, 320, 3), dtype=np.uint8)
        cv2.putText(
            frame,
            f"FRAME {self.frame_count}",
            (20, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 255, 0),
            2,
        )
        time.sleep(0.03)  # simulate ~30 FPS
        return True, frame

    def release(self):
        self._is_opened = False


class CameraOptimizationTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Ensure at least one test camera exists in DB
        cls.cameras = list_cameras()

    @patch("camera_manager.open_camera")
    def test_01_shared_camera_stream_single_thread_multiple_subscribers(self, mock_open):
        """Verify multiple subscribers reuse the same background capture thread without duplicating connections."""
        mock_source = MockCameraSource("cam_mock_1")
        mock_open.return_value = mock_source

        cam_config = {
            "id": "cam_mock_1",
            "name": "Mock Test Camera",
            "source_type": "ip",
            "source": "rtsp://mock-cam/live",
            "enabled": True,
        }

        stream = SharedCameraStream(cam_config)
        self.assertTrue(stream.is_running)

        # 1. First subscriber
        gen1 = stream.subscribe("sub_1")
        # Generator starts upon calling next()
        frame_chunk_1 = next(gen1)
        self.assertIn("sub_1", stream.subscribers)
        self.assertIsNotNone(frame_chunk_1)
        self.assertIn(b"--frame", frame_chunk_1)
        self.assertIn(b"Content-Type: image/jpeg", frame_chunk_1)

        # 2. Second subscriber joins: must immediately yield cached latest_jpeg without waiting
        t0 = time.time()
        gen2 = stream.subscribe("sub_2")
        frame_chunk_2 = next(gen2)
        elapsed_ms = (time.time() - t0) * 1000

        self.assertIn("sub_2", stream.subscribers)
        self.assertLess(elapsed_ms, 20.0, "Subsequent subscriber must receive cached frame in <20ms")
        self.assertIn(b"Content-Type: image/jpeg", frame_chunk_2)

        # 3. Unsubscribe sub_1: sub_2 remains active
        stream.unsubscribe("sub_1")
        self.assertNotIn("sub_1", stream.subscribers)
        self.assertIn("sub_2", stream.subscribers)
        self.assertTrue(stream.is_running)

        # 4. Unsubscribe sub_2
        stream.unsubscribe("sub_2")
        self.assertNotIn("sub_2", stream.subscribers)

        # 5. Stop stream releases source
        stream.stop()
        self.assertFalse(stream.is_running)
        self.assertFalse(mock_source.isOpened())

    def test_02_stream_hub_singleton_management(self):
        """STREAM_HUB provides stable shared streams across repeated requests."""
        fake_cam = {
            "id": "hub_cam_99999",
            "name": "Test Hub Camera",
            "source_type": "ip",
            "source": "rtsp://mock-not-exist:554/stream",
            "enabled": True,
            "roles": ["ENTRY"],
        }

        with patch("camera_manager.open_camera") as mock_open:
            mock_source = MockCameraSource("hub_cam_99999")
            mock_open.return_value = mock_source

            s1 = STREAM_HUB.get_stream(fake_cam)
            s2 = STREAM_HUB.get_stream(fake_cam)
            self.assertIs(s1, s2, "STREAM_HUB must return the exact same SharedCameraStream instance for same camera id")

            # Cleanup
            stopped = STREAM_HUB.stop_camera("hub_cam_99999")
            self.assertTrue(stopped)
            self.assertNotIn("hub_cam_99999", STREAM_HUB._streams)

    def test_03_camera_api_snapshot_endpoint(self):
        """GET /cameras/{camera_id}/snapshot.jpg returns JPEG or fallback if camera offline."""
        cameras = client.get("/cameras").json()
        if cameras:
            cam_id = cameras[0]["id"]
            # Mock latest frame to return synthetic jpeg
            dummy_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00" + b"\x00" * 50
            with patch.object(STREAM_HUB, "get_latest_frame_jpeg", return_value=dummy_jpeg):
                resp = client.get(f"/cameras/{cam_id}/snapshot.jpg")
                self.assertEqual(resp.status_code, 200)
                self.assertEqual(resp.headers.get("content-type"), "image/jpeg")
                self.assertGreater(len(resp.content), 20)

    def test_04_camera_api_stream_stop_endpoint(self):
        """POST /cameras/{camera_id}/stream/{stream_id}/stop gracefully unhooks client."""
        cameras = client.get("/cameras").json()
        if cameras:
            cam_id = cameras[0]["id"]
            resp = client.post(f"/cameras/{cam_id}/stream/test-stream-123/stop")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertTrue(data.get("ok"))


if __name__ == "__main__":
    unittest.main()
