import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function TopBar({ onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('swiss_side_user') || 'Manager';
  const userRole = localStorage.getItem('swiss_side_role') || 'staff';
  const displayName = localStorage.getItem('swiss_side_display_name') || userEmail.split('@')[0];
  const [profilePhoto, setProfilePhoto] = useState(localStorage.getItem('swiss_side_photo') || null);

  useEffect(() => {
    // Silently fetch latest profile photo
    api.get('/auth/me').then(data => {
      if (data?.profile_photo) {
        setProfilePhoto(data.profile_photo);
        localStorage.setItem('swiss_side_photo', data.profile_photo);
      }
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('swiss_side_session');
    localStorage.removeItem('swiss_side_user');
    localStorage.removeItem('swiss_side_role');
    localStorage.removeItem('swiss_side_display_name');
    localStorage.removeItem('swiss_side_photo');
    toast.success('Session ended');
    navigate('/login');
  };

  const pageName = location.pathname.split('/')[1] || 'Dashboard';

  return (
    <header className="h-[64px] bg-white border-b border-[#F3F4F6] px-6 flex items-center justify-between sticky top-0 z-[100] shadow-sm">
      <div className="flex items-center gap-4">
        {/* Mobile: hamburger + logo image (no box wrapper) */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-[#6B7280] hover:text-[#A0604E] hover:bg-[#A0604E]/5 rounded-xl transition-all"
        >
          <Menu size={24} />
        </button>
        
        {/* Mobile logo — actual image, no square wrapper */}
        <div className="lg:hidden flex items-center gap-2.5">
          <img src="/logo.png" alt="Swiss Side" className="h-8 w-auto object-contain" />
          <span className="text-[11px] font-black uppercase tracking-widest text-[#1A1A1A]">Swiss Side</span>
        </div>

        {/* Desktop: breadcrumb label */}
        <div className="hidden lg:flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A0604E]">Swiss Side Suite</span>
          <span className="text-[13px] font-bold text-[#1A1A1A] capitalize">{pageName}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Name + Role */}
        <div className="hidden md:flex flex-col text-right">
          <span className="text-[13px] font-bold text-[#1A1A1A] leading-tight">{displayName}</span>
          <span className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">{userRole.replace('_', ' ')}</span>
        </div>

        {/* Avatar — profile photo or initials */}
        {profilePhoto ? (
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#F3F4F6] shadow-sm flex-shrink-0">
            <img
              src={profilePhoto}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={() => setProfilePhoto(null)}
            />
          </div>
        ) : (
          <div className="w-10 h-10 bg-[#F9FAFB] border border-[#F3F4F6] rounded-xl flex items-center justify-center text-[#A0604E] font-black text-sm shadow-sm select-none">
            {displayName[0]?.toUpperCase()}
          </div>
        )}

        <div className="w-px h-6 bg-[#F3F4F6] mx-1 md:mx-2 hidden md:block" />

        <button
          onClick={handleLogout}
          className="w-10 h-10 flex items-center justify-center text-[#6B7280] hover:text-[#A0604E] hover:bg-[#A0604E]/5 rounded-xl transition-all"
          title="Sign Out"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
