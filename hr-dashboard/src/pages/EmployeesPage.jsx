import React from "react";
import {
  getStatus,
  formatStatus,
  formatTime,
  formatWorkedTime,
  statusClass,
} from "../utils/formatters";
import { STANDARDIZED_DEPARTMENTS, STANDARDIZED_PRACTICES } from "../utils/constants";

export default function EmployeesPage({
  auth,
  allDepartments = STANDARDIZED_DEPARTMENTS,
  allPractices = STANDARDIZED_PRACTICES,
  practiceFilter = "ALL",
  setPracticeFilter,
  setEmployeeForm,
  setShowAddEmployee,
  search,
  setSearch,
  deptFilter,
  setDeptFilter,
  employees,
  locationFilter,
  setLocationFilter,
  allLocations,
  directoryEmployees,
  authorizedEmployees,
  getAttendance,
  expandedEmployeeId,
  setExpandedEmployeeId,
  openEditShift,
  openEmployeeHistory,
  openReportChooser,
  deleteEmployee,
  deletingEmployeeId,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 className="page-title">
            {auth?.role === "hr" ? "Department Employees" : "Employees"}
          </h1>
          <p className="page-description">
            {auth?.role === "hr"
              ? `Managing authorized employee records for ${auth.department}.`
              : "Manage employees registered across all departments in the attendance system."}
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            const defaultDept =
              auth?.role === "hr"
                ? auth.department
                : allDepartments[0] || "Software Services";
            setEmployeeForm((prev) => ({
              ...prev,
              department:
                auth?.role === "hr"
                  ? auth.department
                  : prev.department || defaultDept,
              work_location: prev.work_location || "Miracle City (HQ)",
            }));
            setShowAddEmployee(true);
          }}
        >
          + Add Employee
        </button>
      </div>

      {/* 3-WAY FILTER TOOLBAR: Department, Employee Name/ID, Work Location */}
      <div className="filter-toolbar-card">
        <div className="filter-fields-row">
          {/* Filter 1: Employee Name / ID */}
          <div
            className="search-box"
            style={{ minWidth: "220px", flex: "1 1 220px" }}
          >
            <span className="search-icon">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee name or ID..."
            />
          </div>

          {/* Filter 2: Department */}
          <select
            className="filter-select-box"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments ({employees.length})</option>
            {allDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Filter 3: Practice */}
          <select
            className="filter-select-box"
            value={practiceFilter}
            onChange={(e) => setPracticeFilter && setPracticeFilter(e.target.value)}
          >
            <option value="ALL">All Practices</option>
            {allPractices.map((prac) => (
              <option key={prac} value={prac}>
                {prac}
              </option>
            ))}
          </select>

          {/* Filter 4: Work Location */}
          <select
            className="filter-select-box"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="ALL">All Locations</option>
            {allLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* Clear Filters Button */}
          {(search || deptFilter !== "ALL" || practiceFilter !== "ALL" || locationFilter !== "ALL") && (
            <button
              type="button"
              className="clear-filters-btn"
              onClick={() => {
                setSearch("");
                setDeptFilter("ALL");
                if (setPracticeFilter) setPracticeFilter("ALL");
                setLocationFilter("ALL");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
          Showing {directoryEmployees.length} of {authorizedEmployees.length}{" "}
          employees
        </div>
      </div>

      <div className="page-panel">
        <div className="employee-grid">
          {directoryEmployees.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "#64748b",
                gridColumn: "1 / -1",
              }}
            >
              No employees match the selected criteria (Name: "{search || "any"}",
              Dept: "{deptFilter}", Location: "{locationFilter}").
            </div>
          ) : (
            directoryEmployees.map((employee) => {
              const record = getAttendance(employee.employee_id);
              const status = getStatus(record);
              const isExpanded = expandedEmployeeId === employee.employee_id;

              return (
                <div
                  className="employee-card"
                  key={employee.employee_id}
                  style={{
                    transition: "all 0.2s ease",
                    border: isExpanded
                      ? "1px solid #4f46e5"
                      : "1px solid #eaecf0",
                    boxShadow: isExpanded
                      ? "0 4px 12px rgba(79, 70, 229, 0.08)"
                      : "none",
                  }}
                >
                  <div
                    className="employee-card-top"
                    style={{ alignItems: "flex-start" }}
                  >
                    <div className="employee-cell">
                      <div className="avatar">
                        {String(employee.employee_name || "E")
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <div className="employee-card-name">
                          {employee.employee_name}
                        </div>
                        <div className="employee-card-id">
                          ID: {employee.employee_id}
                        </div>
                      </div>
                    </div>

                    <span className={`status-badge ${statusClass(status)}`}>
                      {formatStatus(status)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      margin: "8px 0 6px 0",
                    }}
                  >
                    <span className="card-tag-badge card-tag-dept">
                      {employee.department || "General"}
                    </span>
                    <span className="card-tag-badge card-tag-loc">
                      {employee.work_location || "Miracle City (HQ)"}
                    </span>
                    {employee.reporting_hr && (
                      <span
                        className="card-tag-badge"
                        style={{
                          background: "#eff6ff",
                          color: "#1e40af",
                          border: "1px solid #bfdbfe",
                          fontWeight: 650,
                        }}
                      >
                        HR: {employee.reporting_hr}
                      </span>
                    )}
                    {employee.is_flexible_shift && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "600",
                          padding: "2px 7px",
                          borderRadius: "5px",
                          background: "#f0fdf4",
                          color: "#16a34a",
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        Flexible Shift
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "10px",
                      paddingTop: "8px",
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      {employee.is_flexible_shift
                        ? "Flexible (8h req)"
                        : `${employee.shift_start || "--"} - ${
                            employee.shift_end || "--"
                          }`}
                    </span>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: "4px 9px", fontSize: "11.5px" }}
                      onClick={() =>
                        setExpandedEmployeeId(
                          isExpanded ? null : employee.employee_id
                        )
                      }
                    >
                      {isExpanded ? "Hide Details" : "View Details"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: "1px dashed #e2e8f0",
                      }}
                    >
                      <div className="employee-info" style={{ marginTop: 0 }}>
                        <div className="info-row">
                          <span>Email</span>
                          <span>{employee.email || "--"}</span>
                        </div>
                        {employee.designation && (
                          <div className="info-row">
                            <span>Designation</span>
                            <span>{employee.designation}</span>
                          </div>
                        )}
                        {employee.reports_to && (
                          <div className="info-row">
                            <span>Reports To</span>
                            <span>{employee.reports_to}</span>
                          </div>
                        )}
                        <div className="info-row">
                          <span>First In</span>
                          <span>{formatTime(record?.first_in)}</span>
                        </div>
                        <div className="info-row">
                          <span>Worked</span>
                          <span>{formatWorkedTime(record)}</span>
                        </div>
                      </div>

                      <div
                        className="employee-card-actions"
                        style={{
                          marginTop: "12px",
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "6px",
                        }}
                      >
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => openEditShift(employee)}
                        >
                          Edit Shift
                        </button>
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => openEmployeeHistory(employee)}
                        >
                          View History
                        </button>
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => openReportChooser(employee)}
                        >
                          Export Report
                        </button>
                        <button
                          type="button"
                          className="delete-employee-button"
                          onClick={() => deleteEmployee(employee)}
                          disabled={
                            deletingEmployeeId === String(employee.employee_id)
                          }
                        >
                          {deletingEmployeeId === String(employee.employee_id)
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {!employees.length && (
          <div className="empty-state">
            <div className="empty-icon">•</div>
            No employees registered.
          </div>
        )}
      </div>
    </>
  );
}
