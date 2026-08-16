// Safety classification engine with Centimeter-based Hysteresis & Debounce persistence
import { EYE_TRACKING_CONFIG } from '../config/eyeTrackingConfig.js';

export class SafetyLogic {
  constructor() {
    this.currentStatus = 'unknown';      // 'safe' | 'warning' | 'danger' | 'unknown'
    this.candidateStatus = null;
    this.candidateStartTime = null;
    this.isDangerLatched = false;        // Hysteresis latch for danger state
    this.isWarningLatched = false;
  }

  evaluate({ detected, eyeBoxes, distanceCm, smoothedBoxSize, safeBoxSize, safeDistanceCm, ratioToSafe, pose, ear }) {
    // 1. If not detected, return 'unknown' status immediately without false alarms
    if (!detected || distanceCm === null) {
      this.candidateStatus = null;
      this.candidateStartTime = null;
      this.currentStatus = 'unknown';

      return {
        detected: false,
        eye_boxes: [],
        eye_labels: [],
        distance_cm: null,
        eye_box_size: smoothedBoxSize,
        safe_box_size: safeBoxSize,
        safe_distance_cm: safeDistanceCm,
        ratio_to_safe: null,
        pose: null,
        ear: null,
        status: 'unknown'
      };
    }

    const cfg = EYE_TRACKING_CONFIG;
    const now = Date.now();

    // 2. Determine raw candidate state with Distance in Centimeters & Hysteresis
    let targetRawStatus = 'safe';

    // Danger Hysteresis evaluation (e.g. Danger < 35cm, Release >= 38cm)
    if (this.isDangerLatched) {
      if (distanceCm < cfg.HYSTERESIS_CM.DANGER_RELEASE) {
        targetRawStatus = 'danger';
      } else if (distanceCm < cfg.HYSTERESIS_CM.WARNING_TRIGGER) {
        targetRawStatus = 'warning';
        this.isDangerLatched = false;
        this.isWarningLatched = true;
      } else {
        targetRawStatus = 'safe';
        this.isDangerLatched = false;
        this.isWarningLatched = false;
      }
    } else if (this.isWarningLatched) {
      if (distanceCm <= cfg.HYSTERESIS_CM.DANGER_TRIGGER) {
        targetRawStatus = 'danger';
      } else if (distanceCm < cfg.HYSTERESIS_CM.WARNING_RELEASE) {
        targetRawStatus = 'warning';
      } else {
        targetRawStatus = 'safe';
        this.isWarningLatched = false;
      }
    } else {
      // Standard transition without existing latch
      if (distanceCm <= cfg.HYSTERESIS_CM.DANGER_TRIGGER) {
        targetRawStatus = 'danger';
      } else if (distanceCm < cfg.HYSTERESIS_CM.WARNING_TRIGGER) {
        targetRawStatus = 'warning';
      } else {
        targetRawStatus = 'safe';
      }
    }

    // 3. Debounce & Persistence (1.5s continuous duration requirement to avoid false alarms)
    if (targetRawStatus !== this.currentStatus) {
      if (this.candidateStatus !== targetRawStatus) {
        // Start timing candidate state transition
        this.candidateStatus = targetRawStatus;
        this.candidateStartTime = now;
      } else {
        const elapsed = now - this.candidateStartTime;
        // If candidate state persists longer than persistence threshold or transitioning towards safe
        if (elapsed >= cfg.PERSISTENCE_TIME_MS || targetRawStatus === 'safe') {
          this.currentStatus = targetRawStatus;
          if (this.currentStatus === 'danger') {
            this.isDangerLatched = true;
          } else if (this.currentStatus === 'warning') {
            this.isWarningLatched = true;
          }
          this.candidateStatus = null;
          this.candidateStartTime = null;
        }
      }
    } else {
      // Already at target status
      this.candidateStatus = null;
      this.candidateStartTime = null;
    }

    // Return complete metric output
    return {
      detected: true,
      eye_boxes: eyeBoxes.map((boxItem) => {
        const box = Array.isArray(boxItem) ? boxItem : (boxItem.box || [0, 0, 0, 0]);
        return [
          Math.round(box[0]),
          Math.round(box[1]),
          Math.round(box[2]),
          Math.round(box[3])
        ];
      }),
      eye_labels: eyeBoxes.map((boxItem) => boxItem?.label || 'open_eye'),
      distance_cm: distanceCm,
      eye_box_size: smoothedBoxSize,
      safe_box_size: safeBoxSize,
      safe_distance_cm: safeDistanceCm,
      ratio_to_safe: ratioToSafe,
      pose: pose || { yaw: 0, pitch: 0, roll: 0 },
      ear: ear || { avg: 0.28, isEyeClosed: false },
      status: this.currentStatus
    };
  }

  reset() {
    this.currentStatus = 'unknown';
    this.candidateStatus = null;
    this.candidateStartTime = null;
    this.isDangerLatched = false;
    this.isWarningLatched = false;
  }
}

export const safetyLogic = new SafetyLogic();
