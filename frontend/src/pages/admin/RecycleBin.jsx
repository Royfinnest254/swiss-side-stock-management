import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import { 
  Trash2, Filter, Search, Calendar, RefreshCcw, 
  Loader2, AlertCircle, Inbox, ArrowRight
} from 'lucide-react';

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'spa', label: 'Spa' },
  { value: 'shop', label: 'Shop' },
  { value: 'gym_equipment', label: 'Gym Equipment' },
  { value: 'gym_products', label: 'Gym Products' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'needs', label: 'Needs' },
];

export default function RecycleBin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Filters
  const [filters, setFilters] = useState({ module: '', from_date: '', to_date: '', search: '' });

  const role = localStorage.getItem('swiss_side_role');
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    fetchDeletedItems();
  }, [filters.module, filters.from_date, filters.to_date]);

  const fetchDeletedItems = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.module) queryParams.append('module', filters.module);
      if (filters.from_date) queryParams.append('from_date', filters.from_date);
      if (filters.to_date) queryParams.append('to_date', filters.to_date);
      
      const data = await api.get(`/recycle-bin?${queryParams.toString()}`);
      setItems(data);
    } catch (err) {
      toast.error('Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await api.post('/recycle-bin/restore', {
        module: selectedItem.module,
        item_id: selectedItem.id
      });
      toast.success('ITEM RESTORED TO INVENTORY');
      setRestoreModalOpen(false);
      fetchDeletedItems();
    } catch (err) {
      toast.error(err.error || 'Restoration failed');
    } finally {
      setRestoring(false);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(filters.search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Recycle Bin</h1>
          <p className="text-xs font-black text-primary uppercase tracking-[0.3em] mt-2">Data Restoration</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="system-card p-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px] space-y-1.5">
          <label className="text-xs-label ml-1">Search Items</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              className="input-field pl-12" 
              placeholder="Search by name..." 
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>
        </div>

        <div className="w-full md:w-[200px] space-y-1.5">
          <label className="text-xs-label ml-1">Module</label>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select 
              className="input-field pl-12 appearance-none"
              value={filters.module}
              onChange={(e) => setFilters({...filters, module: e.target.value})}
            >
              {MODULE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full md:w-[200px] space-y-1.5">
          <label className="text-xs-label ml-1">From Date</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="date" 
              className="input-field pl-12" 
              value={filters.from_date}
              onChange={(e) => setFilters({...filters, from_date: e.target.value})}
            />
          </div>
        </div>

        <div className="w-full md:w-[200px] space-y-1.5">
          <label className="text-xs-label ml-1">To Date</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="date" 
              className="input-field pl-12" 
              value={filters.to_date}
              onChange={(e) => setFilters({...filters, to_date: e.target.value})}
            />
          </div>
        </div>
      </div>

      <div className="system-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/50">
                <th className="px-8 py-5 text-xs-label">Deleted Item</th>
                <th className="px-8 py-5 text-xs-label">Source Module</th>
                <th className="px-8 py-5 text-xs-label">Deleted By</th>
                <th className="px-8 py-5 text-xs-label">Date Deleted</th>
                <th className="px-8 py-5 text-xs-label text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <Loader2 className="animate-spin text-primary mx-auto" size={32} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Loading Bin...</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <Inbox className="text-slate-200 mx-auto mb-4" size={48} />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No deleted items found</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={`${item.module}-${item.id}`} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-rose-50 text-danger rounded-2xl flex items-center justify-center">
                          <Trash2 size={18} />
                        </div>
                        <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="status-badge bg-slate-100 text-slate-500">
                        {item.module.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-[11px] font-black text-slate-900 uppercase tracking-wide">{item.deleted_by_name || 'System'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {new Date(item.deleted_at).toLocaleDateString()} at {new Date(item.deleted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => { setSelectedItem(item); setRestoreModalOpen(true); }}
                        className="btn-secondary h-10 px-6 flex items-center gap-2 ml-auto"
                      >
                        <RefreshCcw size={14} /> Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      <Modal isOpen={restoreModalOpen} onClose={() => setRestoreModalOpen(false)} title="Restore Item">
        <div className="space-y-6">
          <div className="bg-primary/5 p-6 rounded-premium flex items-start gap-4 border border-primary/10">
            <div className="w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shrink-0">
              <RefreshCcw size={20} />
            </div>
            <div>
              <h4 className="text-sm font-black text-primary uppercase tracking-widest mb-1">Restoration Request</h4>
              <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase tracking-wider">
                Restoring <span className="text-primary">{selectedItem?.name}</span>. The item will be returned to the <span className="text-primary">{selectedItem?.module.replace('_', ' ')}</span> module with its last known state.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <AlertCircle className="text-warning" size={16} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
              Warning: Transaction history for this item will start fresh from the point of restoration.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => setRestoreModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button 
              onClick={handleRestore}
              disabled={restoring}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {restoring ? <Loader2 className="animate-spin" size={18} /> : <><RefreshCcw size={18} /> Confirm Restore</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

