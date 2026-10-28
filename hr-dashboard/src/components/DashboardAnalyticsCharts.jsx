import { useMemo } from 'react';

function DashboardAnalyticsCharts({
  totalEmployees = 0,
  presentToday = 0,
  lateToday = 0,
  insideNow = 0,
  employees = [],
  attendance = [],
  isHistorical = false,
  deptFilter = "ALL",
  practiceFilter = "ALL",
  subPracticeFilter = "ALL",
}) {
  // Apply Department, Practice, and Sub-Practice filters to ensure workforce distribution
  // synchronizes with selected filters and shows actual database records without duplication
  const filteredEmployeesList = useMemo(() => {
    const hasFilters =
      (deptFilter && deptFilter !== "ALL") ||
      (practiceFilter && practiceFilter !== "ALL") ||
      (subPracticeFilter && subPracticeFilter !== "ALL");

    if (!hasFilters) return employees;

    return employees.filter((emp) => {
      if (deptFilter && deptFilter !== "ALL") {
        if (
          (emp.department || "").toLowerCase().trim() !==
          deptFilter.toLowerCase().trim()
        ) {
          return false;
        }
      }
      if (practiceFilter && practiceFilter !== "ALL") {
        const p = (emp.practice || "").toLowerCase().trim();
        if (p !== practiceFilter.toLowerCase().trim()) {
          return false;
        }
      }
      if (subPracticeFilter && subPracticeFilter !== "ALL") {
        const sp = (
          emp.sub_practice ||
          emp.team_name ||
          emp.project ||
          ""
        )
          .toLowerCase()
          .trim();
        if (sp !== subPracticeFilter.toLowerCase().trim()) {
          return false;
        }
      }
      return true;
    });
  }, [employees, deptFilter, practiceFilter, subPracticeFilter]);

  // Compute metrics from filtered employees
  const { total, present, late, inside } = useMemo(() => {
    const filteredIds = new Set(
      filteredEmployeesList.map((e) => String(e.employee_id))
    );
    const filteredAttendance = attendance.filter((rec) =>
      filteredIds.has(String(rec.employee_id))
    );

    let pres = 0;
    let lt = 0;
    let ins = 0;

    filteredAttendance.forEach((rec) => {
      const isPres =
        (rec.first_in && rec.first_in !== "--" && rec.first_in !== "") ||
        String(rec.current_state || "").toUpperCase() === "INSIDE" ||
        (rec.status && rec.status.toUpperCase() !== "ABSENT");

      if (isPres) pres++;

      const arrStatus = String(rec.arrival_status || rec.status || "").toUpperCase();
      if (arrStatus === "LATE" || (rec.late_minutes && Number(rec.late_minutes) > 0)) {
        lt++;
      }

      if (
        !isHistorical &&
        String(rec.current_state || "").toUpperCase() === "INSIDE"
      ) {
        ins++;
      }
    });

    return {
      total: filteredEmployeesList.length,
      present: pres,
      late: lt,
      inside: isHistorical ? 0 : ins,
    };
  }, [filteredEmployeesList, attendance, isHistorical]);

  const onTimeToday = Math.max(0, present - late);
  const absentToday = Math.max(0, total - present);
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

  // Donut chart calculations: circle with r=45 has circumference ~282.743
  const r = 45;
  const circumference = 2 * Math.PI * r;

  const slices = [
    { label: "On Time", count: onTimeToday, color: "var(--miracle-medium-blue, #2368A0)" },
    { label: "Late Arrival", count: late, color: "var(--miracle-red, #EF4048)" },
    { label: "Absent", count: absentToday, color: "var(--miracle-dark-grey, #8C8C8C)" },
  ];

  let cumulativeOffset = 0;
  const sliceElements = total > 0
    ? slices.map((slice) => {
        const fraction = total > 0 ? slice.count / total : 0;
        const strokeDash = fraction * circumference;
        const offset = -cumulativeOffset;
        cumulativeOffset += strokeDash;
        return (
          <circle
            key={slice.label}
            cx="60"
            cy="60"
            r={r}
            fill="transparent"
            stroke={slice.color}
            strokeWidth="14"
            strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            style={{ transition: "stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease" }}
          />
        );
      })
    : null;

  // Deduplicated department distribution — case-insensitive grouping prevents duplicate department entries
  const deptStats = useMemo(() => {
    const map = new Map();
    filteredEmployeesList.forEach((emp) => {
      const deptRaw = (emp.department || "General").trim();
      const key = deptRaw.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: deptRaw, total: 0, present: 0 });
      }
      map.get(key).total += 1;
    });

    attendance.forEach((rec) => {
      const emp = filteredEmployeesList.find(
        (e) => String(e.employee_id) === String(rec.employee_id)
      );
      if (emp) {
        const deptRaw = (emp.department || "General").trim();
        const key = deptRaw.toLowerCase();
        const isPresent =
          String(rec.current_state || "").toUpperCase() === "INSIDE" ||
          (rec.first_in && rec.first_in !== "--" && rec.first_in !== "");
        if (isPresent && map.has(key)) {
          map.get(key).present += 1;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredEmployeesList, attendance]);

  return (
    <div className="dashboard-charts-grid">
      {/* 1. Donut Chart Card */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3 className="chart-card-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--miracle-medium-blue, #2368A0)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
              <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
            </svg>
            Attendance Breakdown
          </h3>
          <span className="chart-card-badge">
            {total > 0 ? `${attendanceRate}% Present` : "No Records"}
          </span>
        </div>

        {total === 0 ? (
          <div className="chart-empty-state">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--miracle-dark-grey, #8C8C8C)"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: "8px" }}
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--miracle-black, #232527)",
              }}
            >
              No Attendance Data
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--miracle-dark-grey, #8C8C8C)",
                marginTop: "4px",
              }}
            >
              No records found matching selected date or filters.
            </div>
          </div>
        ) : (
          <div className="donut-chart-container">
            <div className="donut-svg-wrapper">
              <svg
                width="140"
                height="140"
                viewBox="0 0 120 120"
                style={{ transform: "rotate(-90deg)" }}
              >
                {/* Background track */}
                <circle
                  cx="60"
                  cy="60"
                  r={r}
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="14"
                />
                {sliceElements}
              </svg>
              <div className="donut-center-info">
                <span className="donut-center-pct">{attendanceRate}%</span>
                <span className="donut-center-lbl">Attended</span>
              </div>
            </div>

            <div className="donut-legend-list">
              <div className="donut-legend-item">
                <div className="donut-legend-left">
                  <span
                    className="donut-legend-dot"
                    style={{ background: "var(--miracle-medium-blue, #2368A0)" }}
                  ></span>
                  <span>On-Time</span>
                </div>
                <div className="donut-legend-right">
                  <span className="donut-legend-val">{onTimeToday}</span>
                  <span className="donut-legend-pct">
                    ({total > 0 ? Math.round((onTimeToday / total) * 100) : 0}%)
                  </span>
                </div>
              </div>

              <div className="donut-legend-item">
                <div className="donut-legend-left">
                  <span
                    className="donut-legend-dot"
                    style={{ background: "var(--miracle-red, #EF4048)" }}
                  ></span>
                  <span>Late Arrival</span>
                </div>
                <div className="donut-legend-right">
                  <span className="donut-legend-val">{late}</span>
                  <span className="donut-legend-pct">
                    ({total > 0 ? Math.round((late / total) * 100) : 0}%)
                  </span>
                </div>
              </div>

              <div className="donut-legend-item">
                <div className="donut-legend-left">
                  <span
                    className="donut-legend-dot"
                    style={{ background: "var(--miracle-dark-grey, #8C8C8C)" }}
                  ></span>
                  <span>Absent</span>
                </div>
                <div className="donut-legend-right">
                  <span className="donut-legend-val">{absentToday}</span>
                  <span className="donut-legend-pct">
                    ({total > 0 ? Math.round((absentToday / total) * 100) : 0}%)
                  </span>
                </div>
              </div>

              <div
                className="donut-legend-item"
                style={{ paddingTop: "6px", borderTop: "1px dashed #e2e8f0" }}
              >
                <div className="donut-legend-left" style={{ fontWeight: 600 }}>
                  <span
                    className="donut-legend-dot"
                    style={{ background: "var(--miracle-dark-blue, #0D416B)" }}
                  ></span>
                  <span>Total Staff</span>
                </div>
                <div className="donut-legend-right">
                  <span
                    className="donut-legend-val"
                    style={{ color: "var(--miracle-dark-blue, #0D416B)" }}
                  >
                    {total}
                  </span>
                  <span className="donut-legend-pct">100%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Metrics Bar Chart Card */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3 className="chart-card-title">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--miracle-light-blue, #00AAE7)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
            Workforce Presence & Distribution
          </h3>
          <span
            className="chart-card-badge"
            style={{
              background: isHistorical ? "#f1f5f9" : "#e0f2fe",
              color: isHistorical ? "#475569" : "#0369a1",
              border: isHistorical ? "1px solid #cbd5e1" : "1px solid #bae6fd",
            }}
          >
            {isHistorical ? "Historical" : "Live Status"}
          </span>
        </div>

        {total === 0 ? (
          <div className="chart-empty-state">
            <div
              style={{
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--miracle-black, #232527)",
              }}
            >
              No Employee Data Available
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "var(--miracle-dark-grey, #8C8C8C)",
                marginTop: "4px",
              }}
            >
              Database returned 0 employees for your selected filters/scope.
            </div>
          </div>
        ) : (
          <>
            <div className="metrics-bar-list">
              {/* Total Workforce */}
              <div className="metric-bar-item">
                <div className="metric-bar-header">
                  <span className="metric-bar-label">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: "var(--miracle-dark-blue, #0D416B)",
                        display: "inline-block",
                      }}
                    ></span>
                    Total Workforce
                  </span>
                  <div className="metric-bar-counts">
                    <span className="metric-bar-num">{total}</span>
                    <span className="metric-bar-pct">Active Roster</span>
                  </div>
                </div>
                <div className="metric-bar-track">
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: "100%",
                      background: "var(--miracle-dark-blue, #0D416B)",
                    }}
                  ></div>
                </div>
              </div>

              {/* Present Today */}
              <div className="metric-bar-item">
                <div className="metric-bar-header">
                  <span className="metric-bar-label">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: "var(--miracle-light-blue, #00AAE7)",
                        display: "inline-block",
                      }}
                    ></span>
                    Present Today
                  </span>
                  <div className="metric-bar-counts">
                    <span className="metric-bar-num">{present}</span>
                    <span className="metric-bar-pct">
                      {total > 0 ? Math.round((present / total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="metric-bar-track">
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: `${total > 0 ? (present / total) * 100 : 0}%`,
                      background: "var(--miracle-light-blue, #00AAE7)",
                    }}
                  ></div>
                </div>
              </div>

              {/* Currently Inside */}
              <div className="metric-bar-item">
                <div className="metric-bar-header">
                  <span className="metric-bar-label">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: "var(--miracle-medium-blue, #2368A0)",
                        display: "inline-block",
                      }}
                    ></span>
                    Currently Inside Facility
                  </span>
                  <div className="metric-bar-counts">
                    <span className="metric-bar-num">{inside}</span>
                    <span className="metric-bar-pct">
                      {total > 0 ? Math.round((inside / total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="metric-bar-track">
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: `${total > 0 ? (inside / total) * 100 : 0}%`,
                      background: "var(--miracle-medium-blue, #2368A0)",
                    }}
                  ></div>
                </div>
              </div>

              {/* Late Today */}
              <div className="metric-bar-item">
                <div className="metric-bar-header">
                  <span className="metric-bar-label">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: "var(--miracle-red, #EF4048)",
                        display: "inline-block",
                      }}
                    ></span>
                    Late Today
                  </span>
                  <div className="metric-bar-counts">
                    <span className="metric-bar-num">{late}</span>
                    <span className="metric-bar-pct">
                      {total > 0 ? Math.round((late / total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div className="metric-bar-track">
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: `${total > 0 ? (late / total) * 100 : 0}%`,
                      background: "var(--miracle-red, #EF4048)",
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Deduplicated Department Breakdown Chips */}
            {deptStats.length > 0 && (
              <div className="dept-pills-row" style={{ marginTop: "14px" }}>
                {deptStats.map((ds) => (
                  <div
                    key={ds.name}
                    className="dept-pill"
                    title={`${ds.present} of ${ds.total} present in ${ds.name}`}
                  >
                    <span className="dept-pill-name">{ds.name}:</span>
                    <span className="dept-pill-count">
                      {ds.present} / {ds.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardAnalyticsCharts;
