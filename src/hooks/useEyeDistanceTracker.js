// React Hook for Realtime MediaPipe 3D Landmark Tracking & PnP Metric Distance Estimation
import { useState, useEffect, useRef } from 'react';
import { eyeDetector } from '../services/eyeDetector.js';
import { distanceEstimator } from '../services/distanceEstimator.js';
import { safetyLogic } from '../services/safetyLogic.js';

export function useEyeDistanceTracker(videoRef, isEnabled = true) {
  const [eyeData, setEyeData] = useState({
    detected: false,
    eye_boxes: [],
    eye_labels: [],
    distance_cm: null,
    eye_box_size: null,
    safe_distance_cm: 50.0,
    ratio_to_safe: null,
    pose: { yaw: 0, pitch: 0, roll: 0 },
    ear: { avg: 0.28, isEyeClosed: false },
    status: 'unknown'
  });

  const [inferenceMode, setInferenceMode] = useState('mediapipe_pnp');
  const [fps, setFps] = useState(30);

  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const isProcessingRef = useRef(false);

  // Main 60 FPS Real-time Inference Loop
  useEffect(() => {
    if (!isEnabled) {
      safetyLogic.reset();
      setEyeData({
        detected: false,
        eye_boxes: [],
        eye_labels: [],
        distance_cm: null,
        eye_box_size: null,
        safe_distance_cm: 50.0,
        ratio_to_safe: null,
        pose: { yaw: 0, pitch: 0, roll: 0 },
        ear: { avg: 0.28, isEyeClosed: false },
        status: 'unknown'
      });
      return;
    }

    let animId;
    let isMounted = true;

    const processFrame = async () => {
      if (!isMounted) return;

      const video = videoRef?.current;

      if (video && video.readyState >= 2 && video.videoWidth > 0 && !isProcessingRef.current) {
        isProcessingRef.current = true;

        try {
          // 1. Detect 478 Face Landmarks with Google MediaPipe & Solve PnP
          const detection = await eyeDetector.detectEyes(video);
          
          if (detection.inferenceMode !== inferenceMode) {
            setInferenceMode(detection.inferenceMode);
          }

          // 2. Compute Metric Distance & EMA Smoothing
          const metricData = distanceEstimator.processMetricDetection({
            eyeBoxes: detection.eyeBoxes,
            distanceCm: detection.distanceCm
          });

          // 3. Evaluate Safety Status with Centimeter-based Hysteresis & Debounce
          const safetyOutput = safetyLogic.evaluate({
            detected: detection.detected,
            eyeBoxes: detection.eyeBoxes,
            distanceCm: metricData.distanceCm,
            smoothedBoxSize: metricData.smoothedBoxSize,
            safeBoxSize: metricData.safeBoxSize,
            safeDistanceCm: metricData.safeDistanceCm,
            ratioToSafe: metricData.ratioToSafe,
            pose: detection.pose,
            ear: detection.ear
          });

          if (isMounted) {
            setEyeData(safetyOutput);

            // FPS Counter
            frameCountRef.current++;
            const now = Date.now();
            if (now - lastFpsTimeRef.current >= 1000) {
              setFps(frameCountRef.current);
              frameCountRef.current = 0;
              lastFpsTimeRef.current = now;
            }
          }
        } catch (err) {
          console.warn('Frame processing error:', err);
        } finally {
          isProcessingRef.current = false;
        }
      }

      if (isMounted) {
        animId = requestAnimationFrame(processFrame);
      }
    };

    animId = requestAnimationFrame(processFrame);

    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isEnabled, videoRef, inferenceMode]);

  return {
    eyeData,
    inferenceMode,
    fps
  };
}
