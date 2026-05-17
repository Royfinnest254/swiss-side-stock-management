import { X } from 'lucide-react';

export default function SlidePanel({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#ede9e5]/40 backdrop-blur-sm animate-in fade-in duration-300"
      />

      {/* Panel */}
      <div 
        className="relative bg-white w-full max-w-[500px] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">{title}</h2>
            <div className="w-8 h-1 bg-primary mt-2 rounded-full"></div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-danger transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
