import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LoginPage from '../views/LoginPage';

// ── Mock authService ──────────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        login: vi.fn(),
        requestPasswordReset: vi.fn(),
    },
}));

vi.mock('@react-oauth/google', () => ({
    useGoogleLogin: vi.fn(),
}));

import { authService } from '../models/api/authService';

// Helper: render LoginPage inside a Router (required by useNavigate/Link)
const renderLoginPage = () =>
    render(
        <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
        </MemoryRouter>
    );

describe('LoginPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── 1. Basic rendering ────────────────────────────────────────────────
    it('should render the login form with all its elements', () => {
        renderLoginPage();

        expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
        expect(screen.getByLabelText('Email o usuario')).toBeInTheDocument();
        expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
        expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Regístrate' })).toBeInTheDocument();
    });

    // ── 2. Validation: both fields empty ───────────────────────────────────
    it('should show an error if the form is submitted with all fields empty', async () => {
        renderLoginPage();

        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        await waitFor(() => {
            expect(screen.getByText('Rellene todos los campos')).toBeInTheDocument();
        });

        expect(authService.login).not.toHaveBeenCalled();
    });

    // ── 3. Validation: only password empty ─────────────────────────────────
    it('should show an error if the password is missing', async () => {
        renderLoginPage();

        fireEvent.change(screen.getByLabelText('Email o usuario'), {
            target: { value: 'usuario@test.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        await waitFor(() => {
            expect(screen.getByText('Rellene todos los campos')).toBeInTheDocument();
        });

        expect(authService.login).not.toHaveBeenCalled();
    });

    // ── 4. Login exitoso ─────────────────────────────────────────────────────
    it('should call authService.login and show a welcome message when submitting valid credentials', async () => {
        (authService.login as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { first_name: 'Ana' },
        });

        renderLoginPage();

        fireEvent.change(screen.getByLabelText('Email o usuario'), {
            target: { value: 'ana@test.com' },
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: 'Segura123' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        await waitFor(() => {
            expect(authService.login).toHaveBeenCalledWith('ana@test.com', 'Segura123');
        });

        await waitFor(() => {
            expect(screen.getByText('¡Bienvenido de nuevo, Ana!')).toBeInTheDocument();
        });
    });

    // ── 5. Login fallido ─────────────────────────────────────────────────────
    it('should show the error message when the service rejects the credentials', async () => {
        (authService.login as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Credenciales incorrectas')
        );

        renderLoginPage();

        fireEvent.change(screen.getByLabelText('Email o usuario'), {
            target: { value: 'mal@test.com' },
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: 'wrongpass' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        await waitFor(() => {
            expect(screen.getByText('Credenciales incorrectas')).toBeInTheDocument();
        });
    });

    // ── 6. The button is disabled while loading ────────────────────────────
    it('should disable the Entrar button while login is processing', async () => {
        // Promise that never resolves → simulates a long load
        (authService.login as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

        renderLoginPage();

        fireEvent.change(screen.getByLabelText('Email o usuario'), {
            target: { value: 'ana@test.com' },
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { value: 'Segura123' },
        });

        const btn = screen.getByRole('button', { name: 'Entrar' });
        fireEvent.click(btn);

        await waitFor(() => {
            expect(btn).toBeDisabled();
        });
    });

    // ── 7. Password recovery form ───────────────────────────
    it('should show the reset form when clicking "¿Olvidaste tu contraseña?"', () => {
        renderLoginPage();

        fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));

        // The real component shows 'Recuperar contraseña'
        expect(screen.getByText('Recuperar contraseña')).toBeInTheDocument();
        expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeInTheDocument();
        // The real component shows 'Volver al inicio de sesión'
        expect(screen.getByText('Volver al inicio de sesión')).toBeInTheDocument();
    });

    // ── 8. Back to login from recovery ────────────────────────────────
    it('should return to the login form when clicking "Volver al inicio de sesión"', () => {
        renderLoginPage();

        fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
        expect(screen.getByText('Recuperar contraseña')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Volver al inicio de sesión'));
        expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
    });

    // ── 9. The email is pre-filled in the reset form ─────────────────
    it('should pre-fill the email in the reset form if one was already typed', () => {
        renderLoginPage();

        fireEvent.change(screen.getByLabelText('Email o usuario'), {
            target: { value: 'prefill@test.com' },
        });

        fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));

        expect(screen.getByLabelText('Correo electrónico')).toHaveValue('prefill@test.com');
    });
});
