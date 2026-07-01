import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { ClipboardList, Plus, Search, Loader2, CheckCircle2, Clock, AlertCircle, ShoppingCart, ArrowRight, Trash2, Package, Wrench, HelpCircle, DollarSign, Eye, EyeOff, Filter, Folder, CheckCircle, Archive, Settings, ArrowLeft, ShoppingBag, ListChecks, Printer, Download, Edit } from 'lucide-react';

export default function Needs() {
  const [activeTab, setActiveTab] = useState('requisitions'); // 'requisitions' or 'shopping-lists'

  // Requisitions (Existing operational needs) states
  const [needs, setNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const userRole = localStorage.getItem('swiss_side_role') || 'staff';
  const isAdmin = userRole === 'admin';

  // Requisitions Modals
  const [needModal, setNeedModal] = useState({ open: false, mode: 'add', data: null });
  const [statusModal, setStatusModal] = useState({ open: false, action: '', data: null });
  const [addToListModal, setAddToListModal] = useState({ open: false, need: null, listId: '', newListName: '', isCreatingNew: false });
  const [adminNotes, setAdminNotes] = useState('');

  // Requisitions Inline Shopping List States
  const [shopItems, setShopItems] = useState([]);
  const [shopTitle, setShopTitle] = useState('Requisition Shopping List');
  const [shopCurrency, setShopCurrency] = useState('KES');
  const [shopForm, setShopForm] = useState({ name: '', quantity: 1, unit: 'pcs', price: 0 });

  // Requisition Form
  const [needForm, setNeedForm] = useState({ 
    request_type: 'Purchase', 
    item: '', 
    quantity: 1, 
    unit: 'pcs', 
    department: 'General', 
    urgency: 'Medium', 
    estimated_price: 0, 
    notes: '' 
  });

  // Shopping Lists State
  const [lists, setLists] = useState([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [listItems, setListItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Shopping Lists Modals & Actions
  const [listModal, setListModal] = useState({ open: false, mode: 'add', data: null });
  const [deleteListModal, setDeleteListModal] = useState({ open: false, data: null });
  const [deleteItemModal, setDeleteItemModal] = useState({ open: false, data: null });
  const [purchaseModal, setPurchaseModal] = useState({ open: false, listId: null, item: null });
  const [pricePaid, setPricePaid] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  // Shopping Lists Forms
  const [listForm, setListForm] = useState({ name: '' });
  const [itemForm, setItemForm] = useState({ name: '', department: 'General', quantity: 1, unit: 'pcs', price_per_unit: 0, notes: '' });

  // Edit Item Form
  const [editItemModal, setEditItemModal] = useState({ open: false, data: null });
  const [editItemForm, setEditItemForm] = useState({ name: '', department: 'General', quantity: 1, unit: 'pcs', price_per_unit: 0, notes: '' });

  useEffect(() => {
    fetchData();
    fetchLists();
  }, []);

  // Fetch Requisitions
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.get('/needs');
      setNeeds(data.results || data);
    } catch (err) {
      toast.error('Failed to sync requisitions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch All Historical Shopping Lists
  const fetchLists = async () => {
    setListsLoading(true);
    try {
      const data = await api.get('/reports/shopping-lists');
      setLists(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      toast.error('Failed to load shopping lists');
    } finally {
      setListsLoading(false);
    }
  };

  // Open Details of a Single Shopping List
  const selectList = async (list) => {
    setSelectedList(list);
    setItemsLoading(true);
    try {
      const data = await api.get(`/reports/shopping-lists/${list.id}`);
      setListItems(data.items || []);
    } catch (err) {
      toast.error('Failed to load list details');
    } finally {
      setItemsLoading(false);
    }
  };

  // Create or Rename List
  const handleSaveList = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (listModal.mode === 'add') {
        const response = await api.post('/reports/shopping-lists', { name: listForm.name });
        toast.success('Procurement list created successfully');
        setListModal({ open: false, mode: 'add', data: null });
        await fetchLists();
        if (response && response.id) {
          selectList(response);
        }
      } else {
        await api.put(`/reports/shopping-lists/${listModal.data.id}`, { name: listForm.name });
        toast.success('Procurement list renamed successfully');
        setListModal({ open: false, mode: 'add', data: null });
        await fetchLists();
        if (selectedList?.id === listModal.data.id) {
          setSelectedList(prev => ({ ...prev, name: listForm.name }));
        }
      }
    } catch (err) {
      toast.error('Failed to save list');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Status of Selected List
  const handleUpdateListStatus = async (status) => {
    if (!selectedList) return;
    try {
      await api.put(`/reports/shopping-lists/${selectedList.id}`, { name: selectedList.name, status });
      toast.success(`List status updated to ${status}`);
      setSelectedList(prev => ({ ...prev, status }));
      setLists(prev => prev.map(l => l.id === selectedList.id ? { ...l, status } : l));
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Add Item to Single List
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!selectedList) return;
    setSubmitting(true);
    try {
      await api.post(`/reports/shopping-lists/${selectedList.id}/items`, {
        name: itemForm.name,
        department: itemForm.department,
        suggested_quantity: parseFloat(itemForm.quantity) || 1,
        unit: itemForm.unit,
        price_per_unit: parseFloat(itemForm.price_per_unit) || 0,
        notes: itemForm.notes
      });
      toast.success('Item added to procurement list');
      setItemForm({ name: '', department: 'General', quantity: 1, unit: 'pcs', price_per_unit: 0, notes: '' });
      selectList(selectedList); // Refresh detail
    } catch (err) {
      toast.error('Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Shopping List
  const handleDeleteList = async () => {
    if (!deleteListModal.data) return;
    setSubmitting(true);
    try {
      await api.delete(`/reports/shopping-lists/${deleteListModal.data.id}`);
      toast.success('Procurement list deleted');
      if (selectedList?.id === deleteListModal.data.id) {
        setSelectedList(null);
        setListItems([]);
      }
      setDeleteListModal({ open: false, data: null });
      fetchLists();
    } catch (err) {
      toast.error('Failed to delete list');
    } finally {
      setSubmitting(false);
    }
  };

  // Download Shopping List as PDF Statement
  const handleDownloadListPDF = async () => {
    if (!selectedList) return;
    const toastId = toast.loading('Compiling shopping list PDF...');
    try {
      const response = await api.get(`/reports/shopping-lists/${selectedList.id}/pdf`, { responseType: 'blob' });
      const blob = response instanceof Blob ? response : new Blob([response.data || response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeListName = (selectedList.name || 'procurement').replace(/[^a-zA-Z0-9]/g, '_');
      link.setAttribute('download', `Swiss_Side_Shopping_List_${safeListName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Shopping list PDF downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to compile and download shopping list.', { id: toastId });
    }
  };

  // Delete Item from Single List
  const handleDeleteItem = async () => {
    if (!deleteItemModal.data) return;
    setSubmitting(true);
    try {
      await api.delete(`/reports/shopping-lists/${selectedList.id}/items/${deleteItemModal.data.id}`);
      toast.success('Item removed from list');
      setDeleteItemModal({ open: false, data: null });
      selectList(selectedList);
    } catch (err) {
      toast.error('Failed to remove item');
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Edit Item Modal
  const triggerEditItem = (item) => {
    setEditItemModal({ open: true, data: item });
    setEditItemForm({
      name: item.name,
      department: item.department || 'General',
      quantity: item.suggested_quantity || item.quantity || 1,
      unit: item.unit || 'pcs',
      price_per_unit: item.price_per_unit || 0,
      notes: item.notes || ''
    });
  };

  // Submit Edited Item
  const handleEditItem = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/reports/shopping-lists/${selectedList.id}/items/${editItemModal.data.id}`, {
        name: editItemForm.name,
        department: editItemForm.department,
        suggested_quantity: parseFloat(editItemForm.quantity) || 1,
        unit: editItemForm.unit,
        price_per_unit: parseFloat(editItemForm.price_per_unit) || 0,
        notes: editItemForm.notes
      });
      toast.success('Item updated successfully');
      setEditItemModal({ open: false, data: null });
      selectList(selectedList); // Refresh list items
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update item');
    } finally {
      setSubmitting(false);
    }
  };

  // Mark Item as Purchased & Auto-Restock
  const handleConfirmPurchase = async (e) => {
    e.preventDefault();
    if (!purchaseModal.item) return;
    setSubmitting(true);
    try {
      await api.patch(`/reports/shopping-lists/${purchaseModal.listId}/items/${purchaseModal.item.id}/purchase`, {
        actual_price_paid: parseFloat(pricePaid),
        notes: purchaseNotes
      });
      toast.success(`${purchaseModal.item.name} checked off & restocked successfully!`);
      setPurchaseModal({ open: false, listId: null, item: null });
      setPricePaid('');
      setPurchaseNotes('');
      selectList(selectedList); // Refresh
    } catch (err) {
      toast.error(err.response?.data?.error || 'Purchase logging failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Edit Requisition Modal
  const triggerEditNeed = (need) => {
    setNeedForm({
      request_type: need.request_type || 'Purchase',
      item: need.item || '',
      quantity: need.quantity || 1,
      unit: need.unit || 'pcs',
      department: need.department || 'General',
      urgency: need.urgency || 'Medium',
      estimated_price: need.estimated_price || 0,
      notes: need.notes || ''
    });
    setNeedModal({ open: true, mode: 'edit', data: need });
  };

  // Requisitions Handlers
  const handleSaveNeed = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (needModal.mode === 'add') {
        await api.post('/needs', needForm);
        toast.success('Request logged successfully');
      } else {
        await api.put(`/needs/${needModal.data.id}`, needForm);
        toast.success('Request updated successfully');
      }
      setNeedModal({ open: false, mode: 'add', data: null });
      fetchData();
    } catch (err) { 
      toast.error('Saving request failed'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleUpdateStatus = async () => {
    setSubmitting(true);
    try {
      let nextStatus = 'pending';
      if (statusModal.action === 'Approve') nextStatus = 'approved';
      else if (statusModal.action === 'Order') nextStatus = 'ordered';
      else if (statusModal.action === 'Fulfill') nextStatus = 'fulfilled';
      else if (statusModal.action === 'Dismiss') nextStatus = 'dismissed';

      await api.patch(`/needs/${statusModal.data.id}/status`, { 
        status: nextStatus,
        notes: adminNotes
      });
      toast.success(`Request marked as ${nextStatus}`);
      
      setNeeds(prev => prev.map(n => 
        n.id === statusModal.data.id ? { ...n, status: nextStatus, resolution_notes: adminNotes } : n
      ));
      setStatusModal({ open: false, action: '', data: null });
      setAdminNotes('');
    } catch (err) { 
      toast.error('Failed to update status'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleAddToShoppingList = (need) => {
    // Filter active draft/ordered shopping lists
    const activeLists = lists.filter(l => l.status === 'Draft' || l.status === 'Ordered');
    
    if (activeLists.length === 0) {
      setAddToListModal({
        open: true,
        need,
        listId: '',
        newListName: `${need.department} Restock Run - ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`,
        isCreatingNew: true
      });
    } else {
      setAddToListModal({
        open: true,
        need,
        listId: activeLists[0].id.toString(),
        newListName: '',
        isCreatingNew: false
      });
    }
  };

  const handleConfirmAddToList = async (e) => {
    e.preventDefault();
    if (!addToListModal.need) return;

    setSubmitting(true);
    const toastId = toast.loading('Adding request to procurement checklist...');
    try {
      let targetListId = addToListModal.listId;

      // 1. If creating a new procurement list on the fly
      if (addToListModal.isCreatingNew) {
        if (!addToListModal.newListName.trim()) {
          toast.error('Please enter a shopping list name', { id: toastId });
          setSubmitting(false);
          return;
        }
        const response = await api.post('/reports/shopping-lists', { name: addToListModal.newListName });
        targetListId = response.id.toString();
      }

      // 2. Add the item to the database-stored shopping list items
      await api.post(`/reports/shopping-lists/${targetListId}/items`, {
        name: addToListModal.need.item,
        department: addToListModal.need.department,
        suggested_quantity: parseFloat(addToListModal.need.quantity) || 1,
        unit: addToListModal.need.unit || 'pcs',
        price_per_unit: parseFloat(addToListModal.need.estimated_price) || 0,
        notes: `Linked from operational need requisition #${addToListModal.need.id}`
      });

      // 3. Automatically advance status of this need to 'ordered' and log reference list
      await api.patch(`/needs/${addToListModal.need.id}/status`, {
        status: 'ordered',
        notes: `Auto-dispatched to procurement list ID #${targetListId}`
      });

      toast.success('Successfully added to procurement checklist and marked as ordered!', { id: toastId });
      setAddToListModal({ open: false, need: null, listId: '', newListName: '', isCreatingNew: false });
      
      // Refresh local page tables and lists
      fetchData();
      fetchLists();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to dispatch request to shopping list', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  // Draft print window export
  const handleExportPDF = () => {
    if (shopItems.length === 0) {
      toast.error('Please add at least one item to the shopping list first.');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked! Please allow popups for this site.');
      return;
    }
    const totalCost = shopItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const htmlContent = `
      <html>
        <head>
          <title>${shopTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&display=swap');
            body { font-family: 'Outfit', sans-serif; color: #1A1A1A; margin: 0; padding: 40px; }
            .header-container { display: flex; justify-content: space-between; border-bottom: 2px solid #F3F4F6; padding-bottom: 20px; }
            .camp-details { text-align: right; font-size: 11px; color: #4B5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th { background: #F9FAFB; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 14px; border-bottom: 1px solid #E5E7EB; text-align: left; }
            td { padding: 14px; font-size: 12px; border-bottom: 1px solid #F3F4F6; }
            .right { text-align: right; }
            .totals { display: flex; justify-content: flex-end; margin-top: 30px; }
            .totals-card { width: 300px; background: #FDF5F3; border-radius: 12px; padding: 20px; border: 1px solid rgba(160, 96, 78, 0.1); }
            .totals-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; }
            .totals-row.grand { border-top: 1px solid rgba(160, 96, 78, 0.2); padding-top: 8px; font-weight: 900; color: #A0604E; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <img src="/logo.png" style="height:44px;object-fit:contain;" />
            <div class="camp-details">
              <strong>SWISS SIDE ITEN</strong><br/>
              Premier Endurance Camp • 2,400m altitude
            </div>
          </div>
          <h2>${shopTitle}</h2>
          <p style="font-size:11px;color:#9CA3AF;">Created: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr><th>Item</th><th class="right">Qty</th><th>Unit</th><th class="right">Unit Price</th><th class="right">Total</th></tr>
            </thead>
            <tbody>
              ${shopItems.map(i => `
                <tr>
                  <td>${i.name}</td><td class="right">${i.quantity}</td><td>${i.unit}</td>
                  <td class="right">${shopCurrency} ${i.price.toLocaleString()}</td>
                  <td class="right">${shopCurrency} ${(i.quantity * i.price).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div class="totals-card">
              <div class="totals-row"><span>Subtotal</span><span>${shopCurrency} ${totalCost.toLocaleString()}</span></div>
              <div class="totals-row grand"><span>EST. TOTAL</span><span>${shopCurrency} ${totalCost.toLocaleString()}</span></div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); setTimeout(window.close, 500); };</script>
        </body>
      </html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const filteredNeeds = needs.filter(n => {
    const matchesSearch = (n.item || '').toLowerCase().includes(search.toLowerCase()) || (n.notes || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || n.status === filterStatus;
    const matchesDept = filterDept === 'all' || n.department === filterDept;
    const matchesType = filterType === 'all' || n.request_type === filterType;
    return matchesSearch && matchesStatus && matchesDept && matchesType;
  });

  const totalItems = listItems.length;
  const calculateListTotal = () => listItems.reduce((sum, i) => sum + (i.quantity * (i.price_per_unit || 0)), 0);

  if (loading && !needs.length) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#A0604E]" size={32} />
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Print Overlay Styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          aside, nav, header, button, .no-print, select { display: none !important; }
          .print-area { width: 100% !important; max-width: 100% !important; margin: 0 !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#F3F4F6] no-print">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A0604E] block mb-2">Resource Procurement</span>
          <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight uppercase">Operational Needs</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTab === 'requisitions' ? (
            <>
              <button onClick={() => {
                setNeedForm({ request_type: 'Purchase', item: '', quantity: 1, unit: 'pcs', department: 'General', urgency: 'Medium', estimated_price: 0, notes: '' });
                setNeedModal({ open: true, mode: 'add', data: null });
              }} className="btn-primary h-12 px-8 shadow-premium">
                <Plus size={18} /> NEW REQUEST
              </button>
            </>
          ) : (
            selectedList ? (
              <button onClick={() => setSelectedList(null)} className="btn-primary h-12 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black uppercase text-[11px] tracking-widest flex items-center gap-2">
                <ArrowLeft size={16} /> BACK TO DIRECTORY
              </button>
            ) : (
              <button onClick={() => {
                setListForm({ name: '' });
                setListModal({ open: true, mode: 'add', data: null });
              }} className="btn-primary h-12 px-8 shadow-premium">
                <Plus size={18} /> CREATE NEW LIST
              </button>
            )
          )}
        </div>
      </div>

      {/* Tab Selector sub-navigation */}
      <div className="flex border-b border-[#F3F4F6] gap-8 no-print">
        <button
          onClick={() => setActiveTab('requisitions')}
          className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${
            activeTab === 'requisitions' ? 'text-[#A0604E]' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Requisitions
          {activeTab === 'requisitions' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#A0604E] animate-in slide-in-from-left duration-250" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('shopping-lists');
            fetchLists();
          }}
          className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${
            activeTab === 'shopping-lists' ? 'text-[#A0604E]' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Shopping Lists (Procurement)
          {activeTab === 'shopping-lists' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#A0604E] animate-in slide-in-from-left duration-250" />
          )}
        </button>
      </div>

      {/* ======================= TAB 1: REQUISITIONS ======================= */}
      {activeTab === 'requisitions' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          {/* Advanced Filter Panel */}
          <div className="bg-white border border-[#F3F4F6] rounded-[32px] p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[280px] flex items-center gap-3 bg-[#F9FAFB] border border-[#F3F4F6] rounded-2xl px-6 py-1">
                <Search className="text-[#9CA3AF]" size={18} />
                <input 
                  className="bg-transparent border-none focus:ring-0 w-full h-11 text-[14px] placeholder:text-[#9CA3AF]" 
                  placeholder="Filter requests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-[#9CA3AF] uppercase ml-1 mb-1">Status</span>
                  <select className="bg-white border border-[#F3F4F6] rounded-xl px-4 h-11 text-[11px] font-black uppercase tracking-wider outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="ordered">Ordered</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-[#9CA3AF] uppercase ml-1 mb-1">Department</span>
                  <select className="bg-white border border-[#F3F4F6] rounded-xl px-4 h-11 text-[11px] font-black uppercase tracking-wider outline-none" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                    <option value="all">All Depts</option>
                    <option value="General">General</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Spa">Spa</option>
                    <option value="Gym">Gym</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Laundry">Laundry</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-[#9CA3AF] uppercase ml-1 mb-1">Type</span>
                  <select className="bg-white border border-[#F3F4F6] rounded-xl px-4 h-11 text-[11px] font-black uppercase tracking-wider outline-none" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="all">All Types</option>
                    <option value="Purchase">Purchase</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Requisitions List Table */}
          <div className="system-card p-0 overflow-hidden shadow-sm">
            <div className="overflow-x-auto table-scroll">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="px-6 py-4">Request Detail</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Urgency</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="text-right px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {filteredNeeds.map(need => (
                    <tr key={need.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-[#FDF5F3] text-[#A0604E] rounded-xl flex items-center justify-center shrink-0">
                            {need.request_type === 'Maintenance' ? <Wrench size={20} /> : <ClipboardList size={20} />}
                          </div>
                          <div>
                            <span className="font-bold text-[#1A1A1A] block uppercase tracking-tight">{need.item}</span>
                            <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest block mb-1">
                              {need.quantity} {need.unit || 'pcs'} &bull; {need.request_type}
                            </span>
                            {need.notes && <p className="text-xs text-[#6B7280] italic max-w-sm mt-1">{need.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-black text-[#6B7280] uppercase tracking-widest">{need.department || 'General'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-lg ${
                          need.urgency === 'High' ? 'bg-[#FCEBEB] text-[#A32D2D]' : 
                          need.urgency === 'Medium' ? 'bg-[#FAEEDA] text-[#854F0B]' : 'bg-[#EAF3DE] text-[#3B6D11]'
                        }`}>
                          {need.urgency || 'Medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-[#1A1A1A]">
                          KES {parseFloat(need.estimated_price || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg ${
                          need.status === 'fulfilled' ? 'bg-[#EAF3DE] text-[#3B6D11]' : 
                          need.status === 'ordered' ? 'bg-orange-50 text-orange-700' :
                          need.status === 'approved' ? 'bg-indigo-50 text-indigo-700' :
                          need.status === 'dismissed' ? 'bg-red-50 text-red-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {need.status || 'pending'}
                        </span>
                      </td>
                      <td className="text-right px-6 py-4">
                        <div className="flex justify-end gap-1.5 items-center">
                          <button 
                            onClick={() => handleAddToShoppingList(need)} 
                            title="Add to Shopping List draft"
                            className="h-8 w-8 bg-[#FAEEDA] hover:bg-[#854F0B] hover:text-white text-[#854F0B] rounded-lg flex items-center justify-center transition-all shrink-0"
                          >
                            <ShoppingCart size={13} />
                          </button>
                          {(need.status === 'pending' || isAdmin) && (
                            <button 
                              onClick={() => triggerEditNeed(need)} 
                              title="Edit Requisition Details"
                              className="h-8 w-8 bg-amber-50 hover:bg-amber-100 text-[#BA7517] rounded-lg flex items-center justify-center transition-all shrink-0"
                            >
                              <Edit size={13} />
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              {need.status === 'pending' && (
                                <button onClick={() => setStatusModal({ open: true, action: 'Approve', data: need })} className="h-8 px-2 bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-transform shrink-0">
                                  Approve
                                </button>
                              )}
                              {(need.status === 'approved' || need.status === 'pending') && (
                                <button onClick={() => setStatusModal({ open: true, action: 'Order', data: need })} className="h-8 px-2 bg-orange-50 text-orange-700 text-[9px] font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-transform shrink-0">
                                  Order
                                </button>
                              )}
                              {need.status !== 'fulfilled' && need.status !== 'dismissed' && (
                                <button onClick={() => setStatusModal({ open: true, action: 'Fulfill', data: need })} className="h-8 px-2 bg-[#EAF3DE] text-[#3B6D11] text-[9px] font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-transform shrink-0">
                                  Fulfill
                                </button>
                              )}
                              {need.status !== 'fulfilled' && need.status !== 'dismissed' && (
                                <button onClick={() => setStatusModal({ open: true, action: 'Dismiss', data: need })} className="h-8 px-2 bg-red-50 text-[#A32D2D] text-[9px] font-black uppercase tracking-widest rounded-lg hover:scale-105 transition-transform shrink-0">
                                  Dismiss
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredNeeds.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-[#9CA3AF] uppercase text-[10px] font-black tracking-widest">No matching requests found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: SHOPPING LISTS (PROCUREMENT) ======================= */}
      {activeTab === 'shopping-lists' && (
        <div className="space-y-10 animate-in fade-in duration-300 print-area">
          {listsLoading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-[#A0604E]" size={32} />
            </div>
          ) : !selectedList ? (
            /* DIRECTORY VIEW: LIST ALL REQUISITION LISTS */
            <div className="system-card p-0 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#1A1A1A]">Historical Shopping Records</h2>
                <span className="text-xs text-slate-400 font-bold uppercase">{lists.length} Lists Saved</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th className="px-6 py-4">Shopping List Name</th>
                      <th className="px-6 py-4">Current Status</th>
                      <th className="px-6 py-4">Date Created</th>
                      <th className="text-right px-6 py-4">Action Options</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {lists.map(list => (
                      <tr 
                        key={list.id} 
                        onClick={() => selectList(list)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-all"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <Folder className="text-[#A0604E]" size={18} />
                            <span className="font-bold text-[#1A1A1A] uppercase tracking-tight text-[14px]">{list.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {list.status === 'Completed' && (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-[#EAF3DE] text-[#3B6D11] px-2.5 py-1 rounded-lg">
                              <CheckCircle2 size={10} /> FULFILLED
                            </span>
                          )}
                          {list.status === 'Ordered' && (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-orange-50 text-orange-700 px-2.5 py-1 rounded-lg">
                              <Clock size={10} /> ORDERED
                            </span>
                          )}
                          {list.status === 'Draft' && (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
                              <Folder size={10} /> DRAFT
                            </span>
                          )}
                          {list.status === 'Archived' && (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-gray-100 text-gray-400 px-2.5 py-1 rounded-lg">
                              <Archive size={10} /> ARCHIVED
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs font-semibold text-slate-500">
                            {new Date(list.created_at).toLocaleString()}
                          </span>
                        </td>
                        <td className="text-right px-6 py-5" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => {
                                setListForm({ name: list.name });
                                setListModal({ open: true, mode: 'edit', data: list });
                              }}
                              className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-[#A0604E] px-2 py-1"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => setDeleteListModal({ open: true, data: list })}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {lists.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-20 text-[#9CA3AF] uppercase text-[10px] font-black tracking-widest">
                          No active procurement shopping lists recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* DETAILED WORKSPACE VIEW FOR SELECTED LIST */
            <div className="bg-white border border-[#F3F4F6] rounded-[32px] p-8 space-y-8 shadow-sm print:border-none print:shadow-none print:p-0">
              {/* Back to Lists trigger */}
              <button 
                onClick={() => setSelectedList(null)} 
                className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-[#A0604E] flex items-center gap-2 mb-4 no-print"
              >
                <ArrowLeft size={14} /> Back to All Lists
              </button>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6 print:border-b-2 print:pb-4">
                <div>
                  <h2 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-tight print:text-3xl">{selectedList.name}</h2>
                  <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mt-1 print:text-black">
                    Procurement List Ledger &bull; Created: {new Date(selectedList.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 no-print">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Status:</span>
                    <select 
                      className="bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl px-3 h-10 text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer"
                      value={selectedList.status}
                      onChange={e => handleUpdateListStatus(e.target.value)}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Ordered">Ordered</option>
                      <option value="Completed">Completed</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>

                  <button 
                    onClick={handleDownloadListPDF}
                    className="h-10 px-4 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#1A1A1A] flex items-center gap-2 hover:bg-gray-100"
                  >
                    <Download size={14} /> Download PDF
                  </button>
                </div>
              </div>



              {/* Add New Item Inline Form */}
              <form onSubmit={handleSaveItem} className="bg-[#FAF9F7] p-6 rounded-[24px] border border-[#E0DBD6] space-y-4 no-print">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A0604E] block">Add Item to List</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#9CA3AF]">Item Name</label>
                    <input 
                      type="text" 
                      className="input-field h-11" 
                      placeholder="e.g. Bulk Rice" 
                      value={itemForm.name}
                      onChange={e => setItemForm({...itemForm, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#9CA3AF]">Department</label>
                    <select 
                      className="input-field h-11 cursor-pointer" 
                      value={itemForm.department}
                      onChange={e => setItemForm({...itemForm, department: e.target.value})}
                    >
                      <option value="General">General</option>
                      <option value="Kitchen">Kitchen</option>
                      <option value="Spa">Spa</option>
                      <option value="Gym">Gym</option>
                      <option value="Supplies">Supplies</option>
                      <option value="Laundry">Laundry</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#9CA3AF]">Qty</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        className="input-field h-11 w-24 shrink-0" 
                        value={itemForm.quantity}
                        onChange={e => setItemForm({...itemForm, quantity: parseFloat(e.target.value) || 1})}
                        required
                        min="1"
                      />
                      <input 
                        type="text" 
                        className="input-field h-11" 
                        placeholder="pcs, kg, box" 
                        value={itemForm.unit}
                        onChange={e => setItemForm({...itemForm, unit: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#9CA3AF]">Est. Unit Price (KES)</label>
                    <input 
                      type="number" 
                      className="input-field h-11" 
                      placeholder="0.00" 
                      value={itemForm.price_per_unit}
                      onChange={e => setItemForm({...itemForm, price_per_unit: parseFloat(e.target.value) || 0})}
                      required
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#9CA3AF]">Item Notes (Optional)</label>
                    <input 
                      type="text" 
                      className="input-field h-11" 
                      placeholder="e.g. Brand preference..." 
                      value={itemForm.notes}
                      onChange={e => setItemForm({...itemForm, notes: e.target.value})}
                    />
                  </div>
                  <button type="submit" disabled={submitting} className="btn-primary h-11 w-full uppercase tracking-widest text-[10px] font-black shadow-premium">
                    {submitting ? 'Adding...' : 'Add Item to List'}
                  </button>
                </div>
              </form>

              {/* Shopping List Items Table */}
              {itemsLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#A0604E]" size={24} /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left print:text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 print:border-b-2">
                        <th className="py-4">Item Description</th>
                        <th className="py-4">Department</th>
                        <th className="py-4">Qty</th>
                        <th className="py-4">Est. Price</th>
                        <th className="py-4 text-right">Total (KES)</th>
                        <th className="py-4 text-right no-print">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {listItems.map(item => (
                        <tr key={item.id} className={`transition-colors ${item.purchased ? 'bg-green-50/40 hover:bg-green-50/60' : 'hover:bg-gray-50/50'}`}>
                          <td className="py-4 font-bold text-[#1A1A1A] uppercase tracking-tight flex items-center gap-2">
                            {item.purchased ? (
                              <CheckCircle className="text-green-600 shrink-0" size={16} />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                            )}
                            <div>
                              <span className={item.purchased ? 'line-through text-slate-400 font-medium' : ''}>{item.name}</span>
                              {item.notes && (
                                <span className="text-[10px] text-slate-500 font-bold block mt-0.5 normal-case tracking-normal">
                                  Note: {item.notes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">{item.department || 'General'}</td>
                          <td className="py-4">
                            <span className="font-black text-[15px]">{item.suggested_quantity || item.quantity}</span> <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit || 'pcs'}</span>
                          </td>
                          <td className="py-4 font-semibold text-slate-600">
                            KES {parseFloat(item.price_per_unit || 0).toLocaleString()}
                          </td>
                          <td className="py-4 font-black text-right text-[#1A1A1A]">
                            {item.purchased ? (
                              <div className="text-right">
                                <span className="text-[9px] font-black uppercase tracking-widest text-green-600 block">PAID TOTAL</span>
                                <span className="text-green-700 text-sm">KES {parseFloat((item.actual_price_paid || item.price_paid || 0) * (item.suggested_quantity || item.quantity || 1)).toLocaleString()}</span>
                              </div>
                            ) : (
                              <span>KES {parseFloat((item.suggested_quantity || item.quantity || 1) * (item.price_per_unit || 0)).toLocaleString()}</span>
                            )}
                          </td>
                          <td className="py-4 text-right no-print">
                            <div className="flex justify-end gap-2">
                              {!item.purchased ? (
                                <>
                                  <button 
                                    onClick={() => triggerEditItem(item)}
                                    className="w-8 h-8 flex items-center justify-center bg-amber-50 text-[#BA7517] hover:bg-amber-100 rounded-full transition-transform"
                                    title="Edit Item"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button 
                                    onClick={() => setDeleteItemModal({ open: true, data: item })}
                                    className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 hover:text-red-700 rounded-full transition-transform"
                                    title="Delete Item"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <span className="text-[9px] font-black uppercase tracking-[0.15em] bg-[#EAF3DE] text-[#3B6D11] px-2.5 py-1 rounded-lg">RESTOCKED</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {listItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-[#9CA3AF] uppercase text-[10px] font-black tracking-widest">
                            No items added to this procurement list yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals Panel bottom banner */}
              <div className="bg-[#F9FAFB] rounded-[24px] p-6 flex flex-col md:flex-row justify-between items-center gap-4 print:bg-white print:border-t-2 print:rounded-none">
                <div className="text-center md:text-left">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Procurement Cost</span>
                  <p className="text-[11px] text-slate-500 font-medium">Summed value of all active list lines</p>
                </div>
                <div className="text-2xl font-black text-[#A0604E] tracking-tighter print:text-black">
                  KES {calculateListTotal().toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/*                       SHARED MODALS                          */}
      {/* ============================================================ */}

      {/* Log Requisition Form Modal */}
      <Modal isOpen={needModal.open} onClose={() => setNeedModal({ ...needModal, open: false })} title={needModal.mode === 'add' ? 'Log Request' : 'Modify Request'}>
        <form onSubmit={handleSaveNeed} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Type</label>
              <select className="input-field cursor-pointer" value={needForm.request_type} onChange={e => setNeedForm({...needForm, request_type: e.target.value})}>
                <option value="Purchase">Purchase Request</option>
                <option value="Maintenance">Maintenance Request</option>
              </select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Item Name</label>
              <input className="input-field" value={needForm.item} onChange={e => setNeedForm({...needForm, item: e.target.value})} required placeholder="e.g. Bulk laundry soap" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Quantity</label>
              <input type="number" className="input-field" value={needForm.quantity} onChange={e => setNeedForm({...needForm, quantity: parseFloat(e.target.value)})} required />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Unit</label>
              <input className="input-field" value={needForm.unit} onChange={e => setNeedForm({...needForm, unit: e.target.value})} required placeholder="pcs, liters, boxes" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Department</label>
              <select className="input-field cursor-pointer" value={needForm.department} onChange={e => setNeedForm({...needForm, department: e.target.value})}>
                <option>General</option>
                <option>Kitchen</option>
                <option>Spa</option>
                <option>Gym</option>
                <option>Supplies</option>
                <option>Laundry</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Urgency</label>
              <select className="input-field cursor-pointer" value={needForm.urgency} onChange={e => setNeedForm({...needForm, urgency: e.target.value})}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Estimated Price (KES)</label>
              <input type="number" className="input-field" value={needForm.estimated_price} onChange={e => setNeedForm({...needForm, estimated_price: parseFloat(e.target.value)})} required />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Notes / Details</label>
              <textarea className="input-field py-4 min-h-[100px]" value={needForm.notes} onChange={e => setNeedForm({...needForm, notes: e.target.value})} placeholder="Specify links, model details, or priority justifications..." />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black">SAVE REQUEST</button>
        </form>
      </Modal>

      {/* Administrative Requisition Transition Modal */}
      <Modal isOpen={statusModal.open} onClose={() => setStatusModal({ open: false, action: '', data: null })} title={`${statusModal.action} Requisition`}>
        <div className="space-y-8 text-center py-4">
          <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 size={40} />
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-black text-[#1A1A1A] uppercase tracking-tight">{statusModal.action} Request?</h3>
            <p className="text-[14px] text-slate-500 mt-2">
              Confirming will transition <strong>{statusModal.data?.item}</strong> state.
            </p>
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Administrative Notes (Reason / Feedback)</label>
              <textarea 
                className="input-field min-h-[80px] py-3 text-sm" 
                value={adminNotes} 
                onChange={e => setAdminNotes(e.target.value)} 
                placeholder="Provide reasoning or action details (this will be emailed to the requesting staff member)..."
              />
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setStatusModal({ open: false, action: '', data: null })} className="btn-secondary flex-1 h-14">Cancel</button>
            <button onClick={handleUpdateStatus} disabled={submitting} className="btn-primary flex-1 h-14 uppercase tracking-wider">Confirm</button>
          </div>
        </div>
      </Modal>      {/* Requisitions Database Sourcing List Selector Modal */}
      <Modal isOpen={addToListModal.open} onClose={() => setAddToListModal({ ...addToListModal, open: false })} title="Add Request to Procurement List">
        <div className="space-y-6">
          {addToListModal.need && (
            <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-[#FAEEDA] space-y-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#A0604E] block">Target Request Details</span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-0.5">Item Description</span>
                  <span className="text-xs font-black text-[#1A1A1A] uppercase tracking-tight">{addToListModal.need.item}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-0.5">Department Module</span>
                  <span className="text-xs font-black text-[#854F0B] uppercase tracking-tight">{addToListModal.need.department}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-0.5">Required Quantity</span>
                  <span className="text-xs font-black text-[#1A1A1A]">{addToListModal.need.quantity} {addToListModal.need.unit}</span>
                </div>
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-0.5">Est. Price per Unit</span>
                  <span className="text-xs font-black text-[#1A1A1A]">KES {(parseFloat(addToListModal.need.estimated_price) || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Conditional Dropdown Selection */}
            {!addToListModal.isCreatingNew ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-1">Select Active Procurement List</label>
                <select 
                  className="input-field cursor-pointer h-12 text-sm font-semibold text-[#1A1A1A]"
                  value={addToListModal.listId}
                  onChange={e => {
                    if (e.target.value === 'NEW') {
                      setAddToListModal(prev => ({
                        ...prev,
                        isCreatingNew: true,
                        newListName: `${prev.need?.department || 'General'} Restock Run - ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`
                      }));
                    } else {
                      setAddToListModal(prev => ({ ...prev, listId: e.target.value }));
                    }
                  }}
                >
                  {lists.filter(l => l.status === 'Draft' || l.status === 'Ordered').map(list => (
                    <option key={list.id} value={list.id}>{list.name} ({list.status})</option>
                  ))}
                  <option value="NEW" className="font-bold text-[#A0604E]">+ Create a Brand New List...</option>
                </select>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] block mb-1">New Procurement List Name</label>
                  <input 
                    type="text"
                    className="input-field h-12 text-sm font-semibold text-[#1A1A1A]"
                    placeholder="e.g. May Food Sourcing Run..."
                    value={addToListModal.newListName}
                    onChange={e => setAddToListModal(prev => ({ ...prev, newListName: e.target.value }))}
                    autoFocus
                  />
                </div>
                {lists.filter(l => l.status === 'Draft' || l.status === 'Ordered').length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setAddToListModal(prev => ({ ...prev, isCreatingNew: false }))}
                    className="text-[10px] font-black uppercase tracking-widest text-[#A0604E] hover:underline block"
                  >
                    ← Select an existing active list
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setAddToListModal({ open: false, need: null, listId: '', newListName: '', isCreatingNew: false })} 
              className="btn-secondary flex-1 h-12 text-xs font-black uppercase tracking-widest"
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleConfirmAddToList} 
              disabled={submitting} 
              className="btn-primary flex-1 h-12 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Adding...
                </>
              ) : (
                'Confirm Add'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create / Rename Procurement Shopping List Modal */}
      <Modal isOpen={listModal.open} onClose={() => setListModal({ ...listModal, open: false })} title={listModal.mode === 'add' ? 'Create Procurement List' : 'Rename Procurement List'}>
        <form onSubmit={handleSaveList} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">List Name / Target Title</label>
            <input 
              className="input-field" 
              value={listForm.name} 
              onChange={e => setListForm({...listForm, name: e.target.value})} 
              required 
              placeholder="e.g. May Food Procurement" 
              autoFocus 
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black shadow-premium">
            {submitting ? 'Processing...' : 'Confirm List'}
          </button>
        </form>
      </Modal>

      {/* Buy / Purchase Prompt Modal */}
      <Modal isOpen={purchaseModal.open} onClose={() => setPurchaseModal({ open: false, listId: null, item: null })} title="Log Item Purchase">
        <form onSubmit={handleConfirmPurchase} className="space-y-6">
          <div className="space-y-1 bg-[#F9FAFB] p-5 rounded-2xl border border-[#F3F4F6]">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#9CA3AF]">Procured Line Item</span>
            <div className="font-bold text-[#1A1A1A] uppercase tracking-tight">{purchaseModal.item?.name}</div>
            <div className="text-xs text-slate-500 mt-1">
              Quantity to auto-restock: <span className="font-bold text-[#1A1A1A]">{purchaseModal.item?.suggested_quantity || purchaseModal.item?.quantity} {purchaseModal.item?.unit}</span> inside the <span className="font-bold text-[#1A1A1A]">{purchaseModal.item?.department}</span> inventory module.
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Actual Price Paid per Unit (KES)</label>
            <div className="relative">
              <input 
                type="number" 
                step="0.01" 
                className="input-field pl-12 font-black text-lg h-14" 
                value={pricePaid} 
                onChange={e => setPricePaid(e.target.value)} 
                required 
                min="0" 
                placeholder="0.00" 
                autoFocus
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">KES</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium ml-1">Defaulted to target budget price. Correct this value to log exact ledger cost.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Transaction notes / Reference (Optional)</label>
            <textarea 
              className="input-field py-3 min-h-[80px]" 
              placeholder="e.g. Purchased from Iten Supermarket, receipt #425" 
              value={purchaseNotes}
              onChange={e => setPurchaseNotes(e.target.value)}
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Complete Transaction & Restock'}
          </button>
        </form>
      </Modal>

      {/* Edit Shopping List Item Modal */}
      <Modal isOpen={editItemModal.open} onClose={() => setEditItemModal({ open: false, data: null })} title="Edit Shopping List Item">
        <form onSubmit={handleEditItem} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Item Name</label>
            <input 
              className="input-field" 
              value={editItemForm.name} 
              onChange={e => setEditItemForm({...editItemForm, name: e.target.value})} 
              required 
              placeholder="e.g. Bulk Rice" 
              autoFocus 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Department</label>
              <select 
                className="input-field cursor-pointer"
                value={editItemForm.department}
                onChange={e => setEditItemForm({...editItemForm, department: e.target.value})}
              >
                <option value="General">General</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Spa">Spa</option>
                <option value="Gym">Gym</option>
                <option value="Supplies">Supplies</option>
                <option value="Laundry">Laundry</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Est. Unit Price (KES)</label>
              <input 
                type="number" 
                className="input-field" 
                value={editItemForm.price_per_unit} 
                onChange={e => setEditItemForm({...editItemForm, price_per_unit: parseFloat(e.target.value) || 0})} 
                min="0"
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Quantity</label>
              <input 
                type="number" 
                className="input-field" 
                value={editItemForm.quantity} 
                onChange={e => setEditItemForm({...editItemForm, quantity: parseFloat(e.target.value) || 1})} 
                min="1"
                required 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Unit</label>
              <input 
                className="input-field" 
                value={editItemForm.unit} 
                onChange={e => setEditItemForm({...editItemForm, unit: e.target.value})} 
                required 
                placeholder="e.g. kg, box, pcs" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Item Notes (Brand preference, details)</label>
            <input 
              className="input-field" 
              value={editItemForm.notes} 
              onChange={e => setEditItemForm({...editItemForm, notes: e.target.value})} 
              placeholder="e.g. Hostess brand preferable" 
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black shadow-premium">
            {submitting ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </form>
      </Modal>

      <DeleteConfirmModal isOpen={deleteListModal.open} onClose={() => setDeleteListModal({ open: false, data: null })} onConfirm={handleDeleteList} loading={submitting} title="Remove Procurement List" />
      <DeleteConfirmModal isOpen={deleteItemModal.open} onClose={() => setDeleteItemModal({ open: false, data: null })} onConfirm={handleDeleteItem} loading={submitting} title="Remove Item from List" />
    </div>
  );
}
