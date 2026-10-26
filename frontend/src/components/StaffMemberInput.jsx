export function getDefaultStaffMemberName() {
  const displayName = localStorage.getItem('swiss_side_display_name');
  const email = localStorage.getItem('swiss_side_user');
  return displayName || email || '';
}

export default function StaffMemberInput({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF] ml-1">
        Staff member
      </label>
      <input
        className="input-field"
        value={value}
        onChange={onChange}
        maxLength={100}
        required
        placeholder="Name recorded for this stock action"
      />
      <p className="text-[10px] text-[#9CA3AF] ml-1">
        Starts with your account name. You can edit it for this entry.
      </p>
    </div>
  );
}
