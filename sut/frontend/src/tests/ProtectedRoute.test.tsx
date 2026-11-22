import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';

// ── Mock authService ──────────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        getMe: vi.fn(),
    },
}));

import { authService } from '../models/api/authService';

// Helper: renders ProtectedRoute inside a Router with login and protected routes
const renderProtectedRoute = () =>
    render(
        <MemoryRouter initialEntries={['/protected']}>
            <Routes>
                <Route path="/login" element={<div>Login Page</div>} />
                <Route
                    path="/protected"
                    element={
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </MemoryRouter>
    );

describe('ProtectedRoute', () => {
    beforeEach(() => vi.clearAllMocks());

    // ── 1. Loading state ───────────────────────────────────────────────────

    it('shows "Comprobando sesión..." while authentication is being verified', () => {
        // The promise never resolves → simulates an indefinite load
        (authService.getMe as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
        renderProtectedRoute();
        expect(screen.getByText('Comprobando sesión...')).toBeInTheDocument();
    });

    // ── 2. Autenticado ────────────────────────────────────────────────────────

    it('renders the child content when the user is authenticated', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, first_name: 'Test' });
        renderProtectedRoute();
        await waitFor(() => {
            expect(screen.getByText('Protected Content')).toBeInTheDocument();
        });
    });

    it('does not show the loading message once authenticated', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
        renderProtectedRoute();
        await waitFor(() => {
            expect(screen.queryByText('Comprobando sesión...')).not.toBeInTheDocument();
        });
    });

    // ── 3. No autenticado ─────────────────────────────────────────────────────

    it('redirects to /login when getMe() throws an error', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Unauthorized'));
        renderProtectedRoute();
        await waitFor(() => {
            expect(screen.getByText('Login Page')).toBeInTheDocument();
        });
    });

    it('does not show the protected content when not authenticated', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Unauthorized'));
        renderProtectedRoute();
        await waitFor(() => {
            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
        });
    });

    // ── 4. Llama a getMe ──────────────────────────────────────────────────────

    it('calls authService.getMe exactly once on mount', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
        renderProtectedRoute();
        await waitFor(() => expect(authService.getMe).toHaveBeenCalledTimes(1));
    });
});
