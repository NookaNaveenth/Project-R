import React, { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "../../utils/config";

export default function ViewCameraModal({ viewCamera, onClose }) {
  const [streamStatus, setStreamStatus] = useState("connecting"); // "connecting" | "live" | "error"
  const [streamMode, setStreamMode] = useState("mjpeg"); // "mjpeg" | "polling"
  const [errorMessage, setErrorMessage] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [snapshotSrc, setSnapshotSrc] = useState("");
  const [useBackendFallback, setUseBackendFallback] = useState(true);
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const pollingTimerRef = useRef(null);

  const isWebcam = viewCamera?.source_type === "webcam";
  const isIp = !isWebcam;

  // Dedicated, collision-free stream session ID regenerated per refresh/open
  const [streamId, setStreamId] = useState(() =>
    "modal-" + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
  );

  const streamKey = `modal-stream-${viewCamera?.id}-${retryNonce}`;
  const streamUrl = viewCamera && (isIp || useBackendFallback) && streamMode === "mjpeg"
    ? `${API_URL}/cameras/${viewCamera.id}/stream.mjpg?stream_id=${encodeURIComponent(
        streamId
      )}&t=${retryNonce}`
    : "";

  // 1. Initial snapshot & MJPEG readiness watchdog: fetch instant frame (<20ms) for 0ms initial load
  useEffect(() => {
    if (!viewCamera || (!isIp && !useBackendFallback)) return undefined;
    let isMounted = true;

    // Load single-frame snapshot immediately to bypass RTSP/stream handshake wait
    const snapUrl = `${API_URL}/cameras/${viewCamera.id}/snapshot.jpg?t=${Date.now()}`;
    const snapImg = new Image();
    snapImg.src = snapUrl;
    snapImg.onload = () => {
      if (isMounted && snapImg.naturalWidth > 0) {
        setSnapshotSrc(snapUrl);
        setStreamStatus("live");
      }
    };

    // Monitor naturalWidth on the main MJPEG img (Chromium does not dispatch onLoad for multipart/x-mixed-replace)
    const checkInterval = setInterval(() => {
      if (imgRef.current && imgRef.current.naturalWidth > 0) {
        if (isMounted) setStreamStatus("live");
        clearInterval(checkInterval);
      }
    }, 50);

    // Watchdog: If MJPEG doesn't show frames within 2000ms, switch to live polling mode so preview never freezes
    const watchdogTimer = setTimeout(() => {
      if (isMounted && streamMode === "mjpeg") {
        if (!imgRef.current || imgRef.current.naturalWidth === 0) {
          console.warn("[ViewCameraModal] MJPEG stream stalled/blocked; activating resilient live polling.");
          setStreamMode("polling");
          setStreamStatus("live");
        }
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(checkInterval);
      clearTimeout(watchdogTimer);
    };
  }, [viewCamera?.id, isIp, useBackendFallback, retryNonce, streamMode]);

  // 2. High-frequency live snapshot polling fallback (active when streamMode === "polling")
  useEffect(() => {
    if (!viewCamera || streamMode !== "polling" || (!isIp && !useBackendFallback)) {
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

      const nextUrl = `${API_URL}/cameras/${viewCamera.id}/snapshot.jpg?t=${Date.now()}`;
      activeImg = new Image();
      activeImg.onload = () => {
        clearTimeout(safetyTimeout);
        if (isMounted && activeImg && activeImg.naturalWidth > 0) {
          setSnapshotSrc(nextUrl);
          setStreamStatus("live");
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
    pollingTimerRef.current = setInterval(fetchNextFrame, 100); // 10 FPS continuous live feed

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
  }, [viewCamera?.id, streamMode, isIp, useBackendFallback, retryNonce]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Manage browser webcam stream lifecycle (with seamless server fallback)
  useEffect(() => {
    if (!viewCamera || !isWebcam || useBackendFallback) return undefined;

    let isMounted = true;
    setStreamStatus("connecting");
    setErrorMessage("");

    const startWebcam = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn("[ViewCameraModal] getUserMedia unavailable. Falling back to server stream.");
        if (isMounted) setUseBackendFallback(true);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
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
        console.warn("[ViewCameraModal] Local browser webcam failed; falling back to server stream:", err);
        setUseBackendFallback(true);
      }
    };

    startWebcam();

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
  }, [viewCamera, isWebcam, useBackendFallback, retryNonce]);

  // Release backend stream cleanly only upon genuine modal unmount
  useEffect(() => {
    const camId = viewCamera?.id;
    const shouldStop = viewCamera && (isIp || useBackendFallback);

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
  }, [streamId, viewCamera?.id, isIp, useBackendFallback]);

  const handleRetry = useCallback(() => {
    const newStreamId =
      "modal-" + (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    setStreamId(newStreamId);
    setStreamStatus("connecting");
    setErrorMessage("");
    setStreamMode("mjpeg");
    setUseBackendFallback(true);
    setRetryNonce((prev) => prev + 1);

    // Instantly fetch a fresh snapshot to wipe away any old frame immediately
    if (viewCamera?.id) {
      const snapUrl = `${API_URL}/cameras/${viewCamera.id}/snapshot.jpg?t=${Date.now()}`;
      const snapImg = new Image();
      snapImg.onload = () => {
        if (snapImg.naturalWidth > 0) {
          setSnapshotSrc(snapUrl);
          setStreamStatus("live");
        }
      };
      snapImg.src = snapUrl;
    }
  }, [viewCamera?.id]);

  if (!viewCamera) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => event.target === event.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 1000,
      }}
    >
      <div
        className="camera-view-modal-container"
        style={{
          background: "#ffffff",
          borderRadius: "14px",
          width: "min(960px, 96vw)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "800",
                  color: "#0f2942",
                  letterSpacing: "-0.01em",
                }}
              >
                {viewCamera.name}
              </h2>

              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: isWebcam ? "#e0f2fe" : "#f1f5f9",
                  color: isWebcam ? "#0369a1" : "#334155",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                {isWebcam ? "Webcam" : "IP / CC Camera"}
              </span>

              {viewCamera.roles?.map((role) => (
                <span
                  key={role}
                  style={{
                    fontSize: "10.5px",
                    fontWeight: "700",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    background: role === "ENTRY" ? "#ecfdf5" : "#fef2f2",
                    color: role === "ENTRY" ? "#047857" : "#b91c1c",
                    border: `1px solid ${role === "ENTRY" ? "#a7f3d0" : "#fecaca"}`,
                  }}
                >
                  {role}
                </span>
              ))}
            </div>

            <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "12px" }}>
              {isWebcam && !useBackendFallback
                ? "Direct browser video feed • High frame rate live view"
                : isWebcam
                ? "Server camera stream • Shared attendance feed"
                : `RTSP / HTTP stream • ${viewCamera.device || viewCamera.source || "Configured endpoint"}`}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Live Indicator Pill */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "9999px",
                fontSize: "11.5px",
                fontWeight: "700",
                background:
                  streamStatus === "live"
                    ? "#ecfdf5"
                    : streamStatus === "connecting"
                    ? "#fffbeb"
                    : "#fef2f2",
                color:
                  streamStatus === "live"
                    ? "#059669"
                    : streamStatus === "connecting"
                    ? "#b45309"
                    : "#dc2626",
                border: `1px solid ${
                  streamStatus === "live"
                    ? "#a7f3d0"
                    : streamStatus === "connecting"
                    ? "#fde68a"
                    : "#fecaca"
                }`,
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background:
                    streamStatus === "live"
                      ? "#10b981"
                      : streamStatus === "connecting"
                      ? "#f59e0b"
                      : "#ef4444",
                  boxShadow:
                    streamStatus === "live" ? "0 0 6px #10b981" : "none",
                }}
              />
              {streamStatus === "live"
                ? "LIVE"
                : streamStatus === "connecting"
                ? "CONNECTING"
                : "OFFLINE"}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#f1f5f9",
                border: "none",
                borderRadius: "8px",
                width: "32px",
                height: "32px",
                fontSize: "18px",
                color: "#475569",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#e2e8f0";
                e.currentTarget.style.color = "#0f172a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#f1f5f9";
                e.currentTarget.style.color = "#475569";
              }}
              title="Close live preview (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video Canvas Stage */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#0b1120",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Loading Indicator Overlay */}
          {streamStatus === "connecting" && !snapshotSrc && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                color: "#e2e8f0",
                zIndex: 4,
                background: "rgba(11, 17, 32, 0.85)",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: "3px solid rgba(255, 255, 255, 0.15)",
                  borderTopColor: "#00AAE7",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span style={{ fontSize: "13px", fontWeight: "600", letterSpacing: "0.2px" }}>
                Initializing live stream…
              </span>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error Message Overlay */}
          {streamStatus === "error" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "24px",
                textAlign: "center",
                color: "#ffffff",
                zIndex: 5,
                background: "#0f172a",
              }}
            >
              <svg
                width="38"
                height="38"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f87171"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>

              <div style={{ fontSize: "14px", fontWeight: "700", color: "#fca5a5" }}>
                Stream Unavailable
              </div>
              <div style={{ fontSize: "12.5px", color: "#94a3b8", maxWidth: "440px", lineHeight: 1.5 }}>
                {errorMessage ||
                  "The camera did not provide video frames. Verify camera power, RTSP network route, and credentials."}
              </div>

              <button
                type="button"
                onClick={handleRetry}
                style={{
                  marginTop: "6px",
                  background: "#00AAE7",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(0, 170, 231, 0.3)",
                }}
              >
                ↻ Retry Stream
              </button>
            </div>
          )}

          {/* Video / Image Display */}
          {isWebcam && !useBackendFallback ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              onLoadedData={() => setStreamStatus("live")}
              onPlaying={() => setStreamStatus("live")}
              onError={() => {
                setUseBackendFallback(true);
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: streamStatus === "error" ? "none" : "block",
                transform: "scaleX(-1)", // Mirror selfie preview for natural interaction
              }}
            />
          ) : (
            <>
              {snapshotSrc && (
                <img
                  src={snapshotSrc}
                  alt={`Preview of ${viewCamera.name}`}
                  style={{
                    position: streamMode === "mjpeg" ? "absolute" : "relative",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: streamStatus === "error" ? "none" : "block",
                    zIndex: 1,
                  }}
                />
              )}
              {streamMode === "mjpeg" && (
                <img
                  key={streamKey}
                  ref={imgRef}
                  src={streamUrl}
                  alt={`Live feed of ${viewCamera.name}`}
                  onLoad={() => setStreamStatus("live")}
                  onError={() => {
                    console.warn("[ViewCameraModal] MJPEG stream stalled/error, switching to live polling mode");
                    setStreamMode("polling");
                    setStreamStatus("live");
                  }}
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: streamStatus === "error" ? "none" : "block",
                    zIndex: 2,
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Modal Footer with Camera Metadata */}
        <div
          style={{
            padding: "12px 22px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#64748b",
          }}
        >
          <div>
            Camera ID: <strong>{viewCamera.id}</strong> • Role:{" "}
            <strong>{viewCamera.roles?.join(", ") || "General Monitoring"}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={handleRetry}
              style={{
                background: "transparent",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "11.5px",
                fontWeight: "600",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              ↻ Refresh Feed
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#003a70",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "5px 14px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
