import React from "react";

export default function CalendarDayCell({
  cell,
  onSelectDay,
}) {
  const {
    dayNumber,
    isCurrentMonth,
    isToday,
    isSelected,
    attendanceData,
    statusType,
    statusLabel,
  } = cell;

  const handleClick = () => {
    if (isCurrentMonth && attendanceData && onSelectDay) {
      onSelectDay(attendanceData);
    }
  };

  return (
    <div
      className={`miracle-cal-day-card-v2 type-${statusType} ${
        isSelected ? "is-selected" : ""
      } ${isToday ? "is-today" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={isCurrentMonth ? 0 : -1}
      aria-label={
        isCurrentMonth
          ? `Day ${dayNumber}, ${statusLabel || "No status"}`
          : `Inactive day ${dayNumber}`
      }
    >
      <span className="miracle-cal-day-num-v2">{dayNumber}</span>
      {statusLabel && (
        <span className="miracle-cal-day-label-v2">{statusLabel}</span>
      )}
    </div>
  );
}
