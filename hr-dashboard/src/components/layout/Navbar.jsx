import React from "react";
import miracleLogo from "../../assets/miracle-logo.svg";

export default function Navbar({
  setActivePage,
  sidebarCollapsed,
  setSidebarCollapsed,
  auth,
  showProfileDropdown,
  setShowProfileDropdown,
  setShowTourModal,
  setShowProfileModal,
  setPasswordStatus,
  setPasswordForm,
  setShowPasswordModal,
  activePage,
  loadAttendanceByDate,
  selectedDate,
  loadCameraStatus,
  loadAdminUsers,
  loadHrUsers,
  loadAuditLogs,
  loadDashboardData,
  handleLogout,
}) {
  return (
    <header className="miracle-topbar">
      <div className="miracle-topbar-left">
        <div
          className="miracle-nav-brand"
          onClick={() => setActivePage("dashboard")}
          title="Miracle Software Systems — FaceAttend Enterprise"
        >
          <img
            src={miracleLogo}
            alt="Miracle Software Systems"
            className="miracle-navbar-logo"
          />
        </div>

        <button
          type="button"
          className="miracle-menu-toggle"
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label="Toggle navigation menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="miracle-topbar-right">
        {auth?.role === "superior" ? (
          <div className="miracle-role-pill superior">Superior Console</div>
        ) : auth?.role === "admin" ? (
          <div className="miracle-role-pill admin">System Admin</div>
        ) : (
          <div className="miracle-role-pill hr">
            HR: {auth?.department || "General"}
          </div>
        )}

        <div className="miracle-system-status">
          <span className="miracle-status-dot"></span>
          System Online
        </div>

        {/* User Profile Area with Dropdown */}
        <div className="miracle-profile-wrapper">
          <div
            className="miracle-profile-trigger"
            onClick={() => setShowProfileDropdown((prev) => !prev)}
            title="Account Menu"
          >
            <span className="miracle-user-name">
              {auth?.username
                ? auth.username.charAt(0).toUpperCase() + auth.username.slice(1)
                : "Durga Mallesh Amuj..."}
            </span>
            <div className="miracle-avatar-circle">
              {(auth?.username || "D").charAt(0).toUpperCase()}
            </div>
          </div>

          {showProfileDropdown && (
            <div className="miracle-dropdown-menu">
              <div className="miracle-dropdown-arrow"></div>
              <div className="miracle-dropdown-header">
                <div className="dropdown-user-title">
                  {auth?.username
                    ? auth.username.charAt(0).toUpperCase() +
                      auth.username.slice(1)
                    : "Durga Mallesh Amuj..."}
                </div>
                <div className="dropdown-user-role">
                  {auth?.role === "superior"
                    ? "Superior Authority"
                    : auth?.role === "admin"
                    ? "System Administrator"
                    : `HR Officer • ${auth?.department || ""}`}
                </div>
              </div>

              <div className="miracle-dropdown-divider"></div>

              <button
                type="button"
                className="miracle-dropdown-item"
                onClick={() => {
                  setShowProfileDropdown(false);
                  setShowTourModal(true);
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                <span>Start Tour</span>
              </button>

              <button
                type="button"
                className="miracle-dropdown-item"
                onClick={() => {
                  setShowProfileDropdown(false);
                  setShowProfileModal(true);
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Profile</span>
              </button>

              <button
                type="button"
                className="miracle-dropdown-item"
                onClick={() => {
                  setShowProfileDropdown(false);
                  setPasswordStatus({ loading: false, error: "", success: "" });
                  setPasswordForm({
                    current_password: "",
                    old_password: "",
                    new_password: "",
                    confirm_password: "",
                  });
                  setShowPasswordModal(true);
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Reset Password</span>
              </button>

              <button
                type="button"
                className="miracle-dropdown-item"
                onClick={() => {
                  setShowProfileDropdown(false);
                  if (activePage === "attendance") {
                    loadAttendanceByDate(selectedDate);
                    loadCameraStatus();
                  } else if (
                    activePage === "admin_mgmt" ||
                    activePage === "generate_access_admin"
                  ) {
                    loadAdminUsers();
                  } else if (
                    activePage === "general_access" ||
                    activePage === "generate_access_hr"
                  ) {
                    loadHrUsers();
                  } else if (
                    activePage === "audit_logs" ||
                    activePage === "activity"
                  ) {
                    loadAuditLogs();
                  } else {
                    loadDashboardData();
                    loadCameraStatus();
                  }
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>Refresh Data</span>
              </button>

              <div className="miracle-dropdown-divider"></div>

              <button
                type="button"
                className="miracle-dropdown-item logout"
                onClick={() => {
                  setShowProfileDropdown(false);
                  handleLogout();
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
