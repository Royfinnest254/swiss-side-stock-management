import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { CookingPot, Plus, Search, Loader2, Package, ArrowUpRight, ArrowDownLeft, Trash2, Clock, History, CheckCircle2, AlertCircle, Edit2, Wrench, Calendar, Filter, Folder } from 'lucide-react';

export default function Kitchen() {
  const [activeTab, setActiveTab] = useState('list'); 
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Date filters for History Tab
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [itemModal, setItemModal] = useState({ open: false, mode: 'add', data: null });
  const [stockModal, setStockModal] = useState({ open: false, type: 'restock', data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, data: null });
  const [resolveModal, setResolveModal] = useState({ open: false, data: null });

  const [itemForm, setItemForm] = useState({ 
    name: '', 
    quantity: 0, 
    unit: 'pcs', 
    reorder_level: 5, 
    category: 'Consumables', 
    notes: '', 
    is_folder: false, 
    parent_id: null,
    classification: '' 
  });
  
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockQty, setStockQty] = useState('');
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [maintForm, setMaintForm] = useState({ description: '' });
  const [maintSearch, setMaintSearch] = useState('');
  const [selectedMaintItemIds, setSelectedMaintItemIds] = useState(new Set());
  
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [resolvedAt, setResolvedAt] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { 
    fetchData(); 
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'list') {
        const data = await api.get('/kitchen/items');
        setItems(data.results || data);
      } else if (activeTab === 'history') {
        let endpoint = '/kitchen/transactions';
        const params = [];
        if (fromDate) params.push(`from_date=${fromDate}`);
        if (toDate) params.push(`to_date=${toDate}`);
        if (params.length) endpoint += `?${params.join('&')}`;
        const data = await api.get(endpoint);
        setTransactions(data.results || data);
      } else if (activeTab === 'maintenance') {
        const data = await api.get('/kitchen/maintenance');
        setMaintenance(data.results || data);
        // Refresh items as well to populate the dropdown in maintenance logger
        const listData = await api.get('/kitchen/items');
        setItems(listData.results || listData);
      }
    } catch (err) { 
      toast.error('Failed to update kitchen records'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: itemForm.name,
      quantity: itemForm.is_folder ? 0 : itemForm.quantity,
      unit: itemForm.is_folder ? 'folder' : itemForm.unit,
      reorder_level: itemForm.is_folder ? 0 : itemForm.reorder_level,
      category: itemForm.is_folder ? 'Consumables' : itemForm.category,
      notes: itemForm.notes,
      is_folder: itemForm.is_folder ? 1 : 0,
      parent_id: itemForm.is_folder ? null : (itemForm.parent_id || null),
      classification: itemForm.classification || null
    };
    try {
      if (itemModal.mode === 'add') {
        await api.post('/kitchen/items', payload);
        toast.success('Item added to records');
      } else {
        await api.put(`/kitchen/items/${itemModal.data.id}`, payload);
        toast.success('Item records updated');
      }
      setItemModal({ open: false, mode: 'add', data: null });
      fetchData();
    } catch (err) { 
      toast.error('Failed to save item'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleStockUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const isRestock = stockModal.type === 'restock';
    const endpoint = isRestock ? '/kitchen/restock' : '/kitchen/withdraw';
    try {
      const response = await api.post(endpoint, { 
        item_id: stockModal.data.id, 
        quantity: parseFloat(stockQty),
        transaction_date: isRestock ? stockDate : undefined
      });
      
      if (response.item) {
        setItems(prev => prev.map(item =>
          item.id === response.item.id ? { ...item, ...response.item } : item
        ));
      } else {
        fetchData();
      }

      toast.success('Stock level modified');
      setStockModal({ open: false, type: 'restock', data: null });
      setStockQty('');
      setStockDate(new Date().toISOString().split('T')[0]);
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Update failed'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleMaintSubmit = async (e) => {
    e.preventDefault();
    if (selectedMaintItemIds.size === 0) return toast.error('Please select at least one item');
    setSubmitting(true);
    try {
      await api.post('/kitchen/maintenance', {
        item_ids: Array.from(selectedMaintItemIds),
        description: maintForm.description
      });
      toast.success('Maintenance ticket logged successfully');
      setMaintForm({ description: '' });
      setSelectedMaintItemIds(new Set());
      setMaintSearch('');
      fetchData();
    } catch (err) { 
      toast.error('Failed to log maintenance'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleResolveMaintenance = async (e) => {
    e.preventDefault();
    if (!resolveModal.data) return;
    setSubmitting(true);
    try {
      await api.patch(`/kitchen/maintenance/${resolveModal.data.id}/resolve`, {
        resolution_notes: resolutionNotes,
        technician_name: technicianName,
        resolved_at: resolvedAt
      });
      toast.success('Maintenance ticket marked as resolved');
      setResolveModal({ open: false, data: null });
      setResolutionNotes('');
      setTechnicianName('');
      setResolvedAt(new Date().toISOString().split('T')[0]);
      fetchData();
    } catch (err) { 
      toast.error('Resolution failed'); 
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/kitchen/items/${deleteModal.data.id}`);
      toast.success('Item removed from records');
      setDeleteModal({ open: false, data: null });
      setItems(prev => prev.filter(i => i.id !== deleteModal.data.id));
    } catch (err) { 
      toast.error('Deletion failed'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const getStatus = (item) => {
    if (item.quantity <= 0) return 'out';
    if (item.reorder_level > 0 && item.quantity < item.reorder_level) return 'low';
    return 'available';
  };

  const KITCHEN_CATEGORIES = ['All', 'Crockery', 'Electronics', 'Consumables'];
  const filtered = items
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .filter(i => categoryFilter === 'All' || (i.category || 'Consumables') === categoryFilter);

  const maintFilteredItems = items.filter(i => 
    !i.is_folder && 
    i.name.toLowerCase().includes(maintSearch.toLowerCase())
  );

  if (loading && !items.length && !maintenance.length && !transactions.length) return (
    <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-[#A0604E]" size={32} /></div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#F3F4F6]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A0604E] block mb-2">Department</span>
          <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight uppercase">Kitchen</h1>
          <div className="flex gap-6 mt-8 overflow-x-auto scrollbar-hide pb-1">
            {[
              { id: 'list', label: 'Items List' }, 
              { id: 'maintenance', label: 'Maintenance Log' },
              { id: 'history', label: 'History' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`text-[11px] font-black pb-3 border-b-2 transition-all uppercase tracking-[0.2em] whitespace-nowrap ${activeTab === tab.id ? 'border-[#A0604E] text-[#A0604E]' : 'border-transparent text-[#9CA3AF]'}`}>{tab.label}</button>
            ))}
          </div>
        </div>
        {activeTab === 'list' && (
          <button onClick={() => {
            setItemForm({ name: '', quantity: 0, unit: 'pcs', reorder_level: 5, category: 'Consumables', notes: '', is_folder: false, parent_id: null, classification: '' });
            setItemModal({ open: true, mode: 'add', data: null });
          }} className="btn-primary h-12 px-8 shadow-premium"><Plus size={18} /> REGISTER ITEM</button>
        )}
      </div>

      {activeTab === 'list' ? (
        <div className="space-y-6">
          {/* Category filter tabs */}
          <div className="flex items-center gap-1 bg-[#F9FAFB] rounded-xl p-1 w-fit border border-[#F3F4F6]">
            {KITCHEN_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilter === cat ? 'bg-[#A0604E] text-white shadow-sm' : 'text-[#9CA3AF] hover:text-[#1A1A1A]'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 bg-white border border-[#F3F4F6] rounded-2xl px-6 py-1 max-w-md shadow-sm">
            <Search className="text-[#9CA3AF]" size={18} />
            <input className="bg-transparent border-none focus:ring-0 w-full h-11 text-[14px] placeholder:text-[#9CA3AF]" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="system-card p-0 overflow-hidden shadow-sm">
            <div className="overflow-x-auto table-scroll">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    
                    <th className="px-6 py-4">Item</th>
                    <th className="hidden md:table-cell px-6 py-4">Category</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="hidden md:table-cell px-6 py-4">Status</th>
                    <th className="text-right px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {filtered.map(item => {
                    const parentFolder = item.parent_id ? items.find(i => i.id === item.parent_id) : null;
                    return (
                      <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-[#FDF5F3] text-[#A0604E] rounded-xl flex items-center justify-center shrink-0">
                              {item.is_folder ? <Folder size={20} /> : <CookingPot size={20} />}
                            </div>
                            <div>
                              <span className="font-bold text-[#1A1A1A] block uppercase tracking-tight">{item.name}</span>
                              <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest block mt-0.5">
                                {parentFolder ? `📁 ${parentFolder.name}  •  ` : ''}
                                {item.classification ? `Class: ${item.classification}  •  ` : ''}
                                {item.notes || 'No notes'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4">
                          {item.is_folder ? (
                            <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">N/A</span>
                          ) : (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[#F3F4F6] text-[#6B7280]">{item.category || 'Consumables'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {item.is_folder ? (
                            <span className="px-3 py-1 rounded-lg bg-[#EAE3F0] text-[#692994] text-[9px] font-black uppercase tracking-[0.15em]">FOLDER</span>
                          ) : (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-lg font-black text-[#1A1A1A] tracking-tighter">{item.quantity}</span>
                              <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{item.unit || 'pcs'}</span>
                            </div>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-6 py-4">
                          {item.is_folder ? (
                            <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">N/A</span>
                          ) : (
                            (() => {
                              const status = getStatus(item);
                              if (status === 'out') return <span className="px-3 py-1 rounded-lg bg-[#FCEBEB] text-[#A32D2D] text-[9px] font-black uppercase tracking-[0.15em]">Critical: Out</span>;
                              if (status === 'low') return <span className="px-3 py-1 rounded-lg bg-[#FAEEDA] text-[#854F0B] text-[9px] font-black uppercase tracking-[0.15em]">Low Stock Alert</span>;
                              return <span className="px-3 py-1 rounded-lg bg-[#EAF3DE] text-[#3B6D11] text-[9px] font-black uppercase tracking-[0.15em]">Available</span>;
                            })()
                          )}
                        </td>
                        <td className="text-right px-6 py-4">
                          <div className="flex justify-end gap-2">
                            {!item.is_folder && (
                              <>
                                <button title="Restock" onClick={() => setStockModal({ open: true, type: 'restock', data: item })} className="w-8 h-8 flex items-center justify-center bg-[#EAF3DE] text-[#3B6D11] rounded-full hover:scale-110 transition-transform"><ArrowUpRight size={16} /></button>
                                <button title="Withdraw" onClick={() => setStockModal({ open: true, type: 'withdraw', data: item })} className="w-8 h-8 flex items-center justify-center bg-[#FAEEDA] text-[#854F0B] rounded-full hover:scale-110 transition-transform"><ArrowDownLeft size={16} /></button>
                              </>
                            )}
                            <button title="Edit Item" onClick={() => {
                              setItemForm({ 
                                name: item.name, 
                                quantity: item.quantity, 
                                unit: item.unit || 'pcs', 
                                reorder_level: item.reorder_level ?? 5, 
                                category: item.category || 'Consumables', 
                                notes: item.notes || '',
                                is_folder: !!item.is_folder,
                                parent_id: item.parent_id || null,
                                classification: item.classification || ''
                              });
                              setItemModal({ open: true, mode: 'edit', data: item });
                            }} className="w-8 h-8 flex items-center justify-center bg-gray-100 text-[#6B7280] rounded-full hover:scale-110 transition-transform"><Wrench size={16} /></button>
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
        </div>
      ) : activeTab === 'history' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4 bg-white border border-[#F3F4F6] rounded-[24px] p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#9CA3AF]" />
              <input type="date" className="bg-transparent border-none text-xs text-[#4B5563] focus:ring-0" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <span className="text-[#9CA3AF] text-xs">to</span>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#9CA3AF]" />
              <input type="date" className="bg-transparent border-none text-xs text-[#4B5563] focus:ring-0" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <button onClick={fetchData} className="ml-auto flex items-center gap-2 bg-[#1A1A1A] hover:bg-[#333] text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors"><Filter size={12} /> Filter Records</button>
          </div>

          <div className="system-card p-0 overflow-hidden shadow-sm">
            <div className="overflow-x-auto table-scroll">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Quantity</th>
                    <th className="px-6 py-4">Reason/Notes</th>
                    <th className="px-6 py-4">Logged By</th>
                    <th className="px-6 py-4">Serviced By</th>
                    <th className="px-6 py-4">Resolved At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-[#F9FAFB] transition-colors text-xs">
                      <td className="px-6 py-4 font-bold text-[#1A1A1A]">{new Date(t.transaction_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${t.action === 'restock' || t.action === 'added' ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#FAEEDA] text-[#854F0B]'}`}>{t.action}</span>
                      </td>
                      <td className="px-6 py-4 font-bold uppercase">{t.item_name}</td>
                      <td className="px-6 py-4 font-black">{t.quantity}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{t.reason || t.notes || '—'}</td>
                      <td className="px-6 py-4 font-medium text-[#4B5563]">{t.action_by_name || 'System'}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-[#9CA3AF] uppercase text-[10px] font-black tracking-widest">No recent transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white border border-[#F3F4F6] rounded-[32px] p-8 h-fit shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A0604E] block mb-2">Request</span>
            <h2 className="text-xl font-black text-[#1A1A1A] uppercase tracking-tight mb-6">Log Maintenance</h2>
            <form onSubmit={handleMaintSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Target Item(s)</label>
                <input 
                  type="text" 
                  className="input-field h-11 text-xs px-4 bg-gray-50 border-gray-100" 
                  placeholder="Search items..." 
                  value={maintSearch} 
                  onChange={e => setMaintSearch(e.target.value)} 
                />
                <div className="max-h-48 overflow-y-auto border border-[#E5E7EB] rounded-2xl p-4 space-y-2 mt-2 bg-gray-50/50">
                  {maintFilteredItems.map(i => {
                    const isChecked = selectedMaintItemIds.has(i.id);
                    return (
                      <label key={i.id} className="flex items-center gap-3 cursor-pointer p-1.5 rounded-xl hover:bg-white transition-colors select-none">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 text-[#A0604E] focus:ring-[#A0604E] transition-all"
                          checked={isChecked}
                          onChange={() => {
                            const newSet = new Set(selectedMaintItemIds);
                            if (isChecked) {
                              newSet.delete(i.id);
                            } else {
                              newSet.add(i.id);
                            }
                            setSelectedMaintItemIds(newSet);
                          }}
                        />
                        <div className="text-[11px] font-black text-[#1A1A1A] uppercase tracking-tight">{i.name}</div>
                      </label>
                    );
                  })}
                  {maintFilteredItems.length === 0 && (
                    <div className="text-center text-[10px] font-black text-[#9CA3AF] uppercase py-6">No items match search</div>
                  )}
                </div>
                {selectedMaintItemIds.size > 0 && (
                  <div className="flex justify-between items-center text-[9px] font-black text-[#A0604E] uppercase tracking-widest mt-2 px-1">
                    <span>{selectedMaintItemIds.size} item(s) selected</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedMaintItemIds(new Set())} 
                      className="hover:underline text-xs"
                    >
                      Clear Selection
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Description of Issue</label>
                <textarea className="input-field min-h-[120px] py-4" value={maintForm.description} onChange={e => setMaintForm({ ...maintForm, description: e.target.value })} required placeholder="Describe what is broken or needs repair..." />
              </div>
              <button type="submit" disabled={submitting || selectedMaintItemIds.size === 0} className="btn-primary w-full h-14 uppercase tracking-widest font-black disabled:opacity-50">LOG ISSUE</button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-[#1A1A1A] uppercase tracking-tight">Active Maintenance Logs</h2>
            <div className="system-card p-0 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="px-6 py-4">Item</th>
                      <th className="px-6 py-4">Issue</th>
                      <th className="hidden md:table-cell px-6 py-4">Logged By</th>
                      <th className="hidden md:table-cell px-6 py-4">Days Open</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="text-right px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {maintenance.map(m => (
                      <tr key={m.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-bold text-[#1A1A1A] uppercase tracking-tight text-sm">{m.item_name}</span>
                        </td>
                        <td className="px-6 py-4 max-w-[200px]">
                          <span className="text-[13px] text-[#6B7280] line-clamp-2">{m.description}</span>
                          {m.status === 'resolved' && m.resolution_notes && (
                            <div className="text-[11px] text-[#15803D] mt-1 font-medium bg-[#F0FDF4] px-2 py-0.5 rounded-lg w-fit">Notes: {m.resolution_notes}</div>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-6 py-4">
                          <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest block">{m.logged_by_name || 'Staff'}</span>
                          {m.status === 'resolved' && m.technician_name && (
                            <span className="text-[10px] font-black text-[#A0604E] uppercase tracking-widest block mt-0.5">By: {m.technician_name}</span>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-6 py-4">
                          {m.status === 'resolved' ? (
                            <span className="text-xs text-[#9CA3AF]">{m.resolved_at ? new Date(m.resolved_at).toLocaleDateString() : 'Resolved'}</span>
                          ) : (
                            <span className="font-black text-[#1A1A1A]">{Math.floor((Date.now() - new Date(m.created_at)) / 86400000)}d</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg ${m.status === 'resolved' ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#FAEEDA] text-[#854F0B]'}`}>{m.status}</span>
                        </td>
                        <td className="text-right px-6 py-4">
                          {m.status === 'pending' && (
                            <button onClick={() => { 
                              setResolveModal({ open: true, data: m }); 
                              setResolutionNotes(''); 
                              setTechnicianName(''); 
                              setResolvedAt(new Date().toISOString().split('T')[0]); 
                            }} className="text-[10px] font-black text-[#A0604E] uppercase tracking-widest hover:underline whitespace-nowrap">
                              Mark Resolved
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {maintenance.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-10 text-[#9CA3AF] uppercase text-[10px] font-black tracking-widest">No maintenance logged.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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

          <button type="submit" disabled={submitting} className="btn-primary w-full h-16 text-[13px] font-black uppercase tracking-widest">
            {submitting ? <Loader2 className="animate-spin" /> : `Confirm ${stockModal.type}`}
          </button>
        </form>
      </Modal>

      <Modal isOpen={itemModal.open} onClose={() => setItemModal({ ...itemModal, open: false })} title={itemModal.mode === 'add' ? 'Register Item / Folder' : 'Modify Item'}>
        <form onSubmit={handleSaveItem} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Item Name</label>
              <input className="input-field" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} required placeholder="e.g. Basmati Rice" />
            </div>

            <div className="space-y-1.5 col-span-2 flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100/80">
              <input 
                type="checkbox" 
                id="is_folder"
                className="w-5 h-5 rounded border-gray-300 text-[#A0604E] focus:ring-[#A0604E] transition-all cursor-pointer"
                checked={itemForm.is_folder}
                onChange={e => setItemForm({
                  ...itemForm, 
                  is_folder: e.target.checked,
                  parent_id: e.target.checked ? null : itemForm.parent_id
                })}
              />
              <label htmlFor="is_folder" className="text-xs font-black uppercase tracking-widest text-[#1A1A1A] cursor-pointer select-none">
                This item is a category folder / group container
              </label>
            </div>

            {!itemForm.is_folder && (
              <>
                <div className="space-y-1.5 col-span-2">
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

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Classification (Optional)</label>
                  <input className="input-field" value={itemForm.classification || ''} onChange={e => setItemForm({...itemForm, classification: e.target.value})} placeholder="e.g. Expiration Date, Supplier" />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Category</label>
                  <select className="input-field" value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} required>
                    <option value="Consumables">Consumables</option>
                    <option value="Crockery">Crockery</option>
                    <option value="Electronics">Electronics</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Unit</label>
                  <input className="input-field" value={itemForm.unit} onChange={e => setItemForm({...itemForm, unit: e.target.value})} required placeholder="kg, liters, pcs" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Reorder Level</label>
                  <input type="number" step="any" className="input-field" value={itemForm.reorder_level} onChange={e => setItemForm({...itemForm, reorder_level: parseFloat(e.target.value)})} required />
                </div>
              </>
            )}
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black">Confirm</button>
        </form>
      </Modal>

      {/* Resolve Maintenance Modal */}
      <Modal isOpen={resolveModal.open} onClose={() => setResolveModal({ open: false, data: null })} title="Resolve Maintenance Issue">
        <form onSubmit={handleResolveMaintenance} className="space-y-6">
          <div className="space-y-1 bg-[#F9FAFB] p-5 rounded-2xl border border-[#F3F4F6]">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Equipment Item</span>
            <div className="font-bold text-[#1A1A1A] uppercase tracking-tight">{resolveModal.data?.item_name}</div>
            <p className="text-xs text-slate-500 mt-1">{resolveModal.data?.description}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Serviced By (Technician / Company)</label>
            <input 
              type="text" 
              className="input-field h-12" 
              value={technicianName} 
              onChange={e => setTechnicianName(e.target.value)} 
              required 
              placeholder="e.g. John Doe, Technical Services Ltd." 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Resolution Date</label>
            <input 
              type="date" 
              className="input-field h-12" 
              value={resolvedAt} 
              onChange={e => setResolvedAt(e.target.value)} 
              required 
              max={new Date().toISOString().split('T')[0]} 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Resolution Summary / Notes</label>
            <textarea 
              className="input-field min-h-[100px] py-4" 
              value={resolutionNotes} 
              onChange={e => setResolutionNotes(e.target.value)} 
              required 
              placeholder="Describe what was done to fix this issue (e.g. replaced parts, tightened screws, refilled fluids)..." 
              autoFocus
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Complete Repair Log'}
          </button>
        </form>
      </Modal>

      <DeleteConfirmModal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, data: null })} onConfirm={handleDelete} loading={submitting} title="Remove Item" />
    </div>
  );
}
