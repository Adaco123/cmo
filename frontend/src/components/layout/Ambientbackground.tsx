import React from 'react';

/**
 * Saca de CMODashboard.tsx el bloque puramente decorativo:
 * ambient-layer (los 3 orbes) + dot-grid. No tiene lógica ni props.
 */
const AmbientBackground: React.FC = () => (
  <>
    <div className="ambient-layer">
      <div className="ambient-orb ambient-orb-1"></div>
      <div className="ambient-orb ambient-orb-2"></div>
      <div className="ambient-orb ambient-orb-3"></div>
    </div>
    <div className="dot-grid"></div>
  </>
);

export default AmbientBackground;