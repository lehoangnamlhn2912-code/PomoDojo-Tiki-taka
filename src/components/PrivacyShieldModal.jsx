import React from 'react';
import { ShieldCheck, X, Eye, Lock, Cpu } from 'lucide-react';

export const PrivacyShieldModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Zero-Data Privacy Shield</h3>
            <p className="text-xs text-slate-400">Cam kết bảo mật & quyền riêng tư tuyệt đối cho học sinh</p>
          </div>
        </div>

        {/* Commitments List */}
        <div className="space-y-3 text-xs">
          
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start space-x-3">
            <Eye className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200 block font-semibold mb-0.5">1. Không lưu hay ghi hình webcam:</strong>
              <span className="text-slate-400 leading-relaxed">
                Ứng dụng chỉ sử dụng webcam để tính toán khoảng cách mắt tương đối và nhận diện động tác tập. Không bao giờ lưu lại ảnh, video hay đặc trưng khuôn mặt.
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start space-x-3">
            <Cpu className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200 block font-semibold mb-0.5">2. Edge-AI xử lý 100% tại máy tính:</strong>
              <span className="text-slate-400 leading-relaxed">
                Tất cả các mô hình trí tuệ nhân tạo (BlazeFace, MoveNet, Audio threshold) đều chạy trực tiếp trên thiết bị cá nhân của bạn.
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start space-x-3">
            <Lock className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200 block font-semibold mb-0.5">3. Zero-Data Cloud Transmission:</strong>
              <span className="text-slate-400 leading-relaxed">
                Ứng dụng hoạt động hoàn hảo ngay cả khi ngắt kết nối Internet. Không có bất kỳ dữ liệu cá nhân nào bị gửi lên máy chủ bên ngoài.
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-500/20"
          >
            Đã Hiểu & Yên Tâm Sử Dụng
          </button>
        </div>

      </div>
    </div>
  );
};
