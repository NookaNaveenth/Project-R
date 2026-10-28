import React from "react";

export default function EmployeeActionModal({
  actionEmployee,
  onClose,
  onEditShift,
  onViewHistory,
  onExportReport,
  onDeleteEmployee,
}) {
  if (!actionEmployee) return null;

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
              {(actionEmployee.employee_name || "E")
                .split(" ")
                .filter(Boolean)
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h3 className="action-popup-name">{actionEmployee.employee_name}</h3>
              <div className="action-popup-meta">
                {actionEmployee.department || "General"} • ID: {actionEmployee.employee_id}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="action-popup-close"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>

        <div className="action-popup-body">
          <p className="action-popup-prompt">Select an operation for this employee:</p>

          <div className="action-options-list">
            {/* 1. Edit Shift */}
            <button
              type="button"
              className="action-option-btn"
              onClick={() => {
                const emp = actionEmployee;
                onClose();
                onEditShift(emp);
              }}
            >
              <div className="action-option-icon icon-shift">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                  <path d="m15 5 4 4"></path>
                </svg>
              </div>
              <div className="action-option-details">
                <div className="action-option-title">Edit Shift</div>
              </div>
            </button>

            {/* 2. View History */}
            <button
              type="button"
              className="action-option-btn"
              onClick={() => {
                const emp = actionEmployee;
                onClose();
                onViewHistory(emp);
              }}
            >
              <div className="action-option-icon icon-history">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l3 3"></path>
                  <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
                </svg>
              </div>
              <div className="action-option-details">
                <div className="action-option-title">View History</div>
              </div>
            </button>

            {/* 3. Export Report */}
            <button
              type="button"
              className="action-option-btn"
              onClick={() => {
                const emp = actionEmployee;
                onClose();
                onExportReport(emp);
              }}
            >
              <div className="action-option-icon icon-report">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div className="action-option-details">
                <div className="action-option-title">Export Report</div>
              </div>
            </button>

            {/* 4. Delete Employee */}
            <button
              type="button"
              className="action-option-btn danger"
              onClick={() => {
                const emp = actionEmployee;
                onClose();
                onDeleteEmployee(emp);
              }}
            >
              <div className="action-option-icon icon-delete">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </div>
              <div className="action-option-details">
                <div className="action-option-title" style={{ color: "#dc2626" }}>Delete</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
