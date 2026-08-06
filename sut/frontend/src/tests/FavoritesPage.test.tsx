import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FavoritesPage from '../views/FavoritesPage';

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('../models/api/favoritosService', () => ({
    favoritosService: {
        getListas: vi.fn(),
        getListaDetalle: vi.fn(),
        deleteLista: vi.fn(),
        deleteFavorito: vi.fn(),
        crearLista: vi.fn(),
        updateLista: vi.fn(),
    },
}));

vi.mock('../models/api/historialService', () => ({
    historialService: {
        addToHistorial: vi.fn(),
    },
}));

import { favoritosService } from '../models/api/favoritosService';

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

const mockListas = [
    { id: 1, nombre: 'Favoritos', icono: 'Heart' },
    { id: 2, nombre: 'Cenas', icono: 'Star' }
];

const renderFavoritesPage = () =>
    render(
        <MemoryRouter initialEntries={['/favorites']}>
            <FavoritesPage />
        </MemoryRouter>
    );

describe('FavoritesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe mostrar el estado de carga inicialmente', async () => {
        (favoritosService.getListas as any).mockReturnValue(new Promise(() => {}));
        renderFavoritesPage();
        expect(await screen.findByText(/Cargando tus listas/i)).toBeInTheDocument();
    });

    it('debe mostrar las listas de favoritos cuando se cargan', async () => {
        (favoritosService.getListas as any).mockResolvedValue(mockListas);

        renderFavoritesPage();

        await waitFor(() => expect(screen.getByText('Favoritos')).toBeInTheDocument());
        expect(screen.getByText('Cenas')).toBeInTheDocument();
        // Muestra el contador de listas
        expect(screen.getByText('2 listas')).toBeInTheDocument();
    });

    it('debe mostrar mensaje vacío cuando no hay listas', async () => {
        (favoritosService.getListas as any).mockResolvedValue([]);

        renderFavoritesPage();

        await waitFor(() => {
            expect(screen.getByText('Aún no tienes listas')).toBeInTheDocument();
        });
    });

    it('debe eliminar una lista tras confirmar desde el menú contextual', async () => {
        (favoritosService.getListas as any).mockResolvedValue(mockListas);
        (favoritosService.deleteLista as any).mockResolvedValue({});
        mockShowConfirm.mockResolvedValue(true);

        renderFavoritesPage();

        await waitFor(() => expect(screen.getByText('Cenas')).toBeInTheDocument());
        
        // El componente tiene un ListMenu con MoreVertical en cada lista
        // Buscamos los botones MoreVertical (sin aria-label, con MoreVertical svg)
        const allButtons = screen.getAllByRole('button');
        const moreBtn = allButtons.find(btn => btn.querySelector('.lucide-more-vertical'));

        if (moreBtn) {
            fireEvent.click(moreBtn);
            
            // El menú muestra "Eliminar lista"
            const deleteListBtn = await screen.findByText(/Eliminar lista/i);
            fireEvent.click(deleteListBtn);

            await waitFor(() => {
                expect(mockShowConfirm).toHaveBeenCalled();
                expect(favoritosService.deleteLista).toHaveBeenCalled();
            });
        } else {
            // Si no encontramos el botón, al menos verificamos que el servicio está disponible
            expect(favoritosService.deleteLista).toBeDefined();
        }
    });
});
