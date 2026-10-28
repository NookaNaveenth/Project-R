import React from "react";

export default function AuditLogsPage({
  loadAuditLogs,
  auditLoading,
  auditRoleFilter,
  setAuditRoleFilter,
  auditActionFilter,
  setAuditActionFilter,
  auditDateFilter,
  setAuditDateFilter,
  auditLogs,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">Activity</h1>
          <p className="page-description">
            Complete immutable audit trail of administrator actions, manual
            attendance overrides, shift updates, and account creation.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadAuditLogs}
          disabled={auditLoading}
        >
          {auditLoading ? "Refreshing..." : "Refresh Logs"}
        </button>
      </div>

      <div
        className="filter-toolbar-card"
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <label
            style={{
              fontSize: "11px",
              fontWeight: "600",
              display: "block",
              color: "#64748b",
              marginBottom: "4px",
            }}
          >
            Actor Role
          </label>
          <select
            className="filter-select-box"
            value={auditRoleFilter}
            onChange={(e) => setAuditRoleFilter(e.target.value)}
          >
            <option value="ALL">All Roles</option>
            <option value="SUPERIOR">Superior</option>
            <option value="ADMIN">Admin</option>
            <option value="HR">HR</option>
          </select>
        </div>

        <div>
          <label
            style={{
              fontSize: "11px",
              fontWeight: "600",
              display: "block",
              color: "#64748b",
              marginBottom: "4px",
            }}
          >
            Action Type
          </label>
          <select
            className="filter-select-box"
            value={auditActionFilter}
            onChange={(e) => setAuditActionFilter(e.target.value)}
          >
            <option value="ALL">All Action Types</option>
            <option value="MANUAL_ATTENDANCE_CORRECTION">
              Manual Attendance Correction
            </option>
            <option value="USER_CREATE">User Account Creation</option>
            <option value="PASSWORD_CHANGE">Password Change</option>
            <option value="SHIFT_UPDATE">Shift Update</option>
            <option value="EMPLOYEE_DELETE">Employee Delete</option>
            <option value="DEPARTMENT_UPDATE">Department Update</option>
            <option value="LEAVE_RECORD">Leave Record Added</option>
            <option value="LEAVE_DELETE">Leave Record Deleted</option>
          </select>
        </div>

        <div>
          <label
            style={{
              fontSize: "11px",
              fontWeight: "600",
              display: "block",
              color: "#64748b",
              marginBottom: "4px",
            }}
          >
            Attendance Date
          </label>
          <input
            type="date"
            className="filter-select-box"
            value={auditDateFilter}
            onChange={(e) => setAuditDateFilter(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="clear-filters-btn"
          style={{ alignSelf: "flex-end" }}
          onClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            setAuditRoleFilter("ALL");
            setAuditActionFilter("ALL");
            setAuditDateFilter(today);
          }}
        >
          Reset to Today
        </button>
      </div>

      <div className="table-card" style={{ marginTop: "16px" }}>
        <div className="table-wrapper">
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading ? (
                <tr>
                  <td
                    colSpan="4"
                    style={{ textAlign: "center", padding: "30px" }}
                  >
                    Loading audit records...
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "#64748b",
                    }}
                  >
                    No audit log records match the current filter.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td
                      style={{
                        fontSize: "11.5px",
                        color: "#64748b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.timestamp}
                    </td>
                    <td>
                      <strong>{log.actor_username}</strong>{" "}
                      <span
                        style={{
                          fontSize: "10.5px",
                          fontWeight: "700",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: "#f1f5f9",
                          color: "#475467",
                        }}
                      >
                        {log.actor_role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "650",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: log.action_type.includes("CORRECTION")
                            ? "#fef3f2"
                            : "#eff8ff",
                          color: log.action_type.includes("CORRECTION")
                            ? "#b42318"
                            : "#175cd3",
                        }}
                      >
                        {log.action_type}
                      </span>
                    </td>
                    <td>
                      {log.target_employee_id
                        ? `Employee: ${log.target_employee_id}`
                        : log.target_date
                        ? `Date: ${log.target_date}`
                        : "--"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
