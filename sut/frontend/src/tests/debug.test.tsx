import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import ValoracionesPage from '../views/ValoracionesPage';

vi.mock('../models/api/valoracionesService', () => ({
    valoracionesService: {
        obtenerTodasMisValoraciones: vi.fn(),
        valorarRestaurante: vi.fn(),
        eliminarValoracion: vi.fn(),
    },
}));
import { valoracionesService } from '../models/api/valoracionesService';

const mockShowNotification = vi.fn();
const mockShowConfirm = vi.fn();
vi.mock('../components/NotificationSystem', () => ({
    useNotification: () => ({
        showNotification: mockShowNotification,
        showConfirm: mockShowConfirm,
    }),
}));

const mockValoracionesData = [{
    id: 1,
    place_id: 'place1',
    calidad: 5, precio: 4, higiene: 3, trato: 5,
    comentario: 'Muy buena experiencia',
    restaurant: { name: 'Restaurante Test', address: 'Calle Falsa 123', types: ['restaurant'], main_photo: null },
    fecha: '2026-04-20T10:00:00Z'
}];

describe('Debug ValoracionesPage', () => {
    it('debe mostrar el DOM', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as any).mockResolvedValue(mockValoracionesData);
        render(<MemoryRouter><ValoracionesPage /></MemoryRouter>);
        
        await waitFor(() => expect(screen.getByText('Restaurante Test')).toBeInTheDocument());
        
        fireEvent.click(screen.getByText('Restaurante Test'));
        
        // Wait for expansion animation/state
        await new Promise(r => setTimeout(r, 100));

        screen.debug();
    });
});
