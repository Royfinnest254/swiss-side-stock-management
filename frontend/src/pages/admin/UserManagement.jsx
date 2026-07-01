import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import SlidePanel from '../../components/SlidePanel';
import Modal from '../../components/Modal';
import { 
  Mail, User, Shield, Loader2, Trash2, Crown, 
  Lock, KeyRound, Pencil, Check, X, Camera, CheckCircle 
} from 'lucide-react';



export default function UserManagement() {
  const role = localStorage.getItem('swiss_side_role') || 'staff';
  const userEmail = localStorage.getItem('swiss_side_user') || 'Manager';

  // Admin States
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' or 'profile'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [editUserModal, setEditUserModal] = useState({ open: false, data: null });
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [formData, setFormData] = useState({ email: '' });
  const [editUserForm, setEditUserForm] = useState({ email: '', display_name: '', phone: '', job_title: '', role: 'staff' });

  // Personal Profile States (Used primarily for Staff, but loaded on mount)
  const [me, setMe] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const photoInputRef = useRef(null);

  // Self-Service Change Password via Magic Link State
  const [requestingReset, setRequestingReset] = useState(false);

  useEffect(() => {
    if (role === 'admin') {
      fetchUsers();
    } else {
      setLoading(false);
    }
    fetchMe();
  }, [role]);

  const fetchUsers = async () => {
    try {
      const data = await api.get('/users').catch(() => []);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMe = async () => {
    try {
      const data = await api.get('/auth/me');
      setMe(data);
      if (data?.display_name) {
        setDisplayName(data.display_name);
        localStorage.setItem('swiss_side_display_name', data.display_name);
      } else {
        setDisplayName(data?.email?.split('@')[0] || '');
      }
      if (data?.profile_photo) {
        setProfilePhoto(data.profile_photo);
        localStorage.setItem('swiss_side_photo', data.profile_photo);
      }
      if (data?.phone) {
        setPhone(data.phone);
      } else {
        setPhone('');
      }
      if (data?.job_title) {
        setJobTitle(data.job_title);
      } else {
        setJobTitle('');
      }
    } catch (err) {
      console.error('[Fetch Profile Error]', err);
    }
  };

  // Profile Upload handler
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2MB');
    
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const result = await api.postForm('/auth/me/photo', fd);
      setProfilePhoto(result.profile_photo);
      localStorage.setItem('swiss_side_photo', result.profile_photo);
      toast.success('Profile photo updated successfully');
      fetchMe();
    } catch (err) {
      toast.error('Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Identity profile details update handler (displayName, phone, jobTitle)
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/auth/me', { displayName, phone, jobTitle });
      localStorage.setItem('swiss_side_display_name', displayName);
      toast.success('Profile details saved successfully');
      fetchMe();
    } catch (err) { 
      toast.error('Failed to update profile details'); 
    } finally {
      setSavingProfile(false);
    }
  };

  // Secure password reset request via magic link
  const handleRequestPasswordChange = async (e) => {
    if (e) e.preventDefault();
    setRequestingReset(true);
    try {
      await api.post('/auth/request-password-change');
      toast.success('Password reset link sent to your email.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to request password reset link.');
    } finally {
      setRequestingReset(false);
    }
  };

  const triggerEditUser = (user) => {
    setEditUserForm({
      email: user.email || '',
      display_name: user.display_name || '',
      phone: user.phone || '',
      job_title: user.job_title || '',
      role: user.role || 'staff'
    });
    setEditUserModal({ open: true, data: user });
  };

  const handleSaveUserDetails = async (e) => {
    e.preventDefault();
    if (!editUserModal.data) return;
    setSubmitting(true);
    try {
      await api.put(`/users/${editUserModal.data.id}`, editUserForm);
      toast.success('User profile updated successfully');
      setEditUserModal({ open: false, data: null });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user details');
    } finally {
      setSubmitting(false);
    }
  };

  const startDeleteFlow = (user) => {
    setSelectedUser(user);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/users/${selectedUser.id}`);
      toast.success('User access revoked');
      setDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Removal failed');
      setDeleteModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const executePromotion = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/users/${selectedUser.id}/promote`);
      toast.success(`${selectedUser.display_name || selectedUser.email} has been promoted to Administrator!`);
      setPromoteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Promotion failed');
      setPromoteModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#A0604E]" size={32} />
    </div>
  );

  // Helper for rendering the unified Personal Profile Card
  const renderProfileCard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
      {/* Personal Info Profile */}
      <section className="system-card space-y-8 p-8 md:p-10 bg-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#FDF5F3] text-[#A0604E] rounded-2xl flex items-center justify-center">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[#1A1A1A]">Personal Details</h3>
            <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mt-0.5">Edit photo and identification</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Profile Photo Upload */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Profile Picture</label>
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden border border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-center cursor-pointer relative group flex-shrink-0 shadow-sm"
                onClick={() => photoInputRef.current?.click()}
              >
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" onError={() => setProfilePhoto(null)} />
                ) : (
                  <span className="text-2xl font-black text-[#A0604E] select-none">{displayName[0]?.toUpperCase() || '?'}</span>
                )}
                <div className="absolute inset-0 bg-[#2C2825]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingPhoto ? <Loader2 size={18} className="animate-spin text-white" /> : <Camera size={18} className="text-white" />}
                </div>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="h-9 px-4 bg-[#2C2825] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#A0604E] transition-all disabled:opacity-50 font-bold"
                >
                  {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
                </button>
                <p className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">JPEG, PNG or WebP. Max 2MB.</p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
          </div>

          {/* Display Name Field */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Display Name</label>
            <input 
              type="text"
              className="input-field text-sm h-12 font-bold text-[#1A1A1A]"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              placeholder="e.g. John Doe"
            />
          </div>

          {/* Phone Number Field */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Phone Number</label>
            <input 
              type="text"
              className="input-field text-sm h-12 font-bold text-[#1A1A1A]"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. +254 712 345 678"
            />
          </div>

          {/* Job Title Field */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Job Title</label>
            <input 
              type="text"
              className="input-field text-sm h-12 font-bold text-[#1A1A1A]"
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. High Altitude Coach"
            />
          </div>

          {/* Email and Tier Readonly fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Personal Email</label>
              <div className="input-field flex items-center text-[#6B7280] font-bold text-[12px] truncate bg-[#F9FAFB]/80">
                {me?.email || userEmail}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">System Privilege</label>
              <div className="input-field flex items-center font-black text-[#A0604E] uppercase tracking-[0.15em] text-[11px] bg-[#FDF5F3] border-none select-none">
                {role}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="btn-primary w-full h-12 mt-6 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest h-14"
          >
            {savingProfile ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle size={16} /> Save Profile Details</>}
          </button>
        </form>
      </section>

      {/* Secure Credential Changer */}
      <section className="system-card space-y-8 p-8 md:p-10 bg-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#FDF5F3] text-[#A0604E] rounded-2xl flex items-center justify-center">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[#1A1A1A]">Update Credentials</h3>
            <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mt-0.5">Securely change your password</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#FDF5F3]/50 border border-[#F1D8D2]/40 rounded-2xl p-6 text-left">
            <p className="text-xs text-[#2C2825] font-medium leading-relaxed uppercase tracking-wider text-[11px]">
              To change your password, request a magic link. A secure email will be dispatched to your inbox allowing you to complete password setup.
            </p>
          </div>

          <button
            onClick={handleRequestPasswordChange}
            disabled={requestingReset}
            className="btn-primary w-full h-12 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest h-14"
          >
            {requestingReset ? <Loader2 className="animate-spin" size={16} /> : <><KeyRound size={16} /> Request Password Reset Link</>}
          </button>
        </div>
      </section>
    </div>
  );

  // STAFF PERSONAL CARD LAYOUT — Only display personal info section
  if (role !== 'admin') {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="border-b border-[#E5E7EB] pb-6">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-[#1A1A1A]">My Profile</h1>
          <p className="text-[11px] font-black text-[#6B7280] uppercase tracking-[0.3em] mt-2">Manage your personal credentials</p>
        </div>
        {renderProfileCard()}
      </div>
    );
  }

  // ADMIN FULL DIRECTORY + MY PROFILE TABS LAYOUT
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b border-[#E5E7EB] pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-[#1A1A1A]">User Management</h1>
          <p className="text-[11px] font-black text-[#6B7280] uppercase tracking-[0.3em] mt-2">Active Staff Directory</p>
        </div>
        {activeTab === 'directory' && (
          <button onClick={() => setPanelOpen(true)} className="btn-primary flex items-center gap-2">
            <Mail size={16} /> Send Invitation
          </button>
        )}
      </div>

      {/* Premium Tab Selector for Admin */}
      <div className="flex gap-2 border-b border-[#E5E7EB] pb-px">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all duration-300 ${
            activeTab === 'directory'
              ? 'border-[#A0604E] text-[#A0604E] border-[#A0604E]'
              : 'border-transparent text-[#6B7280] hover:text-[#A0604E]'
          }`}
        >
          Staff Directory
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all duration-300 ${
            activeTab === 'profile'
              ? 'border-[#A0604E] text-[#A0604E] border-[#A0604E]'
              : 'border-transparent text-[#6B7280] hover:text-[#A0604E]'
          }`}
        >
          My Profile Settings
        </button>
      </div>

      {activeTab === 'directory' ? (
      <div className="system-card p-0 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Access Level</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Registration</th>
                <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {(users ?? []).map((user) => (
                <tr key={user.id ?? Math.random()} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      {user.profile_photo ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#F3F4F6] shadow-sm flex-shrink-0">
                          <img src={user.profile_photo} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl flex items-center justify-center text-[#A0604E] font-black text-sm select-none shadow-sm flex-shrink-0">
                          {(user.display_name || user.email)[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-[#1A1A1A]">
                          {user.password === 'PENDING' ? (
                            <span className="text-[#A0604E] font-extrabold italic">Pending Registration</span>
                          ) : (
                            user.display_name || 'No Name Set'
                          )}
                        </div>
                        <div className="text-[11px] font-medium text-[#6B7280]">{user.email ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-[#A0604E]'}`}>
                        {(user.role === 'admin') ? <Shield size={10} className="inline mr-1" /> : null}
                        {(user.role ?? 'staff').replace(/_/g, ' ')}
                      </span>
                      {user.password === 'PENDING' && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                          Pending
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[12px] font-bold text-[#6B7280]">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <button 
                        onClick={() => triggerEditUser(user)}
                        className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg hover:scale-110 transition-all"
                        title="Edit User Details"
                      >
                        <Pencil size={16} />
                      </button>
                      {user.role !== 'admin' && user.password !== 'PENDING' && (
                        <button 
                          onClick={() => {
                            setSelectedUser(user);
                            setPromoteModalOpen(true);
                          }}
                          className="p-2 hover:bg-amber-50 text-amber-600 rounded-lg hover:scale-110 transition-all"
                          title="Promote to Administrator"
                        >
                          <Crown size={18} />
                        </button>
                      )}
                      {user.role !== 'admin' && (
                        <button 
                          onClick={() => startDeleteFlow(user)}
                          className="p-2 hover:bg-red-50 text-[#A0604E] rounded-lg hover:scale-110 transition-all"
                          title="Remove Staff"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      {user.role === 'admin' && user.id !== me?.id && (
                        <button 
                          onClick={async () => {
                            if (!window.confirm(`Are you sure you want to demote ${user.email} to Staff?`)) return;
                            setSubmitting(true);
                            try {
                              await api.put(`/users/${user.id}`, {
                                email: user.email,
                                display_name: user.display_name,
                                phone: user.phone,
                                job_title: user.job_title,
                                role: 'staff'
                              });
                              toast.success('User demoted to staff');
                              fetchUsers();
                            } catch (err) {
                              toast.error('Failed to demote user');
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                          className="p-2 hover:bg-red-50 text-red-500 rounded-lg hover:scale-110 transition-all"
                          title="Demote to Staff"
                        >
                          <Shield size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(users ?? []).length === 0 && (
            <div className="p-20 text-center">
              <User className="mx-auto text-[#E5E7EB] mb-4" size={48} />
              <p className="text-[11px] font-black text-[#9CA3AF] uppercase tracking-widest">No active staff members</p>
            </div>
          )}
        </div>
      </div>
      ) : (
        renderProfileCard()
      )}

      {/* Invite Staff Slide Panel */}
      <SlidePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} title="Invite Staff Member">
        <form onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          try {
            await api.post('/users/invite', { email: formData.email });
            toast.success('Invitation sent to ' + formData.email);
            setPanelOpen(false);
            setFormData({ ...formData, email: '' });
            fetchUsers();
          } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send invitation');
          } finally {
            setSubmitting(false);
          }
        }} className="space-y-6">
          <p className="text-[11px] text-[#6B7280] font-medium leading-relaxed">
            Send a magic-link invitation. The recipient will be able to set up their own name and password securely.
          </p>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="staff@swissside.store" 
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required 
            />
          </div>

          <div className="pt-4">
            <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Mail size={18} /> Send Magic Link Invitation</>}
            </button>
          </div>
        </form>
      </SlidePanel>

      {/* Countdown Deletion Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => { if (!submitting) setDeleteModalOpen(false); }} title="Confirm Revocation">
        <div className="text-center py-6 space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto hover:scale-110 transition-transform">
            <Trash2 size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1a1a1a] uppercase tracking-tight">Security Verification</h3>
            <p className="text-sm text-slate-500 mt-2">
              You are about to revoke database access and remove records for:<br/>
              <span className="font-bold text-[#1A1A1A]">{selectedUser?.display_name || selectedUser?.email}</span>
            </p>
          </div>

          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280] block mb-1">
              Type the confirmation phrase below:
            </label>
            {/* Soft, beautiful beige/terracotta brand matching colors instead of solid black background */}
            <div className="bg-[#FDF5F3] border border-[#F1D8D2] text-[#A0604E] px-3 py-2.5 rounded-xl font-mono text-center text-xs font-bold select-none tracking-wider mb-3 uppercase">
              {`DELETE ${(selectedUser?.display_name || '').trim().split(/\s+/)[0]?.toUpperCase() || 'STAFF'}`}
            </div>
            <input 
              type="text" 
              className="input-field h-12 text-center text-sm font-black tracking-wide border-red-200 focus:border-red-500 uppercase"
              placeholder="Type phrase here..."
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className="flex gap-4">
            <button 
              type="button" 
              disabled={submitting}
              onClick={() => setDeleteModalOpen(false)} 
              className="flex-1 h-14 bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="button" 
              disabled={submitting || deleteConfirmText.trim().toUpperCase() !== `DELETE ${(selectedUser?.display_name || '').trim().split(/\s+/)[0]?.toUpperCase() || 'STAFF'}`}
              onClick={executeDelete} 
              className={`flex-1 h-14 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
                deleteConfirmText.trim().toUpperCase() === `DELETE ${(selectedUser?.display_name || '').trim().split(/\s+/)[0]?.toUpperCase() || 'STAFF'}`
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-premium' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Promoted Admin Modal */}
      <Modal isOpen={promoteModalOpen} onClose={() => { if (!submitting) setPromoteModalOpen(false); }} title="Confirm Administrative Promotion">
        <div className="text-center py-6 space-y-6">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto hover:scale-110 transition-transform">
            <Crown size={28} />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1a1a1a] uppercase tracking-tight">Grant Administrative Rights?</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              You are about to promote <span className="font-black text-[#1A1A1A]">{selectedUser?.display_name || selectedUser?.email}</span> to an <span className="font-extrabold text-[#A0604E]">Administrator</span>.<br/>
              This gives them full operational control, financial logs access, database deletion permissions, and staff management authority.
            </p>
          </div>

          <div className="flex gap-4">
            <button 
              type="button" 
              disabled={submitting}
              onClick={() => setPromoteModalOpen(false)} 
              className="flex-1 h-14 bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="button" 
              disabled={submitting}
              onClick={executePromotion} 
              className="flex-1 h-14 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-premium flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Confirm Promotion'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit User Details Modal */}
      <Modal isOpen={editUserModal.open} onClose={() => setEditUserModal({ open: false, data: null })} title="Edit User Details">
        <form onSubmit={handleSaveUserDetails} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Display Name</label>
            <input className="input-field" value={editUserForm.display_name} onChange={e => setEditUserForm({...editUserForm, display_name: e.target.value})} required placeholder="Full name of staff member..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Email Address</label>
            <input type="email" className="input-field" value={editUserForm.email} onChange={e => setEditUserForm({...editUserForm, email: e.target.value})} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Phone Number</label>
            <input className="input-field" value={editUserForm.phone} onChange={e => setEditUserForm({...editUserForm, phone: e.target.value})} placeholder="e.g. +254 700 000 000" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Job Title / Designation</label>
            <input className="input-field" value={editUserForm.job_title} onChange={e => setEditUserForm({...editUserForm, job_title: e.target.value})} placeholder="e.g. Laundry Head or Spa Manager" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] mb-2 block">Access Level / Role</label>
            <select className="input-field" value={editUserForm.role} onChange={e => setEditUserForm({...editUserForm, role: e.target.value})}>
              <option value="staff">Staff Member</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Save User Details'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
