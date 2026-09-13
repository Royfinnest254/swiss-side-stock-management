import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, children, footer }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Parents commonly create the close handler inline. Keeping the latest
  // handler in a ref prevents an open modal from tearing down and stealing
  // focus again after every keystroke in one of its inputs.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      const frame = requestAnimationFrame(() => dialogRef.current?.focus());
      const onKeyDown = (event) => {
        if (event.key === 'Escape') onCloseRef.current();
        if (event.key !== 'Tab' || !dialogRef.current) return;
        const focusable = dialogRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        const elements = [...focusable];
        if (!elements.length) return;
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', onKeyDown);
      return () => {
        cancelAnimationFrame(frame);
        document.removeEventListener('keydown', onKeyDown);
        document.body.style.overflow = '';
        previouslyFocusedRef.current?.focus?.();
      };
    } else {
      document.body.style.overflow = '';
    }
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="relative w-full md:max-w-[600px] bg-white shadow-2xl overflow-hidden
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
            <h2 id={titleId} className="text-xl md:text-2xl font-black text-[#1A1A1A] tracking-tight uppercase">{title}</h2>
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
