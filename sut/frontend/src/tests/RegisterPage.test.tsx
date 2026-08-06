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


// Helper: llena los campos del paso 1 del registro
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
        target: { name: 'nombre', value: 'Nuevo' },
    });
    fireEvent.change(screen.getByLabelText('Apellidos'), {
        target: { name: 'apellidos', value: 'Usuario' },
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
        // Por defecto, la comprobación de disponibilidad no bloquea
        (authService.checkAvailability as any).mockResolvedValue({
            email_taken: false,
            username_taken: false,
        });
    });

    // ── 1. Renderizado básico (Paso 1) ────────────────────────────────────────
    it('debe renderizar todos los campos del formulario de registro (paso 1)', () => {
        renderRegisterPage();

        expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument();
        expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
        expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
        expect(screen.getByLabelText('Apellidos')).toBeInTheDocument();
        // En el paso 1, el botón principal es "Continuar"
        expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Inicia sesión' })).toBeInTheDocument();
    });

    // ── 2. Validación: campos vacíos en paso 1 ────────────────────────────────
    it('debe mostrar error si se envía el formulario con campos obligatorios vacíos', async () => {
        renderRegisterPage();

        // El botón "Continuar" es el que activa la validación en el paso 1
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        await waitFor(() => {
            // El mensaje de error del paso 1 (stepError)
            expect(
                screen.getByText(/El email es obligatorio|Rellene todos los campos obligatorios/i)
            ).toBeInTheDocument();
        });

        expect(authService.register).not.toHaveBeenCalled();
    });

    // ── 3. Validación: falta apellidos ────────────────────────────────────────
    it('debe mostrar error si falta un campo como apellidos', async () => {
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
            target: { name: 'nombre', value: 'Nuevo' },
        });
        // Apellidos queda vacío

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        await waitFor(() => {
            expect(
                screen.getByText(/Los apellidos son obligatorios|Rellene todos los campos obligatorios/i)
            ).toBeInTheDocument();
        });
    });

    // ── 4. Navegar al paso 2 y validar ubicación vacía ───────────────────────
    it('debe mostrar error específico si falta la ubicación (paso 2)', async () => {
        renderRegisterPage();

        // Rellenar paso 1
        fillStep1();

        // Avanzar al paso 2
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        // Esperar a que aparezca el paso 2 (tiene el botón "Crear cuenta")
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        });

        // Intentar enviar sin ubicación
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(
                screen.getByText('Debe seleccionar una ubicación válida de la lista')
            ).toBeInTheDocument();
        });
    });

    // ── 5. Registro exitoso → pantalla de verificación ───────────────────────
    it('debe llamar a authService.register y mostrar la pantalla de verificación de email', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (authService.checkEmailVerification as ReturnType<typeof vi.fn>).mockResolvedValue(false);

        renderRegisterPage();

        // Paso 1
        fillStep1();
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        // Esperar paso 2
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        });

        // Simular selección de ubicación (como si el autocomplete la hubiese seleccionado)
        // El mock de react-google-autocomplete dispara onPlaceSelected al cambiar el input
        const autocomplete = screen.getByTestId('mock-autocomplete');
        fireEvent.change(autocomplete, { target: { value: 'Madrid' } });

        // Enviar paso 2
        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(authService.register).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: 'nuevo@test.com',
                    password: 'Segura123',
                    username: 'nuevousuario',
                    nombre: 'Nuevo',
                    apellidos: 'Usuario',
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Verifica tu correo')).toBeInTheDocument();
        });

        expect(screen.getByText(/nuevo@test\.com/)).toBeInTheDocument();
    });

    // ── 6. Registro fallido ───────────────────────────────────────────────────
    it('debe mostrar el error del servicio cuando el registro falla', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('El email ya está en uso')
        );

        renderRegisterPage();

        // Paso 1
        fillStep1();
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        // Esperar paso 2
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        });

        // Simular selección de ubicación
        const autocomplete = screen.getByTestId('mock-autocomplete');
        fireEvent.change(autocomplete, { target: { value: 'Madrid' } });

        fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

        await waitFor(() => {
            expect(screen.getByText('El email ya está en uso')).toBeInTheDocument();
        });
    });

    // ── 7. El botón se deshabilita mientras carga en paso 2 ──────────────────
    it('debe deshabilitar el botón mientras se procesa el registro', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => { }));

        renderRegisterPage();

        // Paso 1
        fillStep1();
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

        // Esperar paso 2
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
        });

        // Simular selección de ubicación
        const autocomplete = screen.getByTestId('mock-autocomplete');
        fireEvent.change(autocomplete, { target: { value: 'Madrid' } });

        const btn = screen.getByRole('button', { name: 'Crear cuenta' });
        fireEvent.click(btn);

        await waitFor(() => {
            expect(btn).toBeDisabled();
        });
    });
});
