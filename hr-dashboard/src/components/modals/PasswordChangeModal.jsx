import React from "react";

export default function PasswordChangeModal({
  show,
  auth,
  passwordStatus,
  passwordForm,
  setPasswordForm,
  handlePasswordChange,
  handleClosePasswordModal,
}) {
  if (!show) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          !auth?.must_change_password &&
          !passwordStatus.loading
        ) {
          handleClosePasswordModal();
        }
      }}
    >
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Change Password</h2>
            <div className="modal-subtitle">
              {auth?.must_change_password
                ? "Initial login: You must update your password before continuing."
                : `Update account password for ${auth?.username}.`}
            </div>
          </div>
          <button
            type="button"
            className="close-button"
            id="modal-change-password-close"
            onClick={handleClosePasswordModal}
            disabled={passwordStatus.loading}
            title={auth?.must_change_password ? "Exit session" : "Close"}
            aria-label={auth?.must_change_password ? "Exit session" : "Close modal"}
          >
            ×
          </button>
        </div>
        <form onSubmit={handlePasswordChange}>
          <div className="modal-body">
            {passwordStatus.error && (
              <div className="message error-message" role="alert">
                {passwordStatus.error}
              </div>
            )}
            {passwordStatus.success && (
              <div className="message success-message" role="status">
                Password updated successfully.
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Current Password</label>
              <input
                type="password"
                required
                value={passwordForm.current_password || passwordForm.old_password || ""}
                onChange={(e) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    current_password: e.target.value,
                    old_password: e.target.value,
                  }))
                }
                disabled={passwordStatus.loading}
                placeholder="Enter current password"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>New Password</label>
              <input
                type="password"
                required
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
                }
                disabled={passwordStatus.loading}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                required
                value={passwordForm.confirm_password}
                onChange={(e) =>
                  setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))
                }
                disabled={passwordStatus.loading}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <div
            className="modal-footer"
            style={{
              justifyContent: auth?.must_change_password
                ? "flex-end"
                : "space-between",
            }}
          >
            {!auth?.must_change_password && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleClosePasswordModal}
                disabled={passwordStatus.loading}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="primary-button"
              disabled={passwordStatus.loading}
            >
              {passwordStatus.loading ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
