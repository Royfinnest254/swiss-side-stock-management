import React from 'react';

export const ConditionBadge = ({ condition }) => {
  if (!condition) return <span className="text-gray-400">—</span>;
  const label = condition.replace(/_/g, ' ');
  const styles = {
    good: 'bg-green-100 text-green-800',
    fair: 'bg-yellow-100 text-yellow-800',
    needs_attention: 'bg-orange-100 text-orange-800',
    broken: 'bg-red-100 text-red-800',
    missing: 'bg-red-900 text-red-100',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${styles[condition] || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  if (!status) return <span className="text-gray-400">—</span>;
  const label = status.replace(/_/g, ' ');
  const styles = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    ordered: 'bg-purple-100 text-purple-800',
    fulfilled: 'bg-emerald-100 text-emerald-800',
    resolved: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
};
