import React from "react";

export default function CalendarHeader({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  onExport,
  loading = false,
}) {
  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="miracle-cal-header-v2">
      <div className="miracle-cal-header-left">
        <button
          type="button"
          className="miracle-cal-nav-btn-v2"
          onClick={onPrevMonth}
          disabled={loading}
          title="Previous Month"
          aria-label="Previous Month"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <h2 className="miracle-cal-month-title-v2">{monthName}</h2>

        <button
          type="button"
          className="miracle-cal-nav-btn-v2"
          onClick={onNextMonth}
          disabled={loading}
          title="Next Month"
          aria-label="Next Month"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onExport && (
          <button
            type="button"
            className="miracle-cal-today-btn-v2"
            onClick={onExport}
            disabled={loading}
            title="Download Monthly Attendance Excel (.xlsx)"
            style={{
              background: "#ffffff",
              color: "#059669",
              borderColor: "#059669",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export (.xlsx)
          </button>
        )}

        <button
          type="button"
          className="miracle-cal-today-btn-v2"
          onClick={onToday}
          disabled={loading}
          title="Jump to Today"
        >
          Today
        </button>
      </div>
    </div>
  );
}
