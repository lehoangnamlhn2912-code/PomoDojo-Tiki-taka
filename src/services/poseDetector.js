// PoseDetector service using MediaPipe Tasks-Vision PoseLandmarker
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export class PoseDetector {
  constructor() {
    this.poseLandmarker = null;
    this.isModelLoaded = false;
    this.isLoadingModel = false;
    this.lastVideoTime = -1;
    this.initMediaPipePose();
  }

  async initMediaPipePose() {
    if (this.isModelLoaded || this.isLoadingModel) return;
    this.isLoadingModel = true;

    try {
      console.log('🔄 Loading Google MediaPipe Pose Landmarker for Workout Recognition...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

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
      console.log('✅ Google MediaPipe Pose Landmarker loaded successfully (33 Body Landmarks)');
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

  detectPose(videoElement) {
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) {
      return { detected: false, landmarks: null, recognizedExercise: null, confidence: 0 };
    }

    if (!this.poseLandmarker || !this.isModelLoaded) {
      return { detected: false, landmarks: null, recognizedExercise: null, confidence: 0, loading: this.isLoadingModel };
    }

    const currentTime = videoElement.currentTime;
    if (currentTime === this.lastVideoTime) {
      return this.lastResult || { detected: false, landmarks: null, recognizedExercise: null, confidence: 0 };
    }
    this.lastVideoTime = currentTime;

    try {
      const results = this.poseLandmarker.detectForVideo(videoElement, performance.now());
      if (results && results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0]; // 33 body landmarks

        // Classify the exercise based on angles and positions
        const classification = this.classifyExercise(landmarks);

        this.lastResult = {
          detected: true,
          landmarks,
          recognizedExercise: classification.exercise,
          exerciseName: classification.name,
          confidence: classification.confidence,
          metrics: classification.metrics
        };
        return this.lastResult;
      }
    } catch (e) {
      console.warn('Pose estimation frame error:', e);
    }

    this.lastResult = { detected: false, landmarks: null, recognizedExercise: null, confidence: 0 };
    return this.lastResult;
  }

  /**
   * Classify exercise from 33 body landmarks
   * Landmark Indices in MediaPipe Pose:
   * 11: left_shoulder, 12: right_shoulder
   * 13: left_elbow,    14: right_elbow
   * 15: left_wrist,    16: right_wrist
   * 23: left_hip,      24: right_hip
   * 25: left_knee,     26: right_knee
   * 27: left_ankle,    28: right_ankle
   */
  classifyExercise(lm) {
    const nose = lm[0];
    const lEye = lm[2], rEye = lm[5];
    const lEar = lm[7], rEar = lm[8];
    const lShoulder = lm[11], rShoulder = lm[12];
    const lElbow = lm[13], rElbow = lm[14];
    const lWrist = lm[15], rWrist = lm[16];
    const lHip = lm[23], rHip = lm[24];
    const lKnee = lm[25], rKnee = lm[26];
    const lAnkle = lm[27], rAnkle = lm[28];

    // Compute Key Angles
    const lElbowAngle = this.calculateAngle(lShoulder, lElbow, lWrist);
    const rElbowAngle = this.calculateAngle(rShoulder, rElbow, rWrist);

    const lShoulderAngle = this.calculateAngle(lHip, lShoulder, lElbow);
    const rShoulderAngle = this.calculateAngle(rHip, rShoulder, rElbow);

    const lKneeAngle = this.calculateAngle(lHip, lKnee, lAnkle);
    const rKneeAngle = this.calculateAngle(rHip, rKnee, rAnkle);

    const lHipAngle = this.calculateAngle(lShoulder, lHip, lKnee);
    const rHipAngle = this.calculateAngle(rShoulder, rHip, rKnee);

    // Torso orientation (horizontal vs vertical)
    const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const midHipY = (lHip.y + rHip.y) / 2;
    const torsoHeight = Math.abs(midShoulderY - midHipY);
    const midShoulderX = (lShoulder.x + rShoulder.x) / 2;
    const midHipX = (lHip.x + rHip.x) / 2;
    const torsoHorizontalDist = Math.abs(midShoulderX - midHipX);

    // 1. Overhead Reach: Both wrists raised high above shoulders/head (great for seated/wheelchair desk stretching)
    const isOverheadReach = (
      lWrist && rWrist && lShoulder && rShoulder &&
      (lWrist.y < lShoulder.y - 0.12 && rWrist.y < rShoulder.y - 0.12) &&
      (nose ? (lWrist.y < nose.y && rWrist.y < nose.y) : true)
    );

    // 2. Chest Hug / Arm Cross: Arms crossed across chest/shoulders
    const isChestHug = (
      lWrist && rWrist && lShoulder && rShoulder &&
      (lWrist.x > midShoulderX - 0.05) &&
      (rWrist.x < midShoulderX + 0.05) &&
      (lWrist.y > midShoulderY - 0.1 && lWrist.y < midHipY + 0.15) &&
      (rWrist.y > midShoulderY - 0.1 && rWrist.y < midHipY + 0.15)
    );

    // 3. Lateral Raise: Arms raised out to the side horizontally (Shoulder angle ~ 70-125 deg)
    const isLateralRaise = (
      (lShoulderAngle >= 70 && lShoulderAngle <= 125) &&
      (rShoulderAngle >= 70 && rShoulderAngle <= 125) &&
      (lElbowAngle > 120 && rElbowAngle > 120) &&
      (lWrist.y < midHipY && rWrist.y < midHipY)
    );

    // 4. Hammer Curl / Bicep Curl: Elbows flexed strongly (Elbow angle < 85 deg), upper arms near torso
    const isHammerCurl = (
      (lElbowAngle < 85 || rElbowAngle < 85) &&
      (lShoulderAngle < 55 && rShoulderAngle < 55) &&
      (lWrist.y < lElbow.y || rWrist.y < rElbow.y)
    );

    // 5. Shoulder Shrugs: Shoulders lifted high toward ears while arms are hanging relaxed
    const lEarDist = (lEar && lShoulder) ? Math.abs(lShoulder.y - lEar.y) : 999;
    const rEarDist = (rEar && rShoulder) ? Math.abs(rShoulder.y - rEar.y) : 999;
    const isShoulderShrug = (
      lEar && rEar && lShoulder && rShoulder &&
      lEarDist < 0.12 && rEarDist < 0.12 &&
      (lWrist.y > lShoulder.y + 0.05 && rWrist.y > rShoulder.y + 0.05)
    );

    // 6. Upward Neck Extension: Head tilted back to look upward (anti-Tech Neck)
    const midEarY = (lEar && rEar) ? (lEar.y + rEar.y) / 2 : null;
    const isNeckUp = (
      nose && midEarY !== null &&
      (nose.y < midEarY - 0.02)
    );

    // 7. Neck Tilt: Tilting ear toward shoulder (lateral neck stretch)
    const earDeltaY = (lEar && rEar) ? Math.abs(lEar.y - rEar.y) : 0;
    const shoulderDeltaY = (lShoulder && rShoulder) ? Math.abs(lShoulder.y - rShoulder.y) : 0;
    const isNeckTilt = (
      earDeltaY > 0.06 &&
      shoulderDeltaY < 0.08
    );

    // 8. Neck Turn: Looking left or right (axial cervical rotation)
    const distToLeftEar = (nose && lEar) ? Math.abs(nose.x - lEar.x) : 0;
    const distToRightEar = (nose && rEar) ? Math.abs(nose.x - rEar.x) : 0;
    const midEarX = (lEar && rEar) ? (lEar.x + rEar.x) / 2 : null;
    const isNeckTurn = (
      nose && lEar && rEar &&
      (
        (distToLeftEar > 0 && distToRightEar > 0 && (distToLeftEar / distToRightEar > 2.2 || distToRightEar / distToLeftEar > 2.2)) ||
        (midEarX !== null && Math.abs(nose.x - midEarX) > 0.06)
      ) &&
      !isNeckTilt
    );

    // 9. Squat: Knees bent significantly (Knee angle between 50 - 135 deg)
    const isSquat = (
      ((lKneeAngle > 50 && lKneeAngle < 135) || (rKneeAngle > 50 && rKneeAngle < 135)) &&
      (lHipAngle > 60 && lHipAngle < 140) &&
      torsoHeight > 0.15
    );

    // Plank / Push-up: Body is horizontal
    const isBodyHorizontal = (torsoHorizontalDist > 0.15 || Math.abs(midShoulderY - midHipY) < 0.22);
    const isPushUp = isBodyHorizontal && (lElbowAngle < 110 || rElbowAngle < 110);
    const isPlank = isBodyHorizontal && !isPushUp && (Math.abs(lElbow.y - midShoulderY) < 0.2);

    // Russian Twist
    const isRussianTwist = (
      (lHipAngle >= 75 && lHipAngle <= 135) &&
      (lKneeAngle >= 60 && lKneeAngle <= 130) &&
      (Math.abs(lWrist.x - midHipX) < 0.25 || Math.abs(rWrist.x - midHipX) < 0.25)
    );

    // Priority classification
    if (isOverheadReach) {
      return { exercise: 'overhead_reach', name: 'Overhead Reach (Hands Up)', confidence: 0.95, metrics: {} };
    }
    if (isChestHug) {
      return { exercise: 'arm_cross', name: 'Chest Hug (Arms Crossed)', confidence: 0.92, metrics: {} };
    }
    if (isLateralRaise) {
      return { exercise: 'lateral_raise', name: 'Lateral Arm Raise', confidence: 0.9, metrics: { lShoulderAngle, rShoulderAngle } };
    }
    if (isHammerCurl) {
      return { exercise: 'hammer_curl', name: 'Bicep Curl Hold', confidence: 0.9, metrics: { lElbowAngle, rElbowAngle } };
    }
    if (isShoulderShrug) {
      return { exercise: 'shoulder_shrug', name: 'Shoulder Shrug (Lift to Ears)', confidence: 0.9, metrics: { lEarDist, rEarDist } };
    }
    if (isNeckUp) {
      return { exercise: 'neck_up', name: 'Neck Extension (Look Up)', confidence: 0.9, metrics: {} };
    }
    if (isNeckTilt) {
      return { exercise: 'neck_tilt', name: 'Neck Tilt (Ear to Shoulder)', confidence: 0.88, metrics: { earDeltaY } };
    }
    if (isNeckTurn) {
      return { exercise: 'neck_turn', name: 'Neck Turn (Look Left/Right)', confidence: 0.88, metrics: {} };
    }
    if (isSquat) {
      return { exercise: 'squat', name: 'Squat Hold', confidence: 0.88, metrics: { lKneeAngle, rKneeAngle } };
    }
    if (isPushUp) {
      return { exercise: 'push_up', name: 'Push-up (Chest press)', confidence: 0.85, metrics: { lElbowAngle, rElbowAngle } };
    }
    if (isPlank) {
      return { exercise: 'plank', name: 'Plank (Core hold)', confidence: 0.85, metrics: { torsoHorizontalDist } };
    }
    if (isRussianTwist) {
      return { exercise: 'russian_twist', name: 'Russian Twist (Torso rotation)', confidence: 0.82, metrics: { lHipAngle, lKneeAngle } };
    }

    return { exercise: null, name: 'Tracking body posture...', confidence: 0, metrics: {} };
  }
}

export const poseDetector = new PoseDetector();
