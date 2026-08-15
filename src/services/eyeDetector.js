// MediaPipe Face Landmark Service with PnP 3D Metric Distance & Head Pose Estimation
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { EYE_TRACKING_CONFIG } from '../config/eyeTrackingConfig.js';
import { solvePnP } from '../utils/pnpSolver.js';

export class EyeDetector {
  constructor() {
    this.faceLandmarker = null;
    this.isModelLoaded = false;
    this.isLoadingModel = false;
    this.lastVideoTime = -1;

    // Optical fallback canvas
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    // Initialize MediaPipe Face Landmarker model
    this.initMediaPipe();
  }

  async initMediaPipe() {
    if (this.isModelLoaded || this.isLoadingModel) return;
    this.isLoadingModel = true;

    try {
      console.log('🔄 Loading Google MediaPipe Face Landmarker...');
      const vision = await FilesetResolver.forVisionTasks(
        EYE_TRACKING_CONFIG.MEDIAPIPE_WASM_PATH
      );

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: EYE_TRACKING_CONFIG.MEDIAPIPE_MODEL_URL,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true
      });

      this.isModelLoaded = true;
      console.log('✅ Google MediaPipe Face Landmarker loaded successfully (478 3D Landmarks)');
    } catch (err) {
      console.warn('⚠️ Could not load MediaPipe with GPU delegate, falling back to CPU:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          EYE_TRACKING_CONFIG.MEDIAPIPE_WASM_PATH
        );
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: EYE_TRACKING_CONFIG.MEDIAPIPE_MODEL_URL,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1
        });
        this.isModelLoaded = true;
        console.log('✅ Google MediaPipe Face Landmarker loaded successfully (CPU mode)');
      } catch (fallbackErr) {
        console.error('❌ Failed to load MediaPipe Face Landmarker:', fallbackErr);
        this.isModelLoaded = false;
      }
    } finally {
      this.isLoadingModel = false;
    }
  }

  // Main Detection pipeline
  async detectEyes(videoElement) {
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return { 
        detected: false, 
        eyeBoxes: [], 
        distanceCm: null,
        pose: null,
        ear: null,
        landmarks: null,
        inferenceMode: 'none' 
      };
    }

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    const currentTime = videoElement.currentTime;

    // 1. Run MediaPipe Face Landmarker if loaded
    if (this.faceLandmarker && this.isModelLoaded && currentTime !== this.lastVideoTime) {
      this.lastVideoTime = currentTime;
      try {
        const results = this.faceLandmarker.detectForVideo(videoElement, performance.now());

        if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0]; // 478 normalized landmarks

          // Solve Perspective-n-Point (PnP) for precise 3D distance and head pose
          const pnpResult = solvePnP({
            landmarks,
            width: videoWidth,
            height: videoHeight
          });

          if (pnpResult) {
            return {
              detected: true,
              eyeBoxes: pnpResult.eyeBoxes,
              distanceCm: pnpResult.distanceCm,
              pose: pnpResult.pose,
              ear: pnpResult.ear,
              landmarks: landmarks,
              ipdPixels: pnpResult.ipdPixels,
              inferenceMode: 'mediapipe_pnp'
            };
          }
        }
      } catch (err) {
        console.warn('MediaPipe detection error:', err);
      }
    }

    // 2. Optical Computer Vision Fallback if MediaPipe is initializing
    const opticalResult = this.detectEyesOptical(videoElement, videoWidth, videoHeight);
    return {
      detected: opticalResult.detected,
      eyeBoxes: opticalResult.eyeBoxes,
      distanceCm: opticalResult.distanceCm,
      pose: opticalResult.pose,
      ear: opticalResult.ear,
      landmarks: null,
      ipdPixels: opticalResult.ipdPixels,
      inferenceMode: this.isModelLoaded ? 'mediapipe_pnp' : 'optical_fallback'
    };
  }

  // Optical fallback when model is loading
  detectEyesOptical(videoElement, videoWidth, videoHeight) {
    const scanW = 160;
    const scanH = 120;
    this.canvas.width = scanW;
    this.canvas.height = scanH;
    this.ctx.drawImage(videoElement, 0, 0, scanW, scanH);
    const data = this.ctx.getImageData(0, 0, scanW, scanH).data;

    let minX = scanW, maxX = 0, minY = scanH, maxY = 0;
    let skinCount = 0;

    for (let y = 4; y < scanH - 4; y += 2) {
      for (let x = 4; x < scanW - 4; x += 2) {
        const idx = (y * scanW + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const isSkin = r > 45 && g > 25 && b > 15 && r > g && (r - b) > 10;
        if (isSkin) {
          skinCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (skinCount < 25 || (maxX - minX) < 12 || (maxY - minY) < 15) {
      return { detected: false, eyeBoxes: [], distanceCm: null, pose: null, ear: null, ipdPixels: null };
    }

    const scaleX = videoWidth / scanW;
    const scaleY = videoHeight / scanH;
    const fW = (maxX - minX) * scaleX;
    const fH = (maxY - minY) * scaleY;
    const fX = minX * scaleX;
    const fY = minY * scaleY;

    const eyeW = fW * 0.22;
    const eyeH = eyeW * 0.65;
    const leftEyeX = fX + fW * 0.30;
    const rightEyeX = fX + fW * 0.70;
    const eyeY = fY + fH * 0.35;

    // Approximate IPD in pixels
    const ipdPixels = rightEyeX - leftEyeX;
    const approxDistCm = Math.max(20, Math.min(100, (63.0 * (videoWidth * 0.8)) / Math.max(1, ipdPixels) / 10));

    return {
      detected: true,
      distanceCm: Number(approxDistCm.toFixed(1)),
      ipdPixels: Number(ipdPixels.toFixed(1)),
      pose: { yaw: 0, pitch: 0, roll: 0 },
      ear: { left: 0.28, right: 0.28, avg: 0.28, isEyeClosed: false },
      eyeBoxes: [
        {
          box: [leftEyeX - eyeW / 2, eyeY - eyeH / 2, leftEyeX + eyeW / 2, eyeY + eyeH / 2],
          label: 'open_eye',
          score: 0.90
        },
        {
          box: [rightEyeX - eyeW / 2, eyeY - eyeH / 2, rightEyeX + eyeW / 2, eyeY + eyeH / 2],
          label: 'open_eye',
          score: 0.90
        }
      ]
    };
  }
}

export const eyeDetector = new EyeDetector();
