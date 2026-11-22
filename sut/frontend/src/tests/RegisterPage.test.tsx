import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RegisterPage from '../views/RegisterPage';

// ── Mock authService ──────────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        register: vi.fn(),
        checkEmailVerification: vi.fn(),
        checkAvailability: vi.fn(),
    },
}));

import { authService } from '../models/api/authService';


// Helper: fills in the step 1 fields of the registration
const fillStep1 = () => {
    fireEvent.change(screen.getByLabelText('Email'), {
        target: { name: 'email', value: 'nuevo@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), {
        target: { name: 'username', value: 'nuevousuario' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
        target: { name: 'password', value: 'Segura123' },
    });
    fireEvent.change(screen.getByLabelText('Nombre'), {
        target: { name: 'first_name', value: 'Nuevo' },
    });
    fireEvent.change(screen.getByLabelText('Apellidos'), {
        target: { name: 'last_name', value: 'Usuario' },
    });
};

const renderRegisterPage = () =>
    render(
        <MemoryRouter initialEntries={['/register']}>
            <RegisterPage />
        </MemoryRouter>
    );

describe('RegisterPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // By default, the availability check does not block
        (authService.checkAvailability as any).mockResolvedValue({
            email_taken: false,
            username_taken: false,
        });
    });

    // ── 1. Basic rendering (Step 1) ────────────────────────────────────────
    it('should render all registration form fields (step 1)', () => {
        renderRegisterPage();

        expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument();
        expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
        expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
        expect(screen.getByLabelText('Apellidos')).toBeInTheDocument();
        // In step 1, the main button is "Continuar"
        expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Inicia sesión' })).toBeInTheDocument();
    });

    // ── 2. Validation: empty fields in step 1 ────────────────────────────────
    it('should show an error if the form is submitted with empty required fields', async () => {
        renderRegisterPage();

        // The "Continuar" button triggers validation in step 1
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        await waitFor(() => {
            // The step 1 error message (stepError)
            expect(
                screen.getByText(/El email es obligatorio|Rellene todos los campos obligatorios/i)
            ).toBeInTheDocument();
        });

        expect(authService.register).not.toHaveBeenCalled();
    });

    // ── 3. Validation: missing last name ────────────────────────────────────────
    it('should show an error if a field such as last name is missing', async () => {
        renderRegisterPage();

        fireEvent.change(screen.getByLabelText('Email'), {
            target: { name: 'email', value: 'nuevo@test.com' },
        });
        fireEvent.change(screen.getByLabelText('Nombre de usuario'), {
            target: { name: 'username', value: 'nuevousuario' },
        });
        fireEvent.change(screen.getByLabelText('Contraseña'), {
            target: { name: 'password', value: 'Segura123' },
        });
        fireEvent.change(screen.getByLabelText('Nombre'), {
            target: { name: 'first_name', value: 'Nuevo' },
        });
        // Last name stays empty

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        await waitFor(() => {
            expect(
                screen.getByText(/Los apellidos son obligatorios|Rellene todos los campos obligatorios/i)
            ).toBeInTheDocument();
        });
    });

    // ── 4. Go to step 2 and validate empty location ───────────────────────
    it('should show a specific error if the location is missing (step 2)', async () => {
        renderRegisterPage();

        // Fill in step 1
        fillStep1();

        // Go to step 2
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        // Wait for step 2 to appear (it has the "Crear cuenta" button)
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        });

        // Try to submit without a location
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(
                screen.getByText('Debe seleccionar una ubicación válida de la lista')
            ).toBeInTheDocument();
        });
    });

    // ── 5. Successful registration → verification screen ───────────────────────
    it('should call authService.register and show the email verification screen', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (authService.checkEmailVerification as ReturnType<typeof vi.fn>).mockResolvedValue(false);

        renderRegisterPage();

        // Step 1
        fillStep1();
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        // Wait for step 2
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        });

        // Simulate location selection (as if autocomplete had selected it)
        // The react-google-autocomplete mock fires onPlaceSelected when the input changes
        const autocomplete = screen.getByTestId('mock-autocomplete');
        fireEvent.change(autocomplete, { target: { value: 'Madrid' } });

        // Submit step 2
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(authService.register).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'nuevo@test.com',
                    password: 'Segura123',
                    username: 'nuevousuario',
                    first_name: 'Nuevo',
                    last_name: 'Usuario',
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Verifica tu correo')).toBeInTheDocument();
        });

        expect(screen.getByText(/nuevo@test\.com/)).toBeInTheDocument();
    });

    // ── 6. Registro fallido ───────────────────────────────────────────────────
    it('should show the service error when registration fails', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('El email ya está en uso')
        );

        renderRegisterPage();

        // Step 1
        fillStep1();
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        // Wait for step 2
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        });

        // Simulate location selection
        const autocomplete = screen.getByTestId('mock-autocomplete');
        fireEvent.change(autocomplete, { target: { value: 'Madrid' } });

        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(screen.getByText('El email ya está en uso')).toBeInTheDocument();
        });
    });

    // ── 7. The button is disabled while loading in step 2 ──────────────────
    it('should disable the button while registration is processing', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => { }));

        renderRegisterPage();

        // Step 1
        fillStep1();
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        // Wait for step 2
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        });

        // Simulate location selection
        const autocomplete = screen.getByTestId('mock-autocomplete');
        fireEvent.change(autocomplete, { target: { value: 'Madrid' } });

        const btn = screen.getByRole('button', { name: 'Crear cuenta' });
        fireEvent.click(btn);

        await waitFor(() => {
            expect(btn).toBeDisabled();
        });
    });
});
