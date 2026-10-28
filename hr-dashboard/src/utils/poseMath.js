// ============================================================
// GUIDED FACE ENROLLMENT CONSTANTS & MATHEMATICAL ALGORITHMS
// ============================================================

export const formatEmployeeName = (name) => {
  if (!name) return "";
  return String(name)
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
};

export const POSE_STEPS = [
  { id: "front",      label: "Front",       arrow: "●", yaw: 0,   pitch: 0,   row: 1, col: 1, hint: "Look straight at the camera" },
  { id: "left",       label: "Left 3/4",    arrow: "←", yaw: -30, pitch: 0,   row: 1, col: 0, hint: "Slowly turn your head to your left" },
  { id: "right",      label: "Right 3/4",   arrow: "→", yaw: 30,  pitch: 0,   row: 1, col: 2, hint: "Slowly turn your head to your right" },
  { id: "up",         label: "Up",          arrow: "↑", yaw: 0,   pitch: 15,  row: 0, col: 1, hint: "Lift your chin up a little" },
  { id: "up-left",    label: "Up + Left",   arrow: "↖", yaw: -28, pitch: 14,  row: 0, col: 0, hint: "Chin up and turn to your left" },
  { id: "up-right",   label: "Up + Right",  arrow: "↗", yaw: 28,  pitch: 14,  row: 0, col: 2, hint: "Chin up and turn to your right" },
  { id: "down",       label: "Down",        arrow: "↓", yaw: 0,   pitch: -15, row: 2, col: 1, hint: "Lower your chin a little" },
  { id: "down-left",  label: "Down + Left", arrow: "↙", yaw: -28, pitch: -14, row: 2, col: 0, hint: "Chin down and turn to your left" },
  { id: "down-right", label: "Down + Right",arrow: "↘", yaw: 28,  pitch: -14, row: 2, col: 2, hint: "Chin down and turn to your right" },
];

// ---- Tuning knobs -------------------------------------------
export const OVAL_HEIGHT = 0.94;        // oval height / camera height (CSS uses the same 94%)
export const OVAL_RATIO = 0.75;         // oval width / height (3:4)
export const YAW_TOLERANCE = 12;        // degrees allowed around the target
export const PITCH_TOLERANCE = 10;
export const FRONT_YAW_LIMIT = 10;      // "front" is judged on raw angles
export const FRONT_PITCH_LIMIT = 15;
export const FRONT_YAW_CUE_LIMIT = 0.12;
export const YAW_CUE_MIN = 0.04;        // min nose shift needed to trust a turn direction
export const PITCH_CUE_MIN = 0.02;
export const HOLD_FRAMES = 2;           // consecutive good frames before capture
export const POLL_MS = 150;             // wait between frame checks
export const CAPTURE_COOLDOWN_MS = 500; // pause after a capture
export const MIN_FACE_RATIO = 0.40;     // face height / oval height (too far)
export const MAX_FACE_RATIO = 1.0;      // (too close)
export const MIN_DET_SCORE = 0.6;

export const EMPTY_BASELINE = { yaw: 0, pitch: 0, yawCue: 0, pitchCue: 0 };

// Pick the face that is inside the oval (closest to its centre).
export function pickFaceInOval(faces, aspect) {
  const radiusY = OVAL_HEIGHT / 2;
  const radiusX = (OVAL_HEIGHT * OVAL_RATIO) / aspect / 2;

  let target = null;
  let best = Infinity;

  for (const face of faces) {
    const centerX = (face.bbox.x1 + face.bbox.x2) / 2;
    const centerY = (face.bbox.y1 + face.bbox.y2) / 2;

    const distance =
      ((centerX - 0.5) / radiusX) ** 2 + ((centerY - 0.5) / radiusY) ** 2;

    if (distance <= 1 && distance < best) {
      best = distance;
      target = face;
    }
  }

  return target;
}

