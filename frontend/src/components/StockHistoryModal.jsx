import { useCallback, useEffect, useState } from 'react';
import { Calendar, Filter, History, Loader2 } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Modal from './Modal';

const actionLabels = {
  added: 'Added',
  restock: 'Restock',
  RESTOCK: 'Restock',
  withdraw: 'Withdraw',
  WITHDRAWAL: 'Withdraw',
  edited: 'Modified',
};

export default function StockHistoryModal({ isOpen, item, endpoint, onClose }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [action, setAction] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!item?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ item_id: item.id });
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      if (action) params.set('action', action);
      const data = await api.get(`${endpoint}?${params.toString()}`);
      setRows(data.results || data || []);
    } catch (error) {
      toast.error('Could not load this item’s stock history');
    } finally {
      setLoading(false);
    }
  }, [action, endpoint, fromDate, item?.id, toDate]);

  useEffect(() => {
    if (isOpen && item?.id) loadHistory();
  }, [isOpen, item?.id, loadHistory]);

  const resetAndClose = () => {
    setFromDate('');
    setToDate('');
    setAction('');
    setRows([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={`Stock history — ${item?.name || ''}`}>
      <div className="space-y-5 py-3">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#F3F4F6] bg-[#F9FAFB] p-4">
          <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
            From
            <span className="flex items-center gap-2 rounded-lg bg-white px-3">
              <Calendar size={14} />
              <input type="date" className="h-10 border-0 bg-transparent text-xs focus:ring-0" value={fromDate} onChange={event => setFromDate(event.target.value)} />
            </span>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
            To
            <span className="flex items-center gap-2 rounded-lg bg-white px-3">
              <Calendar size={14} />
              <input type="date" className="h-10 border-0 bg-transparent text-xs focus:ring-0" value={toDate} onChange={event => setToDate(event.target.value)} />
            </span>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">
            Action
            <select className="h-10 rounded-lg border-0 bg-white text-xs" value={action} onChange={event => setAction(event.target.value)}>
              <option value="">All movements</option>
              <option value="restock">Restock</option>
              <option value="withdraw">Withdraw</option>
              <option value="edited">Modified</option>
              <option value="added">Added</option>
            </select>
          </label>
          <button type="button" onClick={loadHistory} disabled={loading} className="ml-auto flex h-10 items-center gap-2 rounded-xl bg-[#1A1A1A] px-4 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            Apply filters
          </button>
        </div>

        <div className="max-h-[55vh] overflow-auto rounded-2xl border border-[#F3F4F6]">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="sticky top-0 bg-[#F9FAFB] text-[10px] font-black uppercase tracking-wider text-[#9CA3AF]">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Staff member</th>
                <th className="px-4 py-3">Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {rows.map(row => (
                <tr key={`${row.id}-${row.created_at || row.transaction_date}`}>
                  <td className="px-4 py-3">{row.transaction_date ? new Date(row.transaction_date).toLocaleDateString() : row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 font-bold">{actionLabels[row.action] || actionLabels[row.type] || row.action || row.type || '—'}</td>
                  <td className="px-4 py-3 font-black">{row.quantity ?? '—'} {row.unit || ''}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.reason || row.notes || '—'}</td>
                  <td className="px-4 py-3">{row.staff_member_name || row.person || row.action_by_name || '—'}</td>
                  <td className="px-4 py-3 text-[#6B7280]">{row.account_name || row.action_by_name || '—'}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan="6" className="px-4 py-12 text-center text-[#9CA3AF]"><History size={24} className="mx-auto mb-2 opacity-50" />No stock movements found for this item and date range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
