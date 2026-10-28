import React from "react";
import CalendarHeader from "./CalendarHeader";
import CalendarGrid from "./CalendarGrid";
import CalendarSidebar from "./CalendarSidebar";
import CalendarDayDetails from "./CalendarDayDetails";
import "./Calendar.css";

export default function AttendanceCalendar({
  selectedEmployee,
  year,
  month,
  attendanceHistory = [],
  selectedHistoryDay,
  setSelectedHistoryDay,
  onPrevMonth,
  onNextMonth,
  onToday,
  onExport,
  saveSelectedDayLeave,
  removeSelectedDayLeave,
  leaveSaving = false,
  loading = false,
  error = "",
}) {
  return (
    <div className="miracle-calendar-container-v2">
      {/* Top Header Bar: [<] ... Month Year ... [>] ... [Export] [Today] */}
      <CalendarHeader
        year={year}
        month={month}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToday={onToday}
        onExport={onExport}
        loading={loading}
      />

      {error && (
        <div
          className="message error-message"
          role="alert"
          style={{ margin: "10px 16px" }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          className="empty-state"
          style={{ padding: "40px 20px", textAlign: "center" }}
        >
          Loading monthly attendance calendar…
        </div>
      ) : (
        <>
          {/* Main 2-Column Layout matching the screenshot */}
          <div className="miracle-cal-layout-v2">
            {/* Left Column: 7-Column Day Cards Grid (Mon ... Sun) */}
            <CalendarGrid
              year={year}
              month={month}
              attendanceHistory={attendanceHistory}
              selectedHistoryDay={selectedHistoryDay}
              onSelectDay={(day) => setSelectedHistoryDay(day)}
            />

            {/* Right Column: "This Month" & "Attendance Legend" Cards */}
            <CalendarSidebar
              attendanceHistory={attendanceHistory}
              year={year}
              month={month}
            />
          </div>

          {/* Selected Day Details Section (Maintains all sessions & leave inspection) */}
          {selectedHistoryDay && (
            <div style={{ marginTop: 20 }}>
              <CalendarDayDetails
                selectedHistoryDay={selectedHistoryDay}
                removeSelectedDayLeave={removeSelectedDayLeave}
                saveSelectedDayLeave={saveSelectedDayLeave}
                leaveSaving={leaveSaving}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
