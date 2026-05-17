import { useState } from 'react';
import Modal from './Modal';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, title = "Confirm Deletion", loading = false }) {
  const [inputValue, setInputValue] = useState('');

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => { setInputValue(''); onClose(); }} 
      title={title}
      footer={(
        <div className="flex gap-3 w-full">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button 
            onClick={() => { onConfirm(); setInputValue(''); }}
            disabled={inputValue.toUpperCase() !== 'DELETE' || loading}
            className="btn-primary flex-1 bg-danger hover:bg-rose-700 disabled:bg-slate-200 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <><Trash2 size={16} /> Confirm</>}
          </button>
        </div>
      )}
    >
      <div className="space-y-6">
        <div className="bg-rose-50 p-6 rounded-premium flex items-start gap-4">
          <div className="w-10 h-10 bg-danger text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-danger/20">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-danger uppercase tracking-widest mb-1">High Risk Action</h4>
            <p className="text-[11px] font-bold text-danger/70 leading-relaxed uppercase tracking-wider">
              This action cannot be undone. All related data will be permanently removed or moved to the system archives.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-center py-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Type <span className="text-danger">DELETE</span> in uppercase to confirm
          </p>
          <input 
            type="text" 
            className="input-field text-center font-black tracking-widest uppercase border-danger/20 focus:border-danger focus:ring-danger/5"
            placeholder="TYPE HERE"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
          />
        </div>
      </div>
    </Modal>
  );
}
