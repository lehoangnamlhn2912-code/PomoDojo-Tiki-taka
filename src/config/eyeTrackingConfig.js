// Configuration thresholds and parameters for MediaPipe Face Landmark & PnP Distance Tracking

export const EYE_TRACKING_CONFIG = {
  // MediaPipe Vision Face Landmarker Model Configuration
  // Uses Google MediaPipe official pre-trained Face Landmarker (478 3D landmarks with iris)
  MEDIAPIPE_WASM_PATH: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  MEDIAPIPE_MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',

  // Distance Classification Thresholds (in centimeters)
  SAFE_DISTANCE_CM: 50.0,       // >= 50cm is Safe
  WARNING_DISTANCE_CM: 40.0,    // 35cm - 50cm is Warning
  DANGER_DISTANCE_CM: 35.0,     // < 35cm is Danger

  // Ratio Thresholds (compared to safe calibrated distance)
  RATIO_SAFE_THRESHOLD: 1.10,       // ratio <= 1.10 => Safe
  RATIO_WARNING_THRESHOLD: 1.25,    // 1.10 < ratio <= 1.25 => Warning

  // Hysteresis Rules in Centimeters
  HYSTERESIS_CM: {
    DANGER_TRIGGER: 35.0,           // Enter danger if < 35cm
    DANGER_RELEASE: 38.0,           // Only exit danger if >= 38cm
    WARNING_TRIGGER: 45.0,          // Enter warning if < 45cm
    WARNING_RELEASE: 48.0,          // Exit warning if >= 48cm
  },

  // Smoothing Factor (Exponential Moving Average)
  // 0.25 provides silky smooth 3D tracking without jumping
  EMA_ALPHA: 0.25,

  // Debounce / Persistence Time before triggering alert state (in milliseconds)
  PERSISTENCE_TIME_MS: 1500,        // Must exceed threshold continuously for 1.5s

  // Default initial baseline eye box size (pixels) before user calibration
  DEFAULT_SAFE_BOX_SIZE: 38.0,
  DEFAULT_SAFE_DISTANCE_CM: 55.0,

  // LocalStorage Keys for persistent calibration across sessions
  CALIBRATION_STORAGE_KEY: 'eyecare_safe_eye_box_size',
  CALIBRATION_CM_STORAGE_KEY: 'eyecare_safe_distance_cm'
};


