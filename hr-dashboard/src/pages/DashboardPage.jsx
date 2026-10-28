import React from "react";
import DashboardAnalyticsCharts from "../components/DashboardAnalyticsCharts";
import DashboardCameraCard from "../components/DashboardCameraCard";
import AttendanceTable from "../components/AttendanceTable";
import {
  getStatus,
  formatStatus,
  formatTime,
  formatWorkedTime,
  formatBreakTime,
  statusClass,
} from "../utils/formatters";

export default function DashboardPage({
  error,
  totalEmployees,
  presentToday,
  lateToday,
  insideNow,
  authorizedEmployees,
  authorizedAttendance,
  cameraError,
  cameraActionError,
  cameraActionMessage,
  cameraLoading,
  cameras,
  viewCamera,
  openCameraPreview,
  filteredEmployees,
  getAttendance,
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
  allDepartments,
  allPractices = [],
  allSubPractices = [],
  allLocations,
  auth,
  statusFilter,
  setStatusFilter,
  openEmployeeHistory,
  setDailyViewEmployee,
  selectedDate,
  loading,
  dashboardDate,
}) {
  const isHistorical =
    dashboardDate && dashboardDate !== new Date().toISOString().slice(0, 10);

  return (
    <>
      {error && <div className="message error-message">{error}</div>}

      <DashboardAnalyticsCharts
        totalEmployees={totalEmployees}
        presentToday={presentToday}
        lateToday={lateToday}
        insideNow={insideNow}
        employees={authorizedEmployees}
        attendance={authorizedAttendance}
        isHistorical={isHistorical}
        deptFilter={deptFilter}
        practiceFilter={practiceFilter}
        subPracticeFilter={subPracticeFilter}
      />

      <section className="section dashboard-camera-section">
        <div className="section-header">
          <div>
            <div className="section-title">
              Camera Monitoring
              <span className="miracle-title-line"></span>
            </div>
            <div className="section-caption">
              Real-time camera previews and configured recognition streams
            </div>
          </div>
        </div>

        {cameraError && <div className="message error-message">{cameraError}</div>}
        {cameraActionError && (
          <div className="message error-message" role="alert">
            {cameraActionError}
          </div>
        )}
        {cameraActionMessage && (
          <div className="message success-message" role="status">
            {cameraActionMessage}
          </div>
        )}
        {cameraLoading ? (
          <div className="camera-empty">Loading cameras…</div>
        ) : cameras.length ? (
          <div className="dashboard-camera-grid">
            {cameras.map((camera) => (
              <DashboardCameraCard
                key={camera.id}
                camera={camera}
                onView={() => openCameraPreview(camera)}
              />
            ))}
          </div>
        ) : (
          <div className="camera-empty">
            No cameras configured yet. Add a webcam or IP camera using the Add Camera menu.
          </div>
        )}
      </section>

      <AttendanceTable
        employees={filteredEmployees}
        getAttendance={getAttendance}
        getStatus={getStatus}
        formatStatus={formatStatus}
        formatTime={formatTime}
        formatWorkedTime={formatWorkedTime}
        formatBreakTime={formatBreakTime}
        statusClass={statusClass}
        search={search}
        setSearch={setSearch}
        deptFilter={deptFilter}
        setDeptFilter={setDeptFilter}
        practiceFilter={practiceFilter}
        setPracticeFilter={setPracticeFilter}
        subPracticeFilter={subPracticeFilter}
        setSubPracticeFilter={setSubPracticeFilter}
        locationFilter={locationFilter}
        setLocationFilter={setLocationFilter}
        allDepartments={allDepartments}
        allPractices={allPractices}
        allSubPractices={allSubPractices}
        allLocations={allLocations}
        isHr={auth?.role === "hr"}
        hrDepartment={auth?.department}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        openEmployeeHistory={openEmployeeHistory}
        onViewDaily={(emp, rec) =>
          setDailyViewEmployee({
            employee: emp,
            record: rec || getAttendance(emp.employee_id) || {},
            date: dashboardDate || selectedDate || new Date().toISOString().slice(0, 10),
          })
        }
        loading={loading}
        useStatusDropdown={true}
        tableTitle={
          isHistorical
            ? `Attendance Records (${dashboardDate})`
            : "Today's Attendance"
        }
        tableCaption={
          isHistorical
            ? `Historical attendance logs retrieved for ${dashboardDate}`
            : "Real-time attendance and working hours summary"
        }
      />
    </>
  );
}
