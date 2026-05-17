import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, children, footer }) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-[#ede9e5]/40 backdrop-blur-sm animate-in fade-in duration-300"
      />

      {/* Modal Content */}
      <div className="relative w-full md:max-w-[600px] bg-white shadow-2xl overflow-hidden
                    h-[auto] max-h-[90dvh] md:max-h-[85vh] md:rounded-[32px] flex flex-col
                    animate-in slide-in-from-bottom duration-500 md:slide-in-from-top-4
                    rounded-t-[40px] md:rounded-b-[32px] border-t border-[#F3F4F6] md:border-none">
        
        {/* Mobile Handle Bar */}
        <div className="md:hidden flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-[#E5E7EB] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-8 h-20 md:h-24 flex items-center justify-between border-b border-[#F3F4F6] bg-white">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A0604E] block mb-1.5">Swiss Side Protocol</span>
            <h2 className="text-xl md:text-2xl font-black text-[#1A1A1A] tracking-tight uppercase">{title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center hover:bg-[#F9FAFB] rounded-2xl transition-all text-[#9CA3AF] hover:text-[#A0604E]"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 md:p-10 scrollbar-hide">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-8 py-8 border-t border-[#F3F4F6] bg-[#F9FAFB]">
            <div className="flex flex-col md:flex-row justify-end gap-4">
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
