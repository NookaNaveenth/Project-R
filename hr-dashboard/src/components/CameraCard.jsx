function CameraCard({ camera, onView, onEdit, onDelete, onToggle, onTest }) {
  return (
    <article className={`camera-card ${camera.enabled ? "" : "camera-card-disabled"}`}>
      <div className="camera-header">
        <div>
          <div className="camera-name">{camera.name}</div>
          <div className="camera-responsibility">{camera.source_type === "webcam" ? "Webcam" : "IP / CC camera"}</div>
        </div>

        <div className={`connection-badge ${camera.enabled ? "configured" : "disconnected"}`}>
          <span>●</span>{camera.enabled ? "ENABLED" : "DISABLED"}
        </div>
      </div>

      <div className="camera-details">
        <div>
          <div className="detail-label">Source</div>
          <div className="detail-value">{camera.device || "--"}</div>
        </div>
        <div>
          <div className="detail-label">Assigned to</div>
          <div className="detail-value">{camera.roles?.length ? camera.roles.join(" · ") : "Not assigned"}</div>
        </div>
      </div>

      <div className="camera-card-actions">
        <button type="button" className="camera-action-button" onClick={onView} disabled={!camera.enabled}>View</button>
        <button type="button" className="camera-action-button" onClick={onTest} disabled={!camera.enabled}>Test</button>
        <button type="button" className="camera-action-button" onClick={onEdit}>Edit</button>
        <button type="button" className="camera-action-button" onClick={onToggle}>{camera.enabled ? "Disable" : "Enable"}</button>
        <button type="button" className="camera-action-button danger" onClick={onDelete}>Delete</button>
      </div>
    </article>
  );
}


export default CameraCard;