// Decide whether the face in the oval is at the requested angle.
export function evaluatePose(step, data, baseline, aspect) {
  const faces = data?.faces || [];
  const target = pickFaceInOval(faces, aspect);

  if (!target) {
    return {
      ok: false,
      idle: true,
      target: null,
      message: "Put your face inside the circle.",
    };
  }

  if (target.det_score !== null && target.det_score < MIN_DET_SCORE) {
    return { ok: false, target, message: "Face is not clear. Improve the lighting." };
  }

  const faceRatio = (target.bbox.y2 - target.bbox.y1) / OVAL_HEIGHT;

  if (faceRatio < MIN_FACE_RATIO) {
    return { ok: false, target, message: "Move a little closer to the camera." };
  }

  if (faceRatio > MAX_FACE_RATIO) {
    return { ok: false, target, message: "Move back a little." };
  }

  if (!target.pose || target.yaw_cue === null || target.pitch_cue === null) {
    return { ok: false, idle: true, target, message: "Could not read head angle." };
  }

  const isFront = step.id === "front";

  // ---------- FRONT ----------
  if (isFront) {
    const yawOk =
      Math.abs(target.pose.yaw) <= FRONT_YAW_LIMIT &&
      Math.abs(target.yaw_cue) <= FRONT_YAW_CUE_LIMIT;

    const pitchOk = Math.abs(target.pose.pitch) <= FRONT_PITCH_LIMIT;

    if (yawOk && pitchOk) {
      return { ok: true, target, yaw: 0, pitch: 0, message: "Perfect. Hold still..." };
    }

    return {
      ok: false,
      target,
      yaw: 0,
      pitch: 0,
      message: !yawOk ? "Face the camera straight." : "Keep your head level.",
    };
  }

  // ---------- OTHER ANGLES ----------
  const sizeYaw = Math.abs(target.pose.yaw - baseline.yaw);
  const sizePitch = Math.abs(target.pose.pitch - baseline.pitch);

  const dYawCue = target.yaw_cue - baseline.yawCue;
  const dPitchCue = target.pitch_cue - baseline.pitchCue;

  let yaw = 0;
  if (Math.abs(dYawCue) >= YAW_CUE_MIN) {
    yaw = (dYawCue > 0 ? -1 : 1) * sizeYaw;
  }

  let pitch = 0;
  if (Math.abs(dPitchCue) >= PITCH_CUE_MIN) {
    pitch = (dPitchCue < 0 ? 1 : -1) * sizePitch;
  }

  const yawDiff = step.yaw - yaw;
  const pitchDiff = step.pitch - pitch;

  const yawOk = Math.abs(yawDiff) <= YAW_TOLERANCE;
  const pitchOk = Math.abs(pitchDiff) <= PITCH_TOLERANCE;

  if (yawOk && pitchOk) {
    return { ok: true, target, yaw, pitch, message: "Perfect. Hold still..." };
  }

  let message = step.hint;

  if (!yawOk) {
    const wrongWay = step.yaw !== 0 && yaw * step.yaw < 0 && Math.abs(yaw) > 8;
    const side = step.yaw !== 0 ? (step.yaw < 0 ? "left" : "right") : yawDiff < 0 ? "left" : "right";

    if (wrongWay) {
      message = `Wrong way. Turn to your ${side}.`;
    } else if (step.yaw === 0) {
      message = "Face straight, do not turn sideways.";
    } else if (Math.abs(yaw) > Math.abs(step.yaw)) {
      message = "Turn back a little.";
    } else {
      message = `Turn a bit more to your ${side}.`;
    }
  } else if (!pitchOk) {
    if (step.pitch === 0) {
      message = "Keep your head level.";
    } else if (pitchDiff > 0) {
      message = "Lift your chin a little more.";
    } else {
      message = "Lower your chin a little more.";
    }
  }

  return { ok: false, target, yaw, pitch, message };
}
