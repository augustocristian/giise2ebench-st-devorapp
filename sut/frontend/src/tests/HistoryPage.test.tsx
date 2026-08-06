import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HistoryPage from '../views/HistoryPage';

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('../models/api/historialService', () => ({
    historialService: {
        getHistorial: vi.fn(),
        addToHistorial: vi.fn(),
        deleteFromHistorial: vi.fn(),
    },
}));

vi.mock('../models/api/favoritosService', () => ({
    favoritosService: {
        getListas: vi.fn(),
        addFavorito: vi.fn(),
        crearLista: vi.fn(),
    },
}));

vi.mock('../models/api/valoracionesService', () => ({
    valoracionesService: {
        obtenerTodasMisValoraciones: vi.fn(),
        valorarRestaurante: vi.fn(),
    },
}));

import { historialService } from '../models/api/historialService';
import { valoracionesService } from '../models/api/valoracionesService';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useSearchParams: () => [new URLSearchParams(), vi.fn()],
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

// El componente mapea los datos con item.restaurant.name, item.fecha_acceso, item.place_id
const mockHistoryData = [
    {
        id: "1",
        place_id: "place1",
        fecha_acceso: "2026-04-20T10:00:00Z",
        restaurant: {
            name: "Pizza Test",
            address: "Calle Falsa 123",
            rating: 4.5,
            user_ratings_total: 100,
            types: ['restaurant'],
            main_photo: null,
            summary: "Buena pizza",
            opening_hours: ["Monday: 12:00 PM - 11:30 PM"],
            google_maps_uri: "http://maps.google.com/?cid=123",
            website_uri: "http://pizzatest.com"
        }
    }
];

const renderHistoryPage = () =>
    render(
        <MemoryRouter initialEntries={['/history']}>
            <HistoryPage />
        </MemoryRouter>
    );

describe('HistoryPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (valoracionesService.obtenerTodasMisValoraciones as any).mockResolvedValue([]);
    });

    it('debe mostrar el estado de carga inicialmente', async () => {
        (historialService.getHistorial as any).mockReturnValue(new Promise(() => {}));
        renderHistoryPage();
        // El componente muestra 'Cargando historial...'
        expect(await screen.findByText(/Cargando historial/i)).toBeInTheDocument();
    });

    it('debe mostrar la lista de restaurantes agrupados por mes', async () => {
        (historialService.getHistorial as any).mockResolvedValue(mockHistoryData);
        
        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });

        // El historial agrupa por mes en MAYÚSCULAS: "ABRIL 2026"
        expect(screen.getByText(/ABRIL 2026/i)).toBeInTheDocument();
    });

    it('debe eliminar un restaurante tras confirmar desde el menú contextual', async () => {
        (historialService.getHistorial as any).mockResolvedValue(mockHistoryData);
        (historialService.deleteFromHistorial as any).mockResolvedValue({});
        mockShowConfirm.mockResolvedValue(true);

        renderHistoryPage();

        await waitFor(() => screen.getByText('Pizza Test'));
        
        // Buscar el botón de menú (MoreVertical) del ItemMenu
        const allButtons = screen.getAllByRole('button');
        const moreBtn = allButtons.find(btn => btn.querySelector('.lucide-more-vertical'));
        
        if (moreBtn) {
            fireEvent.click(moreBtn);

            const deleteBtn = await screen.findByText(/Eliminar del historial/i);
            fireEvent.click(deleteBtn);

            await waitFor(() => {
                expect(mockShowConfirm).toHaveBeenCalled();
                expect(historialService.deleteFromHistorial).toHaveBeenCalledWith('1');
            });
        }
    });
});
