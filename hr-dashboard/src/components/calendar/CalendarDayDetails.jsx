import React from "react";
import { formatTime, formatMinutes } from "../../utils/formatters";

export default function CalendarDayDetails({
  selectedHistoryDay,
  removeSelectedDayLeave,
  saveSelectedDayLeave,
  leaveSaving = false,
}) {
  if (!selectedHistoryDay) return null;

  const formattedDate = new Date(
    `${selectedHistoryDay.date}T00:00:00`
  ).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isLeave =
    selectedHistoryDay.status === "LEAVE" ||
    Boolean(selectedHistoryDay.leave_type);
  const isWeekend = selectedHistoryDay.status === "WEEKEND";
  const isHalfDay =
    selectedHistoryDay.status === "HALF_DAY" ||
    selectedHistoryDay.status === "HALF DAY" ||
    selectedHistoryDay.status === "HD" ||
    (!selectedHistoryDay.status &&
      selectedHistoryDay.worked_minutes >= 240 &&
      selectedHistoryDay.worked_minutes <= 450);
  const isPresent =
    selectedHistoryDay.status === "FULL_DAY" ||
    selectedHistoryDay.status === "PRESENT" ||
    (!isHalfDay &&
      ((selectedHistoryDay.worked_minutes && selectedHistoryDay.worked_minutes > 450) ||
        Boolean(selectedHistoryDay.first_in)));

  const statusLabel = isLeave
    ? "Leave"
    : isHalfDay
    ? "Half Day"
    : isPresent
    ? "Present / Full Day"
    : isWeekend
    ? "Weekend"
    : "Absent";

  const statusPillClass = isLeave
    ? "pill-leave"
    : isHalfDay
    ? "pill-half"
    : isPresent
    ? "pill-present"
    : isWeekend
    ? "pill-weekend"
    : "pill-absent";

  return (
    <section className="miracle-cal-day-details-panel">
      <div className="miracle-cal-details-header">
        <div className="miracle-cal-details-title-row">
          <div className="miracle-cal-details-date-title">{formattedDate}</div>
          <div className="miracle-cal-details-status-row">
            <span className="miracle-cal-details-status-text">
              Attendance Status:
            </span>
            <span className={`miracle-cal-status-badge ${statusPillClass}`}>
              {statusLabel}
            </span>
          </div>
          {isLeave && (
            <div className="miracle-cal-leave-info">
              <strong>{selectedHistoryDay.leave_type || "Leave"}</strong>
              {selectedHistoryDay.reason ? ` — ${selectedHistoryDay.reason}` : ""}
            </div>
          )}
        </div>

        <div className="miracle-cal-details-actions">
          {isLeave ? (
            <button
              type="button"
              className="miracle-cal-action-btn btn-danger"
              onClick={removeSelectedDayLeave}
              disabled={leaveSaving}
            >
              {leaveSaving ? "Saving…" : "Remove Leave"}
            </button>
          ) : (
            <button
              type="button"
              className="miracle-cal-action-btn btn-primary"
              onClick={saveSelectedDayLeave}
              disabled={leaveSaving || isWeekend}
            >
              {leaveSaving ? "Saving…" : "Mark Leave / Edit"}
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="miracle-cal-metrics-grid">
        <div className="miracle-cal-metric-box">
          <div className="miracle-cal-metric-label">Total Worked</div>
          <div className="miracle-cal-metric-value">
            {selectedHistoryDay.worked_hours || "0h 0m"}
          </div>
        </div>
        <div className="miracle-cal-metric-box">
          <div className="miracle-cal-metric-label">Break Duration</div>
          <div className="miracle-cal-metric-value">
            {selectedHistoryDay.break_hours ||
              (selectedHistoryDay.break_minutes
                ? formatMinutes(selectedHistoryDay.break_minutes)
                : "0m")}
          </div>
        </div>
        <div className="miracle-cal-metric-box">
          <div className="miracle-cal-metric-label">Sessions & Events</div>
          <div className="miracle-cal-metric-value">
            {selectedHistoryDay.sessions?.length ||
              selectedHistoryDay.session_count ||
              0}{" "}
            sessions ·{" "}
            {selectedHistoryDay.events?.length ||
              selectedHistoryDay.event_count ||
              0}{" "}
            events
          </div>
        </div>
        <div className="miracle-cal-metric-box">
          <div className="miracle-cal-metric-label">First In / Last Out</div>
          <div
            className="miracle-cal-metric-value"
            style={{ fontSize: 13.5, fontWeight: 700 }}
          >
            {formatTime(selectedHistoryDay.first_in)} —{" "}
            {formatTime(selectedHistoryDay.last_out)}
          </div>
        </div>
      </div>

      {/* Sessions Breakdown Table */}
      {selectedHistoryDay.sessions && selectedHistoryDay.sessions.length > 0 && (
        <div className="miracle-cal-section-container">
          <div className="miracle-cal-subheading">Sessions Breakdown</div>
          <table className="miracle-cal-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Worked Duration</th>
              </tr>
            </thead>
            <tbody>
              {selectedHistoryDay.sessions.map((sess, sIdx) => (
                <tr key={sIdx}>
                  <td style={{ fontWeight: 600 }}>
                    Session {sess.session_number || sIdx + 1}
                  </td>
                  <td style={{ color: "#16a34a", fontWeight: 600 }}>
                    {formatTime(sess.check_in)}
                  </td>
                  <td style={{ color: "#0284c7", fontWeight: 600 }}>
                    {formatTime(sess.check_out)}
                  </td>
                  <td style={{ fontWeight: 600 }}>
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
      )}

      {/* Recognition Events Log */}
      {selectedHistoryDay.events && selectedHistoryDay.events.length > 0 && (
        <div className="miracle-cal-section-container">
          <div className="miracle-cal-subheading">Recognition Events Log</div>
          <div className="miracle-cal-events-wrap">
            {selectedHistoryDay.events.map((event, index) => (
              <span
                key={`${event.id || index}-${event.event_time}`}
                className={`miracle-cal-event-pill ${
                  event.event_type === "IN" ? "event-in" : "event-out"
                }`}
              >
                <strong>{event.event_type}</strong> · {formatTime(event.event_time)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
