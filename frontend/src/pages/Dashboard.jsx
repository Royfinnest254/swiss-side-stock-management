import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, TrendingDown, Wrench, ClipboardList, ArrowUpRight, ArrowDownRight, Package, AlertTriangle, History, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const StatCard = ({ label, value, description, color, loading }) => (
  <div className={`bg-white rounded-2xl p-6 shadow-sm border-l-[3px] border-[${color}] border-t border-r border-b border-[#F3F4F6] transition-all hover:shadow-md animate-in fade-in duration-500`}>
    <div className="flex flex-col">
      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9CA3AF] mb-1">{label}</span>
      {loading ? (
        <div className="h-9 w-24 bg-gray-100 animate-pulse rounded-lg my-1"></div>
      ) : (
        <span className="text-3xl font-black text-[#1A1A1A] tracking-tight">{value}</span>
      )}
      <span className="text-[11px] font-bold text-[#6B7280] mt-1">{description}</span>
    </div>
  </div>
);

const DepartmentCard = ({ name, total, lowCount, loading }) => {
  let status = 'Operational';
  let badgeColor = 'bg-[#EAF3DE] text-[#639922]';
  
  if (lowCount >= 4) {
    status = 'Urgent Restock';
    badgeColor = 'bg-red-50 text-[#E24B4A] border border-red-100';
  } else if (lowCount >= 1) {
    status = 'Attention Needed';
    badgeColor = 'bg-amber-50 text-[#BA7517] border border-amber-100';
  }

  return (
    <div className="bg-white border border-[#F3F4F6] rounded-2xl p-6 hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-black text-[13px] uppercase tracking-widest text-[#1A1A1A] group-hover:text-[#A0604E] transition-colors">{name}</h3>
          <p className="text-[11px] font-bold text-[#9CA3AF] uppercase mt-1">{total} Items Tracked</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${badgeColor}`}>
          {status}
        </span>
      </div>
      
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[14px] font-black text-[#1A1A1A]">{total - lowCount}</span>
            <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">In Stock</span>
          </div>
          <div className="w-px h-6 bg-[#F3F4F6]"></div>
          <div className="flex flex-col">
            <span className={`text-[14px] font-black ${lowCount > 0 ? 'text-[#E24B4A]' : 'text-[#639922]'}`}>{lowCount}</span>
            <span className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">Low Stock Alert</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stock: { total: 0, low_stock: 0 },
    maintenance: { pending: 0 },
    needs: 0,
    metrics: {},
    lowStockItems: [],
    recentTransactions: [],
    pendingMaintenance: [],
    openNeeds: []
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summary, metrics, lowStock, maintenance, needs] = await Promise.all([
        api.get('/dashboard'),
        api.get('/dashboard/metrics'),
        api.get('/reports/low-stock'),
        api.get('/reports/maintenance'),
        api.get('/needs?status=pending')
      ]);

      setData({
        stock: summary.stock || { total: 0, low_stock: 0 },
        maintenance: summary.maintenance || { pending: 0 },
        needs: summary.requests?.pending || 0,
        metrics,
        lowStockItems: lowStock || [],
        recentTransactions: summary.recentTransactions || [],
        pendingMaintenance: (maintenance || []).filter(m => m.status === 'pending').slice(0, 5),
        openNeeds: (needs || []).slice(0, 5)
      });
    } catch (err) {
      toast.error('Failed to sync system analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const modules = [
    { name: 'Kitchen', key: 'kitchen' },
    { name: 'Spa', key: 'spa' },
    { name: 'Gym', key: 'gym' },
    { name: 'Shop', key: 'shop' },
    { name: 'Supplies', key: 'supplies' },
    { name: 'Laundry', key: 'laundry' }
  ];

  return (
    <div className="space-y-10 max-w-[1400px] mx-auto pb-10">
      {/* KPI Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#9CA3AF]">Camp Overview</h2>
            <button 
              onClick={fetchData} 
              disabled={loading}
              className="px-3 py-1 text-[9px] font-black uppercase tracking-widest bg-white border border-[#F3F4F6] text-[#A0604E] hover:bg-[#A0604E] hover:text-white rounded-lg transition-all shadow-sm flex items-center gap-1.5 h-7"
              title="Sync Analytics"
            >
              {loading ? <Loader2 className="animate-spin" size={10} /> : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              )}
              <span>Sync Now</span>
            </button>
          </div>
          {loading && <Loader2 className="animate-spin text-[#A0604E]" size={16} />}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Total Items" value={data.stock.total} description="Items across suite" color="#639922" loading={loading} />
          <StatCard label="Low Stock" value={data.stock.low_stock} description="Items below threshold" color="#E24B4A" loading={loading} />
          <StatCard label="Maintenance" value={data.maintenance.pending} description="Pending repairs" color="#BA7517" loading={loading} />
          <StatCard label="Requisitions" value={data.needs} description="Open procurement needs" color="#A0604E" loading={loading} />
        </div>
      </section>

      {/* Department Summary Grid */}
      <section>
        <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#9CA3AF] mb-6">Department Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map(mod => (
            <DepartmentCard 
              key={mod.key} 
              name={mod.name} 
              total={data.metrics[mod.key]?.total || 0} 
              lowCount={data.lowStockItems.filter(i => i.module === mod.name).length}
              loading={loading}
            />
          ))}
        </div>
      </section>

      {/* Activity & Alerts Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-[#F3F4F6] shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#9CA3AF] mb-1">Recent Activity</h2>
              <p className="text-[13px] font-bold text-[#1A1A1A]">Latest stock movements combined</p>
            </div>
            <History size={20} className="text-[#A0604E]" />
          </div>
          <div className="space-y-6">
            {data.recentTransactions.length > 0 ? data.recentTransactions.map((tx, idx) => (
              <div key={idx} className="flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${tx.action === 'RESTOCK' ? 'bg-[#EAF3DE] text-[#639922]' : 'bg-red-50 text-[#E24B4A]'}`}>
                    {tx.action === 'RESTOCK' ? 'R' : 'W'}
                  </div>
                  <div>
                    <div className="font-bold text-[14px] text-[#1A1A1A] group-hover:text-[#A0604E] transition-colors">{tx.item}</div>
                    <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                      {tx.module} &bull; {tx.action_by || 'System'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-black text-[14px] ${tx.action === 'RESTOCK' ? 'text-[#639922]' : 'text-[#E24B4A]'}`}>
                    {tx.action === 'RESTOCK' ? '+' : '-'}{tx.quantity}
                  </div>
                  <div className="text-[10px] font-bold text-[#9CA3AF]">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center text-[#9CA3AF] font-bold text-[13px]">No recent movements found.</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#F3F4F6] rounded-[32px] p-8 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#9CA3AF]">Critical Alerts</h2>
            <AlertTriangle size={18} className="text-[#E24B4A]" />
          </div>
          <div className="space-y-6">
            {data.lowStockItems.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-[#A0604E] mb-0.5">{item.module}</div>
                  <div className="font-bold text-[14px] text-[#1A1A1A] tracking-tight">{item.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[#E24B4A] font-black text-lg tracking-tighter">{item.quantity}</div>
                  <div className="text-[9px] font-black text-[#9CA3AF] uppercase tracking-widest">{item.unit || 'Units'}</div>
                </div>
              </div>
            ))}
            {data.lowStockItems.length === 0 && (
              <div className="py-12 text-center text-[#639922] font-black uppercase tracking-[0.2em] text-[10px]">
                System Healthy
              </div>
            )}
          </div>
          <button 
            onClick={() => navigate('/reports')}
            className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-[#1A1A1A] text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all border border-slate-200"
          >
            View Inventory Audit
          </button>
        </div>
      </div>

      {/* Maintenance & Requisitions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[32px] p-8 border border-[#F3F4F6] shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#9CA3AF]">Pending Maintenance</h2>
            <Wrench size={18} className="text-[#BA7517]" />
          </div>
          <div className="space-y-6">
            {data.pendingMaintenance.length > 0 ? data.pendingMaintenance.map((m, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[14px] text-[#1A1A1A]">{m.item_name}</div>
                  <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                    {m.module} &bull; {m.logged_by_name || 'Staff'}
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-amber-50 text-[#BA7517] rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100">
                  Pending
                </span>
              </div>
            )) : (
              <div className="py-8 text-center text-[#9CA3AF] font-bold text-[13px]">No active repairs needed.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-8 border border-[#F3F4F6] shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#9CA3AF]">Open Requisitions</h2>
            <ClipboardList size={18} className="text-[#A0604E]" />
          </div>
          <div className="space-y-6">
            {data.openNeeds.length > 0 ? data.openNeeds.map((n, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[14px] text-[#1A1A1A]">{n.item}</div>
                  <div className="text-[10px] font-black text-[#9CA3AF] uppercase tracking-widest">
                    {n.department} &bull; {n.requestor}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  n.priority === 'High' ? 'bg-red-50 text-[#E24B4A] border-red-100' : 'bg-gray-50 text-[#6B7280] border-gray-100'
                }`}>
                  {n.status}
                </span>
              </div>
            )) : (
              <div className="py-8 text-center text-[#9CA3AF] font-bold text-[13px]">All requirements fulfilled.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
