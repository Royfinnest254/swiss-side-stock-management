import { Outlet } from 'react-router-dom';
export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div className="bg-[#A0604E] rounded-premium p-8 text-white flex justify-between items-center shadow-lg shadow-[#A0604E]/10">
        <div>
          <h2 className="text-2xl font-black tracking-tight uppercase">Control Panel</h2>
          <p className="text-[10px] font-black text-white/80 uppercase tracking-[0.3em] mt-1">Administrator Privileges Active</p>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

