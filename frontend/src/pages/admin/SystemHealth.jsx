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
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);

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

  const runIntegrityScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const data = await api.get('/users/db-integrity');
      setScanResult(data);
      if (data.passed) {
        toast.success('Database scan passed with 100% integrity!');
      } else {
        toast.error(`Scan complete: ${data.errors.length} errors, ${data.warnings.length} warnings.`);
      }
    } catch (err) {
      toast.error('Failed to run database integrity scan');
    } finally {
      setScanning(false);
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

      {/* Database Integrity & Catalog Audit Section */}
      <div className="system-card p-10 space-y-8 bg-white border border-[#F3F4F6] mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Database Catalog & Integrity Scan</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Run diagnostics to verify category spelling, item names, active admins, and data formatting.</p>
          </div>
          <button
            onClick={runIntegrityScan}
            disabled={scanning}
            className="px-6 py-3 bg-[#A0604E] text-white hover:bg-[#8F5241] disabled:bg-slate-200 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 h-11 shrink-0"
          >
            {scanning ? (
              <>
                <Loader2 className="animate-spin" size={14} /> SCANNING DATABASE...
              </>
            ) : (
              'RUN INTEGRITY DIAGNOSTICS'
            )}
          </button>
        </div>

        {scanResult && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Status indicator */}
            <div className={`p-6 rounded-2xl border flex items-center gap-4 ${scanResult.passed ? 'bg-[#EAF3DE] border-[#639922]/20 text-[#3B6D11]' : 'bg-red-50 border-red-200 text-[#E24B4A]'}`}>
              {scanResult.passed ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest">
                  Scan Result: {scanResult.passed ? 'PASSED (100% HEALTHY)' : 'ATTENTION REQUIRED'}
                </h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Checked {scanResult.checksRun} rules • Found {scanResult.errors.length} errors • Found {scanResult.warnings.length} warnings
                </p>
              </div>
            </div>

            {/* Error table */}
            {scanResult.errors.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-[#E24B4A] uppercase tracking-widest ml-1">Critical Errors ({scanResult.errors.length})</h3>
                <div className="overflow-x-auto rounded-2xl border border-red-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-red-50/50 text-[#E24B4A] text-[10px] font-black uppercase tracking-widest border-b border-red-100">
                        <th className="px-6 py-4">Table</th>
                        <th className="px-6 py-4">Item ID</th>
                        <th className="px-6 py-4">Item Name</th>
                        <th className="px-6 py-4">Issue Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {scanResult.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-black uppercase tracking-wider">{err.table}</td>
                          <td className="px-6 py-4 text-xs font-bold">{err.itemId || 'N/A'}</td>
                          <td className="px-6 py-4 text-xs font-black text-slate-900">{err.itemName}</td>
                          <td className="px-6 py-4 text-xs font-bold text-[#E24B4A]">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Warning table */}
            {scanResult.warnings.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest ml-1">Warnings & Recommendations ({scanResult.warnings.length})</h3>
                <div className="overflow-x-auto rounded-2xl border border-amber-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-amber-50/50 text-[#BA7517] text-[10px] font-black uppercase tracking-widest border-b border-amber-100">
                        <th className="px-6 py-4">Table</th>
                        <th className="px-6 py-4">Item ID</th>
                        <th className="px-6 py-4">Item Name</th>
                        <th className="px-6 py-4">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {scanResult.warnings.map((wrn, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-black uppercase tracking-wider">{wrn.table}</td>
                          <td className="px-6 py-4 text-xs font-bold">{wrn.itemId || 'N/A'}</td>
                          <td className="px-6 py-4 text-xs font-black text-slate-900">{wrn.itemName}</td>
                          <td className="px-6 py-4 text-xs font-bold text-[#BA7517]">{wrn.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {scanResult.passed && (
              <div className="py-12 text-center text-[#3B6D11] bg-[#EAF3DE]/30 rounded-2xl border border-[#639922]/10 space-y-3">
                <CheckCircle2 className="mx-auto text-[#639922]" size={48} />
                <h3 className="text-sm font-black uppercase tracking-widest">Database is 100% Healthy!</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">All item names, categories, casing alignments, and administrator access are correct.</p>
              </div>
            )}
          </div>
        )}
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


