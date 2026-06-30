import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { BarChart3, Mail, Calendar, Filter, ArrowUpRight, ArrowDownLeft, TrendingUp, Package, ShoppingCart, Loader2, Clock, CheckCircle, RefreshCw, ShoppingBag, List, CheckSquare, DollarSign, Download } from 'lucide-react';

const ReportStat = ({ label, value, icon: Icon, color, loading }) => (
  <div className="bg-white border border-[#F3F4F6] rounded-[24px] p-8 shadow-sm group hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${color}15`, color }}>
        <Icon size={24} />
      </div>
      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#9CA3AF] mt-1">{label}</div>
    </div>
    {loading ? (
      <div className="h-9 w-24 bg-gray-200 animate-pulse rounded-lg" />
    ) : (
      <div className="text-3xl font-black text-[#1A1A1A] tracking-tighter">{value}</div>
    )}
    <div className="mt-4 h-1 w-full bg-[#F9FAFB] rounded-full overflow-hidden">
      <div className="h-full bg-current opacity-20 w-3/4" style={{ color }} />
    </div>
  </div>
);

export default function Reports() {
  // Analytics State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [dateRange, setDateRange] = useState('7d');

  // Email delivery states
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [reportPeriod, setReportPeriod] = useState('7d');
  const [reportFormat, setReportFormat] = useState('summary');
  const [submitting, setSubmitting] = useState(false);

  const handleDownloadStatement = async () => {
    const toastId = toast.loading('Compiling operations statement PDF...');
    try {
      const response = await api.get('/reports/statement-download', { responseType: 'blob' });
      const blob = response instanceof Blob ? response : new Blob([response.data || response], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Swiss_Side_Operations_Statement.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Operations statement PDF downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to compile and download operations statement.', { id: toastId });
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [summaryRes, transRes, analyticsRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/kitchen/transactions'),
        api.get('/reports/analytics')
      ]);
      setStats(summaryRes);
      setTransactions(transRes.results || transRes);
      setAnalytics(analyticsRes);
    } catch (err) {
      console.error('[Fetch Analytics Error]', err);
      setError(true);
      toast.error('Operational metrics synchronization failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailReport = async (e) => {
    e.preventDefault();
    if (!targetEmail) return toast.error('Destination email address required');
    setSubmitting(true);
    try {
      await api.post('/reports/email', { email: targetEmail, period: reportPeriod, format: reportFormat });
      toast.success('Report dispatched to ' + targetEmail);
      setEmailModalOpen(false);
      setTargetEmail('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to dispatch email reports');
    } finally {
      setSubmitting(false);
    }
  };

  const distributionTotal = analytics?.moduleDistribution?.reduce((acc, d) => acc + d.count, 0) || 0;
  const computedDistribution = (analytics?.moduleDistribution && analytics.moduleDistribution.length > 0) ? analytics.moduleDistribution.map(d => ({
    name: d.module,
    value: distributionTotal > 0 ? Math.round((d.count / distributionTotal) * 100) : 0,
    color: d.module === 'Kitchen' ? '#A0604E' : d.module === 'Spa' ? '#BA7517' : d.module === 'Gym' ? '#639922' : d.module === 'Laundry' ? '#E24B4A' : d.module === 'Supplies' ? '#2563EB' : '#10B981'
  })) : [
    { name: 'Kitchen', value: 45, color: '#A0604E' },
    { name: 'Spa', value: 25, color: '#BA7517' },
    { name: 'Gym', value: 15, color: '#639922' },
    { name: 'Laundry', value: 15, color: '#E24B4A' }
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#F3F4F6]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#A0604E] block mb-2">Operational Analytics</span>
          <h1 className="text-3xl font-black text-[#1A1A1A] tracking-tight uppercase">Operational Intelligence</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setEmailModalOpen(true)}
            className="h-12 px-6 bg-[#1A1A1A] text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-premium"
          >
            <Mail size={16} /> Email Report
          </button>
        </div>
      </div>

      <div className="space-y-12 animate-in fade-in duration-300">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-[24px] p-8 text-center max-w-lg mx-auto">
              <Package className="mx-auto text-red-400 mb-4 animate-bounce" size={40} />
              <h3 className="font-bold text-red-800 uppercase tracking-tight text-sm">Synchronization Interrupted</h3>
              <p className="text-red-600 text-xs mt-1">We were unable to aggregate operational metrics from the active department ledgers.</p>
              <button 
                onClick={fetchData} 
                className="mt-6 h-10 px-5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 mx-auto transition-all"
              >
                <RefreshCw size={14} /> Retry Synchronization
              </button>
            </div>
          ) : (
            <>
              {/* Analytics Metric Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ReportStat 
                  label="Stock Turnover" 
                  value={(analytics?.stockTurnover ?? 0).toLocaleString()} 
                  icon={TrendingUp} 
                  color="#A0604E" 
                  loading={loading}
                />
                <ReportStat 
                  label="Supply Gap" 
                  value={analytics?.itemsBelowThreshold ?? 0} 
                  icon={Package} 
                  color="#E24B4A" 
                  loading={loading}
                />
                <ReportStat 
                  label="Fulfilled Requests" 
                  value={analytics?.fulfilledRequests ?? 0} 
                  icon={ShoppingCart} 
                  color="#639922" 
                  loading={loading}
                />
                <ReportStat 
                  label="Movement Rate" 
                  value={`${analytics?.movementRate ?? 0}%`} 
                  icon={BarChart3} 
                  color="#BA7517" 
                  loading={loading}
                />
              </div>

              {/* Transaction history and charts side-by-side */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#9CA3AF]">Movement Ledger Records</h2>
                    <Clock size={16} className="text-[#9CA3AF]" />
                  </div>
                  <div className="bg-white border border-[#F3F4F6] rounded-[32px] p-0 overflow-hidden shadow-sm">
                    {loading ? (
                      <div className="p-12 text-center space-y-3">
                        <Loader2 className="animate-spin text-[#A0604E] mx-auto" size={24} />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Compiling active records...</span>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-[#F3F4F6]">
                              <th className="p-5 text-[10px] font-black uppercase tracking-wider text-[#9CA3AF]">Timestamp</th>
                              <th className="p-5 text-[10px] font-black uppercase tracking-wider text-[#9CA3AF]">Item</th>
                              <th className="p-5 text-[10px] font-black uppercase tracking-wider text-[#9CA3AF]">Action</th>
                              <th className="p-5 text-[10px] font-black uppercase tracking-wider text-[#9CA3AF]">Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.slice(0, 10).map(t => (
                              <tr key={t.id} className="hover:bg-[#F9FAFB] border-b border-[#F3F4F6] transition-colors">
                                <td className="p-5"><span className="text-[12px] font-bold text-[#6B7280]">{new Date(t.transaction_date || t.created_at).toLocaleDateString()}</span></td>
                                <td className="p-5"><span className="font-bold text-[#1A1A1A] uppercase tracking-tight">{t.item_name}</span></td>
                                <td className="p-5">
                                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                    (t.action || t.type) === 'restock' ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#FCEBEB] text-[#A32D2D]'
                                  }`}>
                                    {t.action || t.type}
                                  </span>
                                </td>
                                <td className="p-5"><span className="font-black text-[#1A1A1A] tracking-tighter">{t.quantity}</span></td>
                              </tr>
                            ))}
                            {transactions.length === 0 && (
                              <tr>
                                <td colSpan={4} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No transaction history logged for this period.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#9CA3AF]">Module Distribution</h2>
                  <div className="bg-white border border-[#F3F4F6] rounded-[32px] p-8 shadow-sm">
                    {loading ? (
                      <div className="h-64 flex items-center justify-center">
                        <Loader2 className="animate-spin text-[#A0604E]" size={24} />
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {computedDistribution.map(module => (
                          <div key={module.name} className="space-y-3">
                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                              <span className="text-[#1A1A1A]">{module.name}</span>
                              <span className="text-[#9CA3AF]">{module.value}%</span>
                            </div>
                            <div className="h-2 w-full bg-[#F9FAFB] rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${module.value}%`, backgroundColor: module.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

      {/* Email Report Modal */}
      <Modal isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Email Operational Report">
        <form onSubmit={handleEmailReport} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Destination Email</label>
            <input 
              type="email" 
              className="input-field" 
              value={targetEmail} 
              onChange={e => setTargetEmail(e.target.value)} 
              required 
              placeholder="e.g. executive@swiss-side.store" 
              autoFocus 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Time Period</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: '24h', label: 'Last 24h' },
                { value: '7d', label: 'Last 7 Days' },
                { value: '30d', label: 'Last 30 Days' },
                { value: '6m', label: 'Last 6 Months' },
                { value: '12m', label: 'Last 12 Months' },
                { value: 'all', label: 'All Time' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReportPeriod(opt.value)}
                  className={`h-9 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${reportPeriod === opt.value ? 'bg-[#A0604E] text-white' : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">Report Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReportFormat('summary')}
                className={`h-20 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                  reportFormat === 'summary' ? 'border-[#A0604E] bg-[#FDF5F3]' : 'border-[#F3F4F6] bg-white hover:border-[#E5E7EB]'
                }`}
              >
                <span className={`text-[11px] font-black uppercase tracking-widest ${reportFormat === 'summary' ? 'text-[#A0604E]' : 'text-[#1A1A1A]'}`}>Summary</span>
                <span className="text-[10px] text-[#9CA3AF] font-medium">Key numbers only</span>
              </button>
              <button
                type="button"
                onClick={() => setReportFormat('detailed')}
                className={`h-20 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                  reportFormat === 'detailed' ? 'border-[#A0604E] bg-[#FDF5F3]' : 'border-[#F3F4F6] bg-white hover:border-[#E5E7EB]'
                }`}
              >
                <span className={`text-[11px] font-black uppercase tracking-widest ${reportFormat === 'detailed' ? 'text-[#A0604E]' : 'text-[#1A1A1A]'}`}>Detailed</span>
                <span className="text-[10px] text-[#9CA3AF] font-medium">Full itemised tables</span>
              </button>
            </div>
            {reportFormat === 'detailed' && (
              <p className="text-[10px] text-[#A0604E] font-black uppercase tracking-widest text-center mt-3 animate-pulse">
                A PDF will be attached to the email.
              </p>
            )}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full h-14 uppercase tracking-widest font-black flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Mail size={16} /> Dispatch Report</>}
          </button>
        </form>
      </Modal>
    </div>
  );
}
