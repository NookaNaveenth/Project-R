import "./App.css";
import { useEffect, useMemo, useRef, useState } from "react";
import LoginPage from "./components/LoginPage";
import { API_URL, HUBBLE_API_URL } from "./utils/config";
import {
  POSE_STEPS,
  EMPTY_BASELINE,
  evaluatePose,
  HOLD_FRAMES,
  POLL_MS,
  CAPTURE_COOLDOWN_MS,
} from "./utils/poseMath";
import {
  getStatus,
  formatStatus,
  formatMinutes,
  formatWorkedTime,
  formatBreakTime,
  formatTime,
  statusClass,
} from "./utils/formatters";
import {
  STANDARDIZED_DEPARTMENTS,
  STANDARDIZED_PRACTICES,
} from "./utils/constants";

// Layout Components
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";

// Pages
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import AttendancePage from "./pages/AttendancePage";
import AdminManagementPage from "./pages/AdminManagementPage";
import GeneralAccessPage from "./pages/GeneralAccessPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import AttendanceOverridePage from "./pages/AttendanceOverridePage";

// Modals
import CameraEditorModal from "./components/modals/CameraEditorModal";
import ViewCameraModal from "./components/modals/ViewCameraModal";
import AddEmployeeModal from "./components/modals/AddEmployeeModal";
import EmployeeHistoryModal from "./components/modals/EmployeeHistoryModal";
import DailyViewModal from "./components/modals/DailyViewModal";
import PasswordChangeModal from "./components/modals/PasswordChangeModal";
import EditShiftModal from "./components/modals/EditShiftModal";
import ExportAttendanceModal from "./components/modals/ExportAttendanceModal";
import EmployeeActionModal from "./components/modals/EmployeeActionModal";
import UserProfileModal from "./components/modals/UserProfileModal";
import GuidedTourModal from "./components/modals/GuidedTourModal";

