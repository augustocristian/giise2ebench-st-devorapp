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

// Helper: renderiza ProtectedRoute dentro de un Router con rutas de login y protegida
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

    // ── 1. Estado de carga ───────────────────────────────────────────────────

    it('muestra "Comprobando sesión..." mientras se verifica la autenticación', () => {
        // La promesa nunca resuelve → simula carga indefinida
        (authService.getMe as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
        renderProtectedRoute();
        expect(screen.getByText('Comprobando sesión...')).toBeInTheDocument();
    });

    // ── 2. Autenticado ────────────────────────────────────────────────────────

    it('renderiza el contenido hijo cuando el usuario está autenticado', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, nombre: 'Test' });
        renderProtectedRoute();
        await waitFor(() => {
            expect(screen.getByText('Protected Content')).toBeInTheDocument();
        });
    });

    it('no muestra el mensaje de carga una vez autenticado', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
        renderProtectedRoute();
        await waitFor(() => {
            expect(screen.queryByText('Comprobando sesión...')).not.toBeInTheDocument();
        });
    });

    // ── 3. No autenticado ─────────────────────────────────────────────────────

    it('redirige a /login cuando getMe() lanza un error', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Unauthorized'));
        renderProtectedRoute();
        await waitFor(() => {
            expect(screen.getByText('Login Page')).toBeInTheDocument();
        });
    });

    it('no muestra el contenido protegido cuando no está autenticado', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Unauthorized'));
        renderProtectedRoute();
        await waitFor(() => {
            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
        });
    });

    // ── 4. Llama a getMe ──────────────────────────────────────────────────────

    it('llama a authService.getMe exactamente una vez al montar', async () => {
        (authService.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
        renderProtectedRoute();
        await waitFor(() => expect(authService.getMe).toHaveBeenCalledTimes(1));
    });
});
