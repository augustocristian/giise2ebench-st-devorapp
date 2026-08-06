import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProfilePage from '../views/ProfilePage';
import { authService } from '../models/api/authService';
import { useNotification } from '../components/NotificationSystem';

// ── Mocks ─────────────────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        getMe: vi.fn(),
        updateProfile: vi.fn(),
        updateEmail: vi.fn(),
        updatePassword: vi.fn(),
        deleteAccount: vi.fn(),
    },
}));

vi.mock('../components/NotificationSystem', () => ({
    useNotification: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const mockShowNotification = vi.fn();

const renderProfilePage = () =>
    render(
        <MemoryRouter initialEntries={['/profile']}>
            <ProfilePage />
        </MemoryRouter>
    );

const mockUser = {
    username: 'testuser',
    email: 'test@example.com',
    nombre: 'Ana',
    apellidos: 'García',
    ubicacion: 'Madrid',
};

describe('ProfilePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useNotification as any).mockReturnValue({
            showNotification: mockShowNotification,
        });
        (authService.getMe as any).mockResolvedValue(mockUser);
    });

    // ── 1. Renderizado básico y carga ─────────────────────────────────────────
    it('debe mostrar el estado de carga y luego renderizar los datos del usuario', async () => {
        let resolvePromise: any;
        const promise = new Promise((resolve) => {
            resolvePromise = resolve;
        });
        (authService.getMe as any).mockReturnValue(promise);

        renderProfilePage();

        // Inicialmente no debe mostrar el nombre porque está cargando (solo el TopBar con showMenu=false)
        expect(screen.queryByText('Ana García')).not.toBeInTheDocument();

        // Resolvemos la carga
        resolvePromise(mockUser);

        await waitFor(() => {
            expect(screen.getAllByText('Ana García')[0]).toBeInTheDocument();
            expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument();
        });
    });

    it('debe redirigir a /home si getMe falla', async () => {
        (authService.getMe as any).mockRejectedValue(new Error('Unauthorized'));

        renderProfilePage();

        await waitFor(() => {
            expect(mockShowNotification).toHaveBeenCalledWith('Error al cargar datos del perfil', 'error');
            expect(mockNavigate).toHaveBeenCalledWith('/home');
        });
    });

    // ── 2. Edición de Información Personal ────────────────────────────────────
    it('debe permitir editar la información personal', async () => {
        renderProfilePage();

        await waitFor(() => expect(screen.getAllByText('Ana García')[0]).toBeInTheDocument());

        // Clic en el botón Editar de Información Personal
        const editButtons = screen.getAllByText('Editar');
        fireEvent.click(editButtons[0]);

        // Verificamos que se abrió el formulario
        const nameInput = screen.getByDisplayValue('Ana');

        // Modificamos datos
        fireEvent.change(nameInput, { target: { value: 'Laura' } });

        (authService.updateProfile as any).mockResolvedValue({
            message: 'Success',
            user: { ...mockUser, nombre: 'Laura' },
        });

        // Guardamos
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => {
            expect(authService.updateProfile).toHaveBeenCalledWith({
                nombre: 'Laura',
                apellidos: 'García',
                ubicacion: 'Madrid',
                password: '',
            });
            expect(mockShowNotification).toHaveBeenCalledWith('Perfil actualizado correctamente', 'success');
        });

        // Verifica que la UI se actualizó
        expect(screen.getAllByText('Laura García')[0]).toBeInTheDocument();
    });

    // ── 3. Edición de Correo Electrónico ──────────────────────────────────────
    it('debe permitir cambiar el correo y redirigir al login', async () => {
        renderProfilePage();

        await waitFor(() => expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument());

        // El botón dice "Cambiar", pero usamos getAll por si acaso
        const changeButtons = screen.getAllByRole('button', { name: /Cambiar$/i });
        fireEvent.click(changeButtons[1]);

        const newEmailInput = screen.getAllByRole('textbox').find(input => (input as HTMLInputElement).type === 'email')!;
        const passwordInput = screen.getByPlaceholderText('Introduce tu contraseña');

        fireEvent.change(newEmailInput, { target: { value: 'nuevo@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        (authService.updateEmail as any).mockResolvedValue({ message: 'Success' });

        fireEvent.click(screen.getByRole('button', { name: 'Cambiar correo' }));

        await waitFor(() => {
            expect(authService.updateEmail).toHaveBeenCalledWith({
                new_email: 'nuevo@example.com',
                password: 'password123',
            });
            expect(mockShowNotification).toHaveBeenCalledWith(
                'Se ha enviado un correo de confirmación. Por favor, verifica tu nueva bandeja de entrada.',
                'success'
            );
        });
    });

    // ── 4. Edición de Contraseña ──────────────────────────────────────────────
    it('debe mostrar error si las contraseñas nuevas no coinciden', async () => {
        renderProfilePage();
        await waitFor(() => expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument());

        const changePassButtons = screen.getAllByRole('button', { name: /Cambiar contraseña/i });
        fireEvent.click(changePassButtons[0]);

        const currentPassInput = screen.getAllByLabelText(/Contraseña Actual/i)[0];
        const newPassInput = screen.getAllByLabelText('Nueva Contraseña')[0];
        const confirmPassInput = screen.getAllByLabelText('Repetir Nueva Contraseña')[0];

        fireEvent.change(currentPassInput, { target: { value: 'oldpass123' } });
        fireEvent.change(newPassInput, { target: { value: 'newpass123' } });
        fireEvent.change(confirmPassInput, { target: { value: 'newpass456' } });

        fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));

        await waitFor(() => {
            expect(mockShowNotification).toHaveBeenCalledWith('Las contraseñas no coinciden', 'error');
            expect(authService.updatePassword).not.toHaveBeenCalled();
        });
    });

    it('debe permitir cambiar la contraseña si los datos son correctos', async () => {
        renderProfilePage();
        await waitFor(() => expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument());

        const changePassButtons = screen.getAllByRole('button', { name: /Cambiar contraseña/i });
        fireEvent.click(changePassButtons[0]);

        const currentPassInput = screen.getAllByLabelText(/Contraseña Actual/i)[0];
        const newPassInput = screen.getAllByLabelText('Nueva Contraseña')[0];
        const confirmPassInput = screen.getAllByLabelText('Repetir Nueva Contraseña')[0];

        fireEvent.change(currentPassInput, { target: { value: 'oldpass123' } });
        fireEvent.change(newPassInput, { target: { value: 'newpass123' } });
        fireEvent.change(confirmPassInput, { target: { value: 'newpass123' } });

        (authService.updatePassword as any).mockResolvedValue({ message: 'Success' });

        fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));

        await waitFor(() => {
            expect(authService.updatePassword).toHaveBeenCalledWith({
                old_password: 'oldpass123',
                new_password: 'newpass123',
            });
            expect(mockShowNotification).toHaveBeenCalledWith('Contraseña actualizada correctamente', 'success');
        });
    });

    // ── 5. Eliminación de Cuenta ──────────────────────────────────────────────
    it('debe permitir eliminar la cuenta', async () => {
        renderProfilePage();
        await waitFor(() => expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument());

        // Hacer clic en "Eliminar cuenta permanentemente" para abrir el formulario
        const deleteButtons = screen.getAllByRole('button', { name: /Eliminar cuenta permanentemente/i });
        fireEvent.click(deleteButtons[0]);

        const confirmInput = screen.getByLabelText(/Escribe CONFIRMAR para continuar/i);
        fireEvent.change(confirmInput, { target: { value: 'CONFIRMAR' } });

        (authService.deleteAccount as any).mockResolvedValue({ message: 'Success' });

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar permanentemente' }));

        await waitFor(() => {
            expect(authService.deleteAccount).toHaveBeenCalledWith('');
            expect(mockShowNotification).toHaveBeenCalledWith('Cuenta eliminada correctamente. Adiós.', 'success');
        });
    });

    // ── 6. Usuario de Google ──────────────────────────────────────────────────
    it('no debe mostrar los botones para cambiar correo y contraseña si el usuario es de Google', async () => {
        (authService.getMe as any).mockResolvedValue({
            ...mockUser,
            is_google: true,
        });

        renderProfilePage();

        await waitFor(() => expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument());

        // Verificamos que se muestra el badge de Google
        expect(screen.getByText('Vinculado a Google')).toBeInTheDocument();

        // El de Ubicación dice "Cambiar" también. Así que debería haber exactamente 1 botón con el texto "Cambiar".
        const changeButtons = screen.getAllByRole('button', { name: /Cambiar$/i });
        expect(changeButtons).toHaveLength(1); // Solo el de Ubicación

        // El de contraseña no debe estar en absoluto
        expect(screen.queryByRole('button', { name: /Cambiar contraseña/i })).not.toBeInTheDocument();
        expect(screen.getByText('Iniciaste sesión con Google. La seguridad de tu cuenta se gestiona a través de Google.')).toBeInTheDocument();
    });
});
