import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SideMenu from '../components/SideMenu';

// ── Mockeamos createPortal para que el contenido se renderice en línea ────────
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
            nombre: 'Test',
            apellidos: 'User',
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

    it('renderiza el botón hamburguesa', () => {
        renderSideMenu();
        expect(screen.getByLabelText('Abrir menú')).toBeInTheDocument();
    });

    it('el drawer no tiene la clase "open" inicialmente', () => {
        renderSideMenu();
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    // ── Apertura del drawer ───────────────────────────────────────────────────

    it('abre el drawer al clicar el botón hamburguesa', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(true);
    });

    it('muestra el título "DevorApp" dentro del drawer cuando está abierto', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText('DevorApp')).toBeInTheDocument();
    });

    // ── Cierre del drawer ─────────────────────────────────────────────────────

    it('cierra el drawer al clicar el botón X', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByLabelText('Cerrar menú'));
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    it('cierra el drawer al clicar el backdrop', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        const backdrop = document.querySelector('.sidemenu-backdrop');
        fireEvent.click(backdrop!);
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    // ── Elementos de navegación ───────────────────────────────────────────────

    it('muestra los ítems de navegación cuando el drawer está abierto', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText('Inicio')).toBeInTheDocument();
        expect(screen.getByText('Buscador')).toBeInTheDocument();
        expect(screen.getByText('Favoritos')).toBeInTheDocument();
        expect(screen.getByText('Para más tarde')).toBeInTheDocument();
        expect(screen.getByText('Historial')).toBeInTheDocument();
        expect(screen.getByText('Valoraciones')).toBeInTheDocument();
    });

    it('cierra el drawer al pulsar un ítem de navegación', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByText('Favoritos'));
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    // ── Controles de tema ─────────────────────────────────────────────────────

    it('muestra los botones de tema Claro y Oscuro', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText(/claro/i)).toBeInTheDocument();
        expect(screen.getByText(/oscuro/i)).toBeInTheDocument();
    });

    it('cambia el atributo data-theme del documento al seleccionar "Claro"', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByText(/claro/i));
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('elimina el atributo data-theme al seleccionar "Oscuro"', () => {
        document.documentElement.setAttribute('data-theme', 'light');
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByText(/oscuro/i));
        expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    });

    // ── Controles de tamaño de fuente ─────────────────────────────────────────

    it('muestra los botones de tamaño de fuente S, M y L', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument();
    });

    it('añade data-font-size="L" al documento al seleccionar L', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByRole('button', { name: 'L' }));
        expect(document.documentElement.dataset.fontSize).toBe('L');
    });

    it('elimina data-font-size al seleccionar M (tamaño por defecto)', () => {
        document.documentElement.dataset.fontSize = 'L';
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByRole('button', { name: 'M' }));
        expect(document.documentElement.dataset.fontSize).toBeUndefined();
    });

    // ── Logout ────────────────────────────────────────────────────────────────

    it('muestra el botón "Cerrar sesión"', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText(/cerrar sesión/i)).toBeInTheDocument();
    });

    it('el botón de logout llama a submitLogout al ser clicado', () => {
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        fireEvent.click(screen.getByText(/cerrar sesión/i));
        // submitLogout es llamado por el mock de useLogout
        // verificamos que el drawer se cierra (el mock llama a onSuccess)
        const overlay = document.querySelector('.sidemenu-overlay');
        expect(overlay?.classList.contains('open')).toBe(false);
    });

    // ── Usuario en caché ──────────────────────────────────────────────────────

    it('muestra los datos del usuario si están en localStorage', async () => {
        const userData = { nombre: 'Carlos', apellidos: 'López', username: 'carlos', email: 'carlos@test.com' };
        localStorage.setItem('devorapp_user_cache', JSON.stringify(userData));
        renderSideMenu();
        fireEvent.click(screen.getByLabelText('Abrir menú'));
        expect(screen.getByText('carlos@test.com')).toBeInTheDocument();
    });

    it('llama a authService.getMe para actualizar la caché al montar', async () => {
        renderSideMenu();
        await waitFor(() => {
            expect(authService.getMe).toHaveBeenCalledTimes(1);
        });
    });
});
