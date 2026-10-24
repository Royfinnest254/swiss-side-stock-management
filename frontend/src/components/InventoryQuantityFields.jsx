export default function InventoryQuantityFields({ quantity, openedQuantityRemaining, unit, onQuantityChange, onOpenedQuantityChange }) {
  const unitLabel = unit?.trim() || 'units';

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">
          Quantity on hand ({unitLabel})
        </label>
        <input
          type="number"
          min="0"
          step="0.001"
          className="input-field"
          value={quantity ?? ''}
          onChange={onQuantityChange}
          required
          placeholder="0.000"
        />
        <p className="text-[10px] text-[#9CA3AF] ml-1">Enter the total amount currently available.</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">
          Opened package remaining <span className="font-normal normal-case">— optional</span>
        </label>
        <input
          type="number"
          min="0"
          step="0.001"
          max={quantity === '' || quantity == null ? undefined : quantity}
          className="input-field"
          value={openedQuantityRemaining ?? ''}
          onChange={onOpenedQuantityChange}
          placeholder={`Amount in open pack (${unitLabel})`}
        />
        <p className="text-[10px] text-[#9CA3AF] ml-1">This amount is included in the total above.</p>
      </div>
    </>
  );
}
