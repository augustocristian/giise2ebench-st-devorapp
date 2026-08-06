import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ValoracionesPage from '../views/ValoracionesPage';

// ── Mock services ─────────────────────────────────────────────────────────────
vi.mock('../models/api/valoracionesService', () => ({
    valoracionesService: {
        obtenerTodasMisValoraciones: vi.fn(),
        obtenerResenasRestaurante: vi.fn(),
        valorarRestaurante: vi.fn(),
        eliminarValoracion: vi.fn(),
    },
}));

import { valoracionesService } from '../models/api/valoracionesService';

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

const mockValoracionesData = [{
    id: 1,
    place_id: 'place1',
    calidad: 5, precio: 4, higiene: 3, trato: 5,
    comentario: 'Muy buena experiencia',
    restaurant: { name: 'Restaurante Test', address: 'Calle Falsa 123', types: ['restaurant'], main_photo: null },
    fecha: '2026-04-20T10:00:00Z'
}];

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={['/mis-valoraciones']}>
            <ValoracionesPage />
        </MemoryRouter>
    );

describe('ValoracionesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('debe mostrar el estado de carga inicialmente', async () => {
        // Mock with a non-resolved promise
        (valoracionesService.obtenerTodasMisValoraciones as any).mockReturnValue(new Promise(() => {}));

        renderPage();

        // El componente muestra 'Cargando valoraciones...' (sin "tus")
        expect(await screen.findByText(/Cargando valoraciones/i)).toBeInTheDocument();
    });

    it('debe mostrar mensaje cuando no hay valoraciones', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as any).mockResolvedValue([]);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Aún no has valorado ningún restaurante.')).toBeInTheDocument();
        });
    });

    it('debe mostrar la lista de valoraciones y expandir la primera por defecto', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as any).mockResolvedValue(mockValoracionesData);

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Restaurante Test')).toBeInTheDocument();
        });

        // La primera se expande sola - muestra las categorías de calificación
        await waitFor(() => {
            expect(screen.getByText('Calidad')).toBeInTheDocument();
        });

        // El comentario ahora se renderiza correctamente
        await waitFor(() => {
            expect(screen.getByText(/Muy buena experiencia/i)).toBeInTheDocument();
        });

        expect(screen.getByText('Precio')).toBeInTheDocument();
        expect(screen.getByText('Higiene')).toBeInTheDocument();
        expect(screen.getByText('Trato')).toBeInTheDocument();
    });

    it('debe abrir el modal de edición al pulsar Editar reseña', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as any).mockResolvedValue(mockValoracionesData);

        renderPage();

        await waitFor(() => screen.getByText('Restaurante Test'));
        
        const editBtn = await screen.findByText(/Editar reseña/i);
        fireEvent.click(editBtn);

        await waitFor(() => {
            // El modal muestra el nombre del restaurante (estará en la lista y en el modal)
            expect(screen.getAllByText('Restaurante Test').length).toBeGreaterThanOrEqual(1);
            // Y tiene el botón de enviar valoración
            expect(screen.getByRole('button', { name: /Enviar valoración/i })).toBeInTheDocument();
        });
    });

    it('debe eliminar una valoración tras confirmar', async () => {
        (valoracionesService.obtenerTodasMisValoraciones as any).mockResolvedValue(mockValoracionesData);
        (valoracionesService.eliminarValoracion as any).mockResolvedValue({});
        mockShowConfirm.mockResolvedValue(true);

        renderPage();

        await waitFor(() => screen.getByText('Restaurante Test'));
        
        const deleteBtn = await screen.findByText(/Eliminar reseña/i);
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(mockShowConfirm).toHaveBeenCalled();
            expect(valoracionesService.eliminarValoracion).toHaveBeenCalledWith('place1');
            expect(mockShowNotification).toHaveBeenCalledWith(
                expect.stringContaining('La reseña ha sido eliminada'),
                'success'
            );
        });
    });
});
