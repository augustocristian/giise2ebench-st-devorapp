import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RatingsPage from '../views/RatingsPage';

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('../models/api/ratingsService', () => ({
    ratingsService: {
        getAllMyRatings: vi.fn(),
        getRestaurantReviews: vi.fn(),
        rateRestaurant: vi.fn(),
        deleteRating: vi.fn(),
    },
}));

import { ratingsService } from '../models/api/ratingsService';

// Mock useNavigate
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

const mockRatingsData = [{
    id: 1,
    place_id: 'place1',
    quality: 5, price: 4, hygiene: 3, service: 5,
    comment: 'Muy buena experiencia',
    restaurant: { name: 'Restaurante Test', address: 'Calle Falsa 123', types: ['restaurant'], main_photo: null },
    created_at: '2026-04-20T10:00:00Z'
}];

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/my-ratings']}>
            <RatingsPage />
        </MemoryRouter>
    );

describe('RatingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should show the loading state initially', async () => {
        // Mock with a non-resolved promise
        (ratingsService.getAllMyRatings as any).mockReturnValue(new Promise(() => {}));

        renderPage();

        // The component shows 'Cargando valoraciones...' (without "tus")
        expect(await screen.findByText(/Cargando valoraciones/i)).toBeInTheDocument();
    });

    it('should show a message when there are no ratings', async () => {
        (ratingsService.getAllMyRatings as any).mockResolvedValue([]);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Aún no has valorado ningún restaurante.')).toBeInTheDocument();
        });
    });

    it('should show the ratings list and expand the first one by default', async () => {
        (ratingsService.getAllMyRatings as any).mockResolvedValue(mockRatingsData);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Restaurante Test')).toBeInTheDocument();
        });

        // The first one expands on its own - shows the rating categories
        await waitFor(() => {
            expect(screen.getByText('Calidad')).toBeInTheDocument();
        });

        // The comment now renders correctly
        await waitFor(() => {
            expect(screen.getByText(/Muy buena experiencia/i)).toBeInTheDocument();
        });

        expect(screen.getByText('Precio')).toBeInTheDocument();
        expect(screen.getByText('Higiene')).toBeInTheDocument();
        expect(screen.getByText('Trato')).toBeInTheDocument();
    });

    it('should open the edit modal when pressing Editar reseña', async () => {
        (ratingsService.getAllMyRatings as any).mockResolvedValue(mockRatingsData);

        renderPage();

        await waitFor(() => screen.getByText('Restaurante Test'));
        
        const editBtn = await screen.findByText(/Editar reseña/i);
        fireEvent.click(editBtn);

        await waitFor(() => {
            // The modal shows the restaurant name (it will be in the list and in the modal)
            expect(screen.getAllByText('Restaurante Test').length).toBeGreaterThanOrEqual(1);
            // And it has the submit rating button
            expect(screen.getByRole('button', { name: /Enviar valoración/i })).toBeInTheDocument();
        });
    });

    it('should delete a rating after confirming', async () => {
        (ratingsService.getAllMyRatings as any).mockResolvedValue(mockRatingsData);
        (ratingsService.deleteRating as any).mockResolvedValue({});
        mockShowConfirm.mockResolvedValue(true);

        renderPage();

        await waitFor(() => screen.getByText('Restaurante Test'));
        
        const deleteBtn = await screen.findByText(/Eliminar reseña/i);
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(mockShowConfirm).toHaveBeenCalled();
            expect(ratingsService.deleteRating).toHaveBeenCalledWith('place1');
            expect(mockShowNotification).toHaveBeenCalledWith(
                expect.stringContaining('La reseña ha sido eliminada'),
                'success'
            );
        });
    });
});
