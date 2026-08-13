import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';

interface ViewButtonProps {
  name: string;
  onClick: () => void;
}

const ViewButton: React.FC<ViewButtonProps> = ({ name, onClick }) => (
  <button className="view-btn" onClick={onClick} title={`Ver ${name}`}>
    <FontAwesomeIcon icon={faEye} />
  </button>
);

export default ViewButton;