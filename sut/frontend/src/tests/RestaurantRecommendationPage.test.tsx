import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RestaurantRecommendationPage from '../views/RestaurantRecommendationPage';

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('../models/api/recommendationService', () => ({
    recommendationService: {
        search: vi.fn(),
    },
}));

vi.mock('../models/api/authService', () => ({
    authService: {
        getMe: vi.fn(),
    },
}));

vi.mock('../models/api/historyService', () => ({
    historyService: {
        addToHistory: vi.fn(),
    },
}));

vi.mock('../models/api/savedForLaterService', () => ({
    savedForLaterService: {
        saveForLater: vi.fn(),
    },
}));

vi.mock('../models/api/ratingsService', () => ({
    ratingsService: {
        getRestaurantReviews: vi.fn(),
        likeReview: vi.fn(),
    },
}));

// Mock useNotification
const mockShowNotification = vi.fn();
vi.mock('../components/useNotification', () => ({
    useNotification: () => ({
        showNotification: mockShowNotification,
        showConfirm: vi.fn(),
    }),
}));

import { recommendationService } from '../models/api/recommendationService';
import { authService } from '../models/api/authService';
import { ratingsService } from '../models/api/ratingsService';

const renderPage = () =>
    render(
        <MemoryRouter>
            <RestaurantRecommendationPage />
        </MemoryRouter>
    );

