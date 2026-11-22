import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SideMenu from '../components/SideMenu';

// ── Mock createPortal so the content renders inline ────────
vi.mock('react-dom', async () => {
    const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
    return {
        ...actual,
        createPortal: (node: React.ReactNode) => node,
    };
});

// ── Mock authService ──────────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        getMe: vi.fn().mockResolvedValue({
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            email: 'test@test.com',
        }),
        logout: vi.fn().mockResolvedValue(undefined),
    },
}));

// ── Mock useLogout ────────────────────────────────────────────────────────────
vi.mock('../controllers/hooks/useLogout', () => ({
    useLogout: (onSuccess: () => void) => ({
        submitLogout: vi.fn().mockImplementation(async () => onSuccess()),
        loading: false,
        error: null,
    }),
}));

import { authService } from '../models/api/authService';

const renderSideMenu = (initialPath = '/home') =>
    render(
        <MemoryRouter initialEntries={[initialPath]}>
            <SideMenu />
        </MemoryRouter>
    );

describe('SideMenu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    // ── Renderizado inicial ───────────────────────────────────────────────────

    it('renders the hamburger button', () => {
        renderSideMenu();
        expect(screen.getByLabelText('Abrir menú')).toBeInTheDocument();
    });

    it('the drawer does not have the "open" class initially', () => {
        renderSideMenu();
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    // ── Drawer opening ───────────────────────────────────────────────────

    it('opens the drawer when clicking the hamburger button', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(true);
    });

    it('shows the "DevorApp" title inside the drawer when open', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText('DevorApp')).toBeInTheDocument();
    });

    // ── Drawer closing ─────────────────────────────────────────────────────

    it('closes the drawer when clicking the X button', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByLabelText('Cerrar menú'));
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    it('closes the drawer when clicking the backdrop', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        const backdrop = document.querySelector('.sidemenu-backdrop');
        fireEvent.click(backdrop!);
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    // ── Navigation items ───────────────────────────────────────────────

    it('shows the navigation items when the drawer is open', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText('Inicio')).toBeInTheDocument();
        expect(screen.getByText('Buscador')).toBeInTheDocument();
        expect(screen.getByText('Favoritos')).toBeInTheDocument();
        expect(screen.getByText('Para más tarde')).toBeInTheDocument();
        expect(screen.getByText('Historial')).toBeInTheDocument();
        expect(screen.getByText('Valoraciones')).toBeInTheDocument();
    });

    it('closes the drawer when pressing a navigation item', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByText('Favoritos'));
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    // ── Theme controls ─────────────────────────────────────────────────────

    it('shows the Claro and Oscuro theme buttons', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText(/claro/i)).toBeInTheDocument();
        expect(screen.getByText(/oscuro/i)).toBeInTheDocument();
    });

    it('changes the document data-theme attribute when selecting "Claro"', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByText(/claro/i));
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('removes the data-theme attribute when selecting "Oscuro"', () => {
        document.documentElement.setAttribute('data-theme', 'light');
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByText(/oscuro/i));
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    // ── Font size controls ─────────────────────────────────────────

    it('shows the S, M and L font size buttons', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument();
    });

    it('adds data-font-size="L" to the document when selecting L', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByRole('button', { name: 'L' }));
        expect(document.documentElement.dataset.fontSize).toBe('L');
    });

    it('removes data-font-size when selecting M (default size)', () => {
        document.documentElement.dataset.fontSize = 'L';
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByRole('button', { name: 'M' }));
        expect(document.documentElement.dataset.fontSize).toBeUndefined();
    });

    // ── Logout ────────────────────────────────────────────────────────────────

    it('shows the "Cerrar sesión" button', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText(/cerrar sesión/i)).toBeInTheDocument();
    });

    it('the logout button calls submitLogout when clicked', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByText(/cerrar sesión/i));
        // submitLogout is called by the useLogout mock
        // verify the drawer closes (the mock calls onSuccess)
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    // ── Cached user ──────────────────────────────────────────────────────

    it('shows the user data if present in localStorage', async () => {
        const userData = { first_name: 'Carlos', last_name: 'López', username: 'carlos', email: 'carlos@test.com' };
        localStorage.setItem('devorapp_user_cache', JSON.stringify(userData));
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText('carlos@test.com')).toBeInTheDocument();
    });

    it('calls authService.getMe to refresh the cache on mount', async () => {
        renderSideMenu();
        await waitFor(() => {
            expect(authService.getMe).toHaveBeenCalledTimes(1);
        });
    });
});
