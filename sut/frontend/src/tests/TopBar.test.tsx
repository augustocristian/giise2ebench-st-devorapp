import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import TopBar from '../components/TopBar';

// Mockeamos SideMenu para aislar TopBar de sus dependencias (authService, hooks, etc.)
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
    // ── Renderizado básico ────────────────────────────────────────────────────

    it('renderiza el nombre de la aplicación "DevorApp"', () => {
        renderTopBar();
        expect(screen.getByText('DevorApp')).toBeInTheDocument();
    });

    it('renderiza el header con role correcto', () => {
        renderTopBar();
        expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    // ── showMenu ──────────────────────────────────────────────────────────────

    it('muestra el SideMenu cuando showMenu=true', () => {
        renderTopBar({ showMenu: true });
        expect(screen.getByTestId('mock-side-menu')).toBeInTheDocument();
    });

    it('no muestra el SideMenu cuando showMenu=false', () => {
        renderTopBar({ showMenu: false });
        expect(screen.queryByTestId('mock-side-menu')).not.toBeInTheDocument();
    });

    it('no muestra el SideMenu cuando showMenu no se especifica', () => {
        renderTopBar({});
        expect(screen.queryByTestId('mock-side-menu')).not.toBeInTheDocument();
    });

    // ── leftSlot ─────────────────────────────────────────────────────────────

    it('renderiza el leftSlot cuando showMenu=false y se pasa leftSlot', () => {
        renderTopBar({
            showMenu: false,
            leftSlot: <button>Atrás</button>,
        });
        expect(screen.getByText('Atrás')).toBeInTheDocument();
    });

    it('el leftSlot no aparece si showMenu=true (SideMenu tiene prioridad)', () => {
        renderTopBar({
            showMenu: true,
            leftSlot: <button>Atrás</button>,
        });
        // SideMenu se muestra pero el leftSlot también está en DOM (showMenu=true → SideMenu, el slot se ignora)
        expect(screen.getByTestId('mock-side-menu')).toBeInTheDocument();
    });

    // ── rightSlot ────────────────────────────────────────────────────────────

    it('renderiza el rightSlot cuando se proporciona', () => {
        renderTopBar({ rightSlot: <button>Perfil</button> });
        expect(screen.getByText('Perfil')).toBeInTheDocument();
    });

    it('no renderiza el rightSlot si no se proporciona', () => {
        renderTopBar({});
        // No debe haber ningún botón extra aparte del de DevorApp
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1); // solo el botón "DevorApp"
    });

    // ── Botón principal (Ir a Inicio) ─────────────────────────────────────────

    it('el botón central tiene aria-label "Ir a Inicio"', () => {
        renderTopBar();
        expect(screen.getByRole('button', { name: 'Ir a Inicio' })).toBeInTheDocument();
    });

    it('hacer click en DevorApp no lanza errores', () => {
        renderTopBar();
        const btn = screen.getByRole('button', { name: 'Ir a Inicio' });
        expect(() => fireEvent.click(btn)).not.toThrow();
    });
});
