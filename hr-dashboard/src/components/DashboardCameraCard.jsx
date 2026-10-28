import React, { useState, useRef, useEffect, memo } from 'react';
import { API_URL } from '../utils/config';

function DashboardCameraCard({ camera, onView }) {
  const [status, setStatus] = useState("connecting"); // "connecting" | "live" | "error" | "disabled"
  const [streamMode, setStreamMode] = useState("mjpeg"); // "mjpeg" | "polling"
  const [errorMessage, setErrorMessage] = useState("");
  const [snapshotSrc, setSnapshotSrc] = useState("");
  const [useBackendFallback, setUseBackendFallback] = useState(true);
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const pollingTimerRef = useRef(null);
  const streamSessionIdRef = useRef(
    "card-" + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
  );
  const streamId = streamSessionIdRef.current;

  const isEnabled = Boolean(camera.enabled);
  const isWebcam = camera.source_type === "webcam";
  const isIp = !isWebcam;

  // Stream URL for IP cameras or webcam backend fallback
  const isStreaming = isEnabled && (isIp || useBackendFallback) && streamMode === "mjpeg";
  const streamUrl = isStreaming
    ? `${API_URL}/cameras/${camera.id}/stream.mjpg?stream_id=${encodeURIComponent(streamId)}`
    : "";

  // 1. Initial snapshot & MJPEG readiness watchdog: fetch instant frame (<20ms) for 0ms initial load
  useEffect(() => {
    if (!isEnabled || (!isIp && !useBackendFallback)) return undefined;
    let isMounted = true;

    // Load single-frame snapshot immediately to bypass RTSP connection delay
    const snapUrl = `${API_URL}/cameras/${camera.id}/snapshot.jpg?t=${Date.now()}`;
    const snapImg = new Image();
    snapImg.src = snapUrl;
    snapImg.onload = () => {
      if (isMounted && snapImg.naturalWidth > 0) {
        setSnapshotSrc(snapUrl);
        setStatus("live");
      }
    };

    // Monitor naturalWidth on the main MJPEG img (Chromium does not dispatch onLoad for multipart/x-mixed-replace)
    const checkInterval = setInterval(() => {
      if (imgRef.current && imgRef.current.naturalWidth > 0) {
        if (isMounted) setStatus("live");
        clearInterval(checkInterval);
      }
    }, 50);

    // Watchdog: If MJPEG doesn't show frames within 1800ms, switch to live polling mode so card preview never freezes
    const watchdogTimer = setTimeout(() => {
      if (isMounted && streamMode === "mjpeg") {
        if (!imgRef.current || imgRef.current.naturalWidth === 0) {
          console.warn("[DashboardCameraCard] MJPEG stream stalled/blocked; activating resilient live polling.");
          setStreamMode("polling");
          setStatus("live");
        }
      }
    }, 1800);

    return () => {
      isMounted = false;
      clearInterval(checkInterval);
      clearTimeout(watchdogTimer);
    };
  }, [camera.id, isEnabled, isIp, useBackendFallback, streamMode]);

  // 2. High-frequency live snapshot polling fallback (active when streamMode === "polling")
  useEffect(() => {
    if (!isEnabled || streamMode !== "polling" || (!isIp && !useBackendFallback)) {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return undefined;
    }

    let isMounted = true;
    let inFlight = false;
    let safetyTimeout = null;
    let activeImg = null;

    const fetchNextFrame = () => {
      if (inFlight || !isMounted) return;
      inFlight = true;

      clearTimeout(safetyTimeout);
      safetyTimeout = setTimeout(() => {
        inFlight = false;
      }, 800);

      const nextUrl = `${API_URL}/cameras/${camera.id}/snapshot.jpg?t=${Date.now()}`;
      activeImg = new Image();
      activeImg.onload = () => {
        clearTimeout(safetyTimeout);
        if (isMounted && activeImg && activeImg.naturalWidth > 0) {
          setSnapshotSrc(nextUrl);
          setStatus("live");
        }
        inFlight = false;
      };
      activeImg.onerror = () => {
        clearTimeout(safetyTimeout);
        inFlight = false;
      };
      activeImg.src = nextUrl;
    };

    fetchNextFrame();
    pollingTimerRef.current = setInterval(fetchNextFrame, 150); // ~7 FPS continuous live feed for card

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      if (activeImg) {
        activeImg.onload = null;
        activeImg.onerror = null;
        activeImg.src = "";
      }
    };
  }, [camera.id, streamMode, isEnabled, isIp, useBackendFallback]);

  // 3. Browser Webcam Stream Management (with seamless backend fallback)
  useEffect(() => {
    if (!isEnabled || !isWebcam || useBackendFallback) {
      if (!useBackendFallback) {
        setStatus(isEnabled ? "connecting" : "disabled");
      }
      return undefined;
    }

    let isMounted = true;
    setStatus("connecting");
    setErrorMessage("");

    const initWebcam = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (isMounted) setUseBackendFallback(true);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 24 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (!isMounted) return;
        // Seamlessly fallback to backend stream
        setUseBackendFallback(true);
      }
    };

    initWebcam();

    return () => {
      isMounted = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camera.id, isEnabled, isWebcam, useBackendFallback]);

  // 4. Clean stream release only upon genuine unmount
  useEffect(() => {
    const camId = camera.id;
    const shouldStop = isEnabled && (isIp || useBackendFallback);

    return () => {
      if (imgRef.current) {
        imgRef.current.src = "";
      }
      if (shouldStop && camId) {
        fetch(`${API_URL}/cameras/${camId}/stream/${encodeURIComponent(streamId)}/stop`, {
          method: "POST",
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, []);

  const tooltipText = [
    `Name: ${camera.name}`,
    `Type: ${isWebcam ? "Local Webcam" : "IP / CC Camera"}`,
    `Source: ${camera.device || camera.source || "Default Device"}`,
    `Assigned: ${camera.roles?.length ? camera.roles.join(", ") : "Not assigned"}`,
    `Status: ${isEnabled ? (status === "live" ? "Live Stream Active" : "Connecting...") : "Disabled"}`,
  ].join("\n");

  return (
    <div
      className={`dashboard-cam-card ${!isEnabled ? "disabled" : ""}`}
      onClick={isEnabled ? onView : undefined}
      title={tooltipText}
    >
      <div className="dashboard-cam-preview-box">
        {/* Loading Spinner for Connecting State */}
        {isEnabled && status === "connecting" && !snapshotSrc && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              color: "#94a3b8",
              background: "#0f172a",
              zIndex: 3,
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                borderTopColor: "#00AAE7",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: "11px", fontWeight: "600" }}>
              {isWebcam && !useBackendFallback ? "Connecting webcam…" : "Connecting stream…"}
            </span>
          </div>
        )}

        {/* Video stream element (Webcam) or Image stream element (IP Camera / Server Stream) */}
        {isEnabled && (
          <>
            {isWebcam && !useBackendFallback ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                onLoadedData={() => setStatus("live")}
                onPlaying={() => setStatus("live")}
                onError={() => {
                  setUseBackendFallback(true);
                }}
                className="dashboard-cam-img"
                style={{
                  transform: "scaleX(-1)",
                  display: status === "error" ? "none" : "block",
                }}
              />
            ) : (
              <>
                {snapshotSrc && (
                  <img
                    src={snapshotSrc}
                    alt={`Preview of ${camera.name}`}
                    className="dashboard-cam-img"
                    style={{
                      position: streamMode === "mjpeg" ? "absolute" : "relative",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: status === "error" ? "none" : "block",
                      zIndex: 1,
                    }}
                  />
                )}
                {streamMode === "mjpeg" && (
                  <img
                    key={`card-stream-${camera.id}`}
                    ref={imgRef}
                    src={streamUrl}
                    alt={`Live feed of ${camera.name}`}
                    className="dashboard-cam-img"
                    onLoad={() => setStatus("live")}
                    onError={() => {
                      console.warn("[DashboardCameraCard] MJPEG stream stalled/error, switching to live polling mode");
                      setStreamMode("polling");
                      setStatus("live");
                    }}
                    style={{
                      position: "relative",
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: status === "error" ? "none" : "block",
                      zIndex: 2,
                    }}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Disabled or Error Placeholder */}
        {(!isEnabled || status === "error") && (
          <div className="dashboard-cam-placeholder">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={status === "error" ? "#f87171" : "currentColor"}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
            <span
              className="cam-placeholder-text"
              style={{ color: status === "error" ? "#fca5a5" : "#94a3b8" }}
            >
              {!isEnabled
                ? "Camera Disabled"
                : errorMessage || "Stream Offline"}
            </span>
          </div>
        )}

        {/* Overlay Top Badges */}
        <div className="dashboard-cam-overlay-top">
          <span
            className={`cam-status-pill ${
              !isEnabled
                ? "offline"
                : status === "live"
                ? "online"
                : status === "connecting"
                ? "connecting"
                : "offline"
            }`}
            style={{
              background:
                !isEnabled
                  ? "rgba(100, 116, 139, 0.85)"
                  : status === "live"
                  ? "rgba(16, 185, 129, 0.9)"
                  : status === "connecting"
                  ? "rgba(245, 158, 11, 0.9)"
                  : "rgba(239, 68, 68, 0.9)",
            }}
          >
            <span
              className="cam-status-dot"
              style={{
                boxShadow: status === "live" ? "0 0 6px #ffffff" : "none",
              }}
            />
            {!isEnabled
              ? "DISABLED"
              : status === "live"
              ? "ONLINE"
              : status === "connecting"
              ? "CONNECTING"
              : "OFFLINE"}
          </span>

          <span className="cam-type-pill">
            {isWebcam ? "Webcam" : "IP Camera"}
          </span>
        </div>

        {/* Click hint on hover */}
        {isEnabled && (
          <div className="dashboard-cam-click-hint">
            <span>Click for fullscreen</span>
          </div>
        )}

        {/* Hover Tooltip */}
        <div className="dashboard-cam-tooltip">
          <div className="cam-tt-header">
            <strong>{camera.name}</strong>
            <span className={`cam-tt-status ${isEnabled ? "active" : "inactive"}`}>
              {isEnabled ? (status === "live" ? "Live" : "Connecting") : "Inactive"}
            </span>
          </div>
          <div className="cam-tt-row">
            <span className="cam-tt-label">Source:</span>
            <span className="cam-tt-val">{camera.device || camera.source || "Default"}</span>
          </div>
          <div className="cam-tt-row">
            <span className="cam-tt-label">Type:</span>
            <span className="cam-tt-val">{isWebcam ? "Webcam" : "IP / CC Camera"}</span>
          </div>
          <div className="cam-tt-row">
            <span className="cam-tt-label">Purpose:</span>
            <span className="cam-tt-val">{camera.roles?.join(" · ") || "Not assigned"}</span>
          </div>
          <div className="cam-tt-row">
            <span className="cam-tt-label">Status:</span>
            <span className="cam-tt-val">
              {!isEnabled ? "Disabled" : status === "live" ? "Active Stream" : "Connecting"}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-cam-info">
        <div className="dashboard-cam-meta">
          <div className="dashboard-cam-name" title={camera.name}>
            {camera.name}
          </div>
          <div className="dashboard-cam-roles">
            {camera.roles && camera.roles.length > 0 ? (
              camera.roles.map((role) => (
                <span
                  key={role}
                  className={`dashboard-cam-role-badge role-${role.toLowerCase()}`}
                >
                  {role === "ENTRY" ? "Entry" : role === "EXIT" ? "Exit" : role === "ENROLLMENT" ? "Enrollment" : role}
                </span>
              ))
            ) : (
              <span className="dashboard-cam-role-badge role-unassigned">General</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(DashboardCameraCard);
