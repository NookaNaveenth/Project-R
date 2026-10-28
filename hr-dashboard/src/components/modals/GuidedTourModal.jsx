import React from "react";

export default function GuidedTourModal({ show, onClose }) {
  if (!show) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="action-popup-card" style={{ maxWidth: "520px" }}>
        <div className="action-popup-header">
          <div>
            <h3 className="action-popup-name">FaceAttend Tour & Navigation</h3>
            <div className="action-popup-meta">Miracle Employee Interface Reference</div>
          </div>
          <button
            type="button"
            className="action-popup-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="action-popup-body" style={{ fontSize: "13px", lineHeight: "1.6", color: "#334155" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{ background: "#e0f2fe", color: "#0284c7", width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>1</div>
              <div>
                <strong style={{ color: "#0f172a" }}>Top Navigation Bar:</strong> Clean white navbar with Miracle branding, menu collapse toggle, Hubble quick shortcuts, and the user profile dropdown for Password Reset and Sign Out.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{ background: "#e0f2fe", color: "#0284c7", width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>2</div>
              <div>
                <strong style={{ color: "#0f172a" }}>Sidebar:</strong> Dedicated navigation focusing on <em>Dashboard</em> and <em>Attendance</em> with smooth expand/collapse capability.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{ background: "#e0f2fe", color: "#0284c7", width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>3</div>
              <div>
                <strong style={{ color: "#0f172a" }}>Attendance & Employee Cards:</strong> Vertically scrollable employee list sorted alphabetically A-Z with shift, status, and punch badges alongside the quick Filter By panel.
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{ background: "#e0f2fe", color: "#0284c7", width: "26px", height: "26px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", flexShrink: 0 }}>4</div>
              <div>
                <strong style={{ color: "#0f172a" }}>Quick Employee Actions:</strong> Simply click on any employee card to open the quick action popup for <em>Edit Shift</em>, <em>View History</em>, or <em>Export Report</em>.
              </div>
            </div>
          </div>

          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="primary-button"
              onClick={onClose}
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
