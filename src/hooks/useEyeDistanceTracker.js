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
    eyeOscillationsPerSec: 0,
    status: 'unknown'
  });

  const [inferenceMode, setInferenceMode] = useState('mediapipe_pnp');
  const [fps, setFps] = useState(30);

  const inferenceModeRef = useRef('mediapipe_pnp');
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const isProcessingRef = useRef(false);
  const wasEnabledRef = useRef(false);

  // Eye micro-movement & oscillation tracking
  const prevEyePosRef = useRef(null);
  const oscillationTimestampsRef = useRef([]);
  const lastOscReportTimeRef = useRef(0);
  const currentOscRateRef = useRef(0);

  // Main 60 FPS Real-time Inference Loop
  useEffect(() => {
    if (!isEnabled) {
      if (wasEnabledRef.current) {
        wasEnabledRef.current = false;
        safetyLogic.reset();
        prevEyePosRef.current = null;
        oscillationTimestampsRef.current = [];
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
          eyeOscillationsPerSec: 0,
          status: 'unknown'
        });
      }
      return;
    }

    wasEnabledRef.current = true;
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
          
          if (detection.inferenceMode && detection.inferenceMode !== inferenceModeRef.current) {
            inferenceModeRef.current = detection.inferenceMode;
            setInferenceMode(detection.inferenceMode);
          }

          // Compute real eye oscillations / saccades per second
          const now = performance.now();
          if (detection.detected && detection.eyeBoxes && detection.eyeBoxes.length > 0) {
            const b = detection.eyeBoxes[0].box;
            const cx = (b[0] + b[2]) / 2;
            const cy = (b[1] + b[3]) / 2;

            if (prevEyePosRef.current) {
              const dx = cx - prevEyePosRef.current.x;
              const dy = cy - prevEyePosRef.current.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist >= 2.0 && (now - prevEyePosRef.current.time) > 40) {
                oscillationTimestampsRef.current.push(now);
              }
            }
            prevEyePosRef.current = { x: cx, y: cy, time: now };

            // Prune timestamps older than 1500ms
            oscillationTimestampsRef.current = oscillationTimestampsRef.current.filter(t => now - t <= 1500);
            
            // Throttled update of oscillation rate
            if (now - lastOscReportTimeRef.current >= 300) {
              lastOscReportTimeRef.current = now;
              currentOscRateRef.current = Number((oscillationTimestampsRef.current.length / 1.5).toFixed(1));
            }
          } else {
            prevEyePosRef.current = null;
            if (now - lastOscReportTimeRef.current >= 500) {
              lastOscReportTimeRef.current = now;
              currentOscRateRef.current = 0;
            }
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
            setEyeData({
              ...safetyOutput,
              eyeOscillationsPerSec: currentOscRateRef.current
            });

            // FPS Counter
            frameCountRef.current++;
            const nowTs = Date.now();
            if (nowTs - lastFpsTimeRef.current >= 1000) {
              setFps(frameCountRef.current);
              frameCountRef.current = 0;
              lastFpsTimeRef.current = nowTs;
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
  }, [isEnabled, videoRef]);

  return {
    eyeData,
    inferenceMode,
    fps
  };
}
