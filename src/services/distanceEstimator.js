// Distance Estimator via Metric PnP / Anthropometric Distance & EMA Smoothing
import { EYE_TRACKING_CONFIG } from '../config/eyeTrackingConfig.js';

export class DistanceEstimator {
  constructor() {
    this.smoothedDistanceCm = null;
    this.smoothedBoxSize = null;
    this.safeDistanceCm = this.loadSavedCalibrationCm();
    this.safeBoxSize = this.loadSavedCalibration();
    this.alpha = EYE_TRACKING_CONFIG.EMA_ALPHA; // 0.25
  }

  // Load previously calibrated safe distance in cm from localStorage
  loadSavedCalibrationCm() {
    try {
      const saved = localStorage.getItem(EYE_TRACKING_CONFIG.CALIBRATION_CM_STORAGE_KEY);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 25 && val <= 120) {
          return val;
        }
      }
    } catch (e) {
      console.warn('LocalStorage not available for calibration:', e);
    }
    return EYE_TRACKING_CONFIG.DEFAULT_SAFE_DISTANCE_CM;
  }

  loadSavedCalibration() {
    try {
      const saved = localStorage.getItem(EYE_TRACKING_CONFIG.CALIBRATION_STORAGE_KEY);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val > 5 && val < 500) {
          return val;
        }
      }
    } catch (e) {}
    return EYE_TRACKING_CONFIG.DEFAULT_SAFE_BOX_SIZE;
  }

  // Calculate box dimensions [x1, y1, x2, y2]
  calculateBoxSize(boxItem) {
    const box = Array.isArray(boxItem) ? boxItem : (boxItem?.box || [0, 0, 0, 0]);
    const width = Math.abs(box[2] - box[0]);
    const height = Math.abs(box[3] - box[1]);
    return Math.sqrt(width * height);
  }

  // Process detected eye boxes & PnP Metric Distance
  processMetricDetection({ eyeBoxes, distanceCm }) {
    if (!eyeBoxes || eyeBoxes.length === 0) {
      return {
        detected: false,
        distanceCm: this.smoothedDistanceCm ? Number(this.smoothedDistanceCm.toFixed(1)) : null,
        smoothedBoxSize: this.smoothedBoxSize ? Number(this.smoothedBoxSize.toFixed(1)) : null,
        safeBoxSize: Number(this.safeBoxSize.toFixed(1)),
        safeDistanceCm: Number(this.safeDistanceCm.toFixed(1)),
        ratioToSafe: null
      };
    }

    // 1. Calculate raw eye box size
    let rawSize = 0;
    if (eyeBoxes.length >= 2) {
      const size1 = this.calculateBoxSize(eyeBoxes[0]);
      const size2 = this.calculateBoxSize(eyeBoxes[1]);
      rawSize = (size1 + size2) / 2;
    } else {
      rawSize = this.calculateBoxSize(eyeBoxes[0]);
    }

    // 2. Exponential Moving Average (EMA) for Box Size
    if (this.smoothedBoxSize === null) {
      this.smoothedBoxSize = rawSize;
    } else {
      this.smoothedBoxSize = (1 - this.alpha) * this.smoothedBoxSize + this.alpha * rawSize;
    }

    // 3. Exponential Moving Average (EMA) for Metric Distance (cm)
    const currentMetricCm = distanceCm || (55.0 * (this.safeBoxSize / Math.max(1, this.smoothedBoxSize)));
    if (this.smoothedDistanceCm === null) {
      this.smoothedDistanceCm = currentMetricCm;
    } else {
      this.smoothedDistanceCm = (1 - this.alpha) * this.smoothedDistanceCm + this.alpha * currentMetricCm;
    }

    // 4. Compute ratio: ratio = safe_distance / current_distance (or current_box / safe_box)
    // When closer than safe distance, ratio > 1.0 (e.g. 1.25x)
    const ratioToSafe = this.safeDistanceCm / Math.max(10, this.smoothedDistanceCm);

    return {
      detected: true,
      distanceCm: Number(this.smoothedDistanceCm.toFixed(1)),
      rawBoxSize: Number(rawSize.toFixed(1)),
      smoothedBoxSize: Number(this.smoothedBoxSize.toFixed(1)),
      safeBoxSize: Number(this.safeBoxSize.toFixed(1)),
      safeDistanceCm: Number(this.safeDistanceCm.toFixed(1)),
      ratioToSafe: Number(ratioToSafe.toFixed(2))
    };
  }

  // Calibrate current distance as the benchmark "Safe Distance"
  calibrateCurrent() {
    if (this.smoothedDistanceCm && this.smoothedDistanceCm >= 20) {
      this.safeDistanceCm = this.smoothedDistanceCm;
      this.safeBoxSize = this.smoothedBoxSize || EYE_TRACKING_CONFIG.DEFAULT_SAFE_BOX_SIZE;
      try {
        localStorage.setItem(
          EYE_TRACKING_CONFIG.CALIBRATION_CM_STORAGE_KEY,
          this.safeDistanceCm.toString()
        );
        localStorage.setItem(
          EYE_TRACKING_CONFIG.CALIBRATION_STORAGE_KEY,
          this.safeBoxSize.toString()
        );
      } catch (e) {
        console.warn('Could not save calibration to localStorage:', e);
      }
      return {
        safeDistanceCm: this.safeDistanceCm,
        safeBoxSize: this.safeBoxSize
      };
    }
    return null;
  }

  // Reset to default factory calibration
  resetCalibration() {
    this.safeDistanceCm = EYE_TRACKING_CONFIG.DEFAULT_SAFE_DISTANCE_CM;
    this.safeBoxSize = EYE_TRACKING_CONFIG.DEFAULT_SAFE_BOX_SIZE;
    try {
      localStorage.removeItem(EYE_TRACKING_CONFIG.CALIBRATION_CM_STORAGE_KEY);
      localStorage.removeItem(EYE_TRACKING_CONFIG.CALIBRATION_STORAGE_KEY);
    } catch (e) {}
    return {
      safeDistanceCm: this.safeDistanceCm,
      safeBoxSize: this.safeBoxSize
    };
  }
}

export const distanceEstimator = new DistanceEstimator();
