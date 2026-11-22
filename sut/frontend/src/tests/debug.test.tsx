import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import RatingsPage from '../views/RatingsPage';

vi.mock('../models/api/ratingsService', () => ({
    ratingsService: {
        getAllMyRatings: vi.fn(),
        rateRestaurant: vi.fn(),
        deleteRating: vi.fn(),
    },
}));
import { ratingsService } from '../models/api/ratingsService';

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

describe('Debug RatingsPage', () => {
    it('should show the DOM', async () => {
        (ratingsService.getAllMyRatings as any).mockResolvedValue(mockRatingsData);
        render(<MemoryRouter><RatingsPage /></MemoryRouter>);
        
        await waitFor(() => expect(screen.getByText('Restaurante Test')).toBeInTheDocument());
        
        fireEvent.click(screen.getByText('Restaurante Test'));
        
        // Wait for expansion animation/state
        await new Promise(r => setTimeout(r, 100));

        screen.debug();
    });
});
