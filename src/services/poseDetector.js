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

    // Lateral Raise: Arms raised out to the side horizontally (Shoulder angle ~ 75-115 deg, elbows relatively straight > 130 deg)
    const isLateralRaise = (
      (lShoulderAngle >= 70 && lShoulderAngle <= 125) &&
      (rShoulderAngle >= 70 && rShoulderAngle <= 125) &&
      (lElbowAngle > 120 && rElbowAngle > 120) &&
      (lWrist.y < midHipY && rWrist.y < midHipY)
    );

    // Hammer Curl / Bicep Curl: Elbows flexed strongly (Elbow angle < 85 deg), upper arms near torso (Shoulder angle < 45 deg)
    const isHammerCurl = (
      (lElbowAngle < 85 || rElbowAngle < 85) &&
      (lShoulderAngle < 55 && rShoulderAngle < 55) &&
      (lWrist.y < lElbow.y || rWrist.y < rElbow.y)
    );

    // Squat: Knees bent significantly (Knee angle between 60 - 130 deg), Hips lowered, Torso upright
    const isSquat = (
      ((lKneeAngle > 50 && lKneeAngle < 135) || (rKneeAngle > 50 && rKneeAngle < 135)) &&
      (lHipAngle > 60 && lHipAngle < 140) &&
      torsoHeight > 0.15
    );

    // Plank / Push-up: Body is horizontal (torso horizontal dist > torsoHeight * 0.8 or shoulders close in Y to hips)
    const isBodyHorizontal = (torsoHorizontalDist > 0.15 || Math.abs(midShoulderY - midHipY) < 0.22);
    
    // Push-up: Horizontal body with bent elbows (< 110 deg)
    const isPushUp = isBodyHorizontal && (lElbowAngle < 110 || rElbowAngle < 110);

    // Plank: Horizontal body with elbows supported near 90 deg under shoulders
    const isPlank = isBodyHorizontal && !isPushUp && (Math.abs(lElbow.y - midShoulderY) < 0.2);

    // Russian Twist: Seated, knees bent, torso leaning back (Hip angle ~ 90-130), hands clasped or rotating across midline
    const isRussianTwist = (
      (lHipAngle >= 75 && lHipAngle <= 135) &&
      (lKneeAngle >= 60 && lKneeAngle <= 130) &&
      (Math.abs(lWrist.x - midHipX) < 0.25 || Math.abs(rWrist.x - midHipX) < 0.25)
    );

    if (isLateralRaise) {
      return { exercise: 'lateral_raise', name: 'Lateral Raise (Dang tay ngang)', confidence: 0.9, metrics: { lShoulderAngle, rShoulderAngle } };
    }
    if (isHammerCurl) {
      return { exercise: 'hammer_curl', name: 'Hammer Curl (Gập bắp tay)', confidence: 0.9, metrics: { lElbowAngle, rElbowAngle } };
    }
    if (isSquat) {
      return { exercise: 'squat', name: 'Squat (Gánh đùi)', confidence: 0.88, metrics: { lKneeAngle, rKneeAngle } };
    }
    if (isPushUp) {
      return { exercise: 'push_up', name: 'Push-up (Chống đẩy)', confidence: 0.85, metrics: { lElbowAngle, rElbowAngle } };
    }
    if (isPlank) {
      return { exercise: 'plank', name: 'Plank (Đo ván)', confidence: 0.85, metrics: { torsoHorizontalDist } };
    }
    if (isRussianTwist) {
      return { exercise: 'russian_twist', name: 'Russian Twist (Xoay eo)', confidence: 0.82, metrics: { lHipAngle, lKneeAngle } };
    }

    return { exercise: null, name: 'Đang theo dõi tư thế...', confidence: 0, metrics: {} };
  }
}

export const poseDetector = new PoseDetector();
