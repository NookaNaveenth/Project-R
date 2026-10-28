import React from "react";
import { STANDARDIZED_DEPARTMENTS, STANDARDIZED_PRACTICES } from "../../utils/constants";

export default function EditShiftModal({
  editingEmployee,
  onClose,
  editShiftLoading,
  editShiftError,
  editShiftForm,
  setEditShiftForm,
  saveEmployeeShift,
  allDepartments = STANDARDIZED_DEPARTMENTS,
  allPractices = STANDARDIZED_PRACTICES,
}) {
  if (!editingEmployee) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) =>
        event.target === event.currentTarget && !editShiftLoading && onClose()
      }
    >
      <form className="modal" onSubmit={saveEmployeeShift}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Edit Shift Schedule</h2>
            <div className="modal-subtitle">
              {editingEmployee.employee_name} • ID: {editingEmployee.employee_id} •{" "}
              {editingEmployee.designation || "Employee"}
            </div>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            disabled={editShiftLoading}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {editShiftError && (
            <div className="message error-message" role="alert">
              {editShiftError}
            </div>
          )}

          {/* Reporting HR Assignment */}
          <div
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
            }}
          >
            <div style={{ fontWeight: 700, color: "#166534", fontSize: 13.5, marginBottom: 10 }}>
              Reporting HR Assignment
            </div>
            <div className="form-grid" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Reporting HR Name</label>
                <input
                  type="text"
                  value={editShiftForm.reporting_hr || ""}
                  onChange={(e) =>
                    setEditShiftForm((prev) => ({ ...prev, reporting_hr: e.target.value }))
                  }
                  placeholder="e.g. Purnima Devi Kella"
                  disabled={editShiftLoading}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Reporting HR Email</label>
                <input
                  type="email"
                  value={editShiftForm.hr_email || ""}
                  onChange={(e) =>
                    setEditShiftForm((prev) => ({ ...prev, hr_email: e.target.value }))
                  }
                  placeholder="e.g. pkella@miraclesoft.com"
                  disabled={editShiftLoading}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Office Location</label>
                <select
                  value={editShiftForm.work_location || "Miracle City (HQ)"}
                  onChange={(e) =>
                    setEditShiftForm((prev) => ({ ...prev, work_location: e.target.value }))
                  }
                  disabled={editShiftLoading}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                >
                  <option value="Miracle City (HQ)">Miracle City (HQ)</option>
                  <option value="Miracle Heights">Miracle Heights</option>
                  <option value="Miracle Valley">Miracle Valley</option>
                  <option value="Tech Center">Tech Center</option>
                  <option value="Remote / Field">Remote / Field</option>
                </select>
              </div>
            </div>

            <div className="form-grid" style={{ marginTop: 10 }}>
              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Department</label>
                <select
                  value={editShiftForm.department || "Software Services"}
                  onChange={(e) =>
                    setEditShiftForm((prev) => ({ ...prev, department: e.target.value }))
                  }
                  disabled={editShiftLoading}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                >
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Practice</label>
                <select
                  value={editShiftForm.practice || "DAAPS Integration"}
                  onChange={(e) =>
                    setEditShiftForm((prev) => ({ ...prev, practice: e.target.value }))
                  }
                  disabled={editShiftLoading}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                >
                  {allPractices.map((prac) => (
                    <option key={prac} value={prac}>
                      {prac}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              background: "#f8f9fa",
              border: "1px solid #eaecf0",
              borderRadius: 8,
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                fontWeight: 650,
                color: "#101828",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(editShiftForm.is_flexible_shift)}
                onChange={(event) =>
                  setEditShiftForm((prev) => ({
                    ...prev,
                    is_flexible_shift: event.target.checked,
                  }))
                }
                disabled={editShiftLoading}
                style={{ width: 17, height: 17, cursor: "pointer" }}
              />
              Flexible Shift (8 Working Hours Required)
            </label>
            <div
              style={{
                fontSize: 12,
                color: "#667085",
                marginTop: 6,
                lineHeight: 1.4,
              }}
            >
              {editShiftForm.is_flexible_shift
                ? "Employee is authorized for flexible working hours. They may fulfill their required 8 hours at flexible times without fixed start/end arrival penalties."
                : "Standard fixed shift with scheduled start and end times. Arrival status and scheduled shift boundaries apply."}
            </div>
          </div>

          {!editShiftForm.is_flexible_shift && (
            <div className="form-grid">
              <div className="form-group">
                <label>Shift Start Time</label>
                <input
                  type="time"
                  required
                  value={editShiftForm.shift_start}
                  onChange={(event) =>
                    setEditShiftForm((previous) => ({
                      ...previous,
                      shift_start: event.target.value,
                    }))
                  }
                  disabled={editShiftLoading}
                />
              </div>
              <div className="form-group">
                <label>Shift End Time</label>
                <input
                  type="time"
                  required
                  value={editShiftForm.shift_end}
                  onChange={(event) =>
                    setEditShiftForm((previous) => ({
                      ...previous,
                      shift_end: event.target.value,
                    }))
                  }
                  disabled={editShiftLoading}
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={editShiftLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={editShiftLoading}
          >
            {editShiftLoading ? "Saving…" : "Save Shift"}
          </button>
        </div>
      </form>
    </div>
  );
}
