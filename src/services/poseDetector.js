// PoseDetector service using MediaPipe Tasks-Vision PoseLandmarker & FaceLandmarker
import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';

export class PoseDetector {
  constructor() {
    this.poseLandmarker = null;
    this.faceLandmarker = null;
    this.isModelLoaded = false;
    this.isFaceModelLoaded = false;
    this.isLoadingModel = false;
    this.lastVideoTime = -1;
    this.lastFaceSeenTime = 0;
    this.lastUpwardMotionTime = 0;
    this.lastKnownNoseY = null;
    this.lastKnownPitch = 0;
    this.isCeilingStretchActive = false;
    this.ceilingStretchStartTime = 0;
    this.baselineShoulderY = null;
    this.baselineFaceX = null;
    this.initMediaPipe();
  }

  async initMediaPipe() {
    if (this.isModelLoaded || this.isLoadingModel) return;
    this.isLoadingModel = true;

    try {
      console.log('🔄 Loading Google MediaPipe Pose & Face Landmarkers for Workout & Head Tracking...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // 1. Initialize Pose Landmarker (33 body landmarks)
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      this.isModelLoaded = true;
      console.log('✅ MediaPipe Pose Landmarker loaded (33 Body Landmarks)');

      // 2. Initialize Face Landmarker (478 3D landmarks) for high-precision Head & Neck Euler Pose
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        this.isFaceModelLoaded = true;
        console.log('✅ MediaPipe Face Landmarker loaded for Head Pose mesh tracking');
      } catch (faceErr) {
        console.warn('⚠️ FaceLandmarker GPU failed, attempting CPU fallback:', faceErr);
        try {
          this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numFaces: 1
          });
          this.isFaceModelLoaded = true;
          console.log('✅ MediaPipe Face Landmarker loaded in CPU mode');
        } catch (cpuFaceErr) {
          console.warn('⚠️ FaceLandmarker could not be loaded, using Pose fallback for neck:', cpuFaceErr);
          this.isFaceModelLoaded = false;
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not load PoseLandmarker with GPU, trying CPU mode:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1
        });
        this.isModelLoaded = true;
        console.log('✅ PoseLandmarker loaded in CPU mode');
      } catch (cpuErr) {
        console.error('❌ Failed to load PoseLandmarker:', cpuErr);
        this.isModelLoaded = false;
      }
    } finally {
      this.isLoadingModel = false;
    }
  }

  // Calculate 2D/3D angle between 3 points in degrees
  calculateAngle(pointA, pointB, pointC) {
    if (!pointA || !pointB || !pointC) return 180;
    const radians = Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x) -
                    Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return angle;
  }

  /**
   * Compute Head Pose Euler Angles (pitch, yaw, roll in degrees) from 478 Face Landmarks
   * Key Face Mesh Indices:
   * 1: Nose tip
   * 152: Chin (Menton)
   * 10: Forehead / Trichion
   * 168: Glabella (between eyebrows)
   * 33: Left eye outer corner
   * 263: Right eye outer corner
   */
  computeFaceMeshHeadPose(faceLm) {
    if (!faceLm || faceLm.length < 400) return null;

    const noseTip = faceLm[1];
    const chin = faceLm[152];
    const glabella = faceLm[168] || faceLm[10];
    const forehead = faceLm[10];
    const lEyeOuter = faceLm[33];
    const rEyeOuter = faceLm[263];

    if (!noseTip || !chin || !glabella || !lEyeOuter || !rEyeOuter) return null;

    // 1. Yaw (Left / Right Turn):
    // 2D horizontal ratio between nose tip and eye corners
    const distToLeft = Math.abs(noseTip.x - lEyeOuter.x);
    const distToRight = Math.abs(rEyeOuter.x - noseTip.x);
    const yawRatio = (distToLeft - distToRight) / Math.max(0.001, (distToLeft + distToRight));
    let yawDeg = yawRatio * 75;

    // Enhance Yaw with 3D Z-depth difference between left and right eye if available
    if (typeof lEyeOuter.z === 'number' && typeof rEyeOuter.z === 'number') {
      const zDiffYaw = (rEyeOuter.z - lEyeOuter.z) * 110;
      yawDeg = yawDeg * 0.6 + zDiffYaw * 0.4;
    }
    const finalYaw = Math.round(yawDeg);

    // 2. Pitch (Up / Down Extension):
    // Compare nose-glabella vs nose-chin vertical spans
    const distToGlabella = Math.abs(noseTip.y - glabella.y);
    const distToChin = Math.abs(chin.y - noseTip.y);
    const verticalSpan = Math.abs(chin.y - (forehead ? forehead.y : glabella.y));
    
    // Natural resting ratio has nose slightly closer to glabella than chin (~1.1 to 1.25)
    const pitchRatio = (distToChin - distToGlabella * 1.15) / Math.max(0.001, verticalSpan);
    let pitchDeg = pitchRatio * 55;

    // In MediaPipe 3D face mesh, when user tilts head up, nose tip z becomes significantly more negative (closer to camera)
    // compared to glabella/chin
    if (typeof noseTip.z === 'number' && typeof chin.z === 'number' && typeof glabella.z === 'number') {
      const midZ = (chin.z + glabella.z) / 2;
      const zDeltaPitch = (midZ - noseTip.z) * 130;
      pitchDeg = pitchDeg * 0.5 + zDeltaPitch * 0.5;
    }
    const finalPitch = Math.round(pitchDeg);

    // 3. Roll (Lateral Tilt): angle of eye line relative to horizontal plane
    const dx = rEyeOuter.x - lEyeOuter.x;
    const dy = rEyeOuter.y - lEyeOuter.y;
    const rollDeg = Math.round(Math.atan2(dy, dx) * (180 / Math.PI));

    return {
      pitch: finalPitch,
      yaw: finalYaw,
      roll: rollDeg
    };
  }

  detectPose(videoElement, targetExercise = null) {
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return { detected: false, landmarks: null, faceLandmarks: null, headPose: null, recognizedExercise: null, confidence: 0 };
    }

    if (!this.poseLandmarker || !this.isModelLoaded) {
      return { detected: false, landmarks: null, faceLandmarks: null, headPose: null, recognizedExercise: null, confidence: 0, loading: this.isLoadingModel };
    }

    const currentTime = videoElement.currentTime;
    if (currentTime === this.lastVideoTime) {
      return this.lastResult || { detected: false, landmarks: null, faceLandmarks: null, headPose: null, recognizedExercise: null, confidence: 0 };
    }
    this.lastVideoTime = currentTime;

    try {
      const now = performance.now();
      const poseResults = this.poseLandmarker.detectForVideo(videoElement, now);
      
      let faceHeadPose = null;
      let faceLandmarks = null;

      // Also detect Face Landmarker for milliradian-accurate head kinematics if loaded
      if (this.faceLandmarker && this.isFaceModelLoaded) {
        try {
          const faceResults = this.faceLandmarker.detectForVideo(videoElement, now);
          if (faceResults && faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
            faceLandmarks = faceResults.faceLandmarks[0];
            faceHeadPose = this.computeFaceMeshHeadPose(faceLandmarks);
          }
        } catch (faceErr) {
          // Non-blocking face mesh inference error
        }
      }

      const hasBodyLandmarks = poseResults && poseResults.landmarks && poseResults.landmarks.length > 0;
      const landmarks = hasBodyLandmarks ? poseResults.landmarks[0] : null;

      // Update kinematic history when face or body is visible
      if (faceLandmarks && faceLandmarks[1]) {
        const noseY = faceLandmarks[1].y;
        if (this.lastKnownNoseY !== null && noseY < this.lastKnownNoseY - 0.006) {
          this.lastUpwardMotionTime = now;
        }
        this.lastKnownNoseY = noseY;
      } else if (landmarks && landmarks[0]) {
        const noseY = landmarks[0].y;
        if (this.lastKnownNoseY !== null && noseY < this.lastKnownNoseY - 0.006) {
          this.lastUpwardMotionTime = now;
        }
        this.lastKnownNoseY = noseY;
      }

      if (faceHeadPose) {
        this.lastFaceSeenTime = now;
        this.lastKnownPitch = faceHeadPose.pitch;
        if (faceHeadPose.pitch > 5) {
          this.lastUpwardMotionTime = now;
        }
        // If face returned and is looking back straight (pitch < 5), cancel ceiling stretch state
        if (faceHeadPose.pitch < 5 && Math.abs(faceHeadPose.yaw) < 14) {
          this.isCeilingStretchActive = false;
          this.ceilingStretchStartTime = 0;
        }
      } else if (landmarks) {
        this.lastFaceSeenTime = now;
      }

      // Update adaptive baseline for shoulders and face to make desktop detection super responsive
      if (landmarks) {
        const lSh = landmarks[11], rSh = landmarks[12];
        if (lSh && rSh && (lSh.visibility || 1) > 0.35 && (rSh.visibility || 1) > 0.35) {
          const currentShY = (lSh.y + rSh.y) / 2;
          if (this.baselineShoulderY === null) {
            this.baselineShoulderY = currentShY;
          } else {
            // When shoulders are low/relaxed, update baseline quickly
            if (currentShY > this.baselineShoulderY) {
              this.baselineShoulderY = this.baselineShoulderY * 0.85 + currentShY * 0.15;
            } else {
              // When shoulders are lifted (shrug), update baseline very slowly so shrug doesn't cancel
              this.baselineShoulderY = this.baselineShoulderY * 0.994 + currentShY * 0.006;
            }
          }
        }

        const nosePt = landmarks[0];
        if (nosePt && (nosePt.visibility || 1) > 0.35) {
          if (this.baselineFaceX === null) {
            this.baselineFaceX = nosePt.x;
          } else {
            this.baselineFaceX = this.baselineFaceX * 0.96 + nosePt.x * 0.04;
          }
        }
      } else if (faceLandmarks && faceLandmarks[1]) {
        const nosePt = faceLandmarks[1];
        if (this.baselineFaceX === null) {
          this.baselineFaceX = nosePt.x;
        } else {
          this.baselineFaceX = this.baselineFaceX * 0.96 + nosePt.x * 0.04;
        }
      }

      // Classify exercises: supports both full body and desk-seated face-only tracking
      if (landmarks || faceHeadPose) {
        const classification = this.classifyExercise(landmarks, faceHeadPose, targetExercise);

        this.lastResult = {
          detected: true,
          landmarks,
          faceLandmarks,
          headPose: faceHeadPose,
          recognizedExercise: classification.exercise,
          exerciseName: classification.name,
          confidence: classification.confidence,
          metrics: classification.metrics
        };
        return this.lastResult;
      }

      // SMART FALLBACK FOR NECK EXTENSION (Ceiling Look):
      // Only allowed if neck_up is the current target or if no target is specified
      const isNeckTargetOrGeneral = !targetExercise || targetExercise === 'neck_up';
      const wasRecentFace = (now - this.lastFaceSeenTime) < 2500;
      const hadUpwardMotion = (now - this.lastUpwardMotionTime) < 2200;
      const hadPositivePitch = this.lastKnownPitch > 4;
      const wasCenteredVertically = this.lastKnownNoseY !== null && this.lastKnownNoseY < 0.65;

      if (isNeckTargetOrGeneral && (this.isCeilingStretchActive || (wasRecentFace && (hadUpwardMotion || hadPositivePitch || wasCenteredVertically)))) {
        if (!this.isCeilingStretchActive) {
          this.isCeilingStretchActive = true;
          this.ceilingStretchStartTime = now;
        }

        const elapsed = now - this.ceilingStretchStartTime;
        if (elapsed <= 4500) {
          this.lastResult = {
            detected: true,
            landmarks: null,
            faceLandmarks: null,
            headPose: { pitch: 35, yaw: 0, roll: 0 },
            recognizedExercise: 'neck_up',
            exerciseName: 'Neck Extension (Looking Up at Ceiling)',
            confidence: 0.95,
            metrics: { ceilingHold: true, elapsed }
          };
          return this.lastResult;
        } else {
          // Timeout after 4.5s max hold
          this.isCeilingStretchActive = false;
          this.ceilingStretchStartTime = 0;
        }
      }
    } catch (e) {
      console.warn('Pose estimation frame error:', e);
    }

    this.lastResult = { detected: false, landmarks: null, faceLandmarks: null, headPose: null, recognizedExercise: null, confidence: 0 };
    return this.lastResult;
  }

  /**
   * Classify exercise from 33 body landmarks + optional 3D Face Landmarker Head Pose
   * Landmark Indices in MediaPipe Pose:
   * 11: left_shoulder, 12: right_shoulder
   * 13: left_elbow,    14: right_elbow
   * 15: left_wrist,    16: right_wrist
   * 23: left_hip,      24: right_hip
   * 25: left_knee,     26: right_knee
   * 27: left_ankle,    28: right_ankle
   */
  classifyExercise(lm, headPose = null, targetExercise = null) {
    // If only head pose is available (e.g. user sitting close to webcam at desk)
    if (!lm) {
      if (headPose) {
        const { pitch, roll, yaw } = headPose;
        // Neck extension: pitch >= +14 deg (leeway at 12)
        if ((!targetExercise || targetExercise === 'neck_up') && pitch >= 12) {
          this.isCeilingStretchActive = true;
          if (!this.ceilingStretchStartTime) this.ceilingStretchStartTime = performance.now();
          return { exercise: 'neck_up', name: 'Neck Extension (Look Up)', confidence: 0.95, metrics: { pitch, yaw, roll } };
        }
        // Neck tilt: ear to shoulder (roll >= 10 deg)
        if ((!targetExercise || targetExercise === 'neck_tilt') && Math.abs(roll) >= 10) {
          return { exercise: 'neck_tilt', name: 'Neck Tilt (Ear to Shoulder)', confidence: 0.94, metrics: { pitch, yaw, roll } };
        }
        // Neck turn: face axis shifts left/right (yaw >= 10 deg)
        if ((!targetExercise || targetExercise === 'neck_turn') && Math.abs(yaw) >= 10 && Math.abs(roll) <= 22) {
          return { exercise: 'neck_turn', name: 'Neck Turn (Look Left/Right)', confidence: 0.94, metrics: { pitch, yaw, roll } };
        }
      }
      return { exercise: null, name: 'Tracking head movement...', confidence: 0, metrics: {} };
    }

    const nose = lm[0];
    const lEye = lm[2], rEye = lm[5];
    const lEar = lm[7], rEar = lm[8];
    const lShoulder = lm[11], rShoulder = lm[12];
    const lElbow = lm[13], rElbow = lm[14];
    const lWrist = lm[15], rWrist = lm[16];
    const lHip = lm[23], rHip = lm[24];
    const lKnee = lm[25], rKnee = lm[26];
    const lAnkle = lm[27], rAnkle = lm[28];

    // Reference head & shoulder levels
    const midEarY = (lEar && rEar) ? (lEar.y + rEar.y) / 2 : (nose ? nose.y + 0.04 : null);
    const midShoulderY = (lShoulder && rShoulder) ? (lShoulder.y + rShoulder.y) / 2 : (lShoulder?.y || rShoulder?.y || null);
    const midShoulderX = (lShoulder && rShoulder) ? (lShoulder.x + rShoulder.x) / 2 : (lShoulder?.x || rShoulder?.x || 0.5);

    // Helper: kiểm tra xem điểm landmark có thực sự hiện diện và nhìn thấy rõ ràng trên camera hay không
    const isPtVisible = (pt, minVis = 0.42) => {
      if (!pt) return false;
      const visOk = (pt.visibility === undefined || pt.visibility >= minVis);
      const presOk = (pt.presence === undefined || pt.presence >= minVis);
      const inBounds = pt.x >= 0.01 && pt.x <= 0.99 && pt.y >= 0.01 && pt.y <= 0.97;
      return visOk && presOk && inBounds;
    };

    // Kiểm tra tay trái và tay phải có thực sự xuất hiện trên camera hay không
    // Cần cả cổ tay và khuỷu tay cùng xuất hiện trong khung hình camera
    const hasLeftArm = Boolean(lShoulder && lElbow && lWrist && isPtVisible(lElbow, 0.42) && isPtVisible(lWrist, 0.42));
    const hasRightArm = Boolean(rShoulder && rElbow && rWrist && isPtVisible(rElbow, 0.42) && isPtVisible(rWrist, 0.42));
    const hasAnyArm = hasLeftArm || hasRightArm;

    // CHỈ tính góc khuỷu tay khi tay thực sự xuất hiện trên camera, tuyệt đối KHÔNG tính góc bừa khi không có tay trên màn hình
    const lElbowAngle = hasLeftArm ? this.calculateAngle(lShoulder, lElbow, lWrist) : null;
    const rElbowAngle = hasRightArm ? this.calculateAngle(rShoulder, rElbow, rWrist) : null;

    const elbowAngles = [lElbowAngle, rElbowAngle].filter(a => a !== null && typeof a === 'number');
    const minElbowAngle = elbowAngles.length > 0 ? Math.min(...elbowAngles) : null;
    const maxElbowAngle = elbowAngles.length > 0 ? Math.max(...elbowAngles) : null;
    const avgElbowAngle = elbowAngles.length > 0 ? (elbowAngles.reduce((a, b) => a + b, 0) / elbowAngles.length) : null;

    const hasHips = Boolean(lHip && rHip && (lHip.visibility || 1) > 0.3 && (rHip.visibility || 1) > 0.3);
    const midHipY = hasHips ? (lHip.y + rHip.y) / 2 : (midShoulderY ? midShoulderY + 0.35 : null);
    const midHipX = hasHips ? (lHip.x + rHip.x) / 2 : midShoulderX;
    const torsoHorizontalDist = (midShoulderX && midHipX) ? Math.abs(midShoulderX - midHipX) : 0;

    const lShoulderAngle = (hasHips && lShoulder && lElbow && hasLeftArm) ? this.calculateAngle(lHip, lShoulder, lElbow) : null;
    const rShoulderAngle = (hasHips && rShoulder && rElbow && hasRightArm) ? this.calculateAngle(rHip, rShoulder, rElbow) : null;
    const lKneeAngle = (hasHips && lKnee && lAnkle) ? this.calculateAngle(lHip, lKnee, lAnkle) : null;
    const rKneeAngle = (hasHips && rKnee && rAnkle) ? this.calculateAngle(rHip, rKnee, rAnkle) : null;
    const lHipAngle = (hasHips && lShoulder && lKnee) ? this.calculateAngle(lShoulder, lHip, lKnee) : null;
    const rHipAngle = (hasHips && rShoulder && rKnee) ? this.calculateAngle(rShoulder, rHip, rKnee) : null;

    // 1. Upward Neck Extension: Head tilted back to look upward ("p + 14 độ là tính được rồi")
    let isNeckUp = false;
    if (headPose) {
      isNeckUp = headPose.pitch >= 12; // pitch >= 14 deg with forgiving margin
    } else {
      isNeckUp = Boolean(nose && midEarY !== null && (nose.y < midEarY - 0.015));
      if (!isNeckUp && lShoulder && rShoulder && (lShoulder.visibility || 1) > 0.4 && (rShoulder.visibility || 1) > 0.4) {
        if (!nose || (nose.visibility && nose.visibility < 0.45) || (nose.y < Math.min(lShoulder.y, rShoulder.y) - 0.18)) {
          isNeckUp = true;
        }
      }
    }

    if (isNeckUp) {
      this.isCeilingStretchActive = true;
      if (!this.ceilingStretchStartTime) this.ceilingStretchStartTime = performance.now();
    }

    // 2. Neck Tilt: "tai chỉ cần gần vai hơn bình thường... tạo vs khung vai 1 góc nhỏ hơn 70 độ là đc"
    let isNeckTilt = false;
    let earDeltaY = 0;
    if (headPose && Math.abs(headPose.roll) >= 10) {
      isNeckTilt = true;
    } else {
      let angleWithShoulderDev = 0;
      if (lShoulder && rShoulder && (lEar || nose)) {
        const shoulderAngle = Math.atan2(rShoulder.y - lShoulder.y, rShoulder.x - lShoulder.x);
        const headTop = nose || { x: (lEar.x + rEar.x) / 2, y: Math.min(lEar.y, rEar.y) };
        const headBottom = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
        const headAngle = Math.atan2(headTop.y - headBottom.y, headTop.x - headBottom.x);
        const diffDeg = Math.abs((headAngle - shoulderAngle) * (180 / Math.PI)) % 180;
        angleWithShoulderDev = Math.abs(diffDeg - 90);
      }
      const earDiff = (lEar && rEar && lShoulder && rShoulder) 
        ? Math.abs(Math.abs(lShoulder.y - lEar.y) - Math.abs(rShoulder.y - rEar.y)) 
        : 0;
      earDeltaY = (lEar && rEar) ? Math.abs(lEar.y - rEar.y) : 0;
      isNeckTilt = angleWithShoulderDev >= 18 || earDiff > 0.025 || earDeltaY > 0.03 || (Math.abs(headPose?.roll || 0) >= 8);
    }

    // 3. Neck Turn: "chỉ cần trục mặt dịch sang phải sang trái một đoạn so với ban đầu là được"
    let isNeckTurn = false;
    if (headPose && Math.abs(headPose.yaw) >= 10 && Math.abs(headPose.roll || 0) <= 22) {
      isNeckTurn = true;
    } else {
      const faceShiftFromMid = (nose && midShoulderX) ? Math.abs(nose.x - midShoulderX) : 0;
      const faceShiftFromBaseline = (nose && this.baselineFaceX !== null) ? Math.abs(nose.x - this.baselineFaceX) : 0;
      const distToLeftEar = (nose && lEar) ? Math.abs(nose.x - lEar.x) : 0;
      const distToRightEar = (nose && rEar) ? Math.abs(nose.x - rEar.x) : 0;
      const earRatio = (distToLeftEar > 0 && distToRightEar > 0) 
        ? Math.max(distToLeftEar / distToRightEar, distToRightEar / distToLeftEar) 
        : 1;
      isNeckTurn = !isNeckTilt && (faceShiftFromBaseline > 0.03 || faceShiftFromMid > 0.035 || earRatio > 1.35);
    }

    // 4. Overhead Reach: Hands or elbows raised up high
    const isOverheadReach = Boolean(
      hasAnyArm && (
        (hasLeftArm && hasRightArm && lWrist.y < lShoulder.y - 0.08 && rWrist.y < lShoulder.y - 0.08) ||
        (hasLeftArm && nose && lWrist.y < nose.y - 0.03) ||
        (hasRightArm && nose && rWrist.y < nose.y - 0.03)
      )
    );

    // 5. Lateral Raise (Dang tay ngang): 2 tay và vai tạo thành đường thẳng ngang
    // Calculate bounding box width independent of mirror/orientation
    const minShoulderX = (lShoulder && rShoulder) ? Math.min(lShoulder.x, rShoulder.x) : 0.4;
    const maxShoulderX = (lShoulder && rShoulder) ? Math.max(lShoulder.x, rShoulder.x) : 0.6;
    const shoulderWidth = Math.max(0.12, maxShoulderX - minShoulderX);

    const minElbowX = (lElbow && rElbow) ? Math.min(lElbow.x, rElbow.x) : null;
    const maxElbowX = (lElbow && rElbow) ? Math.max(lElbow.x, rElbow.x) : null;
    const elbowSpan = (minElbowX !== null && maxElbowX !== null) ? (maxElbowX - minElbowX) : 0;

    const minWristX = (lWrist && rWrist) ? Math.min(lWrist.x, rWrist.x) : null;
    const maxWristX = (lWrist && rWrist) ? Math.max(lWrist.x, rWrist.x) : null;
    const wristSpan = (minWristX !== null && maxWristX !== null) ? (maxWristX - minWristX) : 0;

    // Arms spread wide horizontally beyond shoulders
    const elbowsSpread = (minElbowX !== null && minElbowX < minShoulderX - 0.05 && maxElbowX > maxShoulderX + 0.05) || (elbowSpan > shoulderWidth * 1.35);
    const wristsSpread = (minWristX !== null && minWristX < minShoulderX - 0.12 && maxWristX > maxShoulderX + 0.12) || (wristSpan > shoulderWidth * 1.55);
    const armsSpread = elbowsSpread || wristsSpread;

    // Arms roughly at shoulder level (horizontal)
    const elbowsAtShoulderLevel = Boolean(
      lElbow && rElbow && lShoulder && rShoulder &&
      Math.abs(lElbow.y - lShoulder.y) < 0.22 && Math.abs(rElbow.y - rShoulder.y) < 0.22
    );
    const wristsAtShoulderLevel = Boolean(
      lWrist && rWrist && lShoulder && rShoulder &&
      Math.abs(lWrist.y - lShoulder.y) < 0.24 && Math.abs(rWrist.y - rShoulder.y) < 0.24
    );
    const armsHorizontalY = elbowsAtShoulderLevel || wristsAtShoulderLevel;

    // Arms straight (not curled or hugging)
    const armsStraight = (!lElbowAngle || lElbowAngle > 105) && (!rElbowAngle || rElbowAngle > 105);

    const isLateralRaise = Boolean(hasLeftArm && hasRightArm && !isNeckUp && !isOverheadReach && armsHorizontalY && armsSpread && armsStraight);

    // 6. Chest Hug / Arm Cross: Arms or hands actually crossed over chest (not typing or resting seated)
    const wristsAtChestLevel = Boolean(
      midShoulderY && lWrist && rWrist &&
      lWrist.y >= midShoulderY - 0.08 && lWrist.y <= midShoulderY + 0.28 &&
      rWrist.y >= midShoulderY - 0.08 && rWrist.y <= midShoulderY + 0.28
    );
    const elbowsFlexedForHug = Boolean(
      (!lElbowAngle || lElbowAngle < 115) &&
      (!rElbowAngle || rElbowAngle < 115)
    );
    const handsActuallyCrossed = Boolean(
      lWrist && rWrist && (
        // Wrists cross past each other horizontally in front of chest
        (lWrist.x > rWrist.x) ||
        // Hands placed on opposite shoulders
        (rShoulder && Math.hypot(lWrist.x - rShoulder.x, lWrist.y - rShoulder.y) < 0.22) ||
        (lShoulder && Math.hypot(rWrist.x - lShoulder.x, rWrist.y - lShoulder.y) < 0.22) ||
        // Both hands crossed right in the center of the chest
        (Math.abs(lWrist.x - midShoulderX) < 0.10 && Math.abs(rWrist.x - midShoulderX) < 0.10 && Math.abs(lWrist.y - rWrist.y) < 0.12)
      )
    );
    const isChestHug = Boolean(hasLeftArm && hasRightArm && !isNeckUp && !isOverheadReach && !isLateralRaise && wristsAtChestLevel && elbowsFlexedForHug && handsActuallyCrossed);

    // 7. Shoulder Shrugs (Nhún vai): Cân bằng khoảng cách từ trục vai đến cằm/tai và độ nhấc vai
    const lEarDist = (lEar && lShoulder) ? Math.abs(lShoulder.y - lEar.y) : ((nose && lShoulder) ? Math.abs(lShoulder.y - nose.y) - 0.04 : 999);
    const rEarDist = (rEar && rShoulder) ? Math.abs(rShoulder.y - rEar.y) : ((nose && rShoulder) ? Math.abs(rShoulder.y - nose.y) - 0.04 : 999);
    const shoulderChinDist = (midShoulderY !== null && nose) ? (midShoulderY - nose.y) : 999;
    const shoulderChinRatio = shoulderWidth > 0 ? (shoulderChinDist / shoulderWidth) : 1;

    // Vai nhấc lên so với tư thế ngồi nghỉ bình thường (baseline):
    // >= 0.016 loại bỏ hoàn toàn rung lắc tự nhiên khi thở/ngồi yên, nhưng đủ nhạy để nhận ra cú nhún vai
    const shoulderLift = (this.baselineShoulderY !== null && midShoulderY !== null) ? (this.baselineShoulderY - midShoulderY) : 0;
    const isShoulderRaisedRelative = shoulderLift >= 0.016;

    // Khoảng cách từ vai tới cằm/tai thu hẹp khi nhún vai:
    const isShoulderCloseToHead = (shoulderChinDist < 0.205) || (lEarDist < 0.195 || rEarDist < 0.195) || (shoulderChinRatio < 0.70);

    const isShoulderShrug = !isNeckUp && !isOverheadReach && !isLateralRaise && (
      (isShoulderRaisedRelative && (shoulderChinDist < 0.25 || lEarDist < 0.23 || rEarDist < 0.23)) ||
      (isShoulderCloseToHead && shoulderLift >= 0.008) ||
      (shoulderChinDist < 0.188)
    );

    // Wrist to Head distance: used to distinguish Squat Hold vs Bicep Curl Hold
    const headPtY = nose ? nose.y : (midEarY || (midShoulderY ? midShoulderY - 0.2 : 0.25));
    const headPtX = nose ? nose.x : midShoulderX;
    const lWDist = (lWrist && headPtY !== null) ? Math.hypot(lWrist.x - headPtX, lWrist.y - headPtY) : 999;
    const rWDist = (rWrist && headPtY !== null) ? Math.hypot(rWrist.x - headPtX, rWrist.y - headPtY) : 999;
    const validDists = [lWDist, rWDist].filter(d => d < 900);
    const avgWristHeadDist = validDists.length > 0 ? validDists.reduce((a, b) => a + b, 0) / validDists.length : 999;

    // 8. Squat Hold vs 9. Bicep Curl Hold:
    // CHỈ TÍNH VÀ NHẬN DIỆN KHI CÓ TAY TRÊN CAMERA:
    // - Bicep Curl: CÓ TAY TRÊN CAM và góc khuỷu tay > 50 độ (và < 155 độ)
    // - Squat Hold: CÓ TAY TRÊN CAM và góc khuỷu tay <= 50 độ HOẶC khuỵu gối
    const isKneesBent = Boolean(
      hasHips && (
        ((lKneeAngle !== null && lKneeAngle > 40 && lKneeAngle < 145) || (rKneeAngle !== null && rKneeAngle > 40 && rKneeAngle < 145))
      )
    );

    // Squat với tay: Khi có tay trên cam, góc khuỷu tay <= 50 độ
    const isElbowsSquat = Boolean(hasAnyArm && elbowAngles.some(angle => angle <= 50));
    const isSquat = (isElbowsSquat || isKneesBent) && !isOverheadReach;

    // Bicep Curl: Khi có tay trên cam, có ít nhất một cánh tay có góc khuỷu > 50 độ (và < 155 độ)
    const isElbowsBicep = Boolean(
      hasAnyArm &&
      elbowAngles.some(angle => angle > 50 && angle < 155)
    );
    const isHammerCurl = isElbowsBicep && !isElbowsSquat && !isOverheadReach && !isLateralRaise;

    // Tìm góc đo đại diện thích hợp để hiển thị cho người dùng:
    const activeCurlAngle = (elbowAngles.find(a => a > 50 && a < 155) !== undefined)
      ? elbowAngles.find(a => a > 50 && a < 155)
      : (minElbowAngle || avgElbowAngle || null);

    const activeSquatElbowAngle = (elbowAngles.find(a => a <= 50) !== undefined)
      ? elbowAngles.find(a => a <= 50)
      : (minElbowAngle || null);

    // Plank / Push-up: Body is horizontal
    const isBodyHorizontal = (torsoHorizontalDist > 0.15 || (midShoulderY && midHipY && Math.abs(midShoulderY - midHipY) < 0.22));
    const isPushUp = isBodyHorizontal && ((lElbowAngle !== null && lElbowAngle < 115) || (rElbowAngle !== null && rElbowAngle < 115));
    const isPlank = isBodyHorizontal && !isPushUp && lElbow && midShoulderY && (Math.abs(lElbow.y - midShoulderY) < 0.22);

    // Russian Twist
    const isRussianTwist = Boolean(
      hasHips &&
      (lHipAngle !== null && lHipAngle >= 70 && lHipAngle <= 140) &&
      (lKneeAngle !== null && lKneeAngle >= 55 && lKneeAngle <= 135) &&
      ((lWrist && Math.abs(lWrist.x - midHipX) < 0.28) || (rWrist && Math.abs(rWrist.x - midHipX) < 0.28))
    );

    // Exercise match evaluators - hỗ trợ thẩm định chuyên biệt khi có target hoặc danh sách bài tập cho phép
    const exerciseEvaluators = {
      neck_up: () => isNeckUp ? { exercise: 'neck_up', name: 'Neck Extension (Look Up)', confidence: 0.95, metrics: { pitch: headPose?.pitch } } : null,
      neck_tilt: () => isNeckTilt ? { exercise: 'neck_tilt', name: 'Neck Tilt (Ear to Shoulder)', confidence: 0.94, metrics: { roll: headPose?.roll, earDeltaY } } : null,
      neck_turn: () => isNeckTurn ? { exercise: 'neck_turn', name: 'Neck Turn (Look Left/Right)', confidence: 0.94, metrics: { yaw: headPose?.yaw } } : null,
      overhead_reach: () => isOverheadReach ? { exercise: 'overhead_reach', name: 'Overhead Reach (Hands Up)', confidence: 0.95, metrics: {} } : null,
      lateral_raise: () => isLateralRaise ? { exercise: 'lateral_raise', name: 'Lateral Arm Raise (Arms Straight)', confidence: 0.94, metrics: {} } : null,
      arm_cross: () => isChestHug ? { exercise: 'arm_cross', name: 'Chest Hug (Arms Crossed)', confidence: 0.94, metrics: {} } : null,
      shoulder_shrug: () => isShoulderShrug ? { exercise: 'shoulder_shrug', name: 'Shoulder Shrug (Lift Shoulders)', confidence: 0.95, metrics: { lEarDist, rEarDist } } : null,
      squat: () => (isElbowsSquat || isKneesBent) ? { exercise: 'squat', name: 'Squat Hold', confidence: 0.95, metrics: { elbowAngle: (hasAnyArm && activeSquatElbowAngle !== null) ? Math.round(activeSquatElbowAngle) : undefined } } : null,
      hammer_curl: () => isElbowsBicep ? { exercise: 'hammer_curl', name: 'Bicep Curl Hold', confidence: 0.95, metrics: { elbowAngle: (hasAnyArm && activeCurlAngle !== null) ? Math.round(activeCurlAngle) : undefined } } : null,
      push_up: () => isPushUp ? { exercise: 'push_up', name: 'Push-up (Chest press)', confidence: 0.88, metrics: {} } : null,
      plank: () => isPlank ? { exercise: 'plank', name: 'Plank (Core hold)', confidence: 0.88, metrics: {} } : null,
      russian_twist: () => isRussianTwist ? { exercise: 'russian_twist', name: 'Russian Twist (Torso rotation)', confidence: 0.85, metrics: {} } : null,
    };

    // Khi người dùng đang ở một bài tập cụ thể hoặc tập hợp bài tập (targetExercise):
    // targetExercise có thể là 1 string (vd 'hammer_curl') hoặc một mảng các string hợp lệ (vd ['hammer_curl', 'neck_up'])
    // CHỈ thẩm định các bài tập mục tiêu này. Tuyệt đối không nhận diện các bài tập khác để tránh xung đột (clash)!
    if (targetExercise) {
      const allowedTargets = Array.isArray(targetExercise)
        ? targetExercise.filter(Boolean)
        : [targetExercise].filter(Boolean);

      if (allowedTargets.length > 0) {
        for (const target of allowedTargets) {
          if (exerciseEvaluators[target]) {
            const match = exerciseEvaluators[target]();
            if (match) return match;
          }
        }
        return {
          exercise: null,
          name: null,
          confidence: 0,
          metrics: {
            elbowAngle: (hasAnyArm && minElbowAngle !== null) ? Math.round(minElbowAngle) : undefined,
            handsDetected: hasAnyArm,
            pitch: headPose?.pitch,
            roll: headPose?.roll,
            yaw: headPose?.yaw
          }
        };
      }
    }

    // Khi không chỉ định bài tập đích (chế độ tự do / tổng quát):
    const priorityList = [
      'neck_up', 'neck_tilt', 'neck_turn',
      'overhead_reach', 'lateral_raise', 'arm_cross', 'shoulder_shrug',
      'squat', 'hammer_curl', 'push_up', 'plank', 'russian_twist'
    ];
    for (const key of priorityList) {
      const match = exerciseEvaluators[key]();
      if (match) return match;
    }

    return { exercise: null, name: 'Tracking body & head posture...', confidence: 0, metrics: {} };
  }
}

export const poseDetector = new PoseDetector();

