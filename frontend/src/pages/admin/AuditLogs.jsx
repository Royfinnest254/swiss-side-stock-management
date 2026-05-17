import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { 
  History, Filter, Calendar, Search, 
  Loader2, Inbox, ChevronDown, User,
  Shield, Database, Lock, Download
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
  const [exporting, setExporting] = useState(false);
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

  const getLogoBase64 = () => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });

  const handleExportPDF = async () => {
    if (logs.length === 0) return toast.error('No logs to export');
    setExporting(true);
    try {
      const logoBase64 = await getLogoBase64();
      const element = document.createElement('div');
      element.style.padding = '40px';
      element.style.width = '1000px';
      element.style.background = '#fff';
      element.style.position = 'fixed';
      element.style.left = '-9999px';

      element.innerHTML = `
        <div style="font-family: 'Outfit', Arial, sans-serif;">
          <div style="display: flex; align-items: center; gap: 24px; margin-bottom: 40px; border-bottom: 3px solid #A0604E; padding-bottom: 30px;">
            ${logoBase64 ? `<img src="${logoBase64}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 16px;" />` : ''}
            <div>
              <h1 style="color: #A0604E; text-transform: uppercase; letter-spacing: 4px; font-weight: 900; font-size: 28px; margin: 0;">Swiss Side Management</h1>
              <p style="text-transform: uppercase; font-size: 12px; font-weight: 900; letter-spacing: 2px; color: #64748b; margin: 6px 0 0 0;">Official System Audit List</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0 0;">Generated: ${new Date().toLocaleString()} | Security Level: Admin Confidential</p>
            </div>
          </div>

          <div style="margin-bottom: 30px; display: flex; gap: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px; flex: 1;">
              <span style="display: block; font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Log Count</span>
              <span style="font-size: 18px; font-weight: 900; color: #1e293b;">${logs.length} Entries</span>
            </div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 12px; flex: 1;">
              <span style="display: block; font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Filter Criteria</span>
              <span style="font-size: 18px; font-weight: 900; color: #1e293b;">${filters.action || 'Full System History'}</span>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 15px; text-align: left; color: #475569; text-transform: uppercase; font-weight: 900;">Timestamp</th>
                <th style="padding: 15px; text-align: left; color: #475569; text-transform: uppercase; font-weight: 900;">Staff</th>
                <th style="padding: 15px; text-align: left; color: #475569; text-transform: uppercase; font-weight: 900;">Action Type</th>
                <th style="padding: 15px; text-align: left; color: #475569; text-transform: uppercase; font-weight: 900;">Event Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map((log, idx) => `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#fff' : '#fafafa'}">
                  <td style="padding: 15px; color: #64748b; font-weight: 700;">${new Date(log.created_at).toLocaleString()}</td>
                  <td style="padding: 15px; color: #1e293b; font-weight: 900;">${log.admin_name || log.admin_email}</td>
                  <td style="padding: 15px;"><span style="background: #eff6ff; color: #1d4ed8; padding: 4px 8px; border-radius: 6px; font-weight: 900; font-size: 9px; text-transform: uppercase;">${log.action}</span></td>
                  <td style="padding: 15px; color: #475569; line-height: 1.4;">${log.details || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 40px; padding: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">End of List — Swiss Side Security Protocol</p>
          </div>
        </div>
      `;

      document.body.appendChild(element);
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const fileName = `SwissSide-Audit-Logs.pdf`;
      pdf.save(fileName);
      document.body.removeChild(element);
      toast.success('Audit report generated');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
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
        <button 
          onClick={handleExportPDF} 
          disabled={exporting || loading}
          className="btn-primary flex items-center gap-2 px-8 shadow-premium"
        >
          {exporting ? <Loader2 className="animate-spin" size={18} /> : <><Download size={18} /> Export PDF</>}
        </button>
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


