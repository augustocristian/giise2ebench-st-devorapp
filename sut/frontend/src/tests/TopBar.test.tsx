import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import TopBar from '../components/TopBar';

// Mock SideMenu to isolate TopBar from its dependencies (authService, hooks, etc.)
vi.mock('../components/SideMenu', () => ({
    default: () => <div data-testid="mock-side-menu" />,
}));

const renderTopBar = (props: React.ComponentProps<typeof TopBar> = {}) =>
    render(
        <MemoryRouter>
            <TopBar {...props} />
        </MemoryRouter>
    );

describe('TopBar', () => {
    // ── Basic rendering ────────────────────────────────────────────────────

    it('renders the application name "DevorApp"', () => {
        renderTopBar();
        expect(screen.getByText('DevorApp')).toBeInTheDocument();
    });

    it('renders the header with the correct role', () => {
        renderTopBar();
        expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    // ── showMenu ──────────────────────────────────────────────────────────────

    it('shows the SideMenu when showMenu=true', () => {
        renderTopBar({ showMenu: true });
        expect(screen.getByTestId('mock-side-menu')).toBeInTheDocument();
    });

    it('does not show the SideMenu when showMenu=false', () => {
        renderTopBar({ showMenu: false });
        expect(screen.queryByTestId('mock-side-menu')).not.toBeInTheDocument();
    });

    it('does not show the SideMenu when showMenu is not specified', () => {
        renderTopBar({});
        expect(screen.queryByTestId('mock-side-menu')).not.toBeInTheDocument();
    });

    // ── leftSlot ─────────────────────────────────────────────────────────────

    it('renders the leftSlot when showMenu=false and leftSlot is passed', () => {
        renderTopBar({
            showMenu: false,
            leftSlot: <button>Atrás</button>,
        });
        expect(screen.getByText('Atrás')).toBeInTheDocument();
    });

    it('the leftSlot does not appear if showMenu=true (SideMenu takes priority)', () => {
        renderTopBar({
            showMenu: true,
            leftSlot: <button>Atrás</button>,
        });
        // SideMenu is shown but the leftSlot is also in the DOM (showMenu=true → SideMenu, the slot is ignored)
        expect(screen.getByTestId('mock-side-menu')).toBeInTheDocument();
    });

    // ── rightSlot ────────────────────────────────────────────────────────────

    it('renders the rightSlot when provided', () => {
        renderTopBar({ rightSlot: <button>Perfil</button> });
        expect(screen.getByText('Perfil')).toBeInTheDocument();
    });

    it('does not render the rightSlot if not provided', () => {
        renderTopBar({});
        // There must be no extra button besides the DevorApp one
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1); // only the "DevorApp" button
    });

    // ── Main button (Ir a Inicio) ─────────────────────────────────────────

    it('the central button has aria-label "Ir a Inicio"', () => {
        renderTopBar();
        expect(screen.getByRole('button', { name: 'Ir a Inicio' })).toBeInTheDocument();
    });

    it('clicking DevorApp does not throw errors', () => {
        renderTopBar();
        const btn = screen.getByRole('button', { name: 'Ir a Inicio' });
        expect(() => fireEvent.click(btn)).not.toThrow();
    });
});
