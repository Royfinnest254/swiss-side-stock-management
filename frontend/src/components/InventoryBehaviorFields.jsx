export default function InventoryBehaviorFields({ value, onChange, reorderLevel, onReorderLevelChange, disabled = false }) {
  const itemType = value.item_type || 'stocked';
  const automatic = !!value.auto_reorder_enabled;
  return (
    <section className="col-span-2 rounded-2xl border border-[#E8DED9] bg-[#FFFCFA] p-4 space-y-3">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">How should this item be tracked?</label>
        <select className="input-field mt-1" value={itemType} disabled={disabled} onChange={e => {
          const nextType = e.target.value;
          onChange({ ...value, item_type: nextType, auto_reorder_enabled: nextType === 'stocked' ? automatic : false });
          if (nextType !== 'stocked') onReorderLevelChange(0);
        }}>
          <option value="stocked">Counted stock</option>
          <option value="tracked">Tracked, do not auto-reorder</option>
          <option value="purchase_only">Purchase only (no stock balance)</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">Assets and utilities can be kept out of automatic replenishment.</p>
      </div>
      {itemType === 'stocked' && !disabled && <>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={automatic} onChange={e => onChange({ ...value, item_type: 'stocked', auto_reorder_enabled: e.target.checked })} />
          Include this item in the generated reorder draft
        </label>
        {automatic && <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Minimum stock</label><input type="number" step="0.001" min="0.001" required className="input-field mt-1" value={reorderLevel ?? ''} onChange={e => onReorderLevelChange(e.target.value)} /></div>
          <div><label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Restock target</label><input type="number" step="0.001" min={Number(reorderLevel || 0) + 0.001} required className="input-field mt-1" value={value.reorder_target ?? ''} onChange={e => onChange({ ...value, reorder_target: e.target.value })} /></div>
        </div>}
      </>}
      {itemType === 'purchase_only' && <p className="text-xs text-slate-500">This item will not be included in inventory quantity or automatic reorder calculations.</p>}
    </section>
  );
}
