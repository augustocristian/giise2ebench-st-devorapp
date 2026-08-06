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

vi.mock('../models/api/historialService', () => ({
    historialService: {
        addToHistorial: vi.fn(),
    },
}));

vi.mock('../models/api/savedForLaterService', () => ({
    savedForLaterService: {
        saveForLater: vi.fn(),
    },
}));

vi.mock('../models/api/valoracionesService', () => ({
    valoracionesService: {
        obtenerResenasRestaurante: vi.fn(),
        darMeGusta: vi.fn(),
    },
}));

// Mock useNotification
const mockShowNotification = vi.fn();
vi.mock('../components/NotificationSystem', () => ({
    useNotification: () => ({
        showNotification: mockShowNotification,
        showConfirm: vi.fn(),
    }),
}));

import { recommendationService } from '../models/api/recommendationService';
import { authService } from '../models/api/authService';
import { valoracionesService } from '../models/api/valoracionesService';

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
            ubicacion: 'Valencia'
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

    it('debe renderizar el título y el selector de ubicación', async () => {
        renderPage();
        // El h2 del componente es simplemente 'Recomendador'
        await waitFor(() => {
            expect(screen.getByText(/Recomendador/i)).toBeInTheDocument();
        });
        expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        // La label del radio personalizado es 'Escoger otra ubicación'
        expect(screen.getByText(/Escoger otra ubicación/i)).toBeInTheDocument();
    });

    it('debe cambiar entre modos de ubicación', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/Escoger otra ubicación/i)).toBeInTheDocument();
        });
        
        // La label contiene un input radio - buscamos por el texto del span padre
        const customRadioLabel = screen.getByText(/Escoger otra ubicación/i).closest('label');
        if (customRadioLabel) {
            const radio = customRadioLabel.querySelector('input[type="radio"]');
            if (radio) fireEvent.click(radio);
        }

        // El input de autocomplete debe ser visible (mockeado en setupTests)
        await waitFor(() => {
            expect(screen.getByTestId('mock-autocomplete')).toBeInTheDocument();
        });
    });

    it('debe llamar al servicio de recomendación al enviar el formulario', async () => {
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

        // Esperar a que se cargue la ubicación preferida
        await waitFor(() => {
            expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        });

        // El botón de submit tiene el texto 'Buscar recomendaciones'
        const searchBtn = screen.getByRole('button', { name: /Buscar recomendaciones/i });
        fireEvent.click(searchBtn);

        await waitFor(() => {
            expect(recommendationService.search).toHaveBeenCalled();
        });

        expect(await screen.findByText(/Pizza Place/i)).toBeInTheDocument();
        expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    });

    it('debe reenviar la búsqueda con sort_by: "distance" cuando se cambia el filtro a "Cercanía"', async () => {
        // Primera llamada devuelve resultados
        (recommendationService.search as any).mockResolvedValueOnce({
            results: [{ id: '1', name: 'Sushi Bar', rating: 4.5, user_ratings_total: 100, address: 'Calle 1' }],
            next_page_token: null
        });
        
        // Segunda llamada al cambiar el filtro
        (recommendationService.search as any).mockResolvedValueOnce({
            results: [{ id: '2', name: 'Taco Stand', rating: 4.8, user_ratings_total: 200, address: 'Calle 2' }],
            next_page_token: null
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByText(/Usar ubicación preferida/i)).toBeInTheDocument();
        });

        // Ejecutar primera búsqueda
        const searchBtn = screen.getByRole('button', { name: /Buscar recomendaciones/i });
        fireEvent.click(searchBtn);

        // Esperar resultados - el h2 'Sugerencias para ti' aparece con los resultados
        await waitFor(() => {
            expect(screen.getByText(/Sugerencias para ti/i)).toBeInTheDocument();
        });

        // Cambiar dropdown a distance
        const select = screen.getByRole('combobox', { name: /Ordenar resultados/i });
        fireEvent.change(select, { target: { value: 'distance' } });

        // Verificar que se llamó a search automáticamente con distance
        await waitFor(() => {
            expect(recommendationService.search).toHaveBeenCalledWith(expect.objectContaining({
                sort_by: 'distance',
                location: 'Valencia'
            }));
        });
    });

    it('debe expandir los detalles del restaurante al hacer click', async () => {
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

        // Click en la tarjeta para expandir
        fireEvent.click(screen.getByText(/Pizza Place/i));

        // Después de expandir, el componente muestra la vista de detalle
        await waitFor(() => {
            expect(screen.getByText(/SELECCIONAR ESTE RESTAURANTE/i)).toBeInTheDocument();
        });
    });

    it('debe cargar y mostrar las reseñas de la comunidad al expandir un restaurante', async () => {
        (recommendationService.search as any).mockResolvedValue({
            results: [{ id: '1', name: 'Pizza Place', rating: 4.5, user_ratings_total: 100, address: 'Calle 1' }],
            next_page_token: null
        });

        (valoracionesService.obtenerResenasRestaurante as any).mockResolvedValue([
            { id: 101, username: 'user1', calidad: 5, precio: 4, higiene: 5, trato: 5, comentario: 'Excelente!', me_gustas: 10, ha_dado_me_gusta: false }
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
            expect(valoracionesService.obtenerResenasRestaurante).toHaveBeenCalledWith('1');
        });

        // It should display community reviews header and the review itself
        await waitFor(() => {
            expect(screen.getByText(/Reseñas de la comunidad/i)).toBeInTheDocument();
        });
        expect(await screen.findByText(/user1/i)).toBeInTheDocument();
        // El comentario ahora se renderiza correctamente (sin el bug del literal)
        expect(await screen.findByText(/Excelente!/i)).toBeInTheDocument();
    });

    it('debe mostrar la paginación con el botón "Siguiente" si hay token de paginación', async () => {
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
            // El componente renderiza la nueva paginación con "Siguiente" activo
            expect(screen.getByRole('button', { name: /Siguiente/i })).toBeInTheDocument();
        });
    });
});
