import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationProvider } from '../components/NotificationSystem';
import { useNotification } from '../components/useNotification';

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

    it('should automatically show and hide a toast', async () => {
        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        fireEvent.click(screen.getByText('Show Toast'));

        expect(screen.getByText('Test Toast')).toBeInTheDocument();

        // Wait for time to pass (5000ms + animations)
        act(() => {
            vi.advanceTimersByTime(5500);
        });

        // The toast must disappear (or be in the process of being removed)
        // In our case, it is removed from state after the timeout
        expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    });

    it('should handle the confirmation modal correctly', async () => {
        vi.useRealTimers();
        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        fireEvent.click(screen.getByText('Show Confirm'));

        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(screen.getByText('Title')).toBeInTheDocument();

        // Press Confirmar
        fireEvent.click(screen.getByRole('button', { name: /confirmar/i, hidden: true }));

        expect(await screen.findByText('Confirmed')).toBeInTheDocument();
    });

    it('should return false when pressing cancel in the modal', async () => {
        vi.useRealTimers();
        render(
            <NotificationProvider>
                <TestComponent />
            </NotificationProvider>
        );

        fireEvent.click(screen.getByText('Show Confirm'));

        // Press Cancelar
        fireEvent.click(screen.getByRole('button', { name: /cancelar/i, hidden: true }));

        expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    });
});
