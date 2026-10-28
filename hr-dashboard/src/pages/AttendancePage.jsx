import React, { useState } from "react";
import { getStatus, formatStatus, statusClass } from "../utils/formatters";
import ReportPreviewModal from "../components/modals/ReportPreviewModal";
import { STANDARDIZED_DEPARTMENTS, STANDARDIZED_PRACTICES } from "../utils/constants";

export default function AttendancePage({
  dateAttendanceError,
  selectedDateText,
  selectedDate,
  setSelectedDate,
  dateAttendanceLoading,
  sortedAttendanceEmployees,
  getAttendance,
  openEditShift,
  openEmployeeHistory,
  openReportChooser,
  deleteEmployee,
  deletingEmployeeId,
  search,
  setSearch,
  loadAttendanceByDate,
  handleAttendanceDateChange,
  auth,
  deptFilter,
  setDeptFilter,
  practiceFilter = "ALL",
  setPracticeFilter,
  subPracticeFilter = "ALL",
  setSubPracticeFilter,
  allDepartments = STANDARDIZED_DEPARTMENTS,
  allPractices = STANDARDIZED_PRACTICES,
  allSubPractices = [],
  locationFilter,
  setLocationFilter,
  allLocations = [],
  statusFilter,
  setStatusFilter,
  API_URL,
  authFetch,
}) {
  const isHr = auth?.role === "hr";
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewReportType, setPreviewReportType] = useState("arrival");

  const triggerCutoffCheck = async () => {
    setSchedulerLoading(true);
    setSchedulerStatus(null);
    try {
      const url = `${API_URL || ""}/scheduler/run-cutoff?force=true&date=${selectedDate}`;
      const res = authFetch ? await authFetch(url, { method: "POST" }) : await fetch(url, { method: "POST" });
      const data = await res.json();
      setSchedulerStatus({ type: "success", text: `Attendance Cutoff check executed for ${selectedDate}. Reports generated: ${data.hr_reports_processed || 0}.` });
      if (loadAttendanceByDate) loadAttendanceByDate(selectedDate);
    } catch (err) {
      setSchedulerStatus({ type: "error", text: err.message || "Failed to execute cutoff check" });
    } finally {
      setSchedulerLoading(false);
    }
  };

  const triggerEODReport = async () => {
    setSchedulerLoading(true);
    setSchedulerStatus(null);
    try {
      const url = `${API_URL || ""}/scheduler/run-eod?force=true&date=${selectedDate}`;
      const res = authFetch ? await authFetch(url, { method: "POST" }) : await fetch(url, { method: "POST" });
      const data = await res.json();
      setSchedulerStatus({ type: "success", text: `End-of-Day HR report generated for ${selectedDate}. Reports processed: ${data.reports_processed || 0}.` });
    } catch (err) {
      setSchedulerStatus({ type: "error", text: err.message || "Failed to generate EOD report" });
    } finally {
      setSchedulerLoading(false);
    }
  };

  return (
    <div className="miracle-attendance-page">
      {schedulerStatus && (
        <div
          className={`message ${schedulerStatus.type === "success" ? "success-message" : "error-message"}`}
          style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>{schedulerStatus.text}</span>
          <button
            type="button"
            onClick={() => setSchedulerStatus(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "16px" }}
          >
            ×
          </button>
        </div>
      )}
      {dateAttendanceError && (
        <div className="message error-message" style={{ marginBottom: "16px" }}>
          {dateAttendanceError}
        </div>
      )}

      <div className="miracle-attendance-layout">
        {/* Left Column: Vertically Scrollable Alphabetical Employee Cards */}
        <div className="miracle-employee-column">
          <div className="miracle-column-header">
            <div>
              <h2 className="miracle-list-title">Employee Attendance</h2>
              <p className="miracle-list-subtitle">
                Showing attendance records for{" "}
                <strong>{selectedDateText || selectedDate}</strong>
              </p>
            </div>
          </div>

          <div className="miracle-cards-scroll-container">
            {dateAttendanceLoading ? (
              <div
                className="loading-state"
                style={{
                  background: "#ffffff",
                  padding: "30px",
                  borderRadius: "6px",
                  textAlign: "center",
                }}
              >
                Loading employee attendance records…
              </div>
            ) : sortedAttendanceEmployees.length === 0 ? (
              <div
                className="empty-state"
                style={{
                  background: "#ffffff",
                  padding: "40px 20px",
                  borderRadius: "6px",
                  textAlign: "center",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: "28px",
                    color: "#94a3b8",
                    marginBottom: "8px",
                  }}
                >
                  ⊘
                </div>
                <div
                  style={{
                    fontWeight: "600",
                    color: "#334155",
                    marginBottom: "4px",
                  }}
                >
                  No employees match the selected criteria
                </div>
                <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>
                  Try clearing or adjusting search keywords, department,
                  location, or status filters.
                </p>
              </div>
            ) : (
              sortedAttendanceEmployees.map((emp) => {
                const rec = getAttendance(emp.employee_id) || {};
                const st = getStatus(rec);
                const initials = (emp.employee_name || "E")
                  .split(" ")
                  .filter(Boolean)
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div key={emp.employee_id} className="miracle-employee-card">
                    <div className="miracle-card-avatar">{initials}</div>

                    <div className="miracle-card-info">
                      <div className="miracle-card-name-row">
                        <span className="miracle-card-name">
                          {emp.employee_name}
                        </span>
                        <span className="miracle-card-sep">|</span>
                        <span className="miracle-card-login">
                          {emp.login_id || emp.username || emp.employee_id}
                        </span>
                      </div>

                      <div className="miracle-card-dept-row">
                        <span>{emp.department || "General Department"}</span>
                        {emp.designation && (
                          <span className="miracle-card-desig">
                            {" "}
                            • {emp.designation}
                          </span>
                        )}
                      </div>

                      <div className="miracle-card-shift-row">
                        <span className="miracle-card-shift-icon">
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                        </span>
                        <span>
                          {emp.is_flexible_shift
                            ? "Flexible Shift"
                            : `Shift: ${emp.shift_start || "09:00"} – ${
                                emp.shift_end || "17:00"
                              }`}
                        </span>
                      </div>

                      <div className="miracle-card-badges-row" style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                        <span className="miracle-pill miracle-pill-location">
                          {emp.work_location ||
                            emp.location ||
                            "Miracle City (HQ)"}
                        </span>

                        {(emp.reporting_hr || rec.reporting_hr) && (
                          <span
                            className="miracle-pill"
                            style={{
                              background: "#eff6ff",
                              color: "#1e40af",
                              border: "1px solid #bfdbfe",
                              fontWeight: 650,
                              fontSize: "11px",
                            }}
                          >
                            HR: {emp.reporting_hr || rec.reporting_hr}
                          </span>
                        )}

                        {st && st !== "ABSENT" && st !== "OUTSIDE" && (
                          <span
                            className={`miracle-pill miracle-pill-status ${statusClass(
                              st
                            )}`}
                          >
                            {formatStatus(st)}
                          </span>
                        )}

                        {Boolean(rec.is_provisional) && (
                          <span
                            className="miracle-pill"
                            style={{
                              background: "#fef3c7",
                              color: "#92400e",
                              border: "1px solid #fde68a",
                              fontWeight: 650,
                              fontSize: "11px",
                            }}
                            title="Open attendance session. Total hours are provisional until checkout is recorded."
                          >
                            Provisional Hours
                          </span>
                        )}

                        {rec.worked_hours && rec.worked_hours !== "0h 0m" && (
                          <span style={{ fontSize: "11px", color: "#475569", fontWeight: 600, marginLeft: "4px" }}>
                            ⏱ {rec.worked_hours}{rec.is_provisional ? " *" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="miracle-card-actions">
                      <button
                        type="button"
                        className="miracle-card-icon-btn btn-blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditShift(emp);
                        }}
                        title="Edit Shift"
                        aria-label={`Edit shift for ${emp.employee_name}`}
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
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                          <path d="m15 5 4 4"></path>
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="miracle-card-icon-btn btn-blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEmployeeHistory(emp);
                        }}
                        title="View History"
                        aria-label={`View attendance history for ${emp.employee_name}`}
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
                          <path d="M12 8v4l3 3"></path>
                          <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="miracle-card-icon-btn btn-blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReportChooser(emp);
                        }}
                        title="Export Report"
                        aria-label={`Export report for ${emp.employee_name}`}
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
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                          <line x1="16" y1="13" x2="8" y2="13"></line>
                          <line x1="16" y1="17" x2="8" y2="17"></line>
                          <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="miracle-card-icon-btn btn-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEmployee(emp);
                        }}
                        disabled={
                          deletingEmployeeId === String(emp.employee_id)
                        }
                        title="Delete"
                        aria-label={`Delete ${emp.employee_name}`}
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
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Filter By Card matching Miracle Reference */}
        <div className="miracle-filter-column">
          <div className="miracle-filter-card">
            {/* Search Field */}
            <div className="miracle-filter-section">
              <label className="miracle-filter-label">EMPLOYEE SEARCH</label>
              <div className="miracle-search-input-group">
                <input
                  type="text"
                  className="miracle-filter-input"
                  placeholder="Search by Name, Email or Mobile"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="miracle-search-btn"
                  title="Search employees"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div className="miracle-filter-title">Filter By</div>

            {/* Attendance Date */}
            <div className="miracle-filter-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <label className="miracle-filter-label" style={{ margin: 0 }}>
                  ATTENDANCE DATE
                </label>
                <button
                  type="button"
                  className="miracle-today-link"
                  onClick={() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    setSelectedDate(todayStr);
                    loadAttendanceByDate(todayStr);
                  }}
                >
                  Today
                </button>
              </div>
              <input
                type="date"
                className="miracle-filter-input"
                value={selectedDate}
                onChange={handleAttendanceDateChange}
              />
            </div>

            {/* Department Filter */}
            <div className="miracle-filter-section">
              <label className="miracle-filter-label">DEPARTMENT</label>
              <select
                className="miracle-filter-select"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {allDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Practice Filter */}
            <div className="miracle-filter-section">
              <label className="miracle-filter-label">PRACTICE</label>
              <select
                className="miracle-filter-select"
                value={practiceFilter}
                onChange={(e) =>
                  setPracticeFilter && setPracticeFilter(e.target.value)
                }
              >
                <option value="ALL">All Practices</option>
                {allPractices.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-Practice Filter */}
            <div className="miracle-filter-section">
              <label className="miracle-filter-label">SUB-PRACTICE</label>
              <select
                className="miracle-filter-select"
                value={subPracticeFilter}
                onChange={(e) =>
                  setSubPracticeFilter && setSubPracticeFilter(e.target.value)
                }
              >
                <option value="ALL">All Sub-Practices</option>
                {allSubPractices.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp}
                  </option>
                ))}
              </select>
            </div>

            {/* Work Location Filter */}
            <div className="miracle-filter-section">
              <label className="miracle-filter-label">WORK LOCATION</label>
              <select
                className="miracle-filter-select"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="ALL">All Work Locations</option>
                {allLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>


            {/* Attendance Status Filter */}
            <div className="miracle-filter-section">
              <label className="miracle-filter-label">ATTENDANCE STATUS</label>
              <select
                className="miracle-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late Arrival</option>
                <option value="ABSENT">Absent</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="INSIDE_NOW">Inside Now</option>
              </select>
            </div>

            {/* Automated Attendance & HR Reporting Controls matching Image 2 */}
            <div
              style={{
                marginTop: "16px",
                padding: "14px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.5px", marginBottom: "8px" }}>
                AUTOMATED HR REPORTS
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewReportType("arrival");
                  setPreviewModalOpen(true);
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  marginBottom: "8px",
                  borderRadius: "6px",
                  border: "1px solid #003a70",
                  background: "#ffffff",
                  color: "#003a70",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                Arrival Status Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewReportType("eod");
                  setPreviewModalOpen(true);
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "6px",
                  border: "1px solid #0284c7",
                  background: "#f0f9ff",
                  color: "#0369a1",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                EOD Report
              </button>
            </div>

            {/* Actions in Filter Card */}
            <div className="miracle-filter-actions">
              <button
                type="button"
                className="miracle-export-btn"
                onClick={() => openReportChooser()}
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
                  style={{ marginRight: "7px" }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export Attendance (.xlsx)
              </button>

              {(search ||
                deptFilter !== "ALL" ||
                locationFilter !== "ALL" ||
                statusFilter !== "ALL") && (
                <button
                  type="button"
                  className="miracle-reset-btn"
                  onClick={() => {
                    setSearch("");
                    if (auth?.role !== "hr") setDeptFilter("ALL");
                    if (setPracticeFilter) setPracticeFilter("ALL");
                    if (setSubPracticeFilter) setSubPracticeFilter("ALL");
                    setLocationFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Automated HR Reports Dashboard Preview Modal (Requirement 7) */}
      <ReportPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        reportType={previewReportType}
        selectedDate={selectedDate}
        authFetch={authFetch}
        API_URL={API_URL}
      />
    </div>
  );
}
