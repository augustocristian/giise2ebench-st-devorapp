import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationProvider, useNotification } from '../components/NotificationSystem';

// Helper component to trigger notifications
const TestComponent = () => {
    const { showNotification, showConfirm } = useNotification();
    return (
        <div>
            <button onClick={() => showNotification('Test Toast', 'success')}>Show Toast</button>
            <button onClick={async () => {
                const result = await showConfirm('Are you sure?', 'Title', false);
                showNotification(result ? 'Confirmed' : 'Cancelled', 'info');
            }}>Show Confirm</button>
        </div>
    );
};

describe('NotificationSystem', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('debe mostrar y ocultar automáticamente un brindis (toast)', async () => {
        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        fireEvent.click(screen.getByText('Show Toast'));

        expect(screen.getByText('Test Toast')).toBeInTheDocument();

        // Esperar a que pase el tiempo (5000ms + animaciones)
        act(() => {
            vi.advanceTimersByTime(5500);
        });

        // El toast debe desaparecer (o estar en proceso de remoción)
        // En nuestro caso, removemos del estado tras el timeout
        expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    });

    it('debe manejar correctamente el modal de confirmación', async () => {
        vi.useRealTimers();
        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        fireEvent.click(screen.getByText('Show Confirm'));

        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();

        // Pulsar Confirmar
        fireEvent.click(screen.getByRole('button', { name: /confirmar/i, hidden: true }));

        expect(await screen.findByText('Confirmed')).toBeInTheDocument();
    });

    it('debe devolver false al pulsar cancelar en el modal', async () => {
        vi.useRealTimers();
        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        fireEvent.click(screen.getByText('Show Confirm'));

        // Pulsar Cancelar
        fireEvent.click(screen.getByRole('button', { name: /cancelar/i, hidden: true }));

        expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    });
});