describe('RestaurantRecommendationPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock default for authService.getMe
        (authService.getMe as any).mockResolvedValue({
            location: 'Valencia'
        });

        // Mock global fetch for Google Maps Geocoding API
        (globalThis as any).fetch = vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({
                results: [
                    {
                        address_components: [
                            { short_name: 'ES', types: ['country'] }
                        ]
                    }
                ]
            })
        });
    });

    it('should render the title and the location selector', async () => {
        renderPage();
        // The component's h2 is simply 'Recomendador'
        await waitFor(() => {
            expect(screen.getByText(/Recomendador/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        // The custom radio label is 'Escoger otra ubicación'
        expect(screen.getByText(/Escoger otra ubicación/i)).toBeInTheDocument();
    });

    it('should switch between location modes', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/Escoger otra ubicación/i)).toBeInTheDocument();
        });
        
        // The label contains a radio input - look it up by the parent span text
        const customRadioLabel = screen.getByText(/Escoger otra ubicación/i).closest('label');
        if (customRadioLabel) {
            const radio = customRadioLabel.querySelector('input[type="radio"]');
            if (radio) fireEvent.click(radio);
        }

        // The autocomplete input must be visible (mocked in setupTests)
        await waitFor(() => {
            expect(screen.getByTestId('mock-autocomplete')).toBeInTheDocument();
        });
    });

    it('should call the recommendation service when submitting the form', async () => {
        (recommendationService.search as any).mockResolvedValue({
            results: [
                {
                    id: '1',
                    name: 'Pizza Place',
                    rating: 4.5,
                    user_ratings_total: 100,
                    address: 'Calle Falsa 123',
                    main_photo: '',
                }
            ],
            next_page_token: null
        });

        renderPage();

        // Wait for the preferred location to load
        await waitFor(() => {
            expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        });

        // The submit button has the text 'Buscar recomendaciones'
        const searchBtn = screen.getByRole('button', { name: /Buscar recomendaciones/i });
        fireEvent.click(searchBtn);

        await waitFor(() => {
            expect(recommendationService.search).toHaveBeenCalled();
        });

        expect(await screen.findByText(/Pizza Place/i)).toBeInTheDocument();
        expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    });

    it('should resend the search with sort_by: "distance" when the filter changes to "Cercanía"', async () => {
        // First call returns results
        (recommendationService.search as any).mockResolvedValueOnce({
            results: [{ id: '1', name: 'Sushi Bar', rating: 4.5, user_ratings_total: 100, address: 'Calle 1' }],
            next_page_token: null
        });
        
        // Second call when the filter changes
        (recommendationService.search as any).mockResolvedValueOnce({
            results: [{ id: '2', name: 'Taco Stand', rating: 4.8, user_ratings_total: 200, address: 'Calle 2' }],
            next_page_token: null
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        });

        // Run first search
        const searchBtn = screen.getByRole('button', { name: /Buscar recomendaciones/i });
        fireEvent.click(searchBtn);

        // Wait for results - the h2 'Sugerencias para ti' appears with the results
        await waitFor(() => {
            expect(screen.getByText(/Sugerencias para ti/i)).toBeInTheDocument();
        });

        // Change dropdown to distance
        const select = screen.getByRole('combobox', { name: /Ordenar resultados/i });
        fireEvent.change(select, { target: { value: 'distance' } });

        // Verify search was called automatically with distance
        await waitFor(() => {
            expect(recommendationService.search).toHaveBeenCalledWith(expect.objectContaining({
                sort_by: 'distance',
                location: 'Valencia'
            }));
        });
    });

    it('should expand the restaurant details on click', async () => {
        (recommendationService.search as any).mockResolvedValue({
            results: [
                {
                    id: '1',
                    name: 'Pizza Place',
                    summary: 'La mejor pizza de la ciudad',
                    opening_hours: ['Lunes: 9:00-21:00'],
                    google_maps_uri: 'http://maps.google.com',
                    address: 'Calle Falsa 123',
                    rating: 4.5,
                }
            ],
            next_page_token: null
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Buscar recomendaciones/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Buscar recomendaciones/i }));

        await waitFor(() => {
            expect(screen.getByText(/Pizza Place/i)).toBeInTheDocument();
        });

        // Click the card to expand
        fireEvent.click(screen.getByText(/Pizza Place/i));

        // After expanding, the component shows the detail view
        await waitFor(() => {
            expect(screen.getByText(/SELECCIONAR ESTE RESTAURANTE/i)).toBeInTheDocument();
        });
    });

    it('should load and show community reviews when expanding a restaurant', async () => {
        (recommendationService.search as any).mockResolvedValue({
            results: [{ id: '1', name: 'Pizza Place', rating: 4.5, user_ratings_total: 100, address: 'Calle 1' }],
            next_page_token: null
        });

        (ratingsService.getRestaurantReviews as any).mockResolvedValue([
            { id: 101, username: 'user1', quality: 5, price: 4, hygiene: 5, service: 5, comment: 'Excelente!', likes: 10, liked_by_me: false }
        ]);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Buscar recomendaciones/i }));

        await waitFor(() => {
            expect(screen.getByText(/Pizza Place/i)).toBeInTheDocument();
        });

        // Click to expand
        fireEvent.click(screen.getByText(/Pizza Place/i));

        // It should load reviews
        await waitFor(() => {
            expect(ratingsService.getRestaurantReviews).toHaveBeenCalledWith('1');
        });

        // It should display community reviews header and the review itself
        await waitFor(() => {
            expect(screen.getByText(/Reseñas de la comunidad/i)).toBeInTheDocument();
        });
        expect(await screen.findByText(/user1/i)).toBeInTheDocument();
        // The comment now renders correctly (without the literal bug)
        expect(await screen.findByText(/Excelente!/i)).toBeInTheDocument();
    });

    it('should show pagination with the "Siguiente" button if there is a pagination token', async () => {
        (recommendationService.search as any).mockResolvedValueOnce({
            results: [{ id: '1', name: 'Rest 1', rating: 4.0, user_ratings_total: 50, address: 'Calle 1' }],
            next_page_token: 'token_valido'
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Buscar recomendaciones/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Buscar recomendaciones/i }));

        await waitFor(() => {
            // The component renders the new pagination with "Siguiente" enabled
            expect(screen.getByRole('button', { name: /Siguiente/i })).toBeInTheDocument();
        });
    });
});
