import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { Home, Plus, Search, Loader2, Users, DoorOpen, Key, Calendar, ArrowRight, UserPlus, UserMinus, Settings, ClipboardList, Wrench, Package, Layers, CheckCircle2, Folder, Trash2 } from 'lucide-react';

export default function Accommodation() {
  const [properties, setProperties] = useState([]);
  const [houses, setHouses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomItemsMap, setRoomItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Selections
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modals
  const [roomModal, setRoomModal] = useState({ open: false, mode: 'add', data: null });
  const [assignModal, setAssignModal] = useState({ open: false, data: null });
  const [checkoutModal, setCheckoutModal] = useState({ open: false, data: null });
  const [maintModal, setMaintModal] = useState({ open: false, targetName: '', data: null });
  const [assetModal, setAssetModal] = useState({ open: false, mode: 'add', roomId: null, data: null });
  const [deleteAssetModal, setDeleteAssetModal] = useState({ open: false, data: null });
  const [deleteRoomModal, setDeleteRoomModal] = useState({ open: false, data: null });
  const [editResidentModal, setEditResidentModal] = useState({ open: false, data: null });
  const [assetForm, setAssetForm] = useState({ name: '', quantity: 1, condition_status: 'good', notes: '' });

  // Forms
  const [roomForm, setRoomForm] = useState({ room_number: '', room_type: 'Single', capacity: 1, status: 'available', notes: '' });
  const [assignForm, setAssignForm] = useState({ guest_name: '', check_in_date: new Date().toISOString().split('T')[0] });
  const [editResidentForm, setEditResidentForm] = useState({ guest_name: '', check_in_date: '' });
  const [maintForm, setMaintForm] = useState({ description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Rooms
      const roomsData = await api.get('/accommodation/rooms');
      const loadedRooms = roomsData.results || roomsData;
      setRooms(loadedRooms);

      // Create local properties & houses representation if backend tables are sparse
      const uniqueProps = [...new Set(loadedRooms.map(r => r.property_name || 'Main Property'))];
      const propsList = uniqueProps.map((name, idx) => ({ id: idx + 1, name }));
      setProperties(propsList);
      if (propsList.length > 0) setSelectedProperty(propsList[0]);

      // Create unique houses map
      const uniqueHouses = [];
      loadedRooms.forEach(r => {
        const houseName = r.house_name || 'House Alpha';
        if (!uniqueHouses.some(h => h.name === houseName)) {
          uniqueHouses.push({ id: uniqueHouses.length + 1, name: houseName, property_id: 1 });
        }
      });
      setHouses(uniqueHouses);
      if (uniqueHouses.length > 0) setSelectedHouse(uniqueHouses[0]);

      // Fetch items for each room from the actual database
      const itemsMap = {};
      await Promise.all(loadedRooms.map(async (room) => {
        try {
          const res = await api.get(`/accommodation/houses/${room.id}/items`);
          itemsMap[room.id] = Array.isArray(res) ? res : (res.results || []);
        } catch (e) {
          itemsMap[room.id] = [];
        }
      }));
      setRoomItemsMap(itemsMap);

    } catch (err) {
      toast.error('Failed to sync accommodation registry');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoom = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (roomModal.mode === 'add') {
        await api.post('/accommodation/rooms', roomForm);
        toast.success('Room registered in system');
      } else {
        await api.put(`/accommodation/rooms/${roomModal.data.id}`, roomForm);
        toast.success('Room records updated');
      }
      setRoomModal({ open: false, mode: 'add', data: null });
      fetchData();
    } catch (err) { 
      toast.error('Failed to save room details'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.post(`/accommodation/rooms/${assignModal.data.id}/assign`, assignForm);
      if (response.item) {
        setRooms(prev => prev.map(room => 
          room.id === response.item.id ? { ...room, ...response.item } : room
        ));
      } else {
        fetchData();
      }
      toast.success('Resident checked in successfully');
      setAssignModal({ open: false, data: null });
    } catch (err) { 
      toast.error('Check-in assignment failed'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      const response = await api.post(`/accommodation/rooms/${checkoutModal.data.id}/checkout`);
      if (response.item) {
        setRooms(prev => prev.map(room => 
          room.id === response.item.id ? { ...room, ...response.item } : room
        ));
      } else {
        fetchData();
      }
      toast.success('Resident checked out successfully');
      setCheckoutModal({ open: false, data: null });
    } catch (err) { 
      toast.error('Checkout transition failed'); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const handleMaintSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Hook maintenance ticket directly to the unified Requests/Needs system!
      await api.post('/needs', {
        request_type: 'Maintenance',
        item: maintModal.targetName,
        department: 'Accommodation',
        urgency: 'Medium',
        notes: maintForm.description,
        estimated_price: 0
      });
      toast.success('Maintenance ticket propagated to Requests pipeline');
      setMaintForm({ description: '' });
      setMaintModal({ open: false, targetName: '', data: null });
    } catch (err) {
      toast.error('Failed to report maintenance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (assetModal.mode === 'edit') {
        await api.put(`/accommodation/houses/${assetModal.roomId}/items/${assetModal.data.id}`, assetForm);
        toast.success('Asset details updated');
      } else {
        await api.post(`/accommodation/houses/${assetModal.roomId}/items`, assetForm);
        toast.success('Asset registered to room');
      }
      setAssetModal({ open: false, mode: 'add', roomId: null, data: null });
      fetchData();
    } catch (e) {
      toast.error(assetModal.mode === 'edit' ? 'Failed to update asset' : 'Failed to register asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/accommodation/items/${deleteAssetModal.data.id}`);
      toast.success('Asset removed from room');
      setDeleteAssetModal({ open: false, data: null });
      fetchData();
    } catch (err) {
      toast.error('Failed to remove asset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deleteRoomModal.data) return;
    setSubmitting(true);
    try {
      await api.delete(`/accommodation/rooms/${deleteRoomModal.data.id}`);
      toast.success('Room decommissioned and removed from system');
      setDeleteRoomModal({ open: false, data: null });
      fetchData();
    } catch (err) {
      toast.error('Failed to delete room');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveResidentDetails = async (e) => {
    e.preventDefault();
    if (!editResidentModal.data) return;
    setSubmitting(true);
    try {
      const response = await api.put(`/accommodation/rooms/${editResidentModal.data.id}/resident`, editResidentForm);
      if (response.item) {
        setRooms(prev => prev.map(room => 
          room.id === response.item.id ? { ...room, ...response.item } : room
        ));
      } else {
        fetchData();
      }
      toast.success('Resident details updated successfully');
      setEditResidentModal({ open: false, data: null });
    } catch (err) {
      toast.error('Failed to update resident details');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRooms = rooms.filter(r => {
    const matchesSearch = (r.room_number || '').toString().toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  if (loading && !rooms.length) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#A0604E]" size={32} />
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#F3F4F6]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A0604E] block mb-2">Housing & Lodging</span>
          <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight uppercase">Accommodation</h1>
        </div>
        <button 
          onClick={() => {
            setRoomForm({ room_number: '', room_type: 'Single', capacity: 1, status: 'available', notes: '' });
            setRoomModal({ open: true, mode: 'add', data: null });
          }} 
          className="btn-primary h-12 px-8 shadow-premium"
        >
          <Plus size={18} /> REGISTER ROOM
        </button>
      </div>

      {/* Search */}
      <div className="bg-white border border-[#F3F4F6] rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 px-6 py-1">
          <Search className="text-[#9CA3AF]" size={18} />
          <input className="bg-transparent border-none focus:ring-0 w-full h-11 text-[14px] placeholder:text-[#9CA3AF]" placeholder="Search by room number..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Main Rooms Hierarchy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredRooms.map(room => (
          <div key={room.id} className="bg-white border border-[#F3F4F6] rounded-[32px] overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col justify-between">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-start">
                <div className="w-14 h-14 bg-[#FDF5F3] text-[#A0604E] rounded-[20px] flex items-center justify-center transition-transform group-hover:scale-110">
                  <Home size={28} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg bg-[#F3F4F6] text-[#6B7280]">
                  Cap: {room.capacity}
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-[#1A1A1A] uppercase tracking-tight">Room {room.room_number}</h3>
                <p className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest mt-1">
                  {selectedHouse?.name} &bull; Capacity: {room.capacity}
                </p>
              </div>



              {/* Nested House Items list inside Room */}
              <div className="pt-4 border-t border-[#F3F4F6] space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Layers size={12} /> Fitted Assets</span>
                  <button 
                    onClick={() => {
                      setAssetForm({ name: '', quantity: 1, condition_status: 'good', notes: '' });
                      setAssetModal({ open: true, roomId: room.id, data: null });
                    }}
                    className="text-[#A0604E] hover:opacity-75 transition-opacity"
                  >
                    + ADD ASSET
                  </button>
                </div>
                <div className="space-y-2">
                  {(roomItemsMap[room.id] || []).length > 0 ? (
                    (roomItemsMap[room.id] || []).map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs bg-[#F9FAFB] px-3 py-2 rounded-xl border border-gray-50 hover:border-gray-200 transition-colors">
                        <div>
                          <span className="font-bold text-[#1A1A1A]">{item.name}</span>
                          <span className="text-[9px] text-[#9CA3AF] font-black uppercase block">Qty: {item.quantity} &bull; {item.condition_status.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            title="Log Maintenance"
                            onClick={() => setMaintModal({ open: true, targetName: `Room ${room.room_number} - ${item.name}`, data: room })}
                            className="w-6 h-6 flex items-center justify-center bg-white text-[#9CA3AF] hover:text-[#A0604E] border border-gray-100 rounded-full transition-colors"
                          >
                            <Wrench size={10} />
                          </button>
                          <button 
                            title="Edit Asset"
                            onClick={() => {
                              setAssetForm({
                                name: item.name,
                                quantity: item.quantity,
                                condition_status: item.condition_status || 'good',
                                notes: item.notes || ''
                              });
                              setAssetModal({ open: true, mode: 'edit', roomId: room.id, data: item });
                            }}
                            className="w-6 h-6 flex items-center justify-center bg-white text-[#9CA3AF] hover:text-[#A0604E] border border-gray-100 rounded-full transition-colors"
                          >
                            <Settings size={10} />
                          </button>
                          {localStorage.getItem('swiss_side_role') === 'admin' && (
                            <button 
                              title="Delete Asset"
                              onClick={() => setDeleteAssetModal({ open: true, data: item })}
                              className="w-6 h-6 flex items-center justify-center bg-white text-[#9CA3AF] hover:text-[#A32D2D] border border-gray-100 rounded-full transition-colors"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 border border-dashed border-gray-200 rounded-2xl bg-[#FAFAFA]">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No assets registered</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-[#F9FAFB] flex gap-2.5 border-t border-[#F3F4F6] justify-between items-center">
              <button 
                title="Log Room Repair"
                onClick={() => setMaintModal({ open: true, targetName: `Room ${room.room_number} Structure`, data: room })}
                className="flex-1 h-11 flex items-center justify-center gap-1.5 bg-white border border-[#F3F4F6] text-[#6B7280] rounded-xl hover:text-[#A0604E] hover:border-[#A0604E] transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <Wrench size={14} /> Log Issue
              </button>

              <div className="flex gap-1.5">
                <button 
                  title="Edit Room"
                  onClick={() => {
                    setRoomForm({
                      room_number: room.room_number,
                      room_type: room.room_type || 'Single',
                      capacity: room.capacity || 1,
                      status: room.status || 'available',
                      notes: room.notes || ''
                    });
                    setRoomModal({ open: true, mode: 'edit', data: room });
                  }}
                  className="w-11 h-11 flex items-center justify-center bg-white border border-gray-150 text-gray-500 rounded-xl hover:text-[#A0604E] hover:border-[#A0604E] transition-all"
                >
                  <Settings size={14} />
                </button>
                {localStorage.getItem('swiss_side_role') === 'admin' && (
                  <button 
                    title="Delete Room"
                    onClick={() => setDeleteRoomModal({ open: true, data: room })}
                    className="w-11 h-11 flex items-center justify-center bg-red-50 border border-red-100 text-red-500 rounded-xl hover:bg-red-100 hover:text-red-700 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredRooms.length === 0 && (
          <div className="col-span-3 text-center py-20 bg-white border border-[#F3F4F6] rounded-[32px] text-[#9CA3AF] uppercase text-[10px] font-black tracking-widest shadow-sm">No accommodation blocks found.</div>
        )}
      </div>

      {/* Modals */}
      <Modal isOpen={roomModal.open} onClose={() => setRoomModal({ ...roomModal, open: false })} title={roomModal.mode === 'add' ? 'Register Room' : 'Modify Room'}>
        <form onSubmit={handleSaveRoom} className="space-y-6">
          

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Room Number / Name</label>
              <input className="input-field" value={roomForm.room_number} onChange={e => setRoomForm({...roomForm, room_number: e.target.value})} required placeholder="e.g. 104 or Chalet A" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Capacity</label>
              <input type="number" className="input-field" value={roomForm.capacity} onChange={e => setRoomForm({...roomForm, capacity: parseInt(e.target.value)})} required />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black">Confirm</button>
        </form>
      </Modal>

      <Modal isOpen={assignModal.open} onClose={() => setAssignModal({ open: false, data: null })} title={`Check In - Room ${assignModal.data?.room_number}`}>
        <form onSubmit={handleAssign} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Resident Name</label>
            <input className="input-field" value={assignForm.guest_name} onChange={e => setAssignForm({...assignForm, guest_name: e.target.value})} required placeholder="Full name of guest..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Check In Date</label>
            <input type="date" className="input-field" value={assignForm.check_in_date} onChange={e => setAssignForm({...assignForm, check_in_date: e.target.value})} required />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black">Confirm Check In</button>
        </form>
      </Modal>

      <Modal isOpen={checkoutModal.open} onClose={() => setCheckoutModal({ open: false, data: null })} title="Resident Checkout">
        <div className="space-y-8 text-center py-4">
          <div className="w-20 h-20 bg-[#FCEBEB] text-[#A32D2D] rounded-full flex items-center justify-center mx-auto">
            <UserMinus size={40} />
          </div>
          <div>
            <h3 className="text-xl font-black text-[#1A1A1A] uppercase tracking-tight">Confirm Checkout?</h3>
            <p className="text-[14px] text-[#6B7280] mt-2">Resident <strong>{checkoutModal.data?.guest_name}</strong> will be checked out of Room {checkoutModal.data?.room_number}.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setCheckoutModal({ open: false, data: null })} className="btn-secondary flex-1 h-14 font-black uppercase tracking-wider">Cancel</button>
            <button onClick={handleCheckout} disabled={submitting} className="btn-primary flex-1 h-14 bg-[#A32D2D] border-[#A32D2D] font-black uppercase tracking-wider">Checkout</button>
          </div>
        </div>
      </Modal>

      {/* Maintenance Request Modal */}
      <Modal isOpen={maintModal.open} onClose={() => setMaintModal({ open: false, targetName: '', data: null })} title="Log Maintenance Issue">
        <form onSubmit={handleMaintSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Target Asset</label>
            <div className="input-field bg-gray-50 text-slate-700 font-bold flex items-center">{maintModal.targetName}</div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Problem Description</label>
            <textarea className="input-field py-4 min-h-[120px]" value={maintForm.description} onChange={e => setMaintForm({ description: e.target.value })} required placeholder="Describe what is broken or malfunctioning..." />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black">LOG MAINTENANCE</button>
        </form>
      </Modal>

      {/* Register/Edit Fitted Asset Modal */}
      <Modal isOpen={assetModal.open} onClose={() => setAssetModal({ open: false, mode: 'add', roomId: null, data: null })} title={assetModal.mode === 'edit' ? 'Edit Fitted Asset' : 'Register Fitted Asset'}>
        <form onSubmit={handleSaveAsset} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Asset Name</label>
            <input 
              type="text" 
              className="input-field" 
              value={assetForm.name} 
              onChange={e => setAssetForm(prev => ({ ...prev, name: e.target.value }))} 
              required 
              placeholder="e.g. Smart Lock, Bed Frame" 
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Quantity</label>
              <input 
                type="number" 
                className="input-field" 
                value={assetForm.quantity} 
                onChange={e => setAssetForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))} 
                required 
                min="1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Condition Status</label>
              <select 
                className="input-field" 
                value={assetForm.condition_status} 
                onChange={e => setAssetForm(prev => ({ ...prev, condition_status: e.target.value }))}
              >
                <option value="good">Good Condition</option>
                <option value="fair">Fair / Wear</option>
                <option value="needs_attention">Needs Attention</option>
                <option value="broken">Broken</option>
                <option value="missing">Missing</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Additional Notes</label>
            <input 
              type="text" 
              className="input-field" 
              value={assetForm.notes} 
              onChange={e => setAssetForm(prev => ({ ...prev, notes: e.target.value }))} 
              placeholder="e.g. King size, timber finish" 
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Save Asset Details'}
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal 
        isOpen={deleteAssetModal.open}
        onClose={() => setDeleteAssetModal({ open: false, data: null })}
        onConfirm={handleDeleteAsset}
        loading={submitting}
        title="Remove Asset from Room"
      />

      {/* Edit Resident Details Modal */}
      <Modal isOpen={editResidentModal.open} onClose={() => setEditResidentModal({ open: false, data: null })} title={`Edit Resident - Room ${editResidentModal.data?.room_number}`}>
        <form onSubmit={handleSaveResidentDetails} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Resident Name</label>
            <input className="input-field" value={editResidentForm.guest_name} onChange={e => setEditResidentForm({...editResidentForm, guest_name: e.target.value})} required placeholder="Full name of guest..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Check In Date</label>
            <input type="date" className="input-field" value={editResidentForm.check_in_date} onChange={e => setEditResidentForm({...editResidentForm, check_in_date: e.target.value})} required />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Save Resident Details'}
          </button>
        </form>
      </Modal>

      {/* Delete Room Confirmation Modal */}
      <DeleteConfirmModal 
        isOpen={deleteRoomModal.open}
        onClose={() => setDeleteRoomModal({ open: false, data: null })}
        onConfirm={handleDeleteRoom}
        loading={submitting}
        title={`Decommission Room ${deleteRoomModal.data?.room_number}`}
      />
    </div>
  );
}
