export const getStatus = (record) => {
  if (!record) return "ABSENT";

  // /attendance/today includes a summary row for every employee,
  // including employees who have not checked in today.
  if (!record.first_in && Number(record.event_count || 0) === 0) {
    return "ABSENT";
  }

  const status = String(record.arrival_status || "").toUpperCase();

  if (status === "EARLY") return "EARLY";
  if (status === "LATE") return "LATE";
  if (status === "ON_TIME" || status === "ON TIME") return "ON_TIME";

  return status || (record.first_in ? "PRESENT" : "ABSENT");
};

export const formatStatus = (status) => {
  if (status === "ON_TIME") return "ON TIME";
  if (status === "ABSENT") return "ABSENT";
  return status;
};

export const formatMinutes = (minutes) => {
  const value = Number(minutes || 0);
  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

export const formatWorkedTime = (record) => {
  if (record?.worked_hours) {
    return record.worked_hours;
  }

  if (record?.worked_minutes !== undefined && record?.worked_minutes !== null && Number(record.worked_minutes) > 0) {
    return formatMinutes(record.worked_minutes);
  }

  return record?.first_in ? "0m" : "--";
};

export const formatBreakTime = (record) => {
  if (record?.break_hours) return record.break_hours;
  if (record?.break_minutes !== undefined && record?.break_minutes !== null && record?.break_minutes > 0) {
    return formatMinutes(record.break_minutes);
  }
  return record?.first_in ? "0m" : "--";
};

export const formatTime = (time) => {
  if (!time) return "--";

  const parts = String(time).split(":");
  if (parts.length < 2) return time;

  let hour = Number(parts[0]);
  const minute = parts[1];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${hour}:${minute} ${suffix}`;
};

export const statusClass = (status) => {
  switch (status) {
    case "EARLY":
      return "status-early";
    case "LATE":
      return "status-late";
    case "ON_TIME":
      return "status-ontime";
    case "INSIDE":
      return "status-inside";
    case "OUTSIDE":
      return "status-outside";
    case "ABSENT":
      return "status-absent";
    default:
      return "status-neutral";
  }
};
