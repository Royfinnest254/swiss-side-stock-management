import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ShieldCheck, Users, Lock, KeyRound, X, Eye, EyeOff, Pencil, Check, Loader2, Camera, ExternalLink } from 'lucide-react';
import api from '../lib/api';

function EditableName({ currentName, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName || '');

  useEffect(() => {
    setValue(currentName || '');
  }, [currentName]);

  const handleSave = async () => {
    if (!value.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    await onSave(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-3">
        <input
          type="text"
          className="input-field flex-1"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={handleSave} className="w-12 h-12 bg-[#A0604E] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#A0604E]/20">
          <Check size={20} />
        </button>
        <button onClick={() => setEditing(false)} className="w-12 h-12 bg-white text-[#9CA3AF] rounded-2xl flex items-center justify-center border border-[#F3F4F6]">
          <X size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="input-field flex items-center justify-between cursor-pointer group" onClick={() => setEditing(true)}>
      <span className="font-bold">{value || <span className="text-[#9CA3AF] font-normal">Set display name...</span>}</span>
      <Pencil size={16} className="text-[#9CA3AF] group-hover:text-[#A0604E] transition-colors" />
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('swiss_side_user') || 'Manager';
  const userRole = localStorage.getItem('swiss_side_role') || 'staff';
  const isAdmin = userRole === 'admin';

  // Profile States
  const [displayName, setDisplayName] = useState(localStorage.getItem('swiss_side_display_name') || userEmail.split('@')[0]);
  const [profilePhoto, setProfilePhoto] = useState(localStorage.getItem('swiss_side_photo') || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  // Self-Service Change Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  useEffect(() => {
    // Dynamic on-mount synchronization of current session credentials from backend
    const fetchMe = async () => {
      try {
        const me = await api.get('/auth/me');
        if (me.display_name) {
          localStorage.setItem('swiss_side_display_name', me.display_name);
          setDisplayName(me.display_name);
        }
        if (me.profile_photo) {
          localStorage.setItem('swiss_side_photo', me.profile_photo);
          setProfilePhoto(me.profile_photo);
        }
      } catch (err) {
        console.error('[Fetch Me Error]', err);
      }
    };
    fetchMe();
  }, []);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2MB');
    
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const result = await api.postForm('/auth/me/photo', formData);
      setProfilePhoto(result.profile_photo);
      localStorage.setItem('swiss_side_photo', result.profile_photo);
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error('Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateName = async (newName) => {
    try {
      await api.patch('/auth/display-name', { displayName: newName });
      localStorage.setItem('swiss_side_display_name', newName);
      setDisplayName(newName);
      toast.success('Identity synchronized');
    } catch (e) { 
      toast.error('Update failed'); 
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSubmittingPassword(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      toast.success('Your password has been securely changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password update failed. Please verify your current password.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#F3F4F6]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A0604E] block mb-2">Platform Controls</span>
          <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight uppercase">System Settings</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Profile Card */}
        <section className="system-card space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FDF5F3] text-[#A0604E] rounded-2xl flex items-center justify-center">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#1A1A1A]">Security Identity</h3>
              <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mt-0.5">Manage your personal profile</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Profile Photo */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Profile Photo</label>
              <div className="flex items-center gap-5">
                <div
                  className="w-16 h-16 rounded-2xl overflow-hidden border border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-center cursor-pointer relative group flex-shrink-0"
                  onClick={() => photoInputRef.current?.click()}
                >
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" onError={() => setProfilePhoto(null)} />
                  ) : (
                    <span className="text-2xl font-black text-[#A0604E] select-none">{displayName[0]?.toUpperCase()}</span>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploadingPhoto ? <Loader2 size={18} className="animate-spin text-white" /> : <Camera size={18} className="text-white" />}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="h-9 px-4 bg-[#1A1A1A] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#A0604E] transition-all disabled:opacity-50 font-bold"
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

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Official Name</label>
              <EditableName 
                currentName={displayName} 
                onSave={handleUpdateName} 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Access Tier</label>
                <div className="input-field flex items-center font-black text-[#A0604E] uppercase tracking-[0.15em] text-[11px] bg-[#FDF5F3] border-none">
                  {userRole.replace('_', ' ')}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Account ID</label>
                <div className="input-field flex items-center text-[#9CA3AF] font-bold text-[12px] truncate">
                  {userEmail}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Secure Self-Service Change Password */}
        <section className="system-card space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FDF5F3] text-[#A0604E] rounded-2xl flex items-center justify-center">
              <Lock size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#1A1A1A]">Update Credentials</h3>
              <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mt-0.5">Securely modify your password</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Current Password</label>
              <div className="relative">
                <input 
                  type={showCurrent ? 'text' : 'password'} 
                  className="input-field pr-12 text-sm" 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)} 
                  required 
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">New Password</label>
              <div className="relative">
                <input 
                  type={showNew ? 'text' : 'password'} 
                  className="input-field pr-12 text-sm" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required 
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Confirm New Password</label>
              <div className="relative">
                <input 
                  type={showConfirm ? 'text' : 'password'} 
                  className="input-field pr-12 text-sm" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingPassword}
              className="btn-primary w-full h-12 mt-6 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest h-14"
            >
              {submittingPassword ? <Loader2 className="animate-spin" size={16} /> : <><KeyRound size={16} /> Save Password Update</>}
            </button>
          </form>
        </section>

        {/* Bottom Section: Admin Staff Management Navigation */}
        {isAdmin && (
          <section className="system-card space-y-6 lg:col-span-2 bg-[#F9FAFB]/50 border-dashed border-2 border-[#E5E7EB]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white text-[#A0604E] border border-[#F3F4F6] rounded-2xl flex items-center justify-center shadow-sm">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#1A1A1A]">Staff Accounts Directory</h3>
                  <p className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest mt-1">Invite new personnel or manage staff status</p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/admin/users')}
                className="btn-primary flex items-center gap-2 h-12 px-8 uppercase text-[10px] font-black tracking-widest shadow-premium flex-shrink-0"
              >
                Go to User Management <ExternalLink size={14} />
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
