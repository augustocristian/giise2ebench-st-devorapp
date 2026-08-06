import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HomePage from '../views/HomePage';

// ── Mock authService ──────────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        logout: vi.fn(),
        getMe: vi.fn(),
    },
}));

// ── Mock historialService ─────────────────────────────────────────────────────
vi.mock('../models/api/historialService', () => ({
    historialService: {
        getPopulares: vi.fn(),
        addToHistorial: vi.fn(),
    },
}));

// ── Mock savedForLaterService ─────────────────────────────────────────────────
vi.mock('../models/api/savedForLaterService', () => ({
    savedForLaterService: {
        saveForLater: vi.fn(),
    },
}));

// ── Mock valoracionesService ──────────────────────────────────────────────────
vi.mock('../models/api/valoracionesService', () => ({
    valoracionesService: {
        obtenerResenasRestaurante: vi.fn(),
        darMeGusta: vi.fn(),
    },
}));

import { authService } from '../models/api/authService';
import { historialService } from '../models/api/historialService';

// Mock de useNavigate para poder verificar redirecciones
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock useNotification
const mockShowNotification = vi.fn();
const mockShowConfirm = vi.fn();
vi.mock('../components/NotificationSystem', () => ({
    useNotification: () => ({
        showNotification: mockShowNotification,
        showConfirm: mockShowConfirm,
    }),
}));

const renderHomePage = () =>
    render(
        <MemoryRouter initialEntries={['/home']}>
            <HomePage />
        </MemoryRouter>
    );

describe('HomePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Por defecto, getMe devuelve un usuario básico
        (authService.getMe as any).mockResolvedValue({
            nombre: 'Usuario',
            username: 'usuario',
            ubicacion: 'Valencia',
        });
        // getPopulares devuelve lista vacía por defecto (evita llamadas a geolocalización)
        (historialService.getPopulares as any).mockResolvedValue([]);
    });

    it('debe renderizar la bienvenida y el buscador', async () => {
        renderHomePage();
        expect(screen.getByText(/¿Qué quieres comer hoy?/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Buscar restaurantes/i })).toBeInTheDocument();
    });

    it('debe llamar a authService.logout al cerrar sesión desde el menú', async () => {
        (authService.logout as any).mockResolvedValue(undefined);

        renderHomePage();

        // Abrir menú lateral
        const menuBtn = screen.getByLabelText(/Abrir menú/i);
        fireEvent.click(menuBtn);

        // El menú se renderiza vía Portal, así que debería ser visible en el document.body
        const logoutBtn = await screen.findByRole('button', { name: /Cerrar sesión/i });
        fireEvent.click(logoutBtn);

        await waitFor(() => {
            expect(authService.logout).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/login');
        });
    });

    it('debe navegar a la búsqueda al pulsar el botón principal', () => {
        renderHomePage();
        fireEvent.click(screen.getByRole('button', { name: /Buscar restaurantes/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/recommend-restaurants');
    });
});
