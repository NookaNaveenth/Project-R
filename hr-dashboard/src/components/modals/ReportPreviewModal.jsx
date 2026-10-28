import React, { useState, useEffect } from "react";

export default function ReportPreviewModal({
  isOpen,
  onClose,
  reportType = "arrival", // "arrival" or "eod"
  selectedDate,
  authFetch,
  API_URL,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reports, setReports] = useState([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setReports([]);
      setError("");
      setEmailStatus(null);
      return;
    }

    const fetchReportData = async () => {
      setLoading(true);
      setError("");
      setEmailStatus(null);
      try {
        const endpoint =
          reportType === "arrival"
            ? `${API_URL}/reports/preview/arrival-status?date=${selectedDate}`
            : `${API_URL}/reports/preview/eod?date=${selectedDate}`;

        const res = authFetch ? await authFetch(endpoint) : await fetch(endpoint);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Failed to load report preview");
        }

        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Unable to fetch report preview data");
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [isOpen, reportType, selectedDate, API_URL]);

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const endpoint =
        reportType === "arrival"
          ? `${API_URL}/scheduler/run-cutoff?force=true&date=${selectedDate}`
          : `${API_URL}/scheduler/run-eod?force=true&date=${selectedDate}`;

      const res = authFetch
        ? await authFetch(endpoint, { method: "POST" })
        : await fetch(endpoint, { method: "POST" });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to trigger email delivery");
      }

      setEmailStatus({
        type: "success",
        message:
          reportType === "arrival"
            ? `Arrival Status Report email dispatched successfully (${data.hr_reports_processed || 1} processed).`
            : `End-of-Day Report email dispatched successfully (${data.reports_processed || 1} processed).`,
      });
    } catch (err) {
      setEmailStatus({
        type: "error",
        message: err.message || "Failed to dispatch email",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  const isArrival = reportType === "arrival";
  const title = isArrival
    ? "Shift Arrival Status Report (Dashboard Preview)"
    : "End-of-Day Attendance Report (Dashboard Preview)";

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !sendingEmail) onClose();
      }}
    >
      <div
        className="modal"
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "1050px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Miracle Dark-Blue Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #003a70 0%, #002244 100%)",
            color: "#ffffff",
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "3px solid #00AAE7",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "1.2px",
                color: "#00AAE7",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              MIRACLE SOFTWARE SYSTEMS • ATTENDANCE INTELLIGENCE
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                margin: 0,
                color: "#ffffff",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h2>
            <div
              style={{
                fontSize: "13px",
                color: "#cbd5e1",
                marginTop: "4px",
              }}
            >
              Report Date: <strong>{selectedDate}</strong> • Schedule Buffer:{" "}
              <strong>60 Minutes Post Shift Start</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={sendingEmail}
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              border: "none",
              color: "#ffffff",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              fontSize: "20px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
            background: "#f8fafc",
          }}
        >
          {emailStatus && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                marginBottom: "16px",
                fontSize: "13.5px",
                fontWeight: 600,
                background:
                  emailStatus.type === "success" ? "#ecfdf5" : "#fef2f2",
                color: emailStatus.type === "success" ? "#065f46" : "#991b1b",
                border: `1px solid ${
                  emailStatus.type === "success" ? "#a7f3d0" : "#fecaca"
                }`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{emailStatus.message}</span>
              <button
                type="button"
                onClick={() => setEmailStatus(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>
          )}

          {loading ? (
            <div
              style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "12px" }}>⏳</div>
              <div style={{ fontSize: "15px", fontWeight: 600 }}>
                Loading report data for {selectedDate}...
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                Matching calculations with assigned HR email template.
              </div>
            </div>
          ) : error ? (
            <div
              style={{
                padding: "20px",
                borderRadius: "8px",
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                fontSize: "13.5px",
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          ) : reports.length === 0 ? (
            <div
              style={{
                padding: "50px 20px",
                textAlign: "center",
                background: "#ffffff",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                color: "#64748b",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>📋</div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: "4px",
                }}
              >
                No Report Data Available
              </div>
              <div style={{ fontSize: "13px" }}>
                No active employee records or shifts found for {selectedDate}.
              </div>
            </div>
          ) : (
            reports.map((rep, repIdx) => {
              const totals = rep.totals || {};
              const employees = rep.employees || [];

              return (
                <div
                  key={repIdx}
                  style={{
                    background: "#ffffff",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "24px",
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  {/* HR Scope Info Banner */}
                  <div
                    style={{
                      background: "#f1f5f9",
                      padding: "14px 20px",
                      borderBottom: "1px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        Assigned HR: {rep.hr_name}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginLeft: "8px",
                        }}
                      >
                        ({rep.hr_email})
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          background: "#e0f2fe",
                          color: "#0369a1",
                          padding: "3px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        Practice: {rep.practice || "Software Services"}
                      </span>
                      {isArrival && rep.shift_start && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#ede9fe",
                            color: "#6d28d9",
                            padding: "3px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          Shift: {rep.shift_start} (Cutoff: {rep.cutoff_time || "15:00"})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4 Summary Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "14px",
                      padding: "18px 20px",
                      background: "#fafafa",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    {/* Card 1: Total */}
                    <div
                      style={{
                        background: "#ffffff",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        borderLeft: "4px solid #003a70",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#64748b",
                          letterSpacing: "0.5px",
                        }}
                      >
                        TOTAL ASSIGNED
                      </div>
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 800,
                          color: "#003a70",
                          marginTop: "2px",
                        }}
                      >
                        {totals.total ?? employees.length}
                      </div>
                    </div>

                    {/* Card 2: Present / On-Time */}
                    <div
                      style={{
                        background: "#ffffff",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        borderLeft: "4px solid #16a34a",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#64748b",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {isArrival ? "PRESENT" : "ON-TIME"}
                      </div>
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 800,
                          color: "#16a34a",
                          marginTop: "2px",
                        }}
                      >
                        {isArrival ? totals.present ?? 0 : totals.on_time ?? 0}
                      </div>
                    </div>

                    {/* Card 3: Late */}
                    <div
                      style={{
                        background: "#ffffff",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        borderLeft: "4px solid #dc2626",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#64748b",
                          letterSpacing: "0.5px",
                        }}
                      >
                        LATE
                      </div>
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 800,
                          color: "#dc2626",
                          marginTop: "2px",
                        }}
                      >
                        {totals.late ?? 0}
                      </div>
                    </div>

                    {/* Card 4: Absent / Pending */}
                    <div
                      style={{
                        background: "#ffffff",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        borderLeft: "4px solid #64748b",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#64748b",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {isArrival ? "ABSENT / PENDING" : "ABSENT / PENDING"}
                      </div>
                      <div
                        style={{
                          fontSize: "24px",
                          fontWeight: 800,
                          color: "#475569",
                          marginTop: "2px",
                        }}
                      >
                        {isArrival
                          ? totals.not_checked_in ?? 0
                          : totals.absent ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Data Table */}
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderBottom: "1px solid #e2e8f0",
                            color: "#475569",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            letterSpacing: "0.3px",
                            textAlign: "left",
                          }}
                        >
                          <th style={{ padding: "10px 14px" }}>EMPLOYEE ID</th>
                          <th style={{ padding: "10px 14px" }}>EMPLOYEE NAME</th>
                          <th style={{ padding: "10px 14px" }}>PRACTICE</th>
                          <th style={{ padding: "10px 14px" }}>OFFICE LOCATION</th>
                          <th style={{ padding: "10px 14px" }}>SCHEDULED SHIFT</th>
                          {isArrival ? (
                            <>
                              <th style={{ padding: "10px 14px" }}>ARRIVAL TIME</th>
                              <th style={{ padding: "10px 14px" }}>MINUTES LATE</th>
                              <th style={{ padding: "10px 14px" }}>STATUS</th>
                            </>
                          ) : (
                            <>
                              <th style={{ padding: "10px 14px" }}>FIRST IN</th>
                              <th style={{ padding: "10px 14px" }}>LAST OUT</th>
                              <th style={{ padding: "10px 14px" }}>WORKED HOURS</th>
                              <th style={{ padding: "10px 14px" }}>STATUS</th>
                              <th style={{ padding: "10px 14px" }}>RECORD TYPE</th>
                            </>
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {employees.length === 0 ? (
                          <tr>
                            <td
                              colSpan={isArrival ? 8 : 10}
                              style={{
                                padding: "24px",
                                textAlign: "center",
                                color: "#94a3b8",
                              }}
                            >
                              No records found for this HR group.
                            </td>
                          </tr>
                        ) : (
                          employees.map((emp, empIndex) => {
                            const empId = emp.id || emp.employee_id;
                            const empName = emp.name || emp.employee_name;
                            const practice =
                              emp.practice || emp.department || "Software Services";
                            const location =
                              emp.location || emp.work_location || "Miracle City (HQ)";
                            const shift =
                              emp.shift_start && emp.shift_end
                                ? `${emp.shift_start} - ${emp.shift_end}`
                                : emp.shift_start || "14:00 - 22:00";

                            const status = String(emp.status || "").toUpperCase();
                            const isLate = status === "LATE";
                            const isPresent =
                              status === "PRESENT" ||
                              status === "ON_TIME" ||
                              status === "EARLY";
                            const isNotCheckedIn =
                              status === "NOT CHECKED IN" || status === "ABSENT";

                            return (
                              <tr
                                key={empIndex}
                                style={{
                                  borderBottom: "1px solid #f1f5f9",
                                  background:
                                    empIndex % 2 === 0 ? "#ffffff" : "#fcfcfd",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    fontWeight: 700,
                                    color: "#0f172a",
                                  }}
                                >
                                  {empId}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    fontWeight: 600,
                                    color: "#1e293b",
                                  }}
                                >
                                  {empName}
                                </td>
                                <td style={{ padding: "10px 14px", color: "#475569" }}>
                                  {practice}
                                </td>
                                <td style={{ padding: "10px 14px", color: "#475569" }}>
                                  {location}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 14px",
                                    color: "#475569",
                                    fontFamily: "monospace",
                                    fontSize: "12px",
                                  }}
                                >
                                  {shift}
                                </td>

                                {isArrival ? (
                                  <>
                                    <td
                                      style={{
                                        padding: "10px 14px",
                                        fontFamily: "monospace",
                                        fontSize: "12px",
                                      }}
                                    >
                                      {emp.login_time && emp.login_time !== "—"
                                        ? emp.login_time
                                        : "00:00"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "10px 14px",
                                        fontWeight: 600,
                                        color: isLate ? "#dc2626" : "#475569",
                                      }}
                                    >
                                      {emp.late_minutes && emp.late_minutes > 0
                                        ? `${emp.late_minutes}m`
                                        : "0m"}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                      {isNotCheckedIn ? (
                                        <span
                                          style={{
                                            display: "inline-block",
                                            padding: "3px 8px",
                                            borderRadius: "12px",
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            background: "#334155",
                                            color: "#ffffff",
                                          }}
                                        >
                                          Not Checked In
                                        </span>
                                      ) : isLate ? (
                                        <span
                                          style={{
                                            display: "inline-block",
                                            padding: "3px 8px",
                                            borderRadius: "12px",
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            background: "#fee2e2",
                                            color: "#b91c1c",
                                            border: "1px solid #fca5a5",
                                          }}
                                        >
                                          LATE
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            display: "inline-block",
                                            padding: "3px 8px",
                                            borderRadius: "12px",
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            background: "#dcfce7",
                                            color: "#15803d",
                                            border: "1px solid #86efac",
                                          }}
                                        >
                                          PRESENT
                                        </span>
                                      )}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td
                                      style={{
                                        padding: "10px 14px",
                                        fontFamily: "monospace",
                                        fontSize: "12px",
                                      }}
                                    >
                                      {emp.first_in || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "10px 14px",
                                        fontFamily: "monospace",
                                        fontSize: "12px",
                                      }}
                                    >
                                      {emp.last_out || "—"}
                                    </td>
                                    <td
                                      style={{
                                        padding: "10px 14px",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {emp.worked_hours || "0h 0m"}
                                      {emp.is_provisional ? " *" : ""}
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                      <span
                                        style={{
                                          display: "inline-block",
                                          padding: "3px 8px",
                                          borderRadius: "12px",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          background: isLate
                                            ? "#fee2e2"
                                            : isPresent
                                            ? "#dcfce7"
                                            : "#f1f5f9",
                                          color: isLate
                                            ? "#b91c1c"
                                            : isPresent
                                            ? "#15803d"
                                            : "#475569",
                                        }}
                                      >
                                        {emp.status || "ABSENT"}
                                      </span>
                                    </td>
                                    <td style={{ padding: "10px 14px" }}>
                                      {emp.is_provisional ? (
                                        <span
                                          style={{
                                            fontSize: "11px",
                                            fontWeight: 650,
                                            background: "#fef3c7",
                                            color: "#92400e",
                                            padding: "2px 7px",
                                            borderRadius: "4px",
                                            border: "1px solid #fde68a",
                                          }}
                                        >
                                          Provisional
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: "11px",
                                            fontWeight: 650,
                                            background: "#e0f2fe",
                                            color: "#0369a1",
                                            padding: "2px 7px",
                                            borderRadius: "4px",
                                          }}
                                        >
                                          Completed
                                        </span>
                                      )}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Explanatory Note Callout */}
                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "12px 20px",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: "12px",
                      color: "#64748b",
                      lineHeight: 1.5,
                    }}
                  >
                    {isArrival ? (
                      <div>
                        <strong>Cutoff Policy:</strong> Employees with no badge
                        check-in recorded within 60 minutes of their shift start
                        are marked as <strong>Not Checked In</strong>. Working
                        hours are calculated during End-of-Day reporting.
                      </div>
                    ) : (
                      <div>
                        <strong>EOD Reporting Policy:</strong> Working hours are
                        finalized once an exit checkout event is recorded. Records
                        marked with an asterisk (*) are provisional.
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Previewing report data does not send automated emails.
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={sendingEmail}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close Preview
            </button>

            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sendingEmail || reports.length === 0}
              style={{
                padding: "8px 18px",
                borderRadius: "6px",
                border: "none",
                background: sendingEmail ? "#94a3b8" : "#003a70",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: sendingEmail || reports.length === 0 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {sendingEmail ? (
                "Sending Email..."
              ) : (
                <>
                  <span>✉</span>
                  <span>Send Email to Assigned HR</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
