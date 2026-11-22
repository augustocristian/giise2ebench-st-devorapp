import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProfilePage from '../views/ProfilePage';
import { authService } from '../models/api/authService';
import { useNotification } from '../components/useNotification';

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

vi.mock('../components/useNotification', () => ({
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
    first_name: 'Ana',
    last_name: 'García',
    location: 'Madrid',
};

describe('ProfilePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useNotification as any).mockReturnValue({
            showNotification: mockShowNotification,
        });
        (authService.getMe as any).mockResolvedValue(mockUser);
    });

    // ── 1. Basic rendering and loading ─────────────────────────────────────────
    it('should show the loading state and then render the user data', async () => {
        let resolvePromise: any;
        const promise = new Promise((resolve) => {
            resolvePromise = resolve;
        });
        (authService.getMe as any).mockReturnValue(promise);

        renderProfilePage();

        // Initially the name must not show because it is loading (only the TopBar with showMenu=false)
        expect(screen.queryByText('Ana García')).not.toBeInTheDocument();

        // Resolve the load
        resolvePromise(mockUser);

        await waitFor(() => {
            expect(screen.getAllByText('Ana García')[0]).toBeInTheDocument();
            expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument();
        });
    });

    it('should redirect to /home if getMe fails', async () => {
        (authService.getMe as any).mockRejectedValue(new Error('Unauthorized'));

        renderProfilePage();

        await waitFor(() => {
            expect(mockShowNotification).toHaveBeenCalledWith('Error al cargar datos del perfil', 'error');
            expect(mockNavigate).toHaveBeenCalledWith('/home');
        });
    });

    // ── 2. Editing Personal Information ────────────────────────────────────
    it('should allow editing personal information', async () => {
        renderProfilePage();

        await waitFor(() => expect(screen.getAllByText('Ana García')[0]).toBeInTheDocument());

        // Click the Edit button of Información Personal
        const editButtons = screen.getAllByText('Editar');
        fireEvent.click(editButtons[0]);

        // Verify the form opened
        const nameInput = screen.getByDisplayValue('Ana');

        // Modify data
        fireEvent.change(nameInput, { target: { value: 'Laura' } });

        (authService.updateProfile as any).mockResolvedValue({
            message: 'Success',
            user: { ...mockUser, first_name: 'Laura' },
        });

        // Save
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() => {
            expect(authService.updateProfile).toHaveBeenCalledWith({
                first_name: 'Laura',
                last_name: 'García',
                location: 'Madrid',
                password: '',
            });
            expect(mockShowNotification).toHaveBeenCalledWith('Perfil actualizado correctamente', 'success');
        });

        // Verify the UI was updated
        expect(screen.getAllByText('Laura García')[0]).toBeInTheDocument();
    });

    // ── 3. Editing Email ──────────────────────────────────────
    it('should allow changing the email and redirect to login', async () => {
        renderProfilePage();

        await waitFor(() => expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument());

        // The button says "Cambiar", but use getAll just in case
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

    // ── 4. Editing Password ──────────────────────────────────────────────
    it('should show an error if the new passwords do not match', async () => {
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

    it('should allow changing the password if the data is correct', async () => {
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

    // ── 5. Deleting Account ──────────────────────────────────────────────
    it('should allow deleting the account', async () => {
        renderProfilePage();
        await waitFor(() => expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument());

        // Click "Eliminar cuenta permanentemente" to open the form
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

    // ── 6. Google user ──────────────────────────────────────────────────
    it('should not show the change email and password buttons if the user is a Google user', async () => {
        (authService.getMe as any).mockResolvedValue({
            ...mockUser,
            is_google: true,
        });

        renderProfilePage();

        await waitFor(() => expect(screen.getAllByText('test@example.com')[0]).toBeInTheDocument());

        // Verify the Google badge is shown
        expect(screen.getByText('Vinculado a Google')).toBeInTheDocument();

        // The Ubicación one also says "Cambiar", so there should be exactly 1 button with the text "Cambiar".
        const changeButtons = screen.getAllByRole('button', { name: /Cambiar$/i });
        expect(changeButtons).toHaveLength(1); // Only the Ubicación one

        // The password one must not be present at all
        expect(screen.queryByRole('button', { name: /Cambiar contraseña/i })).not.toBeInTheDocument();
        expect(screen.getByText('Iniciaste sesión con Google. La seguridad de tu cuenta se gestiona a través de Google.')).toBeInTheDocument();
    });
});
