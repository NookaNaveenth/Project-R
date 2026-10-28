import React from "react";
import AttendanceCalendar from "../calendar/AttendanceCalendar";

export default function EmployeeHistoryModal({
  selectedEmployee,
  closeHistory,
  changeHistoryMonth,
  historyLoading,
  historyYear,
  historyMonth,
  historyError,
  attendanceHistory,
  selectedHistoryDay,
  setSelectedHistoryDay,
  removeSelectedDayLeave,
  saveSelectedDayLeave,
  leaveSaving,
  onExportMonth,
}) {
  if (!selectedEmployee) return null;

  const handleGoToToday = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthDiff = (currentYear - historyYear) * 12 + (currentMonth - historyMonth);
    if (monthDiff !== 0) {
      changeHistoryMonth(monthDiff);
    }
    const todayStr = now.toISOString().slice(0, 10);
    const todayRec = attendanceHistory.find((d) => d.date === todayStr);
    if (todayRec) {
      setSelectedHistoryDay(todayRec);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeHistory();
        }
      }}
    >
      <div
        className="modal"
        style={{ width: "min(1240px, 96vw)", maxWidth: "1240px" }}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{selectedEmployee.employee_name}</h2>
            <div className="modal-subtitle">
              Employee ID: {selectedEmployee.employee_id}
              {selectedEmployee.department ? ` • ${selectedEmployee.department}` : ""}
            </div>
          </div>

          <button
            className="close-button"
            onClick={closeHistory}
            title="Close Calendar"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          <AttendanceCalendar
            selectedEmployee={selectedEmployee}
            year={historyYear}
            month={historyMonth}
            attendanceHistory={attendanceHistory}
            selectedHistoryDay={selectedHistoryDay}
            setSelectedHistoryDay={setSelectedHistoryDay}
            onPrevMonth={() => changeHistoryMonth(-1)}
            onNextMonth={() => changeHistoryMonth(1)}
            onToday={handleGoToToday}
            onExport={onExportMonth ? () => onExportMonth(selectedEmployee, historyYear, historyMonth) : null}
            saveSelectedDayLeave={saveSelectedDayLeave}
            removeSelectedDayLeave={removeSelectedDayLeave}
            leaveSaving={leaveSaving}
            loading={historyLoading}
            error={historyError}
          />
        </div>
      </div>
    </div>
  );
}
