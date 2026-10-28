import React from "react";
import { POSE_STEPS } from "../../utils/poseMath";
import { STANDARDIZED_DEPARTMENTS, STANDARDIZED_PRACTICES } from "../../utils/constants";

export default function AddEmployeeModal({
  show,
  closeAddEmployee,
  enrollmentLoading,
  addEmployee,
  formError,
  formMessage,
  employeeForm,
  handleEmployeeFormChange,
  handleHubbleLoginKeyDown,
  hubbleEmployee,
  hubbleLoading,
  fetchHubbleEmployee,
  hubbleError,
  auth,
  enrollmentCameras,
  enrollmentCameraId,
  setEnrollmentCameraId,
  cameraStream,
  startEnrollmentCamera,
  stopEnrollmentCamera,
  captureError,
  setCaptureError,
  currentStep,
  poseState,
  videoAspect,
  cameraImageRef,
  videoRef,
  canvasRef,
  showPoseDebug,
  setShowPoseDebug,
  skipCurrentStep,
  capturedPhotos,
  removeCapturedPhoto,
  allDepartments = STANDARDIZED_DEPARTMENTS,
  allPractices = STANDARDIZED_PRACTICES,
  allLocations = [],
  setVideoAspect,
  skippedSteps = [],
  setSkippedSteps,
}) {
  if (!show) return null;

  return (
<div
  className="modal-backdrop"
  onClick={(event) => {
    if (
      event.target === event.currentTarget &&
      !enrollmentLoading
    ) {
      closeAddEmployee();
    }
  }}
>
  <div className="modal">
    <div className="modal-header">
      <div>
        <h2 className="modal-title">Add Employee</h2>
        <div className="modal-subtitle">
          Add employee details and capture face photos for recognition.
        </div>
      </div>

      <button
        className="close-button"
        onClick={closeAddEmployee}
        disabled={enrollmentLoading}
      >
        ×
      </button>
    </div>

    <form onSubmit={addEmployee}>
      <div className="modal-body">
        {formError && (
          <div className="message error-message">
            {formError}
          </div>
        )}

        {formMessage && (
          <div className="message success-message">
            {formMessage}
          </div>
        )}

        <div className="form-grid">
          <div className="form-group">
            <label>Employee ID</label>
            <input
              name="employee_id"
              value={employeeForm.employee_id}
              onChange={handleEmployeeFormChange}
              placeholder="e.g. 6495"
              required
              disabled={enrollmentLoading}
            />
          </div>

          <div className="form-group full">
            <label>
              Username / Login ID <span style={{ fontWeight: 400, color: "#667085" }}>(auto-fetches details)</span>
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                name="login_id"
                value={employeeForm.login_id}
                onChange={handleEmployeeFormChange}
                onKeyDown={handleHubbleLoginKeyDown}
                onBlur={() => {
                  const trimmed = (employeeForm.login_id || "").trim();
                  if (trimmed && hubbleEmployee?.login_id?.toLowerCase() !== trimmed.toLowerCase() && !hubbleLoading) {
                    fetchHubbleEmployee(trimmed);
                  }
                }}
                placeholder="e.g. nchowdari or 9615"
                disabled={enrollmentLoading}
                style={{ flex: 1 }}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => fetchHubbleEmployee()}
                disabled={enrollmentLoading || hubbleLoading || !employeeForm.login_id.trim()}
                style={{
                  border: "1px solid #c7d2fe",
                  background: "#eef2ff",
                  color: "#4338ca",
                  borderRadius: "8px",
                  padding: "0 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  cursor: enrollmentLoading || hubbleLoading || !employeeForm.login_id.trim() ? "not-allowed" : "pointer",
                  opacity: enrollmentLoading || hubbleLoading || !employeeForm.login_id.trim() ? 0.6 : 1,
                }}
              >
                {hubbleLoading ? "Fetching…" : "Fetch Details"}
              </button>
            </div>
            {hubbleError && (
              <div style={{ marginTop: "7px", color: "#b42318", fontSize: "11px", lineHeight: 1.4 }} role="alert">
                {hubbleError}
              </div>
            )}
            {hubbleEmployee && !hubbleError && (
              <div
                style={{
                  marginTop: "7px",
                  color: hubbleEmployee.is_enrolled ? "#b45309" : "#067647",
                  fontSize: "11.5px",
                  fontWeight: "600",
                }}
              >
                {hubbleEmployee.is_enrolled
                  ? `⚠ Employee ${hubbleEmployee.employee_name || hubbleEmployee.login_id} is already enrolled with face biometric.`
                  : hubbleEmployee.source === "database"
                  ? `✓ Existing employee details loaded from database: ${hubbleEmployee.employee_name || hubbleEmployee.login_id}`
                  : `✓ Employee details loaded successfully: ${hubbleEmployee.employee_name || hubbleEmployee.login_id}`}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Employee Name</label>
            <input
              name="employee_name"
              value={employeeForm.employee_name}
              onChange={handleEmployeeFormChange}
              placeholder="Employee name"
              required={!employeeForm.login_id.trim()}
              disabled={enrollmentLoading}
            />
          </div>

          <div className="form-group">
            <label>Shift Start</label>
            <input
              type="time"
              name="shift_start"
              value={employeeForm.shift_start}
              onChange={handleEmployeeFormChange}
              required
              disabled={enrollmentLoading}
            />
          </div>

          <div className="form-group">
            <label>Shift End</label>
            <input
              type="time"
              name="shift_end"
              value={employeeForm.shift_end}
              onChange={handleEmployeeFormChange}
              required
              disabled={enrollmentLoading}
            />
          </div>

          <div className="form-group">
            <label>Department</label>
            <select
              name="department"
              value={employeeForm.department || "Software Services"}
              onChange={handleEmployeeFormChange}
              disabled={enrollmentLoading}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d0d5dd",
                background: "white",
                fontSize: "13px",
              }}
            >
              {allDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Practice</label>
            <select
              name="practice"
              value={employeeForm.practice || "DAAPS Integration"}
              onChange={handleEmployeeFormChange}
              disabled={enrollmentLoading}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d0d5dd",
                background: "white",
                fontSize: "13px",
              }}
            >
              {allPractices.map((prac) => (
                <option key={prac} value={prac}>
                  {prac}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Work Location</label>
            <select
              name="work_location"
              value={employeeForm.work_location || "Miracle City (HQ)"}
              onChange={handleEmployeeFormChange}
              disabled={enrollmentLoading}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d0d5dd",
                background: "white",
                fontSize: "13px",
              }}
            >
              {allLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Reporting HR Name</label>
            <input
              type="text"
              name="reporting_hr"
              value={employeeForm.reporting_hr || ""}
              onChange={handleEmployeeFormChange}
              placeholder="Reporting HR Name"
              disabled={enrollmentLoading}
            />
          </div>

          <div className="form-group full">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={employeeForm.email}
              onChange={handleEmployeeFormChange}
              placeholder="employee@company.com"
              required={!employeeForm.login_id.trim()}
              disabled={enrollmentLoading}
            />
          </div>
        </div>

        {employeeForm.login_id && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: hubbleEmployee ? "#ecfdf3" : "#f4f3ff",
              border: hubbleEmployee ? "1px solid #abefc6" : "1px solid #e9d7fe",
              color: hubbleEmployee ? "#067647" : "#5925dc",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            {hubbleEmployee ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: "6px" }}>Hubble Employee Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "5px 14px", color: "#344054" }}>
                  <div><strong>Employee ID:</strong> {hubbleEmployee.employee_id || "--"}</div>
                  <div><strong>Login ID:</strong> {hubbleEmployee.login_id || "--"}</div>
                  <div><strong>Reporting Manager:</strong> {hubbleEmployee.reporting_manager || "--"}</div>
                  <div><strong>HR Contact:</strong> {hubbleEmployee.hr_contact || "--"}</div>
                  <div><strong>Department:</strong> {hubbleEmployee.department || "--"}</div>
                  <div><strong>Designation:</strong> {hubbleEmployee.designation || "--"}</div>
                  <div><strong>Team:</strong> {hubbleEmployee.team || "--"}</div>
                </div>
              </>
            ) : (
              <>Enter a Login ID and press <strong>Enter</strong> or click <strong>Fetch</strong> to fetch employee directory details. Sync occurs when you save this employee.</>
            )}
          </div>
        )}

        <div className="enrollment-section">
          <div className="enrollment-header">
            <div>
              <div className="enrollment-title">
                Face Enrollment
              </div>
              <div className="enrollment-caption">
                Follow each angle on the guide. The photo is taken
                automatically when the guide turns green. Keep only
                the employee in the frame.
              </div>
            </div>

            <div className="capture-count">
              {capturedPhotos.length} / {POSE_STEPS.length} angles
            </div>
          </div>

          <label className="enrollment-camera-select">
            Enrollment camera
            <select
              value={enrollmentCameraId}
              onChange={(event) => {
                stopEnrollmentCamera();
                setEnrollmentCameraId(event.target.value);
              }}
              disabled={Boolean(cameraStream) || enrollmentLoading}
            >
              <option value="">Use a browser webcam (default)</option>
              {enrollmentCameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name} · {camera.source_type === "webcam" ? "Webcam" : "IP / CC"}
                </option>
              ))}
            </select>
          </label>

          {captureError && (
            <div className="message error-message">
              {captureError}
            </div>
          )}

          <div className="capture-layout">
            <div className={`pose-info pose-info-${cameraStream && currentStep ? poseState.status : "idle"}`}>
              {!cameraStream ? (
                <>
                  <div className="pose-info-label">Ready</div>
                  <div className="pose-info-arrow">●</div>
                  <div className="pose-info-name">9 angles</div>
                  <div className="pose-info-message">
                    Click “Start Camera”. Then follow each angle.
                    The photo is taken automatically.
                  </div>
                </>
              ) : currentStep ? (
                <>
                  <div className="pose-info-label">
                    Step{" "}
                    {POSE_STEPS.findIndex(
                      (step) => step.id === currentStep.id
                    ) + 1}{" "}
                    / {POSE_STEPS.length}
                  </div>

                  <div className="pose-info-arrow">
                    {currentStep.arrow}
                  </div>

                  <div className="pose-info-name">
                    {currentStep.label}
                  </div>

                  <div
                    className={`pose-info-message pose-message-${poseState.status}`}
                  >
                    {poseState.message}
                  </div>
                </>
              ) : (
                <>
                  <div className="pose-info-label">Done</div>
                  <div className="pose-info-arrow">✓</div>
                  <div className="pose-info-name">All angles</div>
                  <div className="pose-info-message pose-message-done">
                    Click “Save Employee &amp; Enroll Face”.
                  </div>
                </>
              )}
            </div>

            <div>
              <div
                className="camera-preview"
                style={{ aspectRatio: videoAspect }}
              >
                {cameraStream ? (
                  <>
                    {cameraStream.cameraId ? (
                      <img
                        ref={cameraImageRef}
                        crossOrigin="anonymous"
                        alt="Selected enrollment camera preview"
                        onLoad={(event) => {
                          const { naturalWidth, naturalHeight } = event.currentTarget;
                          if (naturalWidth && naturalHeight) setVideoAspect(naturalWidth / naturalHeight);
                        }}
                        onError={() => setCaptureError("Unable to display this camera stream. Check its connection and try again.")}
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        onLoadedMetadata={(event) => {
                          const { videoWidth, videoHeight } = event.currentTarget;
                          if (videoWidth && videoHeight) setVideoAspect(videoWidth / videoHeight);
                        }}
                      />
                    )}

                    {currentStep && (
                      <div
                        className={`pose-guide pose-${poseState.status}`}
                      />
                    )}
                  </>
                ) : (
                  <div className="camera-placeholder">
                    Camera is not started.
                    <br />
                    Click “Start Camera” to begin.
                  </div>
                )}
              </div>

              <canvas
                ref={canvasRef}
                style={{ display: "none" }}
              />

              {cameraStream && showPoseDebug && poseState.debug && (
                <div className="pose-debug">
                  yaw {poseState.debug.yaw.toFixed(1)}° · pitch{" "}
                  {poseState.debug.pitch.toFixed(1)}° · cues{" "}
                  {poseState.debug.yawCue.toFixed(2)} /{" "}
                  {poseState.debug.pitchCue.toFixed(2)} · faces{" "}
                  {poseState.debug.faces}
                </div>
              )}

              <div className="capture-controls">
                {!cameraStream ? (
                  <button
                    type="button"
                    className="camera-start-button"
                    onClick={startEnrollmentCamera}
                    disabled={enrollmentLoading}
                  >
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="camera-start-button"
                      onClick={skipCurrentStep}
                      disabled={
                        enrollmentLoading ||
                        !currentStep ||
                        currentStep.id === "front"
                      }
                    >
                      Skip this angle
                    </button>

                    <button
                      type="button"
                      className="camera-start-button"
                      onClick={stopEnrollmentCamera}
                      disabled={enrollmentLoading}
                    >
                      Stop Camera
                    </button>

                    <label className="pose-debug-toggle">
                      <input
                        type="checkbox"
                        checked={showPoseDebug}
                        onChange={(event) =>
                          setShowPoseDebug(event.target.checked)
                        }
                      />
                      Show angles
                    </label>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="pose-grid">
                {[0, 1, 2].flatMap((row) =>
                  [0, 1, 2].map((col) => {
                    const step = POSE_STEPS.find(
                      (item) => item.row === row && item.col === col
                    );

                    const photoIndex = capturedPhotos.findIndex(
                      (photo) => photo.poseId === step.id
                    );

                    const photo =
                      photoIndex >= 0 ? capturedPhotos[photoIndex] : null;

                    const skipped = skippedSteps.includes(step.id);
                    const isCurrent = currentStep?.id === step.id;

                    return (
                      <button
                        type="button"
                        key={step.id}
                        className={`pose-cell${isCurrent ? " current" : ""}${photo ? " done" : ""}${skipped ? " skipped" : ""}`}
                        disabled={enrollmentLoading || (!photo && !skipped)}
                        title={
                          photo || skipped
                            ? `Retake: ${step.label}`
                            : step.label
                        }
                        onClick={() => {
                          setSkippedSteps((previous) =>
                            previous.filter((id) => id !== step.id)
                          );

                          if (photoIndex >= 0) {
                            removeCapturedPhoto(photoIndex);
                          }
                        }}
                      >
                        {photo ? (
                          <img
                            src={photo.previewUrl}
                            alt={`${step.label} captured`}
                          />
                        ) : (
                          <span className="pose-cell-arrow">
                            {step.arrow}
                          </span>
                        )}

                        <span className="pose-cell-label">
                          {photo ? "✓ " : skipped ? "skipped · " : ""}
                          {step.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="capture-help">
                Tap a captured angle to retake it. At least 5 angles
                are required.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feedback Messages (Requirement 4: visible at bottom of modal) */}
        {(formError || captureError || hubbleError || (hubbleEmployee && hubbleEmployee.is_enrolled)) && (
          <div
            style={{
              padding: "12px 16px",
              marginTop: "16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: hubbleEmployee?.is_enrolled ? "#fffbeb" : "#fef2f2",
              color: hubbleEmployee?.is_enrolled ? "#b45309" : "#b91c1c",
              border: `1px solid ${hubbleEmployee?.is_enrolled ? "#fde68a" : "#fca5a5"}`,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            role="alert"
          >
            <span>⚠️</span>
            <span>
              {hubbleEmployee?.is_enrolled
                ? `Employee ${hubbleEmployee.employee_name || hubbleEmployee.login_id} (ID: ${hubbleEmployee.employee_id}) is already enrolled with face biometric data in the database. Duplicate enrollment is prevented.`
                : formError || captureError || hubbleError}
            </span>
          </div>
        )}

        {formMessage && (
          <div
            style={{
              padding: "12px 16px",
              marginTop: "16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>✓</span>
            <span>{formMessage}</span>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="secondary-button"
          onClick={closeAddEmployee}
          disabled={enrollmentLoading}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="primary-button"
          disabled={
            enrollmentLoading ||
            capturedPhotos.length < 5 ||
            Boolean(hubbleEmployee?.is_enrolled)
          }
          title={
            hubbleEmployee?.is_enrolled
              ? "Employee already enrolled with face biometrics"
              : capturedPhotos.length < 5
              ? "At least 5 photos are required"
              : "Save employee & enroll face"
          }
        >
          {enrollmentLoading
            ? "Enrolling Face..."
            : "Save Employee & Enroll Face"}
        </button>
      </div>
    </form>
  </div>
</div>
  );
}
