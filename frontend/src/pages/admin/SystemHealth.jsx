import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  Database, Activity, Shield, Users, 
  Server, HardDrive, Cpu, Loader2,
  TrendingUp, AlertCircle, CheckCircle2, ShieldCheck
} from 'lucide-react';

export default function SystemMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const role = localStorage.getItem('swiss_side_role');
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const data = await api.get('/users/metrics');
      setMetrics(data);
    } catch (err) {
      toast.error('Failed to load system metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#A0604E]" size={32} />
    </div>
  );

  const totalRecords = metrics ? Object.entries(metrics).reduce((acc, [key, val]) => {
    if (['users', 'admins', 'staff', 'needs'].includes(key)) return acc;
    return acc + (typeof val === 'number' ? val : 0);
  }, 0) : 0;

  const limit = 100000;
  const percentage = (totalRecords / limit) * 100;
  
  const getHealthStatus = () => {
    if (totalRecords < 50000) return { label: 'OPTIMAL', color: 'text-success', bg: 'bg-success' };
    if (totalRecords < 80000) return { label: 'SCALING REQUIRED', color: 'text-warning', bg: 'bg-warning' };
    return { label: 'CRITICAL', color: 'text-danger', bg: 'bg-danger' };
  };

  const status = getHealthStatus();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">System Metrics</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Database Health Card */}
        <div className="system-card p-10 flex flex-col h-full">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-xs-label mb-2">Database Capacity</h3>
              <div className="text-4xl font-black text-slate-900 tracking-tight">{totalRecords.toLocaleString()}</div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Total Managed Records</p>
            </div>
            <div className={`px-4 py-2 rounded-2xl ${status.bg}/10 ${status.color} border border-${status.bg}/10`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status.bg} animate-pulse`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest">{status.label}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Storage Utilization</span>
                <span className="text-xs font-black text-slate-900">{percentage.toFixed(1)}%</span>
              </div>
              <div className="h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-1">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${status.bg}`}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricItem label="Kitchen" value={metrics?.kitchen} />
              <MetricItem label="Spa" value={metrics?.spa} />
              <MetricItem label="Shop" value={metrics?.shop} />
              <MetricItem label="Gym" value={metrics?.gym_prod} />
              <MetricItem label="Supplies" value={metrics?.supplies} />
              <MetricItem label="Laundry" value={metrics?.laundry} />
              <MetricItem label="Accommodation" value={metrics?.houses} />
              <MetricItem label="Needs" value={metrics?.needs} />
            </div>
          </div>
        </div>

        {/* System Info Card */}
        <div className="system-card p-10 flex flex-col h-full bg-slate-900 text-white border-none shadow-elevated">
          <div className="flex justify-between items-start mb-10">
            <div>
              <div className="text-4xl font-black tracking-tight">Swiss Side V14</div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Stable Environment</p>
            </div>
            <Server size={32} className="text-[#A0604E]" />
          </div>

          <div className="flex-1 space-y-10">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#A0604E]">
                  <ShieldCheck size={16} />
                  <span className="text-xs-label text-[#A0604E]">Security</span>
                </div>
                <div className="text-xl font-black">AES-256-GCM</div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">Full End-to-End Database Encryption</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#A0604E]">
                  <Users size={16} />
                  <span className="text-xs-label text-[#A0604E]">Staff</span>
                </div>
                <div className="text-xl font-black">{metrics?.users || 0} Accounts</div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                  {metrics?.admins || 0} Admins / {metrics?.staff || 0} Staff
                </p>
              </div>
            </div>

            <div className="p-8 bg-white/5 rounded-premium border border-white/5 space-y-6">
              <h4 className="text-xs-label text-slate-400">Environment Specs</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Cpu size={16} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-400">Node.js Engine</span>
                  </div>
                  <span className="text-xs font-black">v20.x Standard</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Database size={16} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-400">Database Engine</span>
                  </div>
                  <span className="text-xs font-black">MySQL 8.0 Indexed</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Shield size={16} className="text-slate-500" />
                    <span className="text-xs font-bold text-slate-400">Session Management</span>
                  </div>
                  <span className="text-xs font-black">JWT Stateless</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricItem({ label, value }) {
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-lg font-black text-slate-900">{(value || 0).toLocaleString()}</div>
    </div>
  );
}


