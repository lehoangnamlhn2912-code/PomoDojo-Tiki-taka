// Camera acquisition, frame extraction, and lifecycle management service

export class CameraService {
  constructor() {
    this.stream = null;
    this.videoElement = null;
  }

  // Request hardware user-facing webcam
  async startCamera(constraints = { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } }) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Trình duyệt không hỗ trợ WebRTC getUserMedia API.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.stream;
  }

  // Bind existing stream to video element and ensure autoplay
  attachVideo(videoElement, stream) {
    this.videoElement = videoElement;
    if (this.videoElement && stream) {
      this.videoElement.srcObject = stream;
      return this.videoElement.play().catch((err) => {
        console.warn('Camera video play waiting for user gesture:', err.message);
      });
    }
    return Promise.resolve();
  }

  // Stop active stream and release hardware
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  // Check if frame is ready for vision processing
  isFrameReady() {
    return (
      this.videoElement &&
      this.videoElement.readyState >= 2 &&
      this.videoElement.videoWidth > 0 &&
      this.videoElement.videoHeight > 0
    );
  }
}

export const cameraService = new CameraService();
