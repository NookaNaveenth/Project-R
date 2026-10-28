import React from "react";
import {
  getStatus,
  formatStatus,
  formatMinutes,
  formatWorkedTime,
  formatBreakTime,
  formatTime,
  statusClass,
} from "../../utils/formatters";

export default function DailyViewModal({
  dailyViewEmployee,
  onClose,
  onOpenEmployeeHistory,
}) {
  if (!dailyViewEmployee) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Attendance Details</h2>
            <div className="modal-subtitle">
              {dailyViewEmployee.employee.employee_name} • ID:{" "}
              {dailyViewEmployee.employee.employee_id} • {dailyViewEmployee.date}
            </div>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {/* Daily metrics cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: "#f8f9fa",
                border: "1px solid #eaecf0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#667085",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Total Worked
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#101828",
                  marginTop: 4,
                }}
              >
                {formatWorkedTime(dailyViewEmployee.record)}
              </div>
            </div>
            <div
              style={{
                background: "#f8f9fa",
                border: "1px solid #eaecf0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#667085",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Break Duration
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#101828",
                  marginTop: 4,
                }}
              >
                {formatBreakTime(dailyViewEmployee.record)}
              </div>
            </div>
            <div
              style={{
                background: "#f8f9fa",
                border: "1px solid #eaecf0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#667085",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Sessions
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#101828",
                  marginTop: 4,
                }}
              >
                {dailyViewEmployee.record.session_count ??
                  dailyViewEmployee.record.sessions?.length ??
                  0}
              </div>
            </div>
            <div
              style={{
                background: "#f8f9fa",
                border: "1px solid #eaecf0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#667085",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Status
              </div>
              <div style={{ marginTop: 4 }}>
                <span
                  className={`status-badge ${statusClass(
                    getStatus(dailyViewEmployee.record)
                  )}`}
                >
                  {formatStatus(getStatus(dailyViewEmployee.record))}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #eaecf0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#667085" }}>First Check-In</div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#067647",
                  marginTop: 2,
                }}
              >
                {formatTime(dailyViewEmployee.record.first_in)}
              </div>
            </div>
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #eaecf0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "#667085" }}>Last Check-Out</div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#175cd3",
                  marginTop: 2,
                }}
              >
                {formatTime(dailyViewEmployee.record.last_out)}
              </div>
            </div>
          </div>

          {/* Sessions Breakdown */}
          {dailyViewEmployee.record.sessions &&
          dailyViewEmployee.record.sessions.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#344054",
                  marginBottom: 8,
                }}
              >
                Work Sessions
              </div>
              <table
                style={{
                  width: "100%",
                  fontSize: 12,
                  borderCollapse: "collapse",
                  border: "1px solid #eaecf0",
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8f9fa",
                      borderBottom: "1px solid #eaecf0",
                      textAlign: "left",
                    }}
                  >
                    <th style={{ padding: "8px 10px" }}>Session</th>
                    <th style={{ padding: "8px 10px" }}>In Time</th>
                    <th style={{ padding: "8px 10px" }}>Out Time</th>
                    <th style={{ padding: "8px 10px" }}>Worked Time</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyViewEmployee.record.sessions.map((sess, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f2f4f7" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                        Session {sess.session_number || idx + 1}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#067647" }}>
                        {formatTime(sess.check_in)}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#175cd3" }}>
                        {formatTime(sess.check_out)}
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                        {sess.worked_hours ||
                          (sess.worked_minutes
                            ? formatMinutes(sess.worked_minutes)
                            : "--")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                padding: "12px",
                background: "#f8f9fa",
                borderRadius: 8,
                fontSize: 13,
                color: "#667085",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              {dailyViewEmployee.record.first_in
                ? "In-progress session or single event recorded."
                : "No attendance recorded for this date."}
            </div>
          )}

          {/* Raw Events */}
          {dailyViewEmployee.record.events &&
            dailyViewEmployee.record.events.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#344054",
                    marginBottom: 8,
                  }}
                >
                  Today's Check Events
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {dailyViewEmployee.record.events.map((ev, idx) => (
                    <span
                      key={idx}
                      style={{
                        borderRadius: 6,
                        padding: "5px 8px",
                        background: ev.event_type === "IN" ? "#ecfdf3" : "#eff8ff",
                        color: ev.event_type === "IN" ? "#067647" : "#175cd3",
                        fontSize: 11,
                        fontWeight: 650,
                        border: "1px solid",
                        borderColor:
                          ev.event_type === "IN" ? "#abefc6" : "#b2ddff",
                      }}
                    >
                      {ev.event_type} • {formatTime(ev.event_time)}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const emp = dailyViewEmployee.employee;
              onClose();
              onOpenEmployeeHistory(emp);
            }}
          >
            View Full Monthly History
          </button>
          <button type="button" className="primary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
