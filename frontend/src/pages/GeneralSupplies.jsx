import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { Package, Plus, Search, Loader2, ArrowUpRight, ArrowDownLeft, Trash2, Clock, History, CheckCircle2, AlertCircle, Edit2, Calendar, Folder } from 'lucide-react';

export default function GeneralSupplies() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const [itemModal, setItemModal] = useState({ open: false, mode: 'add', data: null });
  const [isBulkMaintenanceModalOpen, setIsBulkMaintenanceModalOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [bulkMaintenanceData, setBulkMaintenanceData] = useState({ description: '', technician_name: '', status: 'pending', resolved_at: new Date().toISOString().split('T')[0] });

  const [stockModal, setStockModal] = useState({ open: false, type: 'restock', data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, data: null });

  const [itemForm, setItemForm] = useState({ name: '', quantity: 0, unit: 'pcs', reorder_level: 5, notes: '', category: 'Other', is_folder: false, classification: '', parent_id: null });
  const [stockQty, setStockQty] = useState('');
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.get('/general-supplies');
      setItems(data.results || data);
    } catch (err) { toast.error('Failed to load supplies'); } finally { setLoading(false); }
  };

  
  const toggleSelection = (id) => {
    const newSelection = new Set(selectedItemIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedItemIds(newSelection);
  };

  const handleBulkMaintenance = async (e) => {
    e.preventDefault();
    if (selectedItemIds.size === 0) return toast.error("No items selected");
    setSubmitting(true);
    try {
      await api.post('/supplies/general/maintenance/bulk', {
        item_ids: Array.from(selectedItemIds),
        ...bulkMaintenanceData
      });
      toast.success(`Logged maintenance for ${selectedItemIds.size} items`);
      setIsBulkMaintenanceModalOpen(false);
      setSelectedItemIds(new Set());
      fetchData();
    } catch (err) { toast.error('Failed to log bulk maintenance'); } finally { setSubmitting(false); }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: itemForm.name,
      quantity: itemForm.is_folder ? 0 : itemForm.quantity,
      unit: itemForm.is_folder ? 'folder' : itemForm.unit,
      reorder_level: itemForm.is_folder ? 0 : itemForm.reorder_level,
      notes: itemForm.notes || null,
      category: itemForm.category || 'Other',
      is_folder: itemForm.is_folder ? 1 : 0,
      parent_id: itemForm.is_folder ? null : (itemForm.parent_id || null),
      classification: itemForm.is_folder ? null : (itemForm.classification || null)
    };
    try {
      if (itemModal.mode === 'add') {
        await api.post('/general-supplies', payload);
      } else {
        await api.put(`/general-supplies/${itemModal.data.id}`, payload);
      }
      toast.success('Registry updated');
      setItemModal({ open: false, mode: 'add', data: null });
      fetchData();
    } catch (err) { toast.error('Failed to save'); } finally { setSubmitting(false); }
  };

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const isRestock = stockModal.type === 'restock';
    const endpoint = isRestock ? '/general-supplies/restock' : '/general-supplies/withdraw';
    try {
      const response = await api.post(endpoint, { 
        item_id: stockModal.data.id, 
        quantity: parseFloat(stockQty),
        transaction_date: isRestock ? stockDate : undefined
      });
      
      // Feature 4: Live update
      if (response.item) {
        setItems(prev => prev.map(item =>
          item.id === response.item.id ? { ...item, ...response.item } : item
        ));
      } else {
        fetchData();
      }

      toast.success('Inventory modified');
      setStockModal({ open: false, type: 'restock', data: null });
      setStockQty('');
      setStockDate(new Date().toISOString().split('T')[0]);
    } catch (err) { toast.error('Update failed'); } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/general-supplies/${deleteModal.data.id}`);
      toast.success('Asset removed');
      setDeleteModal({ open: false, data: null });
      setItems(prev => prev.filter(i => i.id !== deleteModal.data.id));
    } catch (err) { toast.error('Deletion failed'); } finally { setSubmitting(false); }
  };

  const getStatus = (item) => {
    if (item.quantity <= 0) return 'out';
    // Feature 23: Strict less than
    if (item.reorder_level > 0 && item.quantity < item.reorder_level) return 'low';
    return 'available';
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  if (loading && !items.length) return (
    <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-[#A0604E]" size={32} /></div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#F3F4F6]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A0604E] block mb-2">Facility Module</span>
          <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight uppercase">General Supplies</h1>
        </div>
        <button onClick={() => {
          setItemForm({ name: '', quantity: 0, unit: 'pcs', reorder_level: 5, notes: '', category: 'Other', is_folder: false, classification: '', parent_id: null });
          setItemModal({ open: true, mode: 'add', data: null });
        }} className="btn-primary h-12 px-8 shadow-premium"><Plus size={18} /> REGISTER SUPPLY</button>
      </div>

      <div className="flex items-center gap-3 bg-white border border-[#F3F4F6] rounded-2xl px-6 py-1 max-w-md shadow-sm">
        <Search className="text-[#9CA3AF]" size={18} />
        <input className="bg-transparent border-none focus:ring-0 w-full h-11 text-[14px] placeholder:text-[#9CA3AF]" placeholder="Search supplies..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="system-card p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto table-scroll">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#F9FAFB]">
                <th className="px-6 py-4">Supply Detail</th>
                <th className="px-6 py-4">Stock Balance</th>
                <th className="hidden md:table-cell px-6 py-4">Status</th>
                <th className="text-right px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filtered.map(item => {
                const parentFolder = item.parent_id ? items.find(i => i.id === item.parent_id) : null;
                return (
                  <tr key={item.id} className={`hover:bg-[#F9FAFB] transition-colors ${item.is_folder ? 'border-l-4 border-[#A0604E] bg-orange-50/10' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#FDF5F3] text-[#A0604E] rounded-xl flex items-center justify-center shrink-0">
                          {item.is_folder ? <Folder size={20} /> : <Package size={20} />}
                        </div>
                        <div>
                          <span className="font-bold text-[#1A1A1A] block uppercase tracking-tight">{item.name}</span>
                          <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest block mt-0.5">
                            {parentFolder ? `Folder: ${parentFolder.name}  •  ` : ''}
                            {item.category} • {item.notes || 'Consumable'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.is_folder ? (
                        <span className="px-3 py-1 rounded-lg bg-orange-100/50 text-[#A0604E] text-[9px] font-black uppercase tracking-[0.15em]">Group Folder</span>
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-[#1A1A1A] tracking-tighter">{item.quantity}</span>
                          <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{item.unit}</span>
                        </div>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4">
                      {item.is_folder ? (
                        <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">N/A</span>
                      ) : (() => {
                        const status = getStatus(item);
                        if (status === 'out') return <span className="px-3 py-1 rounded-lg bg-[#FCEBEB] text-[#A32D2D] text-[9px] font-black uppercase tracking-[0.15em]">Out of Stock</span>;
                        if (status === 'low') return <span className="px-3 py-1 rounded-lg bg-[#FAEEDA] text-[#854F0B] text-[9px] font-black uppercase tracking-[0.15em]">Low Stock</span>;
                        return <span className="px-3 py-1 rounded-lg bg-[#EAF3DE] text-[#3B6D11] text-[9px] font-black uppercase tracking-[0.15em]">Available</span>;
                      })()}
                    </td>
                    <td className="text-right px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {item.is_folder ? (
                          <button
                            title="Add Item inside Folder"
                            onClick={() => {
                              setItemForm({
                                name: '',
                                quantity: 0,
                                unit: 'pcs',
                                reorder_level: 5,
                                notes: '',
                                category: item.category || 'Other',
                                is_folder: false,
                                classification: '',
                                parent_id: item.id
                              });
                              setItemModal({ open: true, mode: 'add', data: null });
                            }}
                            className="px-3 py-1.5 flex items-center gap-1 bg-[#FDF5F3] text-[#A0604E] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[#A0604E] hover:text-white transition-all"
                          >
                            <Plus size={12} /> ADD ITEM
                          </button>
                        ) : (
                          <>
                            <button title="Restock" onClick={() => setStockModal({ open: true, type: 'restock', data: item })} className="w-8 h-8 flex items-center justify-center bg-[#EAF3DE] text-[#3B6D11] rounded-full hover:scale-110 transition-transform"><ArrowUpRight size={16} /></button>
                            <button title="Withdraw" onClick={() => setStockModal({ open: true, type: 'withdraw', data: item })} className="w-8 h-8 flex items-center justify-center bg-[#FAEEDA] text-[#854F0B] rounded-full hover:scale-110 transition-transform"><ArrowDownLeft size={16} /></button>
                          </>
                        )}
                        <button
                          title="Edit Item"
                          onClick={() => {
                            setItemForm({
                              name: item.name,
                              quantity: item.quantity || 0,
                              unit: item.unit || 'pcs',
                              reorder_level: item.reorder_level ?? 5,
                              notes: item.notes || '',
                              category: item.category || 'Other',
                              is_folder: !!item.is_folder,
                              classification: item.classification || '',
                              parent_id: item.parent_id || null
                            });
                            setItemModal({ open: true, mode: 'edit', data: item });
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-gray-100 text-[#6B7280] rounded-full hover:scale-110 transition-transform"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button title="Delete" onClick={() => setDeleteModal({ open: true, data: item })} className="w-8 h-8 flex items-center justify-center bg-[#FCEBEB] text-[#A32D2D] rounded-full hover:scale-110 transition-transform"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      
      {/* MODALS */}
      <Modal isOpen={stockModal.open} onClose={() => setStockModal({ open: false, type: 'restock', data: null })} title={`${stockModal.type === 'restock' ? 'Restock' : 'Withdraw'} - ${stockModal.data?.name}`}>
        <form onSubmit={handleStockUpdate} className="space-y-6 py-4">
          <div className="text-center mb-8">
            <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest block mb-2">Current Balance</span>
            <div className="text-4xl font-black text-[#1A1A1A] tracking-tighter">{stockModal.data?.quantity} <span className="text-lg opacity-40">{stockModal.data?.unit}</span></div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Transaction Quantity</label>
              <input type="number" step="0.01" className="input-field h-14 text-center text-xl font-black" value={stockQty} onChange={e => setStockQty(e.target.value)} required min="0.01" autoFocus />
            </div>
            {stockModal.type === 'restock' ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Restock Date</label>
                <div className="relative">
                  <input type="date" className="input-field h-14 pl-12" value={stockDate} onChange={e => setStockDate(e.target.value)} max={new Date().toISOString().split('T')[0]} required />
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#F9FAFB] rounded-xl flex items-center gap-3">
                <Clock className="text-[#9CA3AF]" size={18} />
                <span className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest">Date will be recorded as today automatically.</span>
              </div>
            )}
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-16 text-[13px] font-black uppercase tracking-widest">{submitting ? <Loader2 className="animate-spin" /> : `Confirm ${stockModal.type}`}</button>
        </form>
      </Modal>

      <Modal isOpen={itemModal.open} onClose={() => setItemModal({ ...itemModal, open: false })} title={itemModal.mode === 'add' ? 'Register Item' : 'Modify Item'}>
        <form onSubmit={handleSaveItem} className="space-y-6">
          {itemModal.mode === 'add' && (
            <div className="flex gap-4 p-1 bg-gray-100 rounded-xl mb-4">
              <button type="button" onClick={() => setItemForm({...itemForm, is_folder: false})} className={`flex-1 py-2 text-xs font-bold rounded-lg ${!itemForm.is_folder ? 'bg-white shadow text-[#A0604E]' : 'text-gray-500'}`}>Single Item</button>
              <button type="button" onClick={() => setItemForm({...itemForm, is_folder: true})} className={`flex-1 py-2 text-xs font-bold rounded-lg ${itemForm.is_folder ? 'bg-white shadow text-[#A0604E]' : 'text-gray-500'}`}>Group / Folder</button>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Item Name</label>
            <input className="input-field" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} required placeholder="e.g. Cleaning Supplies" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Category</label>
            <select className="input-field" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})}>
              <option value="Cleaning & Hygiene">Cleaning & Hygiene</option>
              <option value="Office & Stationery">Office & Stationery</option>
              <option value="Pantry & Guest Supplies">Pantry & Guest Supplies</option>
              <option value="Maintenance & Safety">Maintenance & Safety</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {!itemForm.is_folder && (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Parent Folder (Optional)</label>
                <select
                  className="input-field"
                  value={itemForm.parent_id || ''}
                  onChange={e => setItemForm({...itemForm, parent_id: e.target.value ? parseInt(e.target.value) : null})}
                >
                  <option value="">No parent folder...</option>
                  {items.filter(i => i.is_folder && i.id !== itemModal.data?.id).map(f => (
                    <option key={f.id} value={f.id}>{f.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Classification (Optional)</label>
                <input className="input-field" value={itemForm.classification || ''} onChange={e => setItemForm({...itemForm, classification: e.target.value})} placeholder="e.g. Expiration Date, Supplier" />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Notes / Description (Optional)</label>
            <input className="input-field" value={itemForm.notes || ''} onChange={e => setItemForm({...itemForm, notes: e.target.value})} placeholder="e.g. For general staff use" />
          </div>

          {!itemForm.is_folder && (
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Unit</label>
                <input className="input-field" value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} required placeholder="pcs, liters, boxes" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Reorder Level</label>
                <input type="number" className="input-field" value={itemForm.reorder_level} onChange={e => setItemForm({...itemForm, reorder_level: parseFloat(e.target.value)})} required />
              </div>
            </div>
          )}
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black">SAVE LIST</button>
        </form>
      </Modal>

      
      <Modal isOpen={isBulkMaintenanceModalOpen} onClose={() => setIsBulkMaintenanceModalOpen(false)} title={`Log Maintenance (${selectedItemIds.size} items)`}>
        <form onSubmit={handleBulkMaintenance} className="space-y-6 py-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Maintenance Description</label>
            <textarea className="input-field h-20 pt-4" value={bulkMaintenanceData.description} onChange={e => setBulkMaintenanceData({...bulkMaintenanceData, description: e.target.value})} required />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Status</label>
              <select className="input-field" value={bulkMaintenanceData.status} onChange={e => setBulkMaintenanceData({...bulkMaintenanceData, status: e.target.value})}>
                <option value="pending">Pending Repair</option>
                <option value="resolved">Already Resolved</option>
              </select>
            </div>
            {bulkMaintenanceData.status === 'resolved' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest ml-1">Resolution Date</label>
                <input type="date" className="input-field" value={bulkMaintenanceData.resolved_at} onChange={e => setBulkMaintenanceData({...bulkMaintenanceData, resolved_at: e.target.value})} max={new Date().toISOString().split('T')[0]} required />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-[#A0604E] uppercase tracking-widest ml-1">Serviced By (Technician Name)</label>
            <input type="text" className="input-field border-[#A0604E]/30 focus:border-[#A0604E]" value={bulkMaintenanceData.technician_name} onChange={e => setBulkMaintenanceData({...bulkMaintenanceData, technician_name: e.target.value})} required={bulkMaintenanceData.status === 'resolved'} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black">Save Maintenance Log</button>
        </form>
      </Modal>

      <DeleteConfirmModal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, data: null })} onConfirm={handleDelete} loading={submitting} title="Remove Supply" />
    </div>
  );
}
