import React from 'react';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Modal genérico. Reemplaza los 3 bloques idénticos de
 * "historia-backdrop" + onClick/stopPropagation que había en CMODashboard.tsx.
 *
 * Uso:
 *   {showPacienteForm && (
 *     <Modal onClose={() => setShowPacienteForm(false)}>
 *       <PacienteForm onSuccess={...} onClose={() => setShowPacienteForm(false)} />
 *     </Modal>
 *   )}
 */
const Modal: React.FC<ModalProps> = ({ onClose, children }) => {
  return (
    <div className="historia-backdrop" onClick={onClose}>
      <div className="historia-backdrop-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export default Modal;