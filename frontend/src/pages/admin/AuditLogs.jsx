import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  History, Filter, Calendar, Search, 
  Loader2, Inbox, ChevronDown, User,
  Shield, Database, Lock
} from 'lucide-react';

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'ITEM_CREATED', label: 'Item Created' },
  { value: 'ITEM_DELETED', label: 'Item Deleted' },
  { value: 'ITEM_RESTORED', label: 'Item Restored' },
  { value: 'PASSWORD_RESET', label: 'Password Reset' },
  { value: 'USER_CREATED', label: 'User Created' },
  { value: 'USER_REMOVED', label: 'User Removed' },
];

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [filters, setFilters] = useState({ action: '', from_date: '', to_date: '' });

  const role = localStorage.getItem('swiss_side_role');
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    fetchLogs(1, true);
  }, [filters.action, filters.from_date, filters.to_date]);

  const fetchLogs = async (pageNum, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', pageNum);
      queryParams.append('limit', 50);
      if (filters.action) queryParams.append('action', filters.action);
      if (filters.from_date) queryParams.append('from_date', filters.from_date);
      if (filters.to_date) queryParams.append('to_date', filters.to_date);

      const data = await api.get(`/users/admin-logs?${queryParams.toString()}`).catch(() => []);
      const safeData = Array.isArray(data) ? data : [];
      
      if (reset) setLogs(safeData);
      else setLogs(prev => [...prev, ...safeData]);
      
      setHasMore(safeData.length === 50);
      setPage(pageNum);
    } catch (err) {
      toast.error('Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const getBorderColor = (action) => {
    if (!action) return 'border-l-primary';
    if (action.includes('CREATED') || action.includes('RESTORED')) return 'border-l-success';
    if (action.includes('DELETED') || action.includes('REMOVED')) return 'border-l-danger';
    if (action.includes('RESET') || action.includes('MODIFIED')) return 'border-l-warning';
    return 'border-l-primary';
  };

  const getIcon = (action) => {
    if (!action) return <Shield size={14} />;
    if (action.includes('USER')) return <User size={14} />;
    if (action.includes('PASSWORD')) return <Lock size={14} />;
    if (action.includes('ITEM')) return <Database size={14} />;
    return <Shield size={14} />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Audit Logs</h1>
          <p className="text-xs font-black text-primary uppercase tracking-[0.3em] mt-2">Security &amp; Accountability</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="system-card p-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label className="text-xs-label ml-1">Action Type</label>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select 
              className="input-field pl-12 appearance-none"
              value={filters.action}
              onChange={(e) => setFilters({...filters, action: e.target.value})}
            >
              {ACTION_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full md:w-[200px] space-y-1.5">
          <label className="text-xs-label ml-1">From Date</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="date" 
              className="input-field pl-12" 
              value={filters.from_date}
              onChange={(e) => setFilters({...filters, from_date: e.target.value})}
            />
          </div>
        </div>

        <div className="w-full md:w-[200px] space-y-1.5">
          <label className="text-xs-label ml-1">To Date</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="date" 
              className="input-field pl-12" 
              value={filters.to_date}
              onChange={(e) => setFilters({...filters, to_date: e.target.value})}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="animate-spin text-primary mx-auto" size={32} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Streaming Security Logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="system-card p-20 text-center">
          <History className="text-slate-200 mx-auto mb-4" size={48} />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No audit logs recorded for this period</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative pl-8 space-y-4 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100">
            {logs.map((log) => (
              <div 
                key={log.id} 
                className={`bg-white border border-slate-100 border-l-4 rounded-premium p-6 shadow-sm hover:shadow-md transition-all ${getBorderColor(log.action)}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 ${getBorderColor(log.action).replace('border-l-', 'bg-')}`}>
                      {getIcon(log.action)}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">
                        {log.admin_name || log.admin_email}
                      </div>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">
                        {log.details || 'No details provided'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Timestamp</div>
                    <div className="text-[11px] font-bold text-slate-900">
                      {log.created_at ? new Date(log.created_at).toLocaleDateString() : '—'} at {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="pt-8 text-center">
              <button 
                onClick={() => fetchLogs(page + 1)} 
                disabled={loadingMore}
                className="btn-secondary min-w-[200px] flex items-center justify-center gap-2 mx-auto"
              >
                {loadingMore ? <Loader2 className="animate-spin" size={16} /> : <><ChevronDown size={16} /> Load Earlier Logs</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


