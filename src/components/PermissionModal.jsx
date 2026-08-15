import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Mic, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  X, 
  Sliders, 
  Volume2,
  RefreshCw,
  Info,
  HelpCircle
} from 'lucide-react';

export const PermissionModal = ({
  isOpen,
  onClose,
  cameraEnabled,
  setCameraEnabled,
  micEnabled,
  setMicEnabled,
  cameraPermissionStatus,
  setCameraPermissionStatus,
  micPermissionStatus,
  setMicPermissionStatus,
  cameraStream,
  setCameraStream,
  micStream,
  setMicStream
}) => {
  const [testNoiseDb, setTestNoiseDb] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [micError, setMicError] = useState(null);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const videoPreviewRef = useRef(null);

  // Bind real camera stream to mini preview video inside modal
  useEffect(() => {
    if (videoPreviewRef.current) {
      if (cameraStream && cameraEnabled) {
        videoPreviewRef.current.srcObject = cameraStream;
        videoPreviewRef.current.play().catch((e) => console.warn("Video play:", e));
      } else {
        videoPreviewRef.current.srcObject = null;
      }
    }
  }, [cameraStream, cameraEnabled, isOpen]);

  // Live real microphone audio meter test loop inside modal
  useEffect(() => {
    let audioCtx;
    let analyser;
    let animFrame;
    let source;

    if (isOpen && micStream && micEnabled) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioCtx();
        source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!analyser) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const calculatedDb = Math.round(30 + (avg / 255) * 60);
          setTestNoiseDb(calculatedDb);
          animFrame = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (err) {
        console.warn("Audio test meter error:", err);
      }
    } else {
      setTestNoiseDb(0);
    }

    return () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (audioCtx && audioCtx.state !== 'closed') {
        try {
          audioCtx.close();
        } catch (e) {}
      }
    };
  }, [isOpen, micStream, micEnabled]);

  // Toggle Real Physical Camera Permission / Stream
  const handleToggleCamera = async () => {
    setCameraError(null);
    if (cameraEnabled) {
      // Turn off
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
      setCameraEnabled(false);
      setCameraPermissionStatus('denied');
    } else {
      // Request real physical webcam
      setIsRequestingCamera(true);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Trình duyệt của bạn không hỗ trợ API navigator.mediaDevices.getUserMedia");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 }, 
            facingMode: 'user' 
          }
        });
        setCameraStream(stream);
        setCameraEnabled(true);
        setCameraPermissionStatus('granted');
        setCameraError(null);
      } catch (err) {
        console.error("Camera access error:", err);
        setCameraPermissionStatus('denied');
        setCameraEnabled(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError("Trình duyệt đang chặn quyền Webcam. Vui lòng bấm vào biểu tượng 🔒 hoặc 📹 trên thanh địa chỉ (URL) của trình duyệt và chọn 'Cho phép' (Allow) rồi thử lại.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError("Không tìm thấy thiết bị Webcam trên máy tính của bạn. Vui lòng kiểm tra lại kết nối phần cứng.");
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraError("Webcam đang được sử dụng bởi một ứng dụng khác (Zoom, Meet, Teams...). Vui lòng tắt ứng dụng đó và thử lại.");
        } else {
          setCameraError(err.message || "Không thể kết nối với Webcam thật.");
        }
      } finally {
        setIsRequestingCamera(false);
      }
    }
  };

  // Toggle Real Physical Microphone Permission / Stream
  const handleToggleMic = async () => {
    setMicError(null);
    if (micEnabled) {
      // Turn off
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        setMicStream(null);
      }
      setMicEnabled(false);
      setMicPermissionStatus('denied');
    } else {
      // Request real physical microphone
      setIsRequestingMic(true);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Trình duyệt không hỗ trợ API navigator.mediaDevices.getUserMedia");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false
          } 
        });
        setMicStream(stream);
        setMicEnabled(true);
        setMicPermissionStatus('granted');
        setMicError(null);
      } catch (err) {
        console.error("Mic access error:", err);
        setMicPermissionStatus('denied');
        setMicEnabled(false);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMicError("Trình duyệt đang chặn quyền Micro. Vui lòng bấm vào biểu tượng 🔒 hoặc 🎙️ trên thanh địa chỉ (URL) của trình duyệt và chọn 'Cho phép' (Allow) rồi thử lại.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setMicError("Không tìm thấy Microphone trên máy tính của bạn.");
        } else {
          setMicError(err.message || "Không thể kết nối với Micro thật.");
        }
      } finally {
        setIsRequestingMic(false);
      }
    }
  };

  // Enable all permissions at once
  const handleEnableAll = async () => {
    if (!cameraEnabled) await handleToggleCamera();
    if (!micEnabled) await handleToggleMic();
  };

  // Disable all permissions at once
  const handleDisableAll = () => {
    if (cameraEnabled) handleToggleCamera();
    if (micEnabled) handleToggleMic();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Cấp Quyền Thiết Bị Thực</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                100% Cục Bộ
              </span>
            </h3>
            <p className="text-xs text-slate-400">Kết nối trực tiếp WebCam thật & Micro thật của máy tính</p>
          </div>
        </div>

        {/* Permission List */}
        <div className="space-y-4">
          
          {/* 1. Real Webcam Permission Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            cameraEnabled 
              ? 'bg-slate-950/90 border-emerald-500/40 shadow-sm shadow-emerald-500/10' 
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 ${
                  cameraEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-semibold text-slate-100">WebCam Thật (Camera)</h4>
                    {cameraEnabled ? (
                      <span className="flex items-center space-x-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ĐÃ KẾT NỐI CAMERA THẬT</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                        <XCircle className="w-3 h-3" />
                        <span>ĐÃ TẮT</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Thuật toán thị giác máy tính Edge-AI phân tích trực tiếp hình ảnh khuôn mặt từ camera để tính khoảng cách cm theo thời gian thực.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={handleToggleCamera}
                disabled={isRequestingCamera}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  cameraEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                } ${isRequestingCamera ? 'opacity-50 cursor-wait' : ''}`}
                role="switch"
                aria-checked={cameraEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    cameraEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Error Message & Permission Guide */}
            {cameraError && (
              <div className="mt-3 p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-300 space-y-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
                  <span className="leading-relaxed">{cameraError}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">Hãy bấm 'Cho phép' trên popup của trình duyệt</span>
                  <button
                    onClick={handleToggleCamera}
                    className="px-2.5 py-1 bg-red-800/60 hover:bg-red-700 text-red-200 rounded border border-red-500/30 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Thử lại</span>
                  </button>
                </div>
              </div>
            )}

            {/* Camera Mini Live Preview inside Modal */}
            {cameraEnabled && cameraStream && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center space-x-3">
                <div className="w-24 h-16 bg-slate-900 rounded-lg overflow-hidden border border-emerald-500/40 relative flex-shrink-0">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <span className="absolute bottom-1 right-1 text-[8px] font-mono bg-black/70 text-emerald-400 px-1 rounded">
                    REAL CAM
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400 space-y-0.5">
                  <div className="text-emerald-400 font-semibold flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>WebCam thật đang hoạt động</span>
                  </div>
                  <div className="text-[11px] text-slate-500">Khung hình thực tế | In-Memory Local Stream</div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Real Microphone Permission Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            micEnabled 
              ? 'bg-slate-950/90 border-blue-500/40 shadow-sm shadow-blue-500/10' 
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3.5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mt-0.5 ${
                  micEnabled ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-semibold text-slate-100">Micro Thật (Microphone)</h4>
                    {micEnabled ? (
                      <span className="flex items-center space-x-1 text-[10px] font-mono text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ĐÃ KẾT NỐI MICRO THẬT</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                        <XCircle className="w-3 h-3" />
                        <span>ĐÃ TẮT</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Đo trực tiếp decibel (dB) từ micro thật của phòng để tự động kích hoạt âm thanh che tiếng ồn khi vượt ngưỡng 65dB.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={handleToggleMic}
                disabled={isRequestingMic}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  micEnabled ? 'bg-blue-600' : 'bg-slate-700'
                } ${isRequestingMic ? 'opacity-50 cursor-wait' : ''}`}
                role="switch"
                aria-checked={micEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    micEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Error Message & Permission Guide */}
            {micError && (
              <div className="mt-3 p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-xs text-red-300 space-y-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
                  <span className="leading-relaxed">{micError}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">Hãy bấm 'Cho phép' micro trên trình duyệt</span>
                  <button
                    onClick={handleToggleMic}
                    className="px-2.5 py-1 bg-red-800/60 hover:bg-red-700 text-red-200 rounded border border-red-500/30 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Thử lại</span>
                  </button>
                </div>
              </div>
            )}

            {/* Live Mic Test Meter inside Modal */}
            {micEnabled && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Thử nghiệm âm lượng Micro Thật:</span>
                  </span>
                  <span className="text-blue-300 font-bold">{testNoiseDb} dB</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${
                      testNoiseDb > 70 ? 'bg-red-500' : testNoiseDb > 55 ? 'bg-amber-400' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, (testNoiseDb / 100) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Security Reassurance Note */}
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-300 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Zero-Data Guarantee: Luồng WebCam & Micro chỉ chạy cục bộ trong RAM máy bạn và không gửi lên bất kỳ máy chủ nào.</span>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="flex space-x-2">
            <button
              onClick={handleEnableAll}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer"
            >
              Bật tất cả
            </button>
            <button
              onClick={handleDisableAll}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer"
            >
              Tắt tất cả
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-md shadow-blue-500/20 cursor-pointer"
          >
            Lưu & Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