function App() {
  const [auth, setAuth] = useState(() => {
    try {
      const saved = sessionStorage.getItem("faceattend_auth");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const authFetch = (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (auth?.token) {
      headers["Authorization"] = `Bearer ${auth.token}`;
    }
    return fetch(url, { ...options, headers });
  };

  const [deptFilter, setDeptFilter] = useState("ALL");
  const [practiceFilter, setPracticeFilter] = useState("ALL");
  const [subPracticeFilter, setSubPracticeFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [dbDepartments, setDbDepartments] = useState([]);
  const [assignedPractices, setAssignedPractices] = useState([]);

  const handleLogout = () => {
    setAuth(null);
    try {
      sessionStorage.removeItem("faceattend_auth");
    } catch { }
  };

  // Password Change State (Forced and Manual)
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const handleClosePasswordModal = () => {
    if (passwordStatus.loading) return;
    if (auth?.must_change_password) {
      // Security rule: mandatory initial password change cannot be bypassed
      handleLogout();
    } else {
      setShowPasswordModal(false);
    }
    setPasswordForm({
      current_password: "",
      old_password: "",
      new_password: "",
      confirm_password: "",
    });
    setPasswordStatus({ loading: false, error: "", success: "" });
  };
  const [passwordStatus, setPasswordStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });

  // Superior State: Admin Account Creation & Management
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    username: "",
    password: "",
    display_name: "",
  });
  const [adminCreateStatus, setAdminCreateStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });

  // Admin State: General Access (HR Credentials Creation)
  const [hrList, setHrList] = useState([]);
  const [hrLoading, setHrLoading] = useState(false);
  const [newHrForm, setNewHrForm] = useState({
    department: "Innovation",
    username: "",
    password: "",
    display_name: "",
  });
  const [hrCreateStatus, setHrCreateStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });

  // Superior State: Audit & Activity Logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRoleFilter, setAuditRoleFilter] = useState("ALL");
  const [auditActionFilter, setAuditActionFilter] = useState("ALL");
  const [auditDateFilter, setAuditDateFilter] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  // Superior State: Manual Attendance Override
  const [overrideForm, setOverrideForm] = useState({
    employee_id: "",
    attendance_date: new Date().toISOString().slice(0, 10),
    status: "FULL_DAY",
    first_in: "09:00:00",
    last_out: "17:30:00",
    worked_minutes: 480,
    reason: "",
  });
  const [overrideStatus, setOverrideStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });

  // Today's Attendance Details Modal (Employee View Action)
  const [dailyViewEmployee, setDailyViewEmployee] = useState(null);

  // Compact Employee Cards: Expanded Employee ID
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [cameraStatus, setCameraStatus] = useState(null);
  const [cameraDraft, setCameraDraft] = useState({
    id: null,
    name: "",
    source_type: "webcam",
    source: "0",
    roles: ["ENTRY"],
    enabled: true,
  });
  const [showCameraEditor, setShowCameraEditor] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraActionError, setCameraActionError] = useState("");
  const [cameraActionMessage, setCameraActionMessage] = useState("");
  const [viewCamera, setViewCamera] = useState(null);

  const [loading, setLoading] = useState(true);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState("");

  const [activePage, setActivePage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Date used by the Attendance page.
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  // Date used by the Superior Dashboard calendar/date selector.
  const [dashboardDate, setDashboardDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dateAttendanceLoading, setDateAttendanceLoading] = useState(false);
  const [dateAttendanceError, setDateAttendanceError] = useState("");

  const handleDashboardDateChange = (date) => {
    setDashboardDate(date);
    const today = new Date().toISOString().split("T")[0];
    if (!date || date === today) {
      loadDashboardData();
    } else {
      loadAttendanceByDate(date);
    }
  };

  const handleRestoreLiveAttendance = () => {
    const today = new Date().toISOString().split("T")[0];
    setDashboardDate(today);
    loadDashboardData();
  };

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());
  const [historyMonth, setHistoryMonth] = useState(new Date().getMonth() + 1);
  const [selectedHistoryDay, setSelectedHistoryDay] = useState(null);

  // Report Export State
  const [reportChooser, setReportChooser] = useState(null);
  const [reportPeriod, setReportPeriod] = useState("month");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportDownloading, setReportDownloading] = useState(false);
  const [reportError, setReportError] = useState("");

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    employee_id: "",
    employee_name: "",
    shift_start: "14:00",
    shift_end: "22:00",
    email: "",
    login_id: "",
    department: "Software Services",
    practice: "Innovation",
    work_location: "Miracle City (HQ)",
    is_flexible_shift: false,
  });

  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);
  const [hubbleLoading, setHubbleLoading] = useState(false);
  const [hubbleError, setHubbleError] = useState("");
  const [hubbleEmployee, setHubbleEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editShiftForm, setEditShiftForm] = useState({
    shift_start: "09:00",
    shift_end: "17:00",
    is_flexible_shift: false,
    department: "Software Services",
    practice: "Innovation",
  });
  const [editShiftLoading, setEditShiftLoading] = useState(false);
  const [editShiftError, setEditShiftError] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);

  // Miracle UI States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [actionEmployee, setActionEmployee] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);

  // Face enrollment / camera capture state.
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [enrollmentCameraId, setEnrollmentCameraId] = useState("");
  const cameraImageRef = useRef(null);
  const [captureError, setCaptureError] = useState("");
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);

  // Guided (auto) capture state.
  const [skippedSteps, setSkippedSteps] = useState([]);
  const [poseState, setPoseState] = useState({
    status: "idle", // idle (grey) | bad (red) | ok (green) | done (green flash)
    message: "Start the camera to begin.",
    debug: null,
  });
  const [showPoseDebug, setShowPoseDebug] = useState(false);
  const poseCanvasRef = useRef(null);
  const holdCountRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const baselineRef = useRef({ ...EMPTY_BASELINE });
  const [videoAspect, setVideoAspect] = useState(16 / 9);

  // The angle we are asking for right now (first one not captured/skipped).
  const currentStep = useMemo(
    () =>
      POSE_STEPS.find(
        (step) =>
          !capturedPhotos.some((photo) => photo.poseId === step.id) &&
          !skippedSteps.includes(step.id)
      ) || null,
    [capturedPhotos, skippedSteps]
  );

  const loadDashboardData = async (targetPrac) => {
    try {
      setError("");

      const activePrac = targetPrac !== undefined ? targetPrac : practiceFilter;
      const pracParam = activePrac && activePrac !== "ALL" ? `?practice=${encodeURIComponent(activePrac)}` : "";

      const [employeesResponse, attendanceResponse, practicesResponse] = await Promise.all([
        authFetch(`${API_URL}/employees${pracParam}`),
        authFetch(`${API_URL}/attendance/today${pracParam}`),
        authFetch(`${API_URL}/practices`),
      ]);

      if (!employeesResponse.ok) {
        throw new Error("Unable to load employees");
      }

      if (!attendanceResponse.ok) {
        throw new Error("Unable to load attendance");
      }

      const employeesData = await employeesResponse.json();
      const attendanceData = await attendanceResponse.json();

      setEmployees(Array.isArray(employeesData) ? employeesData : []);

      const attendanceList = Array.isArray(attendanceData)
        ? attendanceData
        : attendanceData?.attendance || attendanceData?.data || [];

      setAttendance(attendanceList);

      if (practicesResponse && practicesResponse.ok) {
        const pData = await practicesResponse.json();
        setAssignedPractices(Array.isArray(pData) ? pData : (pData?.practices || []));
      }
    } catch (err) {
      setError(err.message || "Unable to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  const handlePracticeChange = (newPractice) => {
    setPracticeFilter(newPractice);
    loadDashboardData(newPractice);
  };

  const loadAttendanceByDate = async (date) => {
    if (!date) return;

    try {
      setDateAttendanceLoading(true);
      setDateAttendanceError("");

      const response = await authFetch(
        `${API_URL}/attendance/date/${date}`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.detail || "Unable to load attendance for selected date"
        );
      }

      const data = await response.json();

      const attendanceList = Array.isArray(data)
        ? data
        : data?.attendance || data?.data || [];

      setAttendance(attendanceList);

      if (employees.length === 0) {
        authFetch(`${API_URL}/employees`)
          .then((res) => res.json())
          .then((empData) => {
            if (Array.isArray(empData) && empData.length > 0) setEmployees(empData);
          })
          .catch(() => { });
      }
    } catch (err) {
      setDateAttendanceError(
        err.message || "Unable to load selected date"
      );
      setAttendance([]);
    } finally {
      setDateAttendanceLoading(false);
    }
  };

  // Password Update Handler
  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordStatus({ loading: true, error: "", success: "" });

    const currentPass = (passwordForm.current_password || passwordForm.old_password || "").trim();
    if (!currentPass) {
      setPasswordStatus({ loading: false, error: "Please enter your current password.", success: "" });
      return;
    }
    if (!passwordForm.new_password || passwordForm.new_password.length < 4) {
      setPasswordStatus({ loading: false, error: "New password must be at least 4 characters.", success: "" });
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordStatus({ loading: false, error: "New password and confirm password do not match.", success: "" });
      return;
    }

    try {
      const response = await authFetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPass,
          old_password: currentPass,
          new_password: passwordForm.new_password,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Password change failed.");
      }

      setPasswordStatus({
        loading: false,
        error: "",
        success: "Password updated successfully. Session updated.",
      });

      const updatedAuth = { ...auth, must_change_password: false };
      setAuth(updatedAuth);
      try {
        sessionStorage.setItem("faceattend_auth", JSON.stringify(updatedAuth));
      } catch { }

      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordForm({ current_password: "", old_password: "", new_password: "", confirm_password: "" });
        setPasswordStatus({ loading: false, error: "", success: "" });
      }, 900);
    } catch (err) {
      setPasswordStatus({
        loading: false,
        error: err.message || "Unable to update password.",
        success: "",
      });
    }
  };

  // Superior: Load Admins
  const loadAdminUsers = async (dateFilter = "") => {
    try {
      setAdminLoading(true);
      let url = `${API_URL}/admin/users`;
      if (dateFilter) {
        url += `?date=${encodeURIComponent(dateFilter)}`;
      }
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setAdminList(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setAdminLoading(false);
    }
  };

  // Superior: Create Admin Account
  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    setAdminCreateStatus({ loading: true, error: "", success: "" });

    if (!newAdminForm.username.trim()) {
      setAdminCreateStatus({ loading: false, error: "Username is required.", success: "" });
      return;
    }
    if (!newAdminForm.password || newAdminForm.password.length < 4) {
      setAdminCreateStatus({ loading: false, error: "Password must be at least 4 characters.", success: "" });
      return;
    }

    try {
      const res = await authFetch(`${API_URL}/admin/create-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newAdminForm.username.trim(),
          password: newAdminForm.password,
          display_name: newAdminForm.display_name.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to generate administrator credentials.");
      }

      setAdminCreateStatus({
        loading: false,
        error: "",
        success: "Admin credentials generated successfully. Admin must change password on first login.",
      });
      setNewAdminForm({ username: "", password: "", display_name: "" });
      loadAdminUsers();
    } catch (err) {
      setAdminCreateStatus({
        loading: false,
        error: err.message || "Unable to create administrator account.",
        success: "",
      });
    }
  };

  // Admin: Load HR accounts
  const loadHrUsers = async (dateFilter = "") => {
    try {
      setHrLoading(true);
      let url = `${API_URL}/admin/users`;
      if (dateFilter) {
        url += `?date=${encodeURIComponent(dateFilter)}`;
      }
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        const hrOnly = Array.isArray(data) ? data.filter((u) => u.role === "hr") : [];
        setHrList(hrOnly);
      }
    } catch {
      // ignore
    } finally {
      setHrLoading(false);
    }
  };

  // Admin: Create HR Credentials
  const handleCreateHr = async (event) => {
    event.preventDefault();
    setHrCreateStatus({ loading: true, error: "", success: "" });

    if (!newHrForm.department) {
      setHrCreateStatus({ loading: false, error: "Please select an authorized department.", success: "" });
      return;
    }
    if (!newHrForm.username.trim()) {
      setHrCreateStatus({ loading: false, error: "HR username is required.", success: "" });
      return;
    }
    if (!newHrForm.password || newHrForm.password.length < 4) {
      setHrCreateStatus({ loading: false, error: "Password must be at least 4 characters.", success: "" });
      return;
    }

    try {
      const res = await authFetch(`${API_URL}/admin/create-hr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: newHrForm.department,
          username: newHrForm.username.trim(),
          password: newHrForm.password,
          display_name: newHrForm.display_name.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to generate HR credentials.");
      }

      setHrCreateStatus({
        loading: false,
        error: "",
        success: `HR credentials for ${newHrForm.department} generated successfully.`,
      });
      setNewHrForm({
        department: dbDepartments[0] || "Innovation",
        username: "",
        password: "",
        display_name: "",
      });
      loadHrUsers();
    } catch (err) {
      setHrCreateStatus({
        loading: false,
        error: err.message || "Unable to generate HR account.",
        success: "",
      });
    }
  };

  // Superior: Load Audit Logs
  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      let url = `${API_URL}/audit/logs?limit=300`;
      if (auditRoleFilter && auditRoleFilter !== "ALL") {
        url += `&actor_role=${encodeURIComponent(auditRoleFilter.toLowerCase())}`;
      }
      if (auditActionFilter && auditActionFilter !== "ALL") {
        url += `&action_type=${encodeURIComponent(auditActionFilter)}`;
      }
      if (auditDateFilter) {
        url += `&target_date=${encodeURIComponent(auditDateFilter)}`;
      }

      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setAuditLoading(false);
    }
  };

  // Superior: Manual Attendance Correction
  const handleManualOverride = async (event) => {
    event.preventDefault();
    setOverrideStatus({ loading: true, error: "", success: "" });

    if (!overrideForm.employee_id) {
      setOverrideStatus({ loading: false, error: "Please select an employee.", success: "" });
      return;
    }
    if (!overrideForm.reason.trim()) {
      setOverrideStatus({ loading: false, error: "A clear reason is required for manual attendance override.", success: "" });
      return;
    }

    try {
      const res = await authFetch(`${API_URL}/attendance/manual-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: overrideForm.employee_id,
          attendance_date: overrideForm.attendance_date,
          status: overrideForm.status,
          first_in: overrideForm.first_in || null,
          last_out: overrideForm.last_out || null,
          worked_minutes: Number(overrideForm.worked_minutes) || null,
          reason: overrideForm.reason.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Manual attendance correction failed.");
      }

      setOverrideStatus({
        loading: false,
        error: "",
        success: `Attendance corrected for ${overrideForm.employee_id} on ${overrideForm.attendance_date}. Record updated and logged to audit trail.`,
      });

      loadDashboardData();
      loadAttendanceByDate(selectedDate);
    } catch (err) {
      setOverrideStatus({
        loading: false,
        error: err.message || "Unable to correct attendance.",
        success: "",
      });
    }
  };

  const loadCameraStatus = async () => {
    try {
      setCameraError("");

      const response = await fetch(`${API_URL}/cameras/status`);

      if (!response.ok) {
        throw new Error("Unable to load camera status");
      }

      const data = await response.json();
      setCameraStatus((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(data)) {
          return prev;
        }
        return data;
      });
    } catch (err) {
      setCameraError(err.message || "Unable to load camera status");
    } finally {
      setCameraLoading(false);
    }
  };

  const resetCameraDraft = () => {
    setCameraDraft({ id: null, name: "", source_type: "webcam", source: "0", roles: ["ENTRY"], enabled: true });
    setCameraActionError("");
    setCameraActionMessage("");
  };

  const saveCamera = async (event) => {
    event.preventDefault();
    setCameraBusy(true);
    setCameraActionError("");
    setCameraActionMessage("");
    try {
      const response = await fetch(`${API_URL}/cameras${cameraDraft.id ? `/${cameraDraft.id}` : ""}`, {
        method: cameraDraft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cameraDraft.name,
          source_type: cameraDraft.source_type,
          source: cameraDraft.source,
          roles: cameraDraft.roles,
          enabled: cameraDraft.enabled,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to save camera");
      setShowCameraEditor(false);
      resetCameraDraft();
      setCameraActionMessage(cameraDraft.id ? "Camera updated." : "Camera added.");
      await loadCameraStatus();
    } catch (err) {
      setCameraActionError(err.message || "Unable to save camera");
    } finally {
      setCameraBusy(false);
    }
  };

  const editCamera = (camera) => {
    setCameraDraft({ ...camera, source: "", roles: camera.roles || [] });
    setCameraActionError("");
    setCameraActionMessage("");
    setShowCameraEditor(true);
  };

  const toggleCameraEnabled = async (camera) => {
    try {
      const response = await fetch(`${API_URL}/cameras/${camera.id}/enabled`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !camera.enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to update camera");
      await loadCameraStatus();
    } catch (err) {
      setCameraActionError(err.message || "Unable to update camera");
    }
  };

  const deleteCamera = async (camera) => {
    if (!window.confirm(`Delete camera “${camera.name}”?`)) return;
    try {
      if (viewCamera?.id === camera.id) setViewCamera(null);
      const response = await fetch(`${API_URL}/cameras/${camera.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to delete camera");
      await loadCameraStatus();
      if (viewCamera?.id === camera.id) setViewCamera(null);
    } catch (err) {
      setCameraActionError(err.message || "Unable to delete camera");
    }
  };

  const testCamera = async (camera) => {
    try {
      setCameraActionError("");
      const response = await fetch(`${API_URL}/cameras/${camera.id}/test`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Camera connection failed");
      setCameraActionMessage(`${camera.name}: connected successfully.`);
    } catch (err) {
      setCameraActionError(err.message || "Camera connection failed");
    }
  };

  const handleCameraDraftChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCameraDraft((previous) => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
  };

  const toggleCameraRole = (role) => {
    setCameraDraft((previous) => ({
      ...previous,
      roles: previous.roles.includes(role)
        ? previous.roles.filter((item) => item !== role)
        : [...previous.roles, role],
    }));
  };

  const openCameraPreview = (camera) => {
    setViewCamera({
      ...camera,
      streamId: globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2),
    });
  };

  const closeCameraPreview = () => setViewCamera(null);

  const handleAttendanceDateChange = (event) => {
    const date = event.target.value;

    setSelectedDate(date);

    if (date) {
      loadAttendanceByDate(date);
    }
  };

  useEffect(() => {
    // Dynamically load departments from database
    authFetch(`${API_URL}/departments`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDbDepartments(data);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (auth?.must_change_password) {
      setShowPasswordModal(true);
    }
  }, [auth]);

  useEffect(() => {
    if (auth?.role === "superior") {
      if (activePage === "employees") {
        setActivePage("dashboard");
      }
    } else if (auth?.role === "admin") {
      if (
        activePage === "admin_mgmt" ||
        activePage === "generate_access_admin" ||
        activePage === "audit_logs" ||
        activePage === "activity" ||
        activePage === "attendance_override"
      ) {
        setActivePage("dashboard");
      }
    } else if (auth?.role === "hr") {
      if (
        activePage === "employees" ||
        activePage === "admin_mgmt" ||
        activePage === "generate_access_admin" ||
        activePage === "general_access" ||
        activePage === "generate_access_hr" ||
        activePage === "audit_logs" ||
        activePage === "activity" ||
        activePage === "attendance_override"
      ) {
        setActivePage("dashboard");
      }
    }
  }, [auth?.role, activePage]);

  useEffect(() => {
    if (activePage === "attendance") {
      loadAttendanceByDate(selectedDate);
    } else if (
      activePage === "admin_mgmt" ||
      activePage === "generate_access_admin"
    ) {
      loadAdminUsers();
    } else if (
      activePage === "general_access" ||
      activePage === "generate_access_hr"
    ) {
      loadHrUsers();
    } else if (activePage === "audit_logs" || activePage === "activity") {
      loadAuditLogs();
    } else {
      loadDashboardData();
    }

    loadCameraStatus();

    const interval = setInterval(() => {
      loadCameraStatus();

      if (
        activePage === "dashboard" &&
        (!dashboardDate ||
          dashboardDate === new Date().toISOString().slice(0, 10))
      ) {
        loadDashboardData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [
    activePage,
    selectedDate,
    dashboardDate,
    auditRoleFilter,
    auditActionFilter,
    auditDateFilter,
  ]);

  const handleEmployeeFormChange = (event) => {
    const { name, value } = event.target;

    setEmployeeForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (name === "login_id") {
      setHubbleError("");
      setHubbleEmployee(null);
    }
  };

  const fetchHubbleEmployee = async (loginIdOverride = null) => {
    const loginId = String(
      loginIdOverride ?? employeeForm.login_id ?? ""
    ).trim();

    if (!loginId) {
      setHubbleError("Please enter a username or Login ID.");
      return;
    }

    setHubbleLoading(true);
    setHubbleError("");
    setFormError("");

    try {
      // Unified employee lookup endpoint (database-backed)
      let response = null;
      try {
        response = await authFetch(
          `${API_URL}/employees/lookup/${encodeURIComponent(loginId)}`,
          { headers: { Accept: "application/json" } }
        );
      } catch {
        response = null;
      }

      const data = response ? await response.json().catch(() => ({})) : {};
      if (!response || !response.ok) {
        throw new Error(
          data?.detail || `Employee '${loginId}' not found in database.`
        );
      }

      const normalizedEmployee = {
        ...data,
        employee_id: data.employee_id ?? data.id ?? "",
        employee_name: data.employee_name ?? data.name ?? "",
        email: data.email ?? data.mailId ?? "",
        login_id: data.login_id ?? data.loginId ?? loginId,
        reporting_manager: data.reportsTo ?? data.reports_to ?? "",
        hr_contact: data.hrContact ?? data.reporting_hr ?? data.hr_contact ?? "",
        department: data.department ?? "",
        designation: data.designation ?? "",
        team: data.teamName ?? data.team_name ?? "",
        work_location: data.work_location ?? "Miracle City (HQ)",
        shift_start: data.shift_start ?? "14:00",
        shift_end: data.shift_end ?? "22:00",
        is_enrolled: Boolean(data.is_enrolled),
        source: data.source || "database",
      };

      setHubbleEmployee(normalizedEmployee);
      setEmployeeForm((previous) => ({
        ...previous,
        login_id: previous.login_id || normalizedEmployee.login_id,
        employee_id: normalizedEmployee.employee_id !== ""
          ? String(normalizedEmployee.employee_id)
          : previous.employee_id,
        employee_name: normalizedEmployee.employee_name || previous.employee_name,
        email: normalizedEmployee.email || previous.email,
        shift_start: normalizedEmployee.shift_start || previous.shift_start || "14:00",
        shift_end: normalizedEmployee.shift_end || previous.shift_end || "22:00",
        department: auth?.role === "hr" ? auth.department : (normalizedEmployee.department || previous.department || "Software Services"),
        work_location: normalizedEmployee.work_location || previous.work_location || "Miracle City (HQ)",
        reporting_hr: normalizedEmployee.hr_contact || previous.reporting_hr || "",
      }));

      if (normalizedEmployee.is_enrolled) {
        setFormError(
          `Notice: Employee ${normalizedEmployee.employee_name || loginId} is already enrolled with face biometric data.`
        );
      } else if (normalizedEmployee.source === "database") {
        setFormMessage(
          `Existing details found in database for ${normalizedEmployee.employee_name || loginId}. Ready for face enrollment.`
        );
      } else {
        setFormMessage(
          `Employee details retrieved for ${normalizedEmployee.employee_name || loginId}. Ready for face enrollment.`
        );
      }
    } catch (error) {
      setHubbleEmployee(null);
      setHubbleError(error.message || "Unable to fetch employee details.");
    } finally {
      setHubbleLoading(false);
    }
  };

  const handleHubbleLoginKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      fetchHubbleEmployee();
    }
  };

  const startEnrollmentCamera = async () => {
    setCaptureError("");

    try {
      if (cameraStream) {
        cameraStream.getTracks?.().forEach((track) => track.stop());
      }

      if (enrollmentCameraId) {
        const response = await fetch(`${API_URL}/cameras/${enrollmentCameraId}/test`, { method: "POST" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Selected camera is not connected");
        setCameraStream({ cameraId: enrollmentCameraId, streamId: globalThis.crypto.randomUUID() });
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is not supported by this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setCaptureError(
        err.message ||
        "Unable to access the camera. Please allow camera permission."
      );
    }
  };

  const stopEnrollmentCamera = () => {
    if (cameraStream?.cameraId && cameraStream?.streamId) {
      fetch(`${API_URL}/cameras/${cameraStream.cameraId}/stream/${cameraStream.streamId}/stop`, {
        method: "POST",
        keepalive: true,
      }).catch(() => { });
    }
    if (cameraStream) {
      cameraStream.getTracks?.().forEach((track) => track.stop());
    }

    setCameraStream(null);

    holdCountRef.current = 0;
    setPoseState({
      status: "idle",
      message: "Start the camera to begin.",
      debug: null,
    });

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (cameraImageRef.current) cameraImageRef.current.src = "";
  };

  useEffect(() => {
    if (cameraStream?.getTracks && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => { });
    }
  }, [cameraStream]);

  useEffect(() => {
    const image = cameraImageRef.current;
    if (cameraStream?.cameraId && image) {
      image.src = `${API_URL}/cameras/${cameraStream.cameraId}/stream.mjpg?stream_id=${encodeURIComponent(cameraStream.streamId)}`;
    }
    return () => {
      if (image) image.src = "";
      if (cameraStream?.cameraId && cameraStream?.streamId) {
        fetch(`${API_URL}/cameras/${cameraStream.cameraId}/stream/${cameraStream.streamId}/stop`, {
          method: "POST",
          keepalive: true,
        }).catch(() => { });
      }
    };
  }, [cameraStream]);


  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks?.().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const resetEnrollmentState = () => {
    stopEnrollmentCamera();

    capturedPhotos.forEach((photo) => {
      if (photo.previewUrl) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    });

    setCapturedPhotos([]);
    setSkippedSteps([]);
    baselineRef.current = { ...EMPTY_BASELINE };
    holdCountRef.current = 0;
    setCaptureError("");
    setEnrollmentLoading(false);
  };

  const resetAddEmployeeState = () => {
    resetEnrollmentState();
    setEmployeeForm({
      employee_id: "",
      employee_name: "",
      shift_start: "14:00",
      shift_end: "22:00",
      email: "",
      login_id: "",
      department: auth?.role === "hr" ? auth.department : "Software Services",
      work_location: "Miracle City (HQ)",
      is_flexible_shift: false,
    });
    setHubbleEmployee(null);
    setHubbleError("");
    setHubbleLoading(false);
    setFormMessage("");
    setFormError("");
  };

  const closeAddEmployee = () => {
    resetAddEmployeeState();
    setShowAddEmployee(false);
  };

  // Reset all temporary form state whenever the Add Employee modal is closed or not open
  useEffect(() => {
    if (!showAddEmployee) {
      resetAddEmployeeState();
    }
  }, [showAddEmployee]);

  // Automatically fetch employee details when entering lookup information (login_id)
  useEffect(() => {
    if (!showAddEmployee) return;
    const trimmed = (employeeForm.login_id || "").trim();
    if (!trimmed || trimmed.length < 3) return;

    const timer = setTimeout(() => {
      if (hubbleEmployee?.login_id?.toLowerCase() !== trimmed.toLowerCase() && !hubbleLoading) {
        fetchHubbleEmployee(trimmed);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [employeeForm.login_id, showAddEmployee]);

  const getEnrollmentImageElement = () =>
    enrollmentCameraId ? cameraImageRef.current : videoRef.current;

  // Small frame (fast to upload) used only to read the head angle.
  const grabPoseFrameBlob = () =>
    new Promise((resolve) => {
      const video = getEnrollmentImageElement();
      const width = video?.videoWidth || video?.naturalWidth || 0;
      const height = video?.videoHeight || video?.naturalHeight || 0;
      const ready = enrollmentCameraId
        ? video?.complete && width > 0
        : video?.readyState >= 2 && width > 0;

      if (!video || !ready) {
        resolve(null);
        return;
      }

      if (!poseCanvasRef.current) {
        poseCanvasRef.current = document.createElement("canvas");
      }

      const canvas = poseCanvasRef.current;
      const scale = 480 / width;

      canvas.width = 480;
      canvas.height = Math.round(height * scale);

      const context = canvas.getContext("2d");

      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
    });

  // Full-resolution photo of ONLY the employee:
  //  - every other face in the frame is painted over
  //  - the picture is cropped around the employee's face
  // (the enrollment API rejects photos that contain 2+ faces)
  const grabEmployeeCropBlob = (target, others) =>
    new Promise((resolve) => {
      const video = getEnrollmentImageElement();
      const canvas = canvasRef.current;
      const width = video?.videoWidth || video?.naturalWidth || 0;
      const height = video?.videoHeight || video?.naturalHeight || 0;
      const ready = enrollmentCameraId
        ? video?.complete && width > 0
        : video?.readyState >= 2 && width > 0;

      if (!video || !canvas || !ready) {
        resolve(null);
        return;
      }

      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");

      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(video, 0, 0, width, height);

      const box = target.bbox;
      const faceW = (box.x2 - box.x1) * width;
      const faceH = (box.y2 - box.y1) * height;
      const centerX = ((box.x1 + box.x2) / 2) * width;
      const centerY = ((box.y1 + box.y2) / 2) * height;

      // paint over the other people's faces
      context.fillStyle = "#808080";

      others.forEach((other) => {
        const ob = other.bbox;
        const ocx = ((ob.x1 + ob.x2) / 2) * width;
        const ocy = ((ob.y1 + ob.y2) / 2) * height;

        // never paint over the employee's own face
        const insideTarget =
          ocx > centerX - faceW / 2 &&
          ocx < centerX + faceW / 2 &&
          ocy > centerY - faceH / 2 &&
          ocy < centerY + faceH / 2;

        if (insideTarget) return;

        const ow = (ob.x2 - ob.x1) * width;
        const oh = (ob.y2 - ob.y1) * height;

        context.fillRect(
          ob.x1 * width - ow * 0.15,
          ob.y1 * height - oh * 0.15,
          ow * 1.3,
          oh * 1.3
        );
      });

      // crop around the employee
      const cropW = Math.min(width, faceW * 2.2);
      const cropH = Math.min(height, faceH * 2.0);

      const sx = Math.max(0, Math.min(width - cropW, centerX - cropW / 2));
      const sy = Math.max(0, Math.min(height - cropH, centerY - cropH / 2));

      const crop = document.createElement("canvas");

      crop.width = Math.round(cropW);
      crop.height = Math.round(cropH);

      crop
        .getContext("2d")
        .drawImage(canvas, sx, sy, cropW, cropH, 0, 0, crop.width, crop.height);

      crop.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });

  // Automatic capture loop: checks the angle again and again and
  // captures by itself when the requested angle is held.
  useEffect(() => {
    if (!cameraStream || !currentStep || enrollmentLoading) {
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    const step = currentStep;

    holdCountRef.current = 0;

    setPoseState({
      status: "idle",
      message: step.hint,
      debug: null,
    });

    const tick = async () => {
      if (cancelled) return;

      try {
        if (Date.now() < cooldownUntilRef.current) return;

        const frame = await grabPoseFrameBlob();
        if (!frame || cancelled) return;

        const body = new FormData();
        body.append("file", frame, "frame.jpg");

        const response = await fetch(`${API_URL}/face-pose`, {
          method: "POST",
          body,
        });

        if (!response.ok) throw new Error("Pose check failed");

        const data = await response.json();
        if (cancelled) return;

        const video = getEnrollmentImageElement();
        const aspect =
          video && (video.videoHeight || video.naturalHeight)
            ? (video.videoWidth || video.naturalWidth) / (video.videoHeight || video.naturalHeight)
            : 16 / 9;

        const result = evaluatePose(step, data, baselineRef.current, aspect);
        const target = result.target;

        const debug =
          target && target.pose
            ? {
              yaw: result.yaw ?? 0,
              pitch: result.pitch ?? 0,
              yawCue: target.yaw_cue,
              pitchCue: target.pitch_cue,
              faces: data.faces.length,
            }
            : null;

        if (!result.ok) {
          holdCountRef.current = 0;

          setPoseState({
            status: result.idle ? "idle" : "bad",
            message: result.message,
            debug,
          });

          return;
        }

        holdCountRef.current += 1;

        if (holdCountRef.current < HOLD_FRAMES) {
          setPoseState({ status: "ok", message: result.message, debug });
          return;
        }

        // Angle held long enough -> capture only the employee.
        const others = data.faces.filter((face) => face !== target);
        const blob = await grabEmployeeCropBlob(target, others);

        if (!blob || cancelled) return;

        // The front photo is the reference for every other angle.
        if (step.id === "front") {
          baselineRef.current = {
            yaw: target.pose.yaw,
            pitch: target.pose.pitch,
            yawCue: target.yaw_cue,
            pitchCue: target.pitch_cue,
          };
        }

        const previewUrl = URL.createObjectURL(blob);

        holdCountRef.current = 0;
        cooldownUntilRef.current = Date.now() + CAPTURE_COOLDOWN_MS;

        setCapturedPhotos((previous) =>
          previous.some((photo) => photo.poseId === step.id)
            ? previous
            : [
              ...previous,
              {
                blob,
                previewUrl,
                poseId: step.id,
                filename: `face_${step.id}.jpg`,
              },
            ]
        );

        setPoseState({
          status: "done",
          message: `${step.label} captured. Next angle...`,
          debug,
        });
      } catch {
        if (!cancelled) {
          setPoseState({
            status: "idle",
            message: "Cannot reach the face service. Is the API running?",
            debug: null,
          });
        }
      }
    };

    // Run one check at a time: the next one is scheduled only after
    // the previous one finished, so slow frames never pile up.
    const loop = async () => {
      await tick();

      if (!cancelled) {
        timer = setTimeout(loop, POLL_MS);
      }
    };

    loop();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraStream, currentStep?.id, enrollmentLoading]);

  const skipCurrentStep = () => {
    if (!currentStep) return;
    setSkippedSteps((previous) => [...previous, currentStep.id]);
  };

  const removeCapturedPhoto = (index) => {
    setCapturedPhotos((previous) => {
      const photo = previous[index];

      if (photo?.previewUrl) {
        URL.revokeObjectURL(photo.previewUrl);
      }

      return previous.filter((_, photoIndex) => photoIndex !== index);
    });
  };

  const addEmployee = async (event) => {
    event.preventDefault();

    setFormMessage("");
    setFormError("");
    setCaptureError("");

    if (capturedPhotos.length < 5) {
      setCaptureError(
        "Please capture at least 5 angles before adding the employee."
      );
      return;
    }

    if (capturedPhotos.length > 10) {
      setCaptureError("You can capture a maximum of 10 photos.");
      return;
    }

    setEnrollmentLoading(true);

    let employeeCreated = false;

    try {
      // ----------------------------------------------------
      // STEP 1: CREATE EMPLOYEE
      // ----------------------------------------------------

      const employeeResponse = await authFetch(`${API_URL}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(employeeForm),
      });

      const employeeData = await employeeResponse.json();

      if (!employeeResponse.ok) {
        throw new Error(
          employeeData.detail || "Unable to add employee"
        );
      }

      employeeCreated = true;

      // ----------------------------------------------------
      // STEP 2: SEND CAPTURED PHOTOS FOR FACE ENROLLMENT
      // ----------------------------------------------------

      const formData = new FormData();

      capturedPhotos.forEach((photo, index) => {
        formData.append(
          "files",
          photo.blob,
          photo.filename || `face_${index + 1}.jpg`
        );
      });

      const enrollmentResponse = await authFetch(
        `${API_URL}/employees/${encodeURIComponent(
          employeeForm.employee_id
        )}/enroll-face`,
        {
          method: "POST",
          body: formData,
        }
      );

      const enrollmentData = await enrollmentResponse.json();

      if (!enrollmentResponse.ok) {
        // Rollback unenrolled employee creation so there is no dangling record
        try {
          await authFetch(
            `${API_URL}/employees/${encodeURIComponent(employeeForm.employee_id)}`,
            { method: "DELETE" }
          );
        } catch {
          // ignore rollback errors
        }

        const detail =
          typeof enrollmentData.detail === "string"
            ? enrollmentData.detail
            : enrollmentData.detail?.message ||
            "Face enrollment failed.";

        throw new Error(detail);
      }

      setFormMessage(
        `Employee added and face enrolled successfully. ${enrollmentData.photos_processed || capturedPhotos.length} photos processed.`
      );

      // ----------------------------------------------------
      // CLEANUP
      // ----------------------------------------------------

      resetEnrollmentState();

      setEmployeeForm({
        employee_id: "",
        employee_name: "",
        shift_start: "14:00",
        shift_end: "22:00",
        email: "",
        login_id: "",
        department: auth?.role === "hr" ? auth.department : (allDepartments[0] || "Software Services"),
        work_location: "Miracle City (HQ)",
      });

      setHubbleEmployee(null);
      setHubbleError("");

      await loadDashboardData();

      setTimeout(() => {
        setShowAddEmployee(false);
        setFormMessage("");
      }, 1500);
    } catch (err) {
      setFormError(
        `Face enrollment failed: ${err.message || "Unknown error"}. Employee was not added to the dashboard.`
      );
    } finally {
      setEnrollmentLoading(false);
    }
  };


  const loadEmployeeAttendanceHistory = async (employee, year, month) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch(
        `${API_URL}/employees/${encodeURIComponent(employee.employee_id)}/attendance-history?year=${year}&month=${month}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Unable to load monthly attendance.");
      }
      const records = Array.isArray(data.attendance) ? data.attendance : [];
      setAttendanceHistory(records);
      setSelectedHistoryDay((previous) =>
        previous ? records.find((day) => day.date === previous.date) || null : null
      );
      return records;
    } catch (err) {
      setAttendanceHistory([]);
      setHistoryError(err.message || "Unable to load monthly attendance.");
      return [];
    } finally {
      setHistoryLoading(false);
    }
  };

  const openEmployeeHistory = async (employee) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    setSelectedEmployee(employee);
    setHistoryYear(year);
    setHistoryMonth(month);
    setSelectedHistoryDay(null);
    setAttendanceHistory([]);
    await loadEmployeeAttendanceHistory(employee, year, month);
  };

  const changeHistoryMonth = async (offset) => {
    if (!selectedEmployee) return;
    const next = new Date(historyYear, historyMonth - 1 + offset, 1);
    const year = next.getFullYear();
    const month = next.getMonth() + 1;
    setHistoryYear(year);
    setHistoryMonth(month);
    setSelectedHistoryDay(null);
    await loadEmployeeAttendanceHistory(selectedEmployee, year, month);
  };

  const openEditShift = (employee) => {
    setEditingEmployee(employee);
    setEditShiftForm({
      shift_start: employee.shift_start || "14:00",
      shift_end: employee.shift_end || "22:00",
      is_flexible_shift: Boolean(employee.is_flexible_shift),
      reporting_hr: employee.reporting_hr || "",
      hr_email: employee.hr_email || "",
      work_location: employee.work_location || "Miracle City (HQ)",
      department: employee.department || "Software Services",
      practice: employee.practice || "Innovation",
    });
    setEditShiftError("");
  };

  const saveEmployeeShift = async (event) => {
    event.preventDefault();
    if (!editingEmployee) return;
    setEditShiftLoading(true);
    setEditShiftError("");
    try {
      const response = await authFetch(
        `${API_URL}/employees/${encodeURIComponent(editingEmployee.employee_id)}/shift`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editShiftForm),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to update shift.");
      setEmployees((previous) => previous.map((employee) =>
        String(employee.employee_id) === String(data.employee.employee_id)
          ? { ...employee, ...data.employee }
          : employee
      ));
      setEditingEmployee(null);
      await loadDashboardData();
    } catch (err) {
      setEditShiftError(err.message || "Unable to update shift.");
    } finally {
      setEditShiftLoading(false);
    }
  };

  const saveSelectedDayLeave = async () => {
    if (!selectedEmployee || !selectedHistoryDay) return;
    if (selectedHistoryDay.status === "WEEKEND") {
      setHistoryError("Leave records cannot be added to weekends.");
      return;
    }
    const leaveType = window.prompt("Leave type (e.g. L, Sick, Casual)", selectedHistoryDay.leave_type || "L");
    if (leaveType === null) return;
    const reason = window.prompt("Reason (optional)", selectedHistoryDay.reason || "");
    if (reason === null) return;
    setLeaveSaving(true);
    setHistoryError("");
    try {
      const response = await authFetch(
        `${API_URL}/employees/${encodeURIComponent(selectedEmployee.employee_id)}/leave`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: String(selectedEmployee.employee_id),
            leave_date: selectedHistoryDay.date,
            leave_type: leaveType.trim() || "L",
            reason: reason.trim() || null,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to save leave.");
      const records = await loadEmployeeAttendanceHistory(selectedEmployee, historyYear, historyMonth);
      setSelectedHistoryDay(records.find((day) => day.date === selectedHistoryDay.date) || null);
    } catch (err) {
      setHistoryError(err.message || "Unable to save leave.");
    } finally {
      setLeaveSaving(false);
    }
  };

  const removeSelectedDayLeave = async () => {
    if (!selectedEmployee || !selectedHistoryDay || selectedHistoryDay.status !== "LEAVE") return;
    if (!window.confirm(`Remove leave recorded for ${selectedHistoryDay.date}?`)) return;
    setLeaveSaving(true);
    setHistoryError("");
    try {
      const response = await authFetch(
        `${API_URL}/employees/${encodeURIComponent(selectedEmployee.employee_id)}/leave/${selectedHistoryDay.date}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to remove leave.");
      const records = await loadEmployeeAttendanceHistory(selectedEmployee, historyYear, historyMonth);
      setSelectedHistoryDay(records.find((day) => day.date === selectedHistoryDay.date) || null);
    } catch (err) {
      setHistoryError(err.message || "Unable to remove leave.");
    } finally {
      setLeaveSaving(false);
    }
  };

  const openReportChooser = (employee = null) => {
    setReportChooser(employee ? { employee } : { employee: null });
    setReportPeriod("month");
    const today = selectedDate || new Date().toISOString().slice(0, 10);
    setReportDate(today);
    setReportStartDate(today);
    setReportEndDate(today);
    setReportError("");
  };

  const downloadAttendanceReport = async () => {
    if (!reportChooser || reportDownloading) return;
    setReportDownloading(true);
    setReportError("");

    if (reportPeriod === "custom") {
      if (!reportStartDate || !reportEndDate) {
        setReportError("Both start date and end date are required for custom range.");
        setReportDownloading(false);
        return;
      }
      if (reportStartDate > reportEndDate) {
        setReportError("Start date cannot be after end date.");
        setReportDownloading(false);
        return;
      }
    }

    try {
      const employee = reportChooser.employee;
      const endpoint = employee
        ? `/reports/employee/${encodeURIComponent(employee.employee_id)}`
        : "/reports/attendance";

      let queryUrl = `${API_URL}${endpoint}?period=${encodeURIComponent(reportPeriod)}`;
      if (reportPeriod === "custom") {
        queryUrl += `&start_date=${encodeURIComponent(reportStartDate)}&end_date=${encodeURIComponent(reportEndDate)}`;
      } else {
        queryUrl += `&date=${encodeURIComponent(reportDate)}`;
      }
      if (!employee) {
        if (deptFilter && deptFilter !== "ALL") {
          queryUrl += `&department=${encodeURIComponent(deptFilter)}`;
        }
        if (practiceFilter && practiceFilter !== "ALL") {
          queryUrl += `&practice=${encodeURIComponent(practiceFilter)}`;
        }
      }

      const response = await authFetch(queryUrl);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to download attendance report.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        || `${employee ? employee.employee_id : "all_employees"}_${reportPeriod}_attendance.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setReportChooser(null);
    } catch (err) {
      setReportError(err.message || "Unable to download attendance report.");
    } finally {
      setReportDownloading(false);
    }
  };

  const handleDownloadEmployeeMonth = async (employee, year, month) => {
    try {
      const mm = String(month).padStart(2, "0");
      const queryUrl = `${API_URL}/reports/employee/${encodeURIComponent(employee.employee_id)}?period=month&date=${year}-${mm}-01`;
      const response = await authFetch(queryUrl);
      if (!response.ok) {
        throw new Error("Unable to download attendance report.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        || `${employee.employee_id}_month_attendance_${year}${mm}01.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const deleteEmployee = async (employee) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${employee.employee_name}?\n\n` +
      `This will permanently remove the employee, face embeddings, ` +
      `attendance events, and attendance summary.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingEmployeeId(String(employee.employee_id));
      setError("");

      const response = await authFetch(
        `${API_URL}/employees/${employee.employee_id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to delete employee"
        );
      }

      if (
        selectedEmployee &&
        String(selectedEmployee.employee_id) ===
        String(employee.employee_id)
      ) {
        closeHistory();
      }

      await loadDashboardData();
      if (selectedDate) {
        loadAttendanceByDate(selectedDate);
      }
    } catch (err) {
      setError(
        err.message || "Unable to delete employee"
      );
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const closeHistory = () => {
    setSelectedEmployee(null);
    setAttendanceHistory([]);
    setSelectedHistoryDay(null);
    setHistoryError("");
  };

  const getAttendance = (employeeId) => {
    return attendance.find(
      (record) => String(record.employee_id) === String(employeeId)
    );
  };


  const allDepartments = useMemo(() => {
    return STANDARDIZED_DEPARTMENTS;
  }, []);

  const allLocations = useMemo(() => {
    const list = Array.from(
      new Set(
        employees.map((e) => (e.work_location || e.location || "").trim()).filter(Boolean)
      )
    );
    return list.sort();
  }, [employees]);

  const allPractices = useMemo(() => {
    return STANDARDIZED_PRACTICES;
  }, []);

  const allSubPractices = useMemo(() => {
    const list = Array.from(
      new Set(
        employees
          .map((e) => (e.sub_practice || e.team_name || e.project || "").trim())
          .filter(Boolean)
      )
    );
    return list.sort();
  }, [employees]);

  const authorizedEmployees = useMemo(() => {
    return employees;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return authorizedEmployees.filter((employee) => {
      const employeeAttendance = getAttendance(employee.employee_id);
      const status = getStatus(employeeAttendance);

      // 1. Employee Name, ID, Login ID, Email, or Mobile Filter
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        String(employee.employee_id || "").toLowerCase().includes(query) ||
        String(employee.employee_name || "")
          .toLowerCase()
          .includes(query) ||
        String(employee.login_id || "")
          .toLowerCase()
          .includes(query) ||
        String(employee.email || "")
          .toLowerCase()
          .includes(query) ||
        String(employee.phone || employee.mobile || "")
          .toLowerCase()
          .includes(query);

      // 2. Department Filter
      let matchesDept = true;
      if (deptFilter && deptFilter !== "ALL") {
        matchesDept =
          (employee.department || "").toLowerCase().trim() ===
          deptFilter.toLowerCase().trim();
      }

      // 2b. Practice Filter
      let matchesPractice = true;
      if (practiceFilter && practiceFilter !== "ALL") {
        const empPrac = (employee.practice || "").toLowerCase().trim();
        matchesPractice = empPrac === practiceFilter.toLowerCase().trim();
      }

      // 2c. Sub-Practice Filter
      let matchesSubPractice = true;
      if (subPracticeFilter && subPracticeFilter !== "ALL") {
        const empSub = (employee.sub_practice || employee.team_name || employee.project || "").toLowerCase().trim();
        matchesSubPractice = empSub === subPracticeFilter.toLowerCase().trim();
      }

      // 3. Work Location Filter
      let matchesLocation = true;
      if (locationFilter && locationFilter !== "ALL") {
        const empLoc = (employee.work_location || employee.location || "").toLowerCase().trim();
        matchesLocation = empLoc === locationFilter.toLowerCase().trim();
      }

      // 4. Status Filter
      let matchesStatus = true;
      if (statusFilter === "ALL") {
        matchesStatus = true;
      } else if (statusFilter === "PRESENT") {
        matchesStatus = status !== "ABSENT";
      } else if (statusFilter === "EARLY") {
        matchesStatus = status === "EARLY";
      } else if (statusFilter === "LATE") {
        matchesStatus = status === "LATE";
      } else if (statusFilter === "ON_TIME") {
        matchesStatus = status === "ON_TIME";
      } else if (statusFilter === "ABSENT") {
        matchesStatus = status === "ABSENT";
      } else if (statusFilter === "HALF_DAY") {
        matchesStatus = status === "HALF_DAY";
      } else if (statusFilter === "INSIDE" || statusFilter === "INSIDE_NOW") {
        matchesStatus =
          String(employeeAttendance?.current_state || "").toUpperCase() ===
          "INSIDE";
      } else if (statusFilter === "OUTSIDE") {
        matchesStatus =
          String(employeeAttendance?.current_state || "").toUpperCase() ===
          "OUTSIDE";
      }

      return matchesSearch && matchesDept && matchesPractice && matchesSubPractice && matchesLocation && matchesStatus;
    });
  }, [authorizedEmployees, attendance, search, deptFilter, practiceFilter, subPracticeFilter, locationFilter, statusFilter]);

  // Sort employees strictly in alphabetical order by name for Miracle Attendance view
  const sortedAttendanceEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) =>
      (a.employee_name || "").localeCompare(b.employee_name || "", undefined, { sensitivity: "base" })
    );
  }, [filteredEmployees]);

  // Employee Directory list filtered by search, department, practice, and work location
  const directoryEmployees = useMemo(() => {
    return authorizedEmployees.filter((employee) => {
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        String(employee.employee_id || "").toLowerCase().includes(query) ||
        String(employee.employee_name || "").toLowerCase().includes(query) ||
        String(employee.login_id || "").toLowerCase().includes(query) ||
        String(employee.email || "").toLowerCase().includes(query) ||
        String(employee.phone || employee.mobile || "").toLowerCase().includes(query);

      let matchesDept = true;
      if (deptFilter && deptFilter !== "ALL") {
        matchesDept =
          (employee.department || "").toLowerCase().trim() ===
          deptFilter.toLowerCase().trim();
      }

      let matchesPractice = true;
      if (practiceFilter && practiceFilter !== "ALL") {
        const empPrac = (employee.practice || "").toLowerCase().trim();
        matchesPractice = empPrac === practiceFilter.toLowerCase().trim();
      }

      let matchesLocation = true;
      if (locationFilter && locationFilter !== "ALL") {
        const empLoc = (employee.work_location || employee.location || "").toLowerCase().trim();
        matchesLocation = empLoc === locationFilter.toLowerCase().trim();
      }

      return matchesSearch && matchesDept && matchesPractice && matchesLocation;
    });
  }, [authorizedEmployees, search, deptFilter, practiceFilter, locationFilter]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".miracle-profile-wrapper")) {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) {
      document.addEventListener("click", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [showProfileDropdown]);

  const totalEmployees = authorizedEmployees.length;


  const authorizedEmployeeIds = useMemo(() => {
    return new Set(authorizedEmployees.map((e) => String(e.employee_id)));
  }, [authorizedEmployees]);

  const authorizedAttendance = useMemo(() => {
    return attendance.filter((record) =>
      authorizedEmployeeIds.has(String(record.employee_id))
    );
  }, [attendance, authorizedEmployeeIds]);

  const presentToday = authorizedAttendance.filter(
    (record) => getStatus(record) !== "ABSENT"
  ).length;

  const lateToday = authorizedAttendance.filter(
    (record) => getStatus(record) === "LATE"
  ).length;

  const insideNow = authorizedAttendance.filter(
    (record) =>
      String(record.current_state || "").toUpperCase() === "INSIDE"
  ).length;

  const cameras = useMemo(() => cameraStatus?.cameras || [], [cameraStatus]);
  const enrollmentCameras = useMemo(() => cameras.filter((camera) => camera.enabled), [cameras]);


  const todayText = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const selectedDateText = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    : "";


  if (!auth) {
    return (
      <LoginPage
        onLogin={(user) => {
          setAuth(user);
          setActivePage("dashboard");
          try {
            sessionStorage.setItem("faceattend_auth", JSON.stringify(user));
          } catch { }
        }}
        apiBaseUrl={API_URL}
      />
    );
  }


  return (
    <div className="miracle-shell app-shell">
      {/* Top Navbar */}
      <Navbar
        setActivePage={setActivePage}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        auth={auth}
        showProfileDropdown={showProfileDropdown}
        setShowProfileDropdown={setShowProfileDropdown}
        setShowTourModal={setShowTourModal}
        setShowProfileModal={setShowProfileModal}
        setPasswordStatus={setPasswordStatus}
        setPasswordForm={setPasswordForm}
        setShowPasswordModal={setShowPasswordModal}
        activePage={activePage}
        loadAttendanceByDate={loadAttendanceByDate}
        selectedDate={selectedDate}
        loadCameraStatus={loadCameraStatus}
        loadAdminUsers={loadAdminUsers}
        loadHrUsers={loadHrUsers}
        loadAuditLogs={loadAuditLogs}
        loadDashboardData={loadDashboardData}
        handleLogout={handleLogout}
      />

      {/* Body Layout: Sidebar + Main */}
      <div className="miracle-body-layout">
        <Sidebar
          sidebarCollapsed={sidebarCollapsed}
          activePage={activePage}
          setActivePage={setActivePage}
          resetAddEmployeeState={resetAddEmployeeState}
          setShowAddEmployee={setShowAddEmployee}
          resetCameraDraft={resetCameraDraft}
          setShowCameraEditor={setShowCameraEditor}
          auth={auth}
        />

        {/* Main Content Area */}
        <main className={`miracle-main ${sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="content">
            {/* Miracle Breadcrumb */}
            <div className="miracle-breadcrumb-bar">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="miracle-bc-home">HOME</span>
                <span className="miracle-bc-sep">›</span>
                {activePage === "generate_access_hr" ||
                  activePage === "generate_access_admin" ||
                  activePage === "general_access" ? (
                  <>
                    <span
                      className="miracle-bc-home"
                      style={{ cursor: "pointer" }}
                      onClick={() => setActivePage("generate_access_hr")}
                    >
                      GENERATE ACCESS
                    </span>
                    <span className="miracle-bc-sep">›</span>
                    <span className="miracle-bc-active">
                      {activePage === "generate_access_admin" ? "ADMIN" : "HR"}
                    </span>
                  </>
                ) : (
                  <span className="miracle-bc-active">
                    {activePage === "dashboard"
                      ? "DASHBOARD"
                      : activePage === "attendance"
                        ? "EMPLOYEE SEARCH & ATTENDANCE"
                        : activePage === "employees"
                          ? "EMPLOYEE DIRECTORY"
                          : activePage === "admin_mgmt"
                            ? "ADMIN ACCOUNTS"
                            : activePage === "activity" || activePage === "audit_logs"
                              ? "ACTIVITY"
                              : activePage === "attendance_override"
                                ? "ATTENDANCE OVERRIDE"
                                : activePage.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Superior Dashboard Date Picker & Go Live Button (Image 1 reference layout) */}
              {activePage === "dashboard" && auth?.role === "superior" && (
                <div
                  className="dashboard-top-date-picker"
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      display: "flex",
                      alignItems: "center",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    }}
                  >
                    <input
                      type="date"
                      value={dashboardDate || new Date().toISOString().slice(0, 10)}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => handleDashboardDateChange(e.target.value)}
                      style={{
                        border: "none",
                        outline: "none",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#1e293b",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                      aria-label="Select Dashboard Date"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRestoreLiveAttendance}
                    style={{
                      background: "#00AAE7",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "7px 16px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      boxShadow: "0 2px 4px rgba(0, 170, 231, 0.25)",
                      transition: "all 0.15s ease",
                    }}
                    title="Return to current date and live attendance"
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#22c55e",
                        display: "inline-block",
                        boxShadow: "0 0 6px #22c55e",
                      }}
                    ></span>
                    Go Live
                  </button>
                </div>
              )}
            </div>

            {/* Application Pages */}
            {activePage === "dashboard" && (
              <DashboardPage
                error={error}
                totalEmployees={totalEmployees}
                presentToday={presentToday}
                lateToday={lateToday}
                insideNow={insideNow}
                authorizedEmployees={authorizedEmployees}
                authorizedAttendance={authorizedAttendance}
                cameraError={cameraError}
                cameraActionError={cameraActionError}
                cameraActionMessage={cameraActionMessage}
                cameraLoading={cameraLoading}
                cameras={cameras}
                viewCamera={viewCamera}
                openCameraPreview={openCameraPreview}
                filteredEmployees={filteredEmployees}
                getAttendance={getAttendance}
                search={search}
                setSearch={setSearch}
                deptFilter={deptFilter}
                setDeptFilter={setDeptFilter}
                practiceFilter={practiceFilter}
                setPracticeFilter={handlePracticeChange}
                subPracticeFilter={subPracticeFilter}
                setSubPracticeFilter={setSubPracticeFilter}
                locationFilter={locationFilter}
                setLocationFilter={setLocationFilter}
                allDepartments={allDepartments}
                allPractices={allPractices}
                allSubPractices={allSubPractices}
                allLocations={allLocations}
                auth={auth}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                openEmployeeHistory={openEmployeeHistory}
                setDailyViewEmployee={setDailyViewEmployee}
                selectedDate={selectedDate}
                loading={loading}
                dashboardDate={dashboardDate}
              />
            )}

            {activePage === "employees" && auth?.role === "admin" && (
              <EmployeesPage
                auth={auth}
                allDepartments={allDepartments}
                setEmployeeForm={setEmployeeForm}
                setShowAddEmployee={setShowAddEmployee}
                search={search}
                setSearch={setSearch}
                deptFilter={deptFilter}
                setDeptFilter={setDeptFilter}
                practiceFilter={practiceFilter}
                setPracticeFilter={handlePracticeChange}
                allPractices={allPractices}
                employees={employees}
                locationFilter={locationFilter}
                setLocationFilter={setLocationFilter}
                allLocations={allLocations}
                directoryEmployees={directoryEmployees}
                authorizedEmployees={authorizedEmployees}
                getAttendance={getAttendance}
                expandedEmployeeId={expandedEmployeeId}
                setExpandedEmployeeId={setExpandedEmployeeId}
                openEditShift={openEditShift}
                openEmployeeHistory={openEmployeeHistory}
                openReportChooser={openReportChooser}
                deleteEmployee={deleteEmployee}
                deletingEmployeeId={deletingEmployeeId}
              />
            )}

            {activePage === "attendance" && (
              <AttendancePage
                dateAttendanceError={dateAttendanceError}
                selectedDateText={selectedDateText}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                dateAttendanceLoading={dateAttendanceLoading}
                sortedAttendanceEmployees={sortedAttendanceEmployees}
                getAttendance={getAttendance}
                openEditShift={openEditShift}
                openEmployeeHistory={openEmployeeHistory}
                openReportChooser={openReportChooser}
                deleteEmployee={deleteEmployee}
                deletingEmployeeId={deletingEmployeeId}
                search={search}
                setSearch={setSearch}
                loadAttendanceByDate={loadAttendanceByDate}
                handleAttendanceDateChange={handleAttendanceDateChange}
                auth={auth}
                deptFilter={deptFilter}
                setDeptFilter={setDeptFilter}
                practiceFilter={practiceFilter}

                setPracticeFilter={handlePracticeChange}
                subPracticeFilter={subPracticeFilter}
                setSubPracticeFilter={setSubPracticeFilter}
                allDepartments={allDepartments}
                allPractices={allPractices}
                allSubPractices={allSubPractices}
                locationFilter={locationFilter}
                setLocationFilter={setLocationFilter}
                allLocations={allLocations}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                API_URL={API_URL}
                authFetch={authFetch}
              />
            )}

            {(activePage === "admin_mgmt" ||
              activePage === "generate_access_admin") &&
              auth?.role === "superior" && (
                <AdminManagementPage
                  adminCreateStatus={adminCreateStatus}
                  handleCreateAdmin={handleCreateAdmin}
                  newAdminForm={newAdminForm}
                  setNewAdminForm={setNewAdminForm}
                  loadAdminUsers={loadAdminUsers}
                  adminLoading={adminLoading}
                  adminList={adminList}
                />
              )}

            {(activePage === "general_access" ||
              activePage === "generate_access_hr") &&
              (auth?.role === "admin" || auth?.role === "superior") && (
                <GeneralAccessPage
                  hrCreateStatus={hrCreateStatus}
                  handleCreateHr={handleCreateHr}
                  newHrForm={newHrForm}
                  setNewHrForm={setNewHrForm}
                  allDepartments={allDepartments}
                  loadHrUsers={loadHrUsers}
                  hrLoading={hrLoading}
                  hrList={hrList}
                />
              )}

            {(activePage === "audit_logs" || activePage === "activity") &&
              auth?.role === "superior" && (
                <AuditLogsPage
                  loadAuditLogs={loadAuditLogs}
                  auditLoading={auditLoading}
                  auditRoleFilter={auditRoleFilter}
                  setAuditRoleFilter={setAuditRoleFilter}
                  auditActionFilter={auditActionFilter}
                  setAuditActionFilter={setAuditActionFilter}
                  auditDateFilter={auditDateFilter}
                  setAuditDateFilter={setAuditDateFilter}
                  auditLogs={auditLogs}
                />
              )}

            {activePage === "attendance_override" &&
              auth?.role === "superior" && (
                <AttendanceOverridePage
                  overrideStatus={overrideStatus}
                  handleManualOverride={handleManualOverride}
                  overrideForm={overrideForm}
                  setOverrideForm={setOverrideForm}
                  employees={employees}
                />
              )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <CameraEditorModal
        show={showCameraEditor}
        onClose={() => setShowCameraEditor(false)}
        cameraDraft={cameraDraft}
        handleCameraDraftChange={handleCameraDraftChange}
        setCameraDraft={setCameraDraft}
        resetCameraDraft={resetCameraDraft}
        saveCamera={saveCamera}
        toggleCameraRole={toggleCameraRole}
        cameraActionError={cameraActionError}
        cameraActionMessage={cameraActionMessage}
        cameraBusy={cameraBusy}
        cameras={cameras}
        openCameraPreview={openCameraPreview}
        testCamera={testCamera}
        editCamera={editCamera}
        toggleCameraEnabled={toggleCameraEnabled}
        deleteCamera={deleteCamera}
      />

      <ViewCameraModal
        viewCamera={viewCamera}
        onClose={closeCameraPreview}
      />

      <AddEmployeeModal
        show={showAddEmployee}
        closeAddEmployee={closeAddEmployee}
        enrollmentLoading={enrollmentLoading}
        addEmployee={addEmployee}
        formError={formError}
        formMessage={formMessage}
        employeeForm={employeeForm}
        handleEmployeeFormChange={handleEmployeeFormChange}
        handleHubbleLoginKeyDown={handleHubbleLoginKeyDown}
        hubbleEmployee={hubbleEmployee}
        hubbleLoading={hubbleLoading}
        fetchHubbleEmployee={fetchHubbleEmployee}
        hubbleError={hubbleError}
        auth={auth}
        enrollmentCameras={enrollmentCameras}
        enrollmentCameraId={enrollmentCameraId}
        setEnrollmentCameraId={setEnrollmentCameraId}
        cameraStream={cameraStream}
        startEnrollmentCamera={startEnrollmentCamera}
        stopEnrollmentCamera={stopEnrollmentCamera}
        captureError={captureError}
        setCaptureError={setCaptureError}
        currentStep={currentStep}
        poseState={poseState}
        videoAspect={videoAspect}
        cameraImageRef={cameraImageRef}
        videoRef={videoRef}
        canvasRef={canvasRef}
        showPoseDebug={showPoseDebug}
        setShowPoseDebug={setShowPoseDebug}
        skipCurrentStep={skipCurrentStep}
        capturedPhotos={capturedPhotos}
        removeCapturedPhoto={removeCapturedPhoto}
        allDepartments={allDepartments}
        allPractices={allPractices}
        allLocations={allLocations}
        setVideoAspect={setVideoAspect}
        skippedSteps={skippedSteps}
        setSkippedSteps={setSkippedSteps}
      />

      <EmployeeHistoryModal
        selectedEmployee={selectedEmployee}
        closeHistory={closeHistory}
        changeHistoryMonth={changeHistoryMonth}
        historyLoading={historyLoading}
        historyYear={historyYear}
        historyMonth={historyMonth}
        historyError={historyError}
        attendanceHistory={attendanceHistory}
        selectedHistoryDay={selectedHistoryDay}
        setSelectedHistoryDay={setSelectedHistoryDay}
        removeSelectedDayLeave={removeSelectedDayLeave}
        saveSelectedDayLeave={saveSelectedDayLeave}
        leaveSaving={leaveSaving}
        onExportMonth={handleDownloadEmployeeMonth}
      />

      <DailyViewModal
        dailyViewEmployee={dailyViewEmployee}
        onClose={() => setDailyViewEmployee(null)}
        onOpenEmployeeHistory={(emp) => openEmployeeHistory(emp)}
      />

      <PasswordChangeModal
        show={showPasswordModal}
        auth={auth}
        passwordStatus={passwordStatus}
        passwordForm={passwordForm}
        setPasswordForm={setPasswordForm}
        handlePasswordChange={handlePasswordChange}
        handleClosePasswordModal={handleClosePasswordModal}
      />

      <EditShiftModal
        editingEmployee={editingEmployee}
        onClose={() => setEditingEmployee(null)}
        editShiftLoading={editShiftLoading}
        editShiftError={editShiftError}
        editShiftForm={editShiftForm}
        setEditShiftForm={setEditShiftForm}
        saveEmployeeShift={saveEmployeeShift}
        allDepartments={allDepartments}
        allPractices={allPractices}
      />

      <ExportAttendanceModal
        reportChooser={reportChooser}
        onClose={() => setReportChooser(null)}
        reportDownloading={reportDownloading}
        reportError={reportError}
        reportPeriod={reportPeriod}
        setReportPeriod={setReportPeriod}
        reportDate={reportDate}
        setReportDate={setReportDate}
        reportStartDate={reportStartDate}
        setReportStartDate={setReportStartDate}
        reportEndDate={reportEndDate}
        setReportEndDate={setReportEndDate}
        downloadAttendanceReport={downloadAttendanceReport}
        allDepartments={allDepartments}
        allPractices={allPractices}
        deptFilter={deptFilter}
        setDeptFilter={setDeptFilter}
        practiceFilter={practiceFilter}
        setPracticeFilter={handlePracticeChange}
      />

      <EmployeeActionModal
        actionEmployee={actionEmployee}
        onClose={() => setActionEmployee(null)}
        onEditShift={(emp) => openEditShift(emp)}
        onViewHistory={(emp) => openEmployeeHistory(emp)}
        onExportReport={(emp) => openReportChooser(emp)}
        onDeleteEmployee={(emp) => deleteEmployee(emp)}
      />

      <UserProfileModal
        show={showProfileModal}
        auth={auth}
        onClose={() => setShowProfileModal(false)}
      />

      <GuidedTourModal
        show={showTourModal}
        onClose={() => setShowTourModal(false)}
      />
    </div>
  );
}

export default App;
