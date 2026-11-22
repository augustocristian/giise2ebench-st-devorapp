import React from 'react';
import { useNavigate } from 'react-router-dom';
import SideMenu from './SideMenu';

interface TopBarProps {
  /** Optional right slot: action buttons, avatar, etc. */
  rightSlot?: React.ReactNode;
  /** Optional left slot, alternative to the menu */
  leftSlot?: React.ReactNode;
  /** If true, shows the left navigation menu */
  showMenu?: boolean;
}

/**
 * Persistent top bar of the app.
 * Shows the centered name and side controls.
 */
const TopBar: React.FC<TopBarProps> = ({ rightSlot, leftSlot, showMenu }) => {
  const navigate = useNavigate();

  return (
    <header className="topbar" data-testid="topbar">
      <div className="topbar-inner">
        {/* Left Side: Back button or SideMenu */}
        <div className="topbar-side">
          {showMenu ? <SideMenu /> : leftSlot}
        </div>

        {/* Center: App Name (home link) */}
        <button
          data-testid="topbar-home"
          className="topbar-name topbar-home-btn"
          onClick={() => navigate('/home')}
          aria-label="Ir a Inicio"
        >
          DevorApp
        </button>

        {/* Right Side: Actions or flexible spacing */}
        <div className="topbar-side topbar-actions">
          {rightSlot}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
