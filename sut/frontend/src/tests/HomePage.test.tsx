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

// ── Mock historyService ─────────────────────────────────────────────────────
vi.mock('../models/api/historyService', () => ({
    historyService: {
        getPopular: vi.fn(),
        addToHistory: vi.fn(),
    },
}));

// ── Mock savedForLaterService ─────────────────────────────────────────────────
vi.mock('../models/api/savedForLaterService', () => ({
    savedForLaterService: {
        saveForLater: vi.fn(),
    },
}));

// ── Mock ratingsService ──────────────────────────────────────────────────
vi.mock('../models/api/ratingsService', () => ({
    ratingsService: {
        getRestaurantReviews: vi.fn(),
        likeReview: vi.fn(),
    },
}));

import { authService } from '../models/api/authService';
import { historyService } from '../models/api/historyService';

// Mock useNavigate so redirects can be verified
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
vi.mock('../components/useNotification', () => ({
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
        // By default, getMe returns a basic user
        (authService.getMe as any).mockResolvedValue({
            first_name: 'Usuario',
            username: 'usuario',
            location: 'Valencia',
        });
        // getPopular returns an empty list by default (avoids geolocation calls)
        (historyService.getPopular as any).mockResolvedValue([]);
    });

    it('should render the welcome message and the search box', async () => {
        renderHomePage();
        expect(screen.getByText(/¿Qué quieres comer hoy?/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Buscar restaurantes/i })).toBeInTheDocument();
    });

    it('should call authService.logout when logging out from the menu', async () => {
        (authService.logout as any).mockResolvedValue(undefined);

        renderHomePage();

        // Open the side menu
        const menuBtn = screen.getByLabelText(/Abrir menú/i);
        fireEvent.click(menuBtn);

        // The menu renders via Portal, so it should be visible in document.body
        const logoutBtn = await screen.findByRole('button', { name: /Cerrar sesión/i });
        fireEvent.click(logoutBtn);

        await waitFor(() => {
            expect(authService.logout).toHaveBeenCalled();
            expect(mockNavigate).toHaveBeenCalledWith('/login');
        });
    });

    it('should navigate to search when pressing the main button', () => {
        renderHomePage();
        fireEvent.click(screen.getByRole('button', { name: /Buscar restaurantes/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/recommend-restaurants');
    });
});
