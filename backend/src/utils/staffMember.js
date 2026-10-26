function resolveStaffMemberName(req) {
  const enteredName = String(req.body?.staff_member_name ?? '').trim();
  const accountName = String(req.user?.display_name || req.user?.email || '').trim();
  return (enteredName || accountName).slice(0, 100);
}

module.exports = { resolveStaffMemberName };
