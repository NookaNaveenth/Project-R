import React from "react";

export default function CameraEditorModal({
  show,
  onClose,
  cameraDraft,
  handleCameraDraftChange,
  setCameraDraft,
  resetCameraDraft,
  saveCamera,
  toggleCameraRole,
  cameraActionError,
  cameraActionMessage,
  cameraBusy,
  cameras,
  openCameraPreview,
  testCamera,
  editCamera,
  toggleCameraEnabled,
  deleteCamera,
}) {
  if (!show) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="camera-management-modal">
        <div className="modal-header">
          <div>
            <h2>
              {cameraDraft.id
                ? `Edit Camera: ${cameraDraft.name}`
                : "Camera Management & Setup"}
            </h2>
            <p>
              Configure local webcams or network IP cameras and manage configured streams.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="camera-editor-form" onSubmit={saveCamera}>
          <div className="camera-form-title-row">
            <span className="camera-form-section-heading">
              {cameraDraft.id ? "Edit Camera Settings" : "Add New Camera"}
            </span>
            {cameraDraft.id && (
              <button
                type="button"
                className="camera-action-button"
                onClick={() => resetCameraDraft()}
              >
                ← Add New Camera Instead
              </button>
            )}
          </div>

          <div className="camera-config-grid">
            <label className="camera-form-label">
              Camera name
              <input
                name="name"
                value={cameraDraft.name}
                onChange={handleCameraDraftChange}
                placeholder="Front entrance"
                required
              />
            </label>

            <label className="camera-form-label">
              Camera type
              <select
                name="source_type"
                value={cameraDraft.source_type}
                onChange={(event) =>
                  setCameraDraft((previous) => ({
                    ...previous,
                    source_type: event.target.value,
                    source: event.target.value === "webcam" ? "0" : "",
                  }))
                }
              >
                <option value="webcam">Webcam / local device</option>
                <option value="ip">IP / CC camera</option>
              </select>
            </label>
          </div>

          <label className="camera-form-label">
            {cameraDraft.source_type === "webcam"
              ? "Device index or device path"
              : "Stream URL"}
            <input
              name="source"
              value={cameraDraft.source}
              onChange={handleCameraDraftChange}
              placeholder={
                cameraDraft.source_type === "webcam"
                  ? "0 (device index) or /dev/video0"
                  : "rtsp://camera-ip:554/stream"
              }
              required={!cameraDraft.id}
              autoComplete="off"
              spellCheck="false"
            />
            {cameraDraft.id && (
              <span className="camera-form-hint">
                Leave blank to keep the currently saved source.
              </span>
            )}
          </label>

          <fieldset className="camera-role-fieldset">
            <legend>Assign camera to</legend>
            {["ENTRY", "EXIT", "ENROLLMENT"].map((role) => (
              <label className="camera-role-option" key={role}>
                <input
                  type="checkbox"
                  checked={cameraDraft.roles.includes(role)}
                  onChange={() => toggleCameraRole(role)}
                />
                {role === "ENTRY" ? "Entry" : role === "EXIT" ? "Exit" : "Enrollment"}
              </label>
            ))}
          </fieldset>

          <label className="camera-role-option camera-enabled-option">
            <input
              type="checkbox"
              name="enabled"
              checked={cameraDraft.enabled}
              onChange={handleCameraDraftChange}
            />
            Camera enabled
          </label>

          {cameraActionError && (
            <div className="message error-message" role="alert">
              {cameraActionError}
            </div>
          )}
          {cameraActionMessage && (
            <div className="message success-message" role="status">
              {cameraActionMessage}
            </div>
          )}

          <div className="camera-editor-actions">
            <button
              type="button"
              className="camera-action-button"
              onClick={onClose}
            >
              Close
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={cameraBusy}
            >
              {cameraBusy
                ? "Saving…"
                : cameraDraft.id
                ? "Save changes"
                : "Add camera"}
            </button>
          </div>
        </form>

        <div className="camera-configured-section">
          <div className="camera-configured-heading">
            <span className="camera-form-section-heading">
              Configured Cameras ({cameras.length})
            </span>
            <span className="camera-form-subheading">
              Manage, test connections, toggle or remove cameras
            </span>
          </div>

          {cameras.length === 0 ? (
            <div className="camera-empty-list">
              No cameras configured yet. Use the form above to add your first camera.
            </div>
          ) : (
            <div className="camera-management-list">
              {cameras.map((camera) => (
                <div
                  key={camera.id}
                  className={`camera-mgmt-item ${camera.enabled ? "" : "disabled"}`}
                >
                  <div className="camera-mgmt-info">
                    <div className="camera-mgmt-name-row">
                      <span className="camera-mgmt-name">{camera.name}</span>
                      <span
                        className={`camera-mgmt-badge ${
                          camera.enabled ? "enabled" : "disabled"
                        }`}
                      >
                        {camera.enabled ? "● ENABLED" : "○ DISABLED"}
                      </span>
                      <span className="camera-mgmt-type">
                        {camera.source_type === "webcam" ? "Webcam" : "IP Camera"}
                      </span>
                    </div>
                    <div className="camera-mgmt-meta">
                      <span>
                        <strong>Source:</strong> {camera.device || "--"}
                      </span>
                      <span>
                        <strong>Purpose:</strong>{" "}
                        {camera.roles?.length ? camera.roles.join(", ") : "None"}
                      </span>
                    </div>
                  </div>
                  <div className="camera-mgmt-actions">
                    <button
                      type="button"
                      className="camera-action-button"
                      onClick={() => openCameraPreview(camera)}
                      disabled={!camera.enabled}
                      title="View stream"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="camera-action-button"
                      onClick={() => testCamera(camera)}
                      disabled={!camera.enabled}
                      title="Test connection"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      className="camera-action-button"
                      onClick={() => editCamera(camera)}
                      title="Edit settings"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="camera-action-button"
                      onClick={() => toggleCameraEnabled(camera)}
                      title={camera.enabled ? "Disable camera" : "Enable camera"}
                    >
                      {camera.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="camera-action-button danger"
                      onClick={() => deleteCamera(camera)}
                      title="Delete camera"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
