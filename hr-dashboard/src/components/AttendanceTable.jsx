import { STANDARDIZED_DEPARTMENTS, STANDARDIZED_PRACTICES } from "../utils/constants";

function AttendanceTable({
  employees,
  getAttendance,
  getStatus,
  formatStatus,
  formatTime,
  formatWorkedTime,
  formatBreakTime,
  statusClass,
  search,
  setSearch,
  deptFilter,
  setDeptFilter,
  practiceFilter = "ALL",
  setPracticeFilter,
  subPracticeFilter = "ALL",
  setSubPracticeFilter,
  locationFilter,
  setLocationFilter,
  allDepartments = STANDARDIZED_DEPARTMENTS,
  allPractices = STANDARDIZED_PRACTICES,
  allSubPractices = [],
  allLocations = [],
  isHr = false,
  hrDepartment = "",
  statusFilter,
  setStatusFilter,
  openEmployeeHistory,
  onViewDaily,
  loading,
  tableTitle = "Today's Attendance",
  tableCaption = "Real-time attendance and working hours summary",
  useStatusDropdown = true,
}) {
  const statusOptions = [
    ["ALL", "All Statuses"],
    ["PRESENT", "Present"],
    ["EARLY", "Early"],
    ["ON_TIME", "On Time"],
    ["LATE", "Late"],
    ["ABSENT", "Absent"],
    ["INSIDE", "Inside"],
    ["OUTSIDE", "Outside"],
  ];

  const hasActiveFilters =
    Boolean(search) ||
    (deptFilter && deptFilter !== "ALL") ||
    (practiceFilter && practiceFilter !== "ALL") ||
    (subPracticeFilter && subPracticeFilter !== "ALL") ||
    (locationFilter && locationFilter !== "ALL") ||
    (statusFilter && statusFilter !== "ALL");

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <div className="section-title">{tableTitle}</div>
          <div className="section-caption">{tableCaption}</div>
        </div>
      </div>

      <div className="table-card">
        {/* Filter Toolbar: Single Organized Row matching Image 3 */}
        <div
          className="table-toolbar table-toolbar-single-row"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            padding: "14px 16px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {/* 1. Employee Search */}
          <div
            className="search-box"
            style={{ minWidth: "220px", flex: "1 1 200px" }}
          >
            <span className="search-icon">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee name or ID..."
              aria-label="Search employee name or ID"
            />
          </div>

          {/* 2. Department */}
          <select
            className="filter-select-box"
            value={deptFilter}
            onChange={(e) => setDeptFilter && setDeptFilter(e.target.value)}
            style={{ minWidth: "140px" }}
            aria-label="Department Filter"
          >
            <option value="ALL">All Departments</option>
            {allDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* 3. Practice */}
          <select
            className="filter-select-box"
            value={practiceFilter}
            onChange={(e) =>
              setPracticeFilter && setPracticeFilter(e.target.value)
            }
            style={{ minWidth: "140px" }}
            aria-label="Practice Filter"
          >
            <option value="ALL">All Practices</option>
            {allPractices.map((prac) => (
              <option key={prac} value={prac}>
                {prac}
              </option>
            ))}
          </select>

          {/* 4. Sub-Practice */}
          <select
            className="filter-select-box"
            value={subPracticeFilter}
            onChange={(e) =>
              setSubPracticeFilter && setSubPracticeFilter(e.target.value)
            }
            style={{ minWidth: "140px" }}
            aria-label="Sub-Practice Filter"
          >
            <option value="ALL">Sub-Practices</option>
            {allSubPractices.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>

          {/* 5. Work Location */}
          <select
            className="filter-select-box"
            value={locationFilter}
            onChange={(e) =>
              setLocationFilter && setLocationFilter(e.target.value)
            }
            style={{ minWidth: "130px" }}
            aria-label="Location Filter"
          >
            <option value="ALL">Locations</option>
            {allLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* 6. Attendance Status */}
          <select
            className="filter-select-box"
            value={statusFilter}
            onChange={(e) => setStatusFilter && setStatusFilter(e.target.value)}
            style={{ minWidth: "120px" }}
            aria-label="Attendance Status Filter"
          >
            <option value="ALL">Status</option>
            {statusOptions
              .filter(([val]) => val !== "ALL")
              .map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
          </select>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="clear-filters-btn"
              onClick={() => {
                setSearch("");
                if (setDeptFilter)
                  setDeptFilter(isHr && hrDepartment ? hrDepartment : "ALL");
                if (setPracticeFilter) setPracticeFilter("ALL");
                if (setSubPracticeFilter) setSubPracticeFilter("ALL");
                if (setLocationFilter) setLocationFilter("ALL");
                if (setStatusFilter) setStatusFilter("ALL");
              }}
            >
              Reset
            </button>
          )}
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>First In</th>
                <th>Last Out</th>
                <th>Arrival</th>
                <th>Worked</th>
                <th>Break</th>
                <th>Sessions</th>
                <th>State</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9">
                    <div className="empty-state">
                      Loading attendance...
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <div className="empty-state">
                      <div className="empty-icon">◷</div>
                      {isHr && allPractices.length === 0
                        ? "No assigned practices or employees found for this HR."
                        : "No matching attendance records found."}
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((employee) => {
                  const record = getAttendance(employee.employee_id);
                  const status = getStatus(record);

                  return (
                    <tr key={employee.employee_id}>
                      <td>
                        <div className="employee-cell">
                          <div className="avatar">
                            {String(employee.employee_name || "E")
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <div className="employee-name">
                              {employee.employee_name}
                            </div>

                            <div className="employee-id">
                              ID: {employee.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>{formatTime(record?.first_in)}</td>

                      <td>{formatTime(record?.last_out)}</td>

                      <td>
                        <span
                          className={`status-badge ${statusClass(status)}`}
                        >
                          {formatStatus(status)}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {formatWorkedTime(record)}
                        </strong>
                      </td>

                      <td>
                        <span style={{ color: "#475467", fontSize: 13 }}>
                          {formatBreakTime ? formatBreakTime(record) : (record?.break_hours || "--")}
                        </span>
                      </td>

                      <td>
                        {record?.session_count ??
                          record?.sessions?.length ??
                          0}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${statusClass(
                            String(
                              record?.current_state || "OUTSIDE"
                            ).toUpperCase()
                          )}`}
                        >
                          {String(
                            record?.current_state || "OUTSIDE"
                          ).toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => {
                            if (onViewDaily) {
                              onViewDaily(employee, record);
                            } else {
                              openEmployeeHistory(employee);
                            }
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default AttendanceTable;
