import React, { useState } from "react";

export default function Sidebar({
  sidebarCollapsed,
  activePage,
  setActivePage,
  resetAddEmployeeState,
  setShowAddEmployee,
  resetCameraDraft,
  setShowCameraEditor,
  auth,
}) {
  const isSuperior = auth?.role === "superior";
  const isAdmin = auth?.role === "admin";
  const isHr = auth?.role === "hr";

  const isGenerateAccessActive =
    activePage === "generate_access_hr" ||
    activePage === "generate_access_admin" ||
    activePage === "general_access" ||
    activePage === "admin_mgmt";

  const [generateAccessOpen, setGenerateAccessOpen] = useState(false);

  return (
    <aside className={`miracle-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
      <div className="miracle-sidebar-menu">
        {/* Dashboard */}
        <button
          type="button"
          className={`miracle-sidebar-item ${
            activePage === "dashboard" ? "active" : ""
          }`}
          onClick={() => setActivePage("dashboard")}
          title="Dashboard"
        >
          <span className="sidebar-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="9"></rect>
              <rect x="14" y="3" width="7" height="5"></rect>
              <rect x="14" y="12" width="7" height="9"></rect>
              <rect x="3" y="16" width="7" height="5"></rect>
            </svg>
          </span>
          {!sidebarCollapsed && (
            <span className="sidebar-label">Dashboard</span>
          )}
        </button>

        {/* Attendance */}
        <button
          type="button"
          className={`miracle-sidebar-item ${
            activePage === "attendance" ? "active" : ""
          }`}
          onClick={() => setActivePage("attendance")}
          title="Attendance"
        >
          <span className="sidebar-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
              <polyline points="9 16 11 18 15 14"></polyline>
            </svg>
          </span>
          {!sidebarCollapsed && (
            <span className="sidebar-label">Attendance</span>
          )}
        </button>

        {/* Employees Section: Only for Admin; removed for Superior and HR */}
        {!isSuperior && !isHr && (
          <button
            type="button"
            className={`miracle-sidebar-item ${
              activePage === "employees" ? "active" : ""
            }`}
            onClick={() => setActivePage("employees")}
            title="Employee Directory"
          >
            <span className="sidebar-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </span>
            {!sidebarCollapsed && (
              <span className="sidebar-label">Employees</span>
            )}
          </button>
        )}

        {/* Add Employee Action */}
        <button
          type="button"
          className="miracle-sidebar-item"
          onClick={() => {
            resetAddEmployeeState();
            setShowAddEmployee(true);
          }}
          title="Add Employee"
        >
          <span className="sidebar-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </span>
          {!sidebarCollapsed && (
            <span className="sidebar-label">Add Employee</span>
          )}
        </button>

        {/* Add Camera Action */}
        <button
          type="button"
          className="miracle-sidebar-item"
          onClick={() => {
            resetCameraDraft();
            setShowCameraEditor(true);
          }}
          title="Add Camera"
        >
          <span className="sidebar-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </span>
          {!sidebarCollapsed && (
            <span className="sidebar-label">Add Camera</span>
          )}
        </button>

        {/* General Access: Superior (Admin + HR) and Admin (HR only). Removed for HR. */}
        {(isSuperior || isAdmin) && (
          <div className="miracle-sidebar-group-container">
            <button
              type="button"
              className={`miracle-sidebar-item ${
                isGenerateAccessActive ? "active" : ""
              }`}
              onClick={() => {
                setGenerateAccessOpen((prev) => !prev);
              }}
              title="Generate Access"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="sidebar-icon">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </span>
                {!sidebarCollapsed && (
                  <span className="sidebar-label">Generate Access</span>
                )}
              </div>
              {!sidebarCollapsed && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    transform: generateAccessOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </span>
              )}
            </button>

            {/* Sub-sections */}
            {generateAccessOpen && !sidebarCollapsed && (
              <div className="miracle-sidebar-subgroup">
                <button
                  type="button"
                  className={`miracle-sidebar-subitem ${
                    activePage === "generate_access_hr" || activePage === "general_access"
                      ? "active"
                      : ""
                  }`}
                  onClick={() => setActivePage("generate_access_hr")}
                  title="Generate HR Credentials"
                >
                  HR
                </button>

                {isSuperior && (
                  <button
                    type="button"
                    className={`miracle-sidebar-subitem ${
                      activePage === "generate_access_admin" || activePage === "admin_mgmt"
                        ? "active"
                        : ""
                    }`}
                    onClick={() => setActivePage("generate_access_admin")}
                    title="Generate Admin Credentials"
                  >
                    Admin
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Activity (Audit Logs): Superior Authority */}
        {isSuperior && (
          <button
            type="button"
            className={`miracle-sidebar-item ${
              activePage === "activity" || activePage === "audit_logs" ? "active" : ""
            }`}
            onClick={() => setActivePage("activity")}
            title="Activity & Audit Logs"
          >
            <span className="sidebar-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </span>
            {!sidebarCollapsed && (
              <span className="sidebar-label">Activity</span>
            )}
          </button>
        )}

        {/* Attendance Override: Superior Authority */}
        {isSuperior && (
          <button
            type="button"
            className={`miracle-sidebar-item ${
              activePage === "attendance_override" ? "active" : ""
            }`}
            onClick={() => setActivePage("attendance_override")}
            title="Attendance Override"
          >
            <span className="sidebar-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </span>
            {!sidebarCollapsed && (
              <span className="sidebar-label">Attendance Override</span>
            )}
          </button>
        )}
      </div>

      <div className="miracle-sidebar-footer">
        {!sidebarCollapsed ? (
          <>
            <div className="sidebar-footer-role">
              {isSuperior
                ? "Superior Authority"
                : isAdmin
                ? "System Admin"
                : `HR: ${auth?.department || ""}`}
            </div>
            <div className="sidebar-footer-version">
              FaceAttend Enterprise • v7.0
            </div>
          </>
        ) : (
          <div
            style={{
              textAlign: "center",
              fontSize: "10px",
              color: "#64748b",
            }}
          >
            v7.0
          </div>
        )}
      </div>
    </aside>
  );
}
