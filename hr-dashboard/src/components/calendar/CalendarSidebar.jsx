import React, { useMemo } from "react";

export default function CalendarSidebar({
  attendanceHistory = [],
  year,
  month,
}) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Compute stats for "This Month" matching the design
  const stats = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let weekend = 0;
    let leaves = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const weekdayIndex = (new Date(year, month - 1, day).getDay() + 6) % 7;
      const isWeekend = weekdayIndex === 5 || weekdayIndex === 6;

      const record = attendanceHistory.find(
        (d) => d.date === dateStr || Number(d.day) === day
      );

      const isLeave =
        record?.status === "LEAVE" || Boolean(record?.leave_type);
      const isHalfDay =
        record?.status === "HALF_DAY" ||
        record?.status === "HALF DAY" ||
        record?.status === "HD" ||
        (!record?.status &&
          record?.worked_minutes >= 240 &&
          record?.worked_minutes <= 450);
      const isPresent =
        record?.status === "FULL_DAY" ||
        record?.status === "PRESENT" ||
        (!isHalfDay &&
          ((record?.worked_minutes && record.worked_minutes > 450) ||
            (!record?.status && Boolean(record?.first_in))));

      if (isWeekend) {
        // Count weekends
        weekend++;
      } else if (dateStr > todayStr) {
        // Upcoming days are not counted in past attendance stats
      } else if (isLeave) {
        leaves++;
      } else if (isHalfDay) {
        halfDay++;
      } else if (isPresent) {
        present++;
      } else {
        absent++;
      }
    }

    return { present, halfDay, absent, weekend, leaves };
  }, [year, month, attendanceHistory, todayStr]);

  return (
    <div className="miracle-cal-sidebar-column-v2">
      {/* 1. "This Month" Summary Card */}
      <div className="miracle-sidebar-card-v2">
        <h3 className="miracle-sidebar-title-v2">This Month</h3>
        <div className="miracle-stats-stack-v2">
          {/* Present */}
          <div className="miracle-stat-pill-v2 pill-present">
            <span className="miracle-stat-num-v2">{stats.present}</span>
            <span className="miracle-stat-label-v2">Present</span>
          </div>

          {/* Half Day */}
          <div className="miracle-stat-pill-v2 pill-half">
            <span className="miracle-stat-num-v2">{stats.halfDay}</span>
            <span className="miracle-stat-label-v2">Half Day</span>
          </div>

          {/* Absent */}
          <div className="miracle-stat-pill-v2 pill-absent">
            <span className="miracle-stat-num-v2">{stats.absent}</span>
            <span className="miracle-stat-label-v2">Absent</span>
          </div>

          {/* Weekend */}
          <div className="miracle-stat-pill-v2 pill-weekend">
            <span className="miracle-stat-num-v2">{stats.weekend}</span>
            <span className="miracle-stat-label-v2">Weekend</span>
          </div>

          {/* Leaves */}
          <div className="miracle-stat-pill-v2 pill-leave">
            <span className="miracle-stat-num-v2">{stats.leaves}</span>
            <span className="miracle-stat-label-v2">Leaves</span>
          </div>
        </div>
      </div>

      {/* 2. "Attendance Legend" Card */}
      <div className="miracle-sidebar-card-v2">
        <h3 className="miracle-sidebar-title-v2">Attendance Legend</h3>
        <div className="miracle-legend-list-v2">
          <div className="miracle-legend-item-v2">
            <span className="miracle-legend-swatch-v2 swatch-present" />
            <span>Present</span>
          </div>
          <div className="miracle-legend-item-v2">
            <span className="miracle-legend-swatch-v2 swatch-half" />
            <span>Half Day</span>
          </div>
          <div className="miracle-legend-item-v2">
            <span className="miracle-legend-swatch-v2 swatch-absent" />
            <span>Absent</span>
          </div>
          <div className="miracle-legend-item-v2">
            <span className="miracle-legend-swatch-v2 swatch-weekend" />
            <span>Weekend</span>
          </div>
          <div className="miracle-legend-item-v2">
            <span className="miracle-legend-swatch-v2 swatch-upcoming" />
            <span>Upcoming</span>
          </div>
          <div className="miracle-legend-item-v2">
            <span className="miracle-legend-swatch-v2 swatch-leave" />
            <span>Leave</span>
          </div>
        </div>
      </div>
    </div>
  );
}
