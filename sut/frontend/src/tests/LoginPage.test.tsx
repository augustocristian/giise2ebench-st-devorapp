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

// Helper: render LoginPage dentro de un Router (necesario por useNavigate/Link)
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

    // ── 1. Renderizado básico ────────────────────────────────────────────────
    it('debe renderizar el formulario de login con todos sus elementos', () => {
        renderLoginPage();

        expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
        expect(screen.getByLabelText('Email o usuario')).toBeInTheDocument();
        expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
        expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Regístrate' })).toBeInTheDocument();
    });

    // ── 2. Validación: ambos campos vacíos ───────────────────────────────────
    it('debe mostrar error si se envía el formulario con todos los campos vacíos', async () => {
        renderLoginPage();

        fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

        await waitFor(() => {
            expect(screen.getByText('Rellene todos los campos')).toBeInTheDocument();
        });

        expect(authService.login).not.toHaveBeenCalled();
    });

    // ── 3. Validación: solo contraseña vacía ─────────────────────────────────
    it('debe mostrar error si falta la contraseña', async () => {
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
    it('debe llamar a authService.login y mostrar mensaje de bienvenida al enviar credenciales válidas', async () => {
        (authService.login as ReturnType<typeof vi.fn>).mockResolvedValue({
            user: { nombre: 'Ana' },
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
    it('debe mostrar el mensaje de error cuando el servicio rechaza las credenciales', async () => {
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

    // ── 6. El botón se deshabilita mientras carga ────────────────────────────
    it('debe deshabilitar el botón Entrar mientras se procesa el login', async () => {
        // Promesa que no resuelve nunca → simula carga prolongada
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

    // ── 7. Formulario de recuperación de contraseña ───────────────────────────
    it('debe mostrar el formulario de restablecimiento al hacer clic en "¿Olvidaste tu contraseña?"', () => {
        renderLoginPage();

        fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));

        // El componente real muestra 'Recuperar contraseña'
        expect(screen.getByText('Recuperar contraseña')).toBeInTheDocument();
        expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeInTheDocument();
        // El componente real muestra 'Volver al inicio de sesión'
        expect(screen.getByText('Volver al inicio de sesión')).toBeInTheDocument();
    });

    // ── 8. Volver al login desde recuperación ────────────────────────────────
    it('debe volver al formulario de login al hacer clic en "Volver al inicio de sesión"', () => {
        renderLoginPage();

        fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
        expect(screen.getByText('Recuperar contraseña')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Volver al inicio de sesión'));
        expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
    });

    // ── 9. El email se pre-rellena en el formulario de reset ─────────────────
    it('debe pre-rellenar el email en el formulario de reset si ya había uno escrito', () => {
        renderLoginPage();

        fireEvent.change(screen.getByLabelText('Email o usuario'), {
            target: { value: 'prefill@test.com' },
        });

        fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));

        expect(screen.getByLabelText('Correo electrónico')).toHaveValue('prefill@test.com');
    });
});
