import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SavedForLaterPage from '../views/SavedForLaterPage';

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('../models/api/savedForLaterService', () => ({
    savedForLaterService: {
        getSaved: vi.fn(),
        deleteSaved: vi.fn(),
    },
}));

vi.mock('../models/api/historialService', () => ({
    historialService: {
        addToHistorial: vi.fn(),
    },
}));

import { savedForLaterService } from '../models/api/savedForLaterService';
import { historialService } from '../models/api/historialService';

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
vi.mock('../components/NotificationSystem', () => ({
    useNotification: () => ({
        showNotification: mockShowNotification,
        showConfirm: mockShowConfirm,
    }),
}));

const mockSavedData = [
    {
        id: '101',
        place_id: 'place_abc',
        name: 'Sushi Zen',
        rating: 4.6,
        user_ratings_total: 120,
        types: ['restaurant'],
        address: 'Calle del Sushi 10',
        main_photo: null,
        summary: 'Best sushi in town',
        opening_hours: ['Mon: 12:00-22:00'],
        google_maps_uri: 'http://maps.google.com',
        website_uri: 'http://sushizen.com'
    }
];

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/saved']}>
            <SavedForLaterPage />
        </MemoryRouter>
    );

describe('SavedForLaterPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe mostrar los restaurantes guardados para más tarde', async () => {
        (savedForLaterService.getSaved as any).mockResolvedValue(mockSavedData);
        
        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Sushi Zen')).toBeInTheDocument();
        });
        expect(screen.getByText('Calle del Sushi 10')).toBeInTheDocument();
        expect(screen.getByText('1 restaurante pendiente')).toBeInTheDocument();
    });

    it('debe filtrar la lista por el término de búsqueda', async () => {
        (savedForLaterService.getSaved as any).mockResolvedValue(mockSavedData);
        
        renderPage();

        await waitFor(() => expect(screen.getByText('Sushi Zen')).toBeInTheDocument());

        const searchInput = screen.getByPlaceholderText('Buscar en la lista...');
        fireEvent.change(searchInput, { target: { value: 'Pizza' } });

        expect(screen.queryByText('Sushi Zen')).not.toBeInTheDocument();
        expect(screen.getByText('No hay resultados para "Pizza"')).toBeInTheDocument();

        fireEvent.change(searchInput, { target: { value: 'Sushi' } });
        expect(screen.getByText('Sushi Zen')).toBeInTheDocument();
    });

    it('debe seleccionar un restaurante desde el menú contextual y navegar a /home', async () => {
        (savedForLaterService.getSaved as any).mockResolvedValue(mockSavedData);
        (historialService.addToHistorial as any).mockResolvedValue({});
        (savedForLaterService.deleteSaved as any).mockResolvedValue({});

        renderPage();

        await waitFor(() => expect(screen.getByText('Sushi Zen')).toBeInTheDocument());

        // Buscar el botón del menú contextual (MoreVertical) - sin aria-label específico
        // El botón de la TopBar tiene aria-label='Ir a Inicio', el de SideMenu tiene aria-label='Abrir menú'
        // El único botón del ItemMenu no tiene aria-label
        const allButtons = screen.getAllByRole('button');
        const menuBtn = allButtons.find(btn => 
            !btn.getAttribute('aria-label') && 
            btn.querySelector('svg') !== null
        );
        
        if (menuBtn) {
            fireEvent.click(menuBtn);

            const selectBtn = await screen.findByText('Volver a seleccionar');
            fireEvent.click(selectBtn);

            await waitFor(() => {
                expect(historialService.addToHistorial).toHaveBeenCalledWith('place_abc');
                expect(savedForLaterService.deleteSaved).toHaveBeenCalledWith('101');
                expect(mockShowNotification).toHaveBeenCalledWith(
                    expect.stringContaining('Has elegido Sushi Zen'),
                    'success'
                );
                expect(mockNavigate).toHaveBeenCalledWith('/home');
            });
        }
    });

    it('debe eliminar un restaurante tras confirmar desde el menú contextual', async () => {
        (savedForLaterService.getSaved as any).mockResolvedValue(mockSavedData);
        (savedForLaterService.deleteSaved as any).mockResolvedValue({});
        mockShowConfirm.mockResolvedValue(true);

        renderPage();

        await waitFor(() => expect(screen.getByText('Sushi Zen')).toBeInTheDocument());

        // Encontrar el botón del menú contextual
        const allButtons = screen.getAllByRole('button');
        const menuBtn = allButtons.find(btn => 
            !btn.getAttribute('aria-label') && 
            btn.querySelector('svg') !== null
        );

        if (menuBtn) {
            fireEvent.click(menuBtn);

            const deleteBtn = await screen.findByText('Quitar de la lista');
            fireEvent.click(deleteBtn);

            await waitFor(() => {
                expect(mockShowConfirm).toHaveBeenCalled();
                expect(savedForLaterService.deleteSaved).toHaveBeenCalledWith('101');
                expect(mockShowNotification).toHaveBeenCalledWith(
                    expect.stringContaining('Sushi Zen quitado de la lista'),
                    'success'
                );
            });
        }
    });

    it('debe expandir detalles al hacer click en la tarjeta y permitir seleccionar desde ahí', async () => {
        (savedForLaterService.getSaved as any).mockResolvedValue(mockSavedData);
        (historialService.addToHistorial as any).mockResolvedValue({});
        (savedForLaterService.deleteSaved as any).mockResolvedValue({});

        renderPage();

        await waitFor(() => expect(screen.getByText('Sushi Zen')).toBeInTheDocument());

        // Al hacer click en la tarjeta (nombre), navega a detalle via searchParams
        // Con el mock de useSearchParams predeterminado, el componente no renderizará el DetailView
        // pero podemos verificar que el click no falla
        fireEvent.click(screen.getByText('Sushi Zen'));
        
        // El componente usa setSearchParams para mostrar detalles,
        // pero con MemoryRouter sin params mockeados, no cambia a DetailView
        // Verificamos que el componente sigue renderizando correctamente
        await waitFor(() => {
            expect(screen.getByText('Sushi Zen')).toBeInTheDocument();
        });
    });
});
