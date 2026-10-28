import React, { useState } from "react";

export default function AdminManagementPage({
  adminCreateStatus,
  handleCreateAdmin,
  newAdminForm,
  setNewAdminForm,
  loadAdminUsers,
  adminLoading,
  adminList = [],
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [historyDate, setHistoryDate] = useState("");

  const handleDateChange = (date) => {
    setHistoryDate(date);
    if (loadAdminUsers) {
      loadAdminUsers(date);
    }
  };

  const adminOnlyList = adminList.filter((u) => u.role === "admin");
  const filteredList = historyDate
    ? adminOnlyList.filter((u) => {
        if (!u.created_at) return true;
        const uDate = String(u.created_at).slice(0, 10);
        return uDate === historyDate;
      })
    : adminOnlyList;

  return (
    <>
      <div
        className="page-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 className="page-title">Generate Admin Credentials</h1>
        </div>

        {/* Single History / Back Toggle Button */}
        <div>
          {!showHistory ? (
            <button
              type="button"
              className="primary-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: "600",
                borderRadius: "6px",
                backgroundColor: "#00AAE7",
              }}
              onClick={() => {
                setShowHistory(true);
                if (loadAdminUsers) {
                  loadAdminUsers(historyDate);
                }
              }}
              title="View Admin Credential History"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>History</span>
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: "600",
                borderRadius: "6px",
                cursor: "pointer",
              }}
              onClick={() => setShowHistory(false)}
              title="Return to Credential Generation"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>Back to Credential Generation</span>
            </button>
          )}
        </div>
      </div>

      {!showHistory ? (
        /* Credential Generation Card - Shown ONLY when not in history mode */
        <div style={{ maxWidth: "560px", margin: "0 auto" }}>
          <div
            className="page-panel"
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "8px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "700",
                margin: "0 0 16px 0",
                color: "#0f172a",
              }}
            >
              Generate Admin Credentials
            </h3>

            {adminCreateStatus.error && (
              <div className="message error-message">{adminCreateStatus.error}</div>
            )}
            {adminCreateStatus.success && (
              <div className="message success-message">
                {adminCreateStatus.success}
              </div>
            )}

            <form onSubmit={handleCreateAdmin}>
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    marginBottom: "5px",
                    color: "#334155",
                  }}
                >
                  Admin Username
                </label>
                <input
                  type="text"
                  required
                  className="input-text"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                  value={newAdminForm.username}
                  onChange={(e) =>
                    setNewAdminForm((p) => ({ ...p, username: e.target.value }))
                  }
                  disabled={adminCreateStatus.loading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    marginBottom: "5px",
                    color: "#334155",
                  }}
                >
                  Initial Password
                </label>
                <input
                  type="text"
                  required
                  className="input-text"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                  value={newAdminForm.password}
                  onChange={(e) =>
                    setNewAdminForm((p) => ({ ...p, password: e.target.value }))
                  }
                  disabled={adminCreateStatus.loading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "18px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    marginBottom: "5px",
                    color: "#334155",
                  }}
                >
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  className="input-text"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                  value={newAdminForm.display_name}
                  onChange={(e) =>
                    setNewAdminForm((p) => ({ ...p, display_name: e.target.value }))
                  }
                  disabled={adminCreateStatus.loading}
                />
              </div>

              <button
                type="submit"
                className="primary-button"
                style={{ width: "100%", padding: "10px" }}
                disabled={adminCreateStatus.loading}
              >
                {adminCreateStatus.loading
                  ? "Generating..."
                  : "Generate Admin Credentials"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* History / Log Table - Shown ONLY when in history mode */
        <div
          className="page-panel"
          style={{
            background: "#ffffff",
            padding: "24px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  margin: 0,
                  color: "#0f172a",
                }}
              >
                Authorized Administrators
              </h3>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="date"
                className="filter-select-box"
                style={{ padding: "6px 10px", fontSize: "12px", borderRadius: "5px" }}
                value={historyDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => handleDateChange(e.target.value)}
                title="Filter logs by creation date"
              />
              {historyDate && (
                <button
                  type="button"
                  className="clear-filters-btn"
                  style={{ padding: "6px 10px", fontSize: "11.5px" }}
                  onClick={() => handleDateChange("")}
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                className="secondary-button"
                style={{ padding: "6px 12px", fontSize: "11.5px" }}
                onClick={() => loadAdminUsers && loadAdminUsers(historyDate)}
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Display Name</th>
                  <th>Generated Date</th>
                  <th>Password Reset</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {adminLoading ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{ textAlign: "center", padding: "24px" }}
                    >
                      Loading administrator accounts...
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      style={{
                        textAlign: "center",
                        padding: "24px",
                        color: "#64748b",
                      }}
                    >
                      No admin accounts found{historyDate ? ` for ${historyDate}` : ""}.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((u) => (
                    <tr key={u.username}>
                      <td>
                        <strong>{u.username}</strong>
                      </td>
                      <td>{u.display_name || "--"}</td>
                      <td style={{ fontSize: "11.5px", color: "#64748b" }}>
                        {u.created_at
                          ? String(u.created_at).slice(0, 10)
                          : "--"}
                      </td>
                      <td>
                        {u.must_change_password ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: "#fef3f2",
                              color: "#b42318",
                            }}
                          >
                            Required
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: "#ecfdf3",
                              color: "#027a48",
                            }}
                          >
                            Completed
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="card-tag-badge card-tag-dept">
                          Administrator
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
