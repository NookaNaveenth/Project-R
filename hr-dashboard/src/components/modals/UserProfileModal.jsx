import React from "react";

export default function UserProfileModal({ show, auth, onClose }) {
  if (!show) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="action-popup-card">
        <div className="action-popup-header">
          <div className="action-popup-user">
            <div className="action-popup-avatar">
              {(auth?.username || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="action-popup-name">User Profile</h3>
              <div className="action-popup-meta">Miracle FaceAttend Enterprise</div>
            </div>
          </div>
          <button
            type="button"
            className="action-popup-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="action-popup-body">
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>Username</span>
              <strong style={{ color: "#1e293b" }}>{auth?.username || "--"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>Role</span>
              <span className={`miracle-role-pill ${auth?.role || "hr"}`}>
                {auth?.role === "superior" ? "Superior Authority" : auth?.role === "admin" ? "System Admin" : "HR Officer"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>Department</span>
              <strong style={{ color: "#1e293b" }}>{auth?.department || "Global (All Departments)"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
              <span style={{ color: "#64748b" }}>System Status</span>
              <span style={{ color: "#10b981", fontWeight: "600" }}>Active • Authenticated</span>
            </div>
          </div>

          <div style={{ marginTop: "22px", display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="primary-button"
              style={{ width: "100%" }}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
