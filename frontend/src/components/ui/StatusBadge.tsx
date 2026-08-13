import React from 'react';

interface StatusBadgeProps {
  activo: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ activo }) => {
  const clase = activo ? 'active' : 'inactive';
  return (
    <span className="status-indicator">
      <span className={`dot ${clase}`}></span>
      <span className={`label ${clase}`}>{activo ? 'Activo' : 'Inactivo'}</span>
    </span>
  );
};

export default StatusBadge;