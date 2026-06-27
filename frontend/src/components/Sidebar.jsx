import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, CookingPot, Flower2, ShoppingBag, 
  Dumbbell, Truck, WashingMachine, BarChart3, ListChecks, 
  Users, Trash2, ClipboardList, Home, X, Menu
} from 'lucide-react';

const MENU_ITEMS = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Kitchen', path: '/kitchen', icon: CookingPot },
  { label: 'Spa', path: '/spa', icon: Flower2 },
  { label: 'Shop', path: '/shop', icon: ShoppingBag },
  { label: 'Gym', path: '/gym', icon: Dumbbell },
  { label: 'Supplies', path: '/supplies', icon: Truck },
  { label: 'Laundry', path: '/laundry', icon: WashingMachine },
  { label: 'Accommodation', path: '/accommodation', icon: Home },
  { label: 'Needs', path: '/needs', icon: ClipboardList },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
];

const ADMIN_ITEMS = [
  { label: 'User Management', path: '/admin/users', icon: Users },
  { label: 'Deleted Items', path: '/admin/recycle-bin', icon: Trash2 },
  { label: 'Audit Logs', path: '/admin/logs', icon: ClipboardList },
  { label: 'System Health', path: '/admin/system', icon: ListChecks },
];

export default function Sidebar({ sidebarOpen, setSidebarOpen, isMobile }) {
  const role = localStorage.getItem('swiss_side_role');
  const location = useLocation();

  const navItemClass = ({ isActive }) => `
    flex items-center gap-2.5 px-4 h-[48px] transition-all duration-300 rounded-xl group relative
    ${isActive 
      ? 'bg-[#A0604E] text-white font-bold shadow-lg shadow-[#A0604E]/20' 
      : 'text-[#6B7280] hover:text-[#A0604E] hover:bg-[#A0604E]/5'}
  `;

  return (
    <aside className={`
      ${isMobile ? 'h-full w-full bg-white p-6' : 'h-full w-20 lg:w-64 border-r border-[#F3F4F6] bg-white'}
      flex flex-col transition-all duration-300 relative
    `}>
      {isMobile && (
        <button 
          onClick={() => setSidebarOpen(false)}
          className="absolute top-6 right-6 p-2 text-[#6B7280] hover:text-[#A0604E]"
        >
          <X size={24} />
        </button>
      )}

      {/* Header with Logo */}
      <div className={`flex flex-col items-center justify-center ${isMobile ? 'pt-4' : 'pt-10'} pb-8 px-4`}>
        <div className="w-[60px] h-[60px] flex items-center justify-center bg-[#FDF5F3] rounded-2xl mb-4 p-2 group transition-transform hover:scale-105 duration-300">
          <img src="/logo.png" alt="Swiss Side" className="w-full h-full object-contain" />
        </div>
        <div className={`flex flex-col items-center ${!isMobile && 'hidden lg:flex'}`}>
          <h1 className="text-lg font-black tracking-[0.2em] uppercase text-[#1A1A1A] leading-tight">Swiss Side</h1>
          <span className="text-[10px] font-black tracking-[0.4em] uppercase text-[#A0604E] mt-1 opacity-80">Management</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto scrollbar-hide">
        <div className={`text-[9px] font-black text-[#9CA3AF] px-4 mb-4 uppercase tracking-[0.3em] ${!isMobile && 'hidden lg:block'}`}>
          Menu
        </div>
        
        {MENU_ITEMS.map((item) => (
          <div key={item.path} className="relative group">
            <NavLink
              to={item.path}
              className={navItemClass}
              onClick={() => isMobile && setSidebarOpen(false)}
            >
              <item.icon size={18} className="flex-shrink-0" />
              <span className={`text-[13px] font-bold uppercase tracking-wide ${isMobile ? 'block' : 'hidden lg:block'}`}>
                {item.label}
              </span>
            </NavLink>
          </div>
        ))}

        {role === 'staff' && (
          <div className="pt-4 border-t border-[#F3F4F6] mt-4">
            <NavLink
              to="/admin/users"
              className={navItemClass}
              onClick={() => isMobile && setSidebarOpen(false)}
            >
              <Users size={18} className="flex-shrink-0" />
              <span className={`text-[13px] font-bold uppercase tracking-wide ${isMobile ? 'block' : 'hidden lg:block'}`}>
                My Profile
              </span>
            </NavLink>
          </div>
        )}

        {role === 'admin' && (
          <div className="pt-8">
            <div className={`text-[9px] font-black text-[#9CA3AF] px-4 mb-4 uppercase tracking-[0.3em] ${!isMobile && 'hidden lg:block'}`}>
              Administration
            </div>
            {ADMIN_ITEMS.map((item) => (
              <div key={item.path} className="relative group">
                <NavLink
                  to={item.path}
                  className={navItemClass}
                  onClick={() => isMobile && setSidebarOpen(false)}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  <span className={`text-[13px] font-bold uppercase tracking-wide ${isMobile ? 'block' : 'hidden lg:block'}`}>
                    {item.label}
                  </span>
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-[#F3F4F6]">
        <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-[0.3em] text-center">
          V18.0 PRODUCTION
        </div>
      </div>
    </aside>
  );
}
