import React, { useState, useEffect, useMemo, useCallback } from "react";
import { API_URL } from "../utils/config";
import { STANDARDIZED_DEPARTMENTS, STANDARDIZED_PRACTICES } from "../utils/constants";

// Helper: parse time strings (HH:MM, HH:MM:SS, 12h or 24h format) to minutes from midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = String(timeStr).trim();
  const match = str.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[4] ? match[4].toUpperCase() : null;
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

export default function AttendanceOverridePage({
  overrideStatus,
  handleManualOverride,
  overrideForm,
  setOverrideForm,
  employees = [],
}) {
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");
  const [selectedPracticeFilter, setSelectedPracticeFilter] = useState("ALL");
  const [selectedLocationFilter, setSelectedLocationFilter] = useState("ALL");
  const [loadedAttendanceStatus, setLoadedAttendanceStatus] = useState("Absent (Default)");
  const [loadingEmployeeAttendance, setLoadingEmployeeAttendance] = useState(false);

  // Standardized departments and practices
  const departmentsList = STANDARDIZED_DEPARTMENTS;
  const practicesList = STANDARDIZED_PRACTICES;

  const locationsList = useMemo(() => {
    const set = new Set();
    employees.forEach((emp) => {
      if (emp.work_location) set.add(emp.work_location.trim());
    });
    const list = Array.from(set).sort();
    return list.length > 0
      ? list
      : ["Miracle City (HQ)", "Miracle Valley", "Tech Center", "Remote / Field"];
  }, [employees]);

  // Current selected employee object
  const selectedEmployee = useMemo(() => {
    if (!overrideForm.employee_id) return null;
    return (
      employees.find(
        (emp) =>
          String(emp.employee_id).trim() === String(overrideForm.employee_id).trim()
      ) || null
    );
  }, [overrideForm.employee_id, employees]);

  // Filtered employees for dropdown search
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (
        selectedDeptFilter !== "ALL" &&
        (emp.department || "").toLowerCase().trim() !== selectedDeptFilter.toLowerCase().trim()
      ) {
        return false;
      }
      if (
        selectedPracticeFilter !== "ALL" &&
        (emp.practice || "").toLowerCase().trim() !== selectedPracticeFilter.toLowerCase().trim()
      ) {
        return false;
      }
      if (
        selectedLocationFilter !== "ALL" &&
        (emp.work_location || "").toLowerCase().trim() !== selectedLocationFilter.toLowerCase().trim()
      ) {
        return false;
      }
      if (!employeeSearchTerm.trim()) return true;
      const term = employeeSearchTerm.toLowerCase();
      const name = (emp.employee_name || "").toLowerCase();
      const id = String(emp.employee_id || "").toLowerCase();
      const email = (emp.email || "").toLowerCase();
      const login = (emp.login_id || "").toLowerCase();
      return (
        name.includes(term) ||
        id.includes(term) ||
        email.includes(term) ||
        login.includes(term)
      );
    });
  }, [employees, employeeSearchTerm, selectedDeptFilter, selectedPracticeFilter, selectedLocationFilter]);

  // Fetch actual attendance details for the selected employee and attendance date
  const fetchEmployeeAttendanceRecord = useCallback(async (employeeId, date) => {
    if (!employeeId || !date) return;
    try {
      setLoadingEmployeeAttendance(true);
      let token = "";
      try {
        const stored = sessionStorage.getItem("faceattend_auth");
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.token || "";
        }
      } catch {}

      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/attendance/employee/${employeeId}/date/${date}`, {
        headers,
      });

      if (!res.ok) {
        setLoadedAttendanceStatus("Absent (Default)");
        return;
      }

      const data = await res.json();
      if (!data.exists) {
        setLoadedAttendanceStatus("Absent (Default)");
      } else {
        // Format descriptive status
        let statusDisplay = data.status || "Absent";
        if (data.arrival_status === "EARLY") statusDisplay = "Present (Early)";
        else if (data.arrival_status === "ON_TIME") statusDisplay = "Present (On Time)";
        else if (data.arrival_status === "LATE") statusDisplay = "Late";
        else if (data.arrival_status === "FLEXIBLE") statusDisplay = "Flexible";
        else if (data.status === "FULL_DAY") statusDisplay = "Full Day";
        else if (data.status === "HALF_DAY") statusDisplay = "Half Day";
        else if (data.status === "ABSENT") statusDisplay = "Absent (Default)";

        setLoadedAttendanceStatus(statusDisplay);

        // Prepopulate First In and Last Out if present
        if (data.first_in || data.last_out) {
          setOverrideForm((prev) => ({
            ...prev,
            first_in: data.first_in || prev.first_in,
            last_out: data.last_out || prev.last_out,
            status: data.status === "HALF_DAY" ? "HALF_DAY" : data.status === "ABSENT" ? "ABSENT" : "FULL_DAY",
          }));
        }
      }
    } catch {
      setLoadedAttendanceStatus("Absent (Default)");
    } finally {
      setLoadingEmployeeAttendance(false);
    }
  }, [setOverrideForm]);

  // Load employee attendance whenever employee_id or attendance_date changes
  useEffect(() => {
    if (overrideForm.employee_id && overrideForm.attendance_date) {
      fetchEmployeeAttendanceRecord(overrideForm.employee_id, overrideForm.attendance_date);
    } else {
      setLoadedAttendanceStatus("Absent (Default)");
    }
  }, [overrideForm.employee_id, overrideForm.attendance_date, fetchEmployeeAttendanceRecord]);

  // Select an employee from search results
  const handleSelectEmployee = (emp) => {
    setOverrideForm((prev) => {
      const shiftStart =
        emp.shift_start && emp.shift_start !== "Flexible"
          ? emp.shift_start.length === 5
            ? `${emp.shift_start}:00`
            : emp.shift_start
          : prev.first_in || "14:00:00";
      const shiftEnd =
        emp.shift_end && emp.shift_end !== "Flexible"
          ? emp.shift_end.length === 5
            ? `${emp.shift_end}:00`
            : emp.shift_end
          : prev.last_out || "22:00:00";

      return {
        ...prev,
        employee_id: emp.employee_id,
        first_in: prev.status === "ABSENT" ? "" : shiftStart,
        last_out: prev.status === "ABSENT" ? "" : shiftEnd,
      };
    });
    setEmployeeSearchTerm("");
    setIsSearchOpen(false);
    if (emp.department) setSelectedDeptFilter(emp.department);
    if (emp.work_location) setSelectedLocationFilter(emp.work_location);
  };

  const handleClearSelectedEmployee = () => {
    setOverrideForm((prev) => ({
      ...prev,
      employee_id: "",
    }));
    setEmployeeSearchTerm("");
    setLoadedAttendanceStatus("Absent (Default)");
  };

  // Calculate worked minutes automatically whenever first_in, last_out, or status change
  useEffect(() => {
    if (overrideForm.status === "ABSENT") {
      if (overrideForm.worked_minutes !== 0) {
        setOverrideForm((p) => ({ ...p, worked_minutes: 0 }));
      }
      return;
    }

    if (!overrideForm.first_in || !overrideForm.last_out) {
      const defaultMinutes =
        overrideForm.status === "HALF_DAY"
          ? 240
          : overrideForm.status === "FULL_DAY"
          ? 480
          : 0;
      if (overrideForm.worked_minutes !== defaultMinutes) {
        setOverrideForm((p) => ({ ...p, worked_minutes: defaultMinutes }));
      }
      return;
    }

    const inM = parseTimeToMinutes(overrideForm.first_in);
    const outM = parseTimeToMinutes(overrideForm.last_out);

    if (inM !== null && outM !== null) {
      let resolvedOut = outM;
      if (resolvedOut < inM) {
        resolvedOut += 24 * 60; // Overnight shift
      }
      const diff = Math.max(0, resolvedOut - inM);
      if (overrideForm.worked_minutes !== diff) {
        setOverrideForm((p) => ({ ...p, worked_minutes: diff }));
      }
    }
  }, [
    overrideForm.first_in,
    overrideForm.last_out,
    overrideForm.status,
    setOverrideForm,
  ]);

  // Format worked hours string for display (matching Image 4 e.g. "9 hrs")
  const formattedWorkedHours = useMemo(() => {
    if (overrideForm.status === "ABSENT") return "0 hrs";
    const minutes = Number(overrideForm.worked_minutes);
    if (isNaN(minutes) || minutes <= 0) {
      return overrideForm.first_in && overrideForm.last_out ? "0 hrs" : "0 hrs";
    }
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hrs} hrs`;
    return `${hrs}h ${mins}m`;
  }, [overrideForm.worked_minutes, overrideForm.status, overrideForm.first_in, overrideForm.last_out]);

  return (
    <div
      style={{
        maxWidth: "1240px",
        margin: "0 auto",
        padding: "16px 20px 48px 20px",
      }}
    >
      {/* Main Container Card Matching Image 4 */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
          padding: "26px 28px",
        }}
      >
        {/* Success Banner Matching Image 4: "Attendance corrected for 9615 on 2026-10-22. Record updated and logged to audit trail." */}
        {overrideStatus.success && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              borderRadius: "8px",
              padding: "14px 18px",
              marginBottom: "22px",
              fontSize: "13.5px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#059669"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{overrideStatus.success}</span>
          </div>
        )}

        {/* Error Banner if any */}
        {overrideStatus.error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: "8px",
              padding: "14px 18px",
              marginBottom: "22px",
              fontSize: "13.5px",
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{overrideStatus.error}</span>
          </div>
        )}

        <form onSubmit={handleManualOverride}>
          {/* Top Search & Filter Bar: 4 Columns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "18px",
              marginBottom: "20px",
            }}
          >
            {/* 1. Search Employee */}
            <div style={{ position: "relative" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                Search Employee
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "0 12px",
                  height: "44px",
                  cursor: "text",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
                onClick={() => setIsSearchOpen(true)}
              >
                {/* Search Icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: "10px", flexShrink: 0 }}
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>

                <input
                  type="text"
                  placeholder={
                    selectedEmployee
                      ? `${selectedEmployee.employee_name} (${selectedEmployee.employee_id})`
                      : "Search by name, ID or email..."
                  }
                  value={employeeSearchTerm}
                  onChange={(e) => {
                    setEmployeeSearchTerm(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "13.5px",
                    color: selectedEmployee && !employeeSearchTerm ? "#0f2942" : "#1e293b",
                    fontWeight: selectedEmployee && !employeeSearchTerm ? "600" : "400",
                  }}
                />

                {/* Dropdown Chevron */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginLeft: "8px", cursor: "pointer", flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSearchOpen((prev) => !prev);
                  }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              {/* Employee Search Dropdown Overlay */}
              {isSearchOpen && (
                <>
                  <div
                    style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 30,
                    }}
                    onClick={() => setIsSearchOpen(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12)",
                      maxHeight: "280px",
                      overflowY: "auto",
                      zIndex: 35,
                      marginTop: "6px",
                    }}
                  >
                    {filteredEmployees.length === 0 ? (
                      <div
                        style={{
                          padding: "14px",
                          fontSize: "12.5px",
                          color: "#64748b",
                          textAlign: "center",
                        }}
                      >
                        No matching enrolled employees found.
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <div
                          key={emp.employee_id}
                          style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            borderBottom: "1px solid #f1f5f9",
                            fontSize: "13px",
                            transition: "background 0.15s",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#f8fafc")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = "transparent")
                          }
                          onClick={() => handleSelectEmployee(emp)}
                        >
                          <div>
                            <div style={{ fontWeight: "600", color: "#0f2942" }}>
                              {emp.employee_name}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                              ID: {emp.employee_id} • {emp.department || "General"}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              background: "#e0f2fe",
                              color: "#0369a1",
                              borderRadius: "4px",
                              fontWeight: "600",
                            }}
                          >
                            {emp.work_location || "HQ"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* 2. Department */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                Department
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "0 12px",
                  height: "44px",
                  position: "relative",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                {/* Building / Business Icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: "10px", flexShrink: 0 }}
                >
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                  <line x1="9" y1="22" x2="9" y2="22.01"></line>
                  <line x1="15" y1="22" x2="15" y2="22.01"></line>
                  <line x1="8" y1="6" x2="8" y2="6.01"></line>
                  <line x1="16" y1="6" x2="16" y2="6.01"></line>
                  <line x1="8" y1="10" x2="8" y2="10.01"></line>
                  <line x1="16" y1="10" x2="16" y2="10.01"></line>
                  <line x1="8" y1="14" x2="8" y2="14.01"></line>
                  <line x1="16" y1="14" x2="16" y2="14.01"></line>
                </svg>

                <select
                  value={selectedDeptFilter}
                  onChange={(e) => setSelectedDeptFilter(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "13.5px",
                    color: "#1e293b",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                  }}
                >
                  <option value="ALL">All Departments</option>
                  {departmentsList.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none", flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            {/* 3. Practice */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                Practice
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "0 12px",
                  height: "44px",
                  position: "relative",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: "10px", flexShrink: 0 }}
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>

                <select
                  value={selectedPracticeFilter}
                  onChange={(e) => setSelectedPracticeFilter(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "13.5px",
                    color: "#1e293b",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                  }}
                >
                  <option value="ALL">All Practices</option>
                  {practicesList.map((prac) => (
                    <option key={prac} value={prac}>
                      {prac}
                    </option>
                  ))}
                </select>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none", flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            {/* 4. Location */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                Location
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "0 12px",
                  height: "44px",
                  position: "relative",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                {/* Map Pin Icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: "10px", flexShrink: 0 }}
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>

                <select
                  value={selectedLocationFilter}
                  onChange={(e) => setSelectedLocationFilter(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "13.5px",
                    color: "#1e293b",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                  }}
                >
                  <option value="ALL">Select Location</option>
                  {locationsList.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none", flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
          </div>

          {/* Blue Info Callout Box Matching Image 4 */}
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  background: "#dbeafe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
              </div>

              <div>
                {!selectedEmployee ? (
                  <>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "700",
                        color: "#0f2942",
                        marginBottom: "3px",
                      }}
                    >
                      Search for an employee to view their attendance details.
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                      Select an employee from the search results to load their attendance information.
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: "700",
                        color: "#0f2942",
                        marginBottom: "3px",
                      }}
                    >
                      {selectedEmployee.employee_name}{" "}
                      <span
                        style={{
                          fontSize: "12.5px",
                          fontWeight: "600",
                          color: "#0284c7",
                          marginLeft: "6px",
                        }}
                      >
                        (ID: {selectedEmployee.employee_id})
                      </span>
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#475569" }}>
                      Department: <strong>{selectedEmployee.department || "Software Services"}</strong> • Location: <strong>{selectedEmployee.work_location || "Miracle City (HQ)"}</strong> • Standard Shift: <strong>{selectedEmployee.shift_start || "14:00"} - {selectedEmployee.shift_end || "22:00"}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            {selectedEmployee && (
              <button
                type="button"
                onClick={handleClearSelectedEmployee}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#475569",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                ✕ Change Employee
              </button>
            )}
          </div>

          {/* Row 1 of 3 Cards Matching Image 4 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "18px",
              marginBottom: "18px",
            }}
          >
            {/* Card 1: Attendance Date */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "14px 16px",
                minHeight: "86px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                {/* Calendar Icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>Attendance Date</span>
              </div>

              <input
                type="date"
                required
                value={overrideForm.attendance_date}
                onChange={(e) =>
                  setOverrideForm((p) => ({
                    ...p,
                    attendance_date: e.target.value,
                  }))
                }
                disabled={overrideStatus.loading}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  width: "100%",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              />
            </div>

            {/* Card 2: Attendance Status (Displays Loaded Status from DB) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "14px 16px",
                minHeight: "86px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                {/* List / Bars Icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
                <span>Attendance Status</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#0f172a",
                  }}
                >
                  {loadingEmployeeAttendance ? "Loading status..." : loadedAttendanceStatus}
                </span>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none", flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>

            {/* Card 3: Attendance Adjustment (Select Dropdown) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "14px 16px",
                minHeight: "86px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                {/* Circle Check Icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>Attendance Adjustment</span>
              </div>

              <div style={{ display: "flex", alignItems: "center" }}>
                <select
                  required
                  value={overrideForm.status}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setOverrideForm((p) => {
                      if (nextStatus === "ABSENT") {
                        return {
                          ...p,
                          status: nextStatus,
                          first_in: "",
                          last_out: "",
                          worked_minutes: 0,
                        };
                      }
                      if (nextStatus === "HALF_DAY") {
                        return {
                          ...p,
                          status: nextStatus,
                          first_in: p.first_in || "14:00:00",
                          last_out: "18:30:00",
                          worked_minutes: 270,
                        };
                      }
                      return {
                        ...p,
                        status: nextStatus,
                        first_in: p.first_in || "14:00:00",
                        last_out: p.last_out || "23:00:00",
                        worked_minutes: 540,
                      };
                    });
                  }}
                  disabled={overrideStatus.loading}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#0f172a",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                  }}
                >
                  <option value="FULL_DAY">Full Day (&gt; 7.5 hours)</option>
                  <option value="HALF_DAY">Half Day (4 - 7.5 hours)</option>
                  <option value="ABSENT">Absent (&lt; 4 hours)</option>
                  <option value="LEAVE">Leave / Excused</option>
                </select>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none", flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
          </div>

          {/* Row 2 of 3 Cards Matching Image 4 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "18px",
              marginBottom: "18px",
            }}
          >
            {/* Card 4: First In (Optional) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "14px 16px",
                minHeight: "86px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                {/* Clock Icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>First In (Optional)</span>
              </div>

              <div style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="time"
                  step="1"
                  value={overrideForm.first_in || ""}
                  onChange={(e) =>
                    setOverrideForm((p) => ({ ...p, first_in: e.target.value }))
                  }
                  disabled={overrideStatus.loading || overrideForm.status === "ABSENT"}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: overrideForm.status === "ABSENT" ? "#94a3b8" : "#0f172a",
                    cursor: overrideForm.status === "ABSENT" ? "not-allowed" : "pointer",
                  }}
                />
              </div>
            </div>

            {/* Card 5: Last Out (Optional) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "14px 16px",
                minHeight: "86px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                {/* Clock Icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Last Out (Optional)</span>
              </div>

              <div style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="time"
                  step="1"
                  value={overrideForm.last_out || ""}
                  onChange={(e) =>
                    setOverrideForm((p) => ({ ...p, last_out: e.target.value }))
                  }
                  disabled={overrideStatus.loading || overrideForm.status === "ABSENT"}
                  style={{
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    width: "100%",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: overrideForm.status === "ABSENT" ? "#94a3b8" : "#0f172a",
                    cursor: overrideForm.status === "ABSENT" ? "not-allowed" : "pointer",
                  }}
                />
              </div>
            </div>

            {/* Card 6: Worked Hours (Read-only) with Auto calculated Badge */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "14px 16px",
                minHeight: "86px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  color: "#0f2942",
                  marginBottom: "8px",
                }}
              >
                {/* Plus-in-square Icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <span>Worked Hours (Read-only)</span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: "800",
                    color: "#0f2942",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {formattedWorkedHours}
                </span>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    fontSize: "11.5px",
                    color: "#475569",
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    padding: "3px 9px",
                    borderRadius: "4px",
                    fontWeight: "600",
                    userSelect: "none",
                  }}
                  title="Automatically calculated from First In and Last Out times"
                >
                  {/* Small Lock Icon */}
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  Auto calculated
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: Reason for Manual Override (Mandatory Audit Trail Justification) */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              padding: "16px 18px",
              marginBottom: "24px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13.5px",
                fontWeight: "700",
                color: "#0f2942",
                marginBottom: "10px",
              }}
            >
              {/* Document / Edit Icon */}
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0f2942"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>
                Reason for Manual Override (Mandatory Audit Trail Justification)
              </span>
            </div>

            <textarea
              required
              rows={4}
              placeholder="Provide reason for manual correction (e.g., Device connectivity disruption; confirmed by facility manager)."
              value={overrideForm.reason}
              onChange={(e) =>
                setOverrideForm((p) => ({ ...p, reason: e.target.value }))
              }
              disabled={overrideStatus.loading}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                lineHeight: 1.5,
                color: "#1e293b",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                background: "#f8fafc",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Action Button */}
          <div>
            <button
              type="submit"
              disabled={overrideStatus.loading}
              style={{
                background: "#008db9",
                color: "#ffffff",
                fontSize: "13.5px",
                fontWeight: "700",
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                cursor: overrideStatus.loading ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 2px 6px rgba(0, 141, 185, 0.25)",
                transition: "background 0.2s, transform 0.1s",
                opacity: overrideStatus.loading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!overrideStatus.loading) {
                  e.currentTarget.style.backgroundColor = "#007a9e";
                }
              }}
              onMouseLeave={(e) => {
                if (!overrideStatus.loading) {
                  e.currentTarget.style.backgroundColor = "#008db9";
                }
              }}
            >
              {/* Shield Check Icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
              <span>
                {overrideStatus.loading
                  ? "Applying Correction & Logging to Audit..."
                  : "Apply Manual Correction & Log to Audit"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
