import React from "react";
import { STANDARDIZED_DEPARTMENTS, STANDARDIZED_PRACTICES } from "../../utils/constants";

export default function ExportAttendanceModal({
  reportChooser,
  onClose,
  reportDownloading,
  reportError,
  reportPeriod,
  setReportPeriod,
  reportDate,
  setReportDate,
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  downloadAttendanceReport,
  allDepartments = STANDARDIZED_DEPARTMENTS,
  allPractices = STANDARDIZED_PRACTICES,
  deptFilter = "ALL",
  setDeptFilter,
  practiceFilter = "ALL",
  setPracticeFilter,
}) {
  if (!reportChooser) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) =>
        event.target === event.currentTarget && !reportDownloading && onClose()
      }
    >
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Export Attendance Report</h2>
            <div className="modal-subtitle">
              {reportChooser.employee
                ? `${reportChooser.employee.employee_name} • ID: ${reportChooser.employee.employee_id}`
                : "All Authorized Employees"}
            </div>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            disabled={reportDownloading}
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {reportError && (
            <div className="message error-message" role="alert">
              {reportError}
            </div>
          )}

          {!reportChooser.employee && setDeptFilter && setPracticeFilter && (
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label>Department</label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  disabled={reportDownloading}
                  className="filter-select-box"
                  style={{ width: "100%", height: 38 }}
                >
                  <option value="ALL">All Departments</option>
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
                  value={practiceFilter}
                  onChange={(e) => setPracticeFilter(e.target.value)}
                  disabled={reportDownloading}
                  className="filter-select-box"
                  style={{ width: "100%", height: 38 }}
                >
                  <option value="ALL">All Practices</option>
                  {allPractices.map((prac) => (
                    <option key={prac} value={prac}>
                      {prac}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Report Period</label>
            <select
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value)}
              disabled={reportDownloading}
              className="filter-select-box"
              style={{ width: "100%", height: 38 }}
            >
              <option value="day">Day (Single Day)</option>
              <option value="week">Week (Monday – Sunday)</option>
              <option value="month">Month (Calendar Month)</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {reportPeriod === "custom" ? (
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  required
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  disabled={reportDownloading}
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  required
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  disabled={reportDownloading}
                />
              </div>
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>
                {reportPeriod === "day"
                  ? "Select Date"
                  : reportPeriod === "week"
                  ? "Select Date in Target Week"
                  : "Select Date in Target Month"}
              </label>
              <input
                type="date"
                required
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                disabled={reportDownloading}
              />
            </div>
          )}

          <p style={{ color: "#667085", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
            {reportPeriod === "day" && "Generates XLSX report for the chosen day with session events and working durations."}
            {reportPeriod === "week" && "Generates XLSX report covering the Monday through Sunday interval for the chosen date."}
            {reportPeriod === "month" && "Generates XLSX report covering the entire calendar month for the chosen date."}
            {reportPeriod === "custom" && "Generates XLSX report for the exact specified date range with daily summaries and break durations."}
          </p>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={reportDownloading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={downloadAttendanceReport}
            disabled={
              reportDownloading ||
              (reportPeriod === "custom" ? !reportStartDate || !reportEndDate : !reportDate)
            }
          >
            {reportDownloading ? "Generating XLSX…" : "Download Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
