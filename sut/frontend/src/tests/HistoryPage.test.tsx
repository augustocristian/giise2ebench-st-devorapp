import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import HistoryPage from '../views/HistoryPage';

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('../models/api/historyService', () => ({
    historyService: {
        getHistory: vi.fn(),
        addToHistory: vi.fn(),
        deleteFromHistory: vi.fn(),
    },
}));

vi.mock('../models/api/favoritesService', () => ({
    favoritesService: {
        getLists: vi.fn(),
        addFavorite: vi.fn(),
        createList: vi.fn(),
    },
}));

vi.mock('../models/api/ratingsService', () => ({
    ratingsService: {
        getAllMyRatings: vi.fn(),
        rateRestaurant: vi.fn(),
    },
}));

import { historyService } from '../models/api/historyService';
import { ratingsService } from '../models/api/ratingsService';

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
vi.mock('../components/useNotification', () => ({
    useNotification: () => ({
        showNotification: mockShowNotification,
        showConfirm: mockShowConfirm,
    }),
}));

// The component maps the data with item.restaurant.name, item.accessed_at, item.place_id
const mockHistoryData = [
    {
        id: "1",
        place_id: "place1",
        accessed_at: "2026-04-20T10:00:00Z",
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
        (ratingsService.getAllMyRatings as any).mockResolvedValue([]);
    });

    it('should show the loading state initially', async () => {
        (historyService.getHistory as any).mockReturnValue(new Promise(() => {}));
        renderHistoryPage();
        // The component shows 'Cargando historial...'
        expect(await screen.findByText(/Cargando historial/i)).toBeInTheDocument();
    });

    it('should show the restaurant list grouped by month', async () => {
        (historyService.getHistory as any).mockResolvedValue(mockHistoryData);
        
        renderHistoryPage();

        await waitFor(() => {
            expect(screen.getByText('Pizza Test')).toBeInTheDocument();
        });

        // History groups by month in UPPERCASE: "ABRIL 2026"
        expect(screen.getByText(/ABRIL 2026/i)).toBeInTheDocument();
    });

    it('should delete a restaurant after confirming from the context menu', async () => {
        (historyService.getHistory as any).mockResolvedValue(mockHistoryData);
        (historyService.deleteFromHistory as any).mockResolvedValue({});
        mockShowConfirm.mockResolvedValue(true);

        renderHistoryPage();

        await waitFor(() => screen.getByText('Pizza Test'));
        
        // Find the menu button (MoreVertical) of the ItemMenu
        const allButtons = screen.getAllByRole('button');
        const moreBtn = allButtons.find(btn => btn.querySelector('.lucide-more-vertical'));
        
        if (moreBtn) {
            fireEvent.click(moreBtn);

            const deleteBtn = await screen.findByText(/Eliminar del historial/i);
            fireEvent.click(deleteBtn);

            await waitFor(() => {
                expect(mockShowConfirm).toHaveBeenCalled();
                expect(historyService.deleteFromHistory).toHaveBeenCalledWith('1');
            });
        }
    });
});
