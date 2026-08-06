import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authService } from '../models/api/authService';

describe('authService', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.clearAllMocks();
    });

    // ── login ─────────────────────────────────────────────────────────────────

    it('login debe hacer POST a /login y retornar la respuesta si es correcta', async () => {
        const mockResponse = { message: 'Ok', user: { username: 'test' } };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await authService.login('test@test.com', 'password');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/login'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ identifier: 'test@test.com', password: 'password' }),
            })
        );
        expect(result).toEqual(mockResponse);
    });

    it('login debe lanzar error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Credenciales inválidas' }),
        });

        await expect(authService.login('test@test.com', 'pass')).rejects.toThrow('Credenciales inválidas');
    });

    // ── loginWithGoogle ───────────────────────────────────────────────────────

    it('loginWithGoogle debe retornar { require_username: true } si el estado es 202', async () => {
        const mockResponse = { require_username: true, email: 'g@g.com' };
        (globalThis.fetch as any).mockResolvedValue({
            status: 202,
            ok: true,
            json: async () => mockResponse,
        });

        const result = await authService.loginWithGoogle('google-token');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/auth/google'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ token: 'google-token' }),
            })
        );
        expect(result).toEqual(mockResponse);
    });

    it('loginWithGoogle debe lanzar error si la respuesta no es ok y no es 202', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            status: 400,
            ok: false,
            json: async () => ({ detail: 'Token inválido' }),
        });

        await expect(authService.loginWithGoogle('bad-token')).rejects.toThrow('Token inválido');
    });

    // ── registerWithGoogle ────────────────────────────────────────────────────

    it('registerWithGoogle debe hacer POST a /register/google', async () => {
        const mockResponse = { message: 'Cuenta creada' };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await authService.registerWithGoogle('token', 'username', 'Madrid');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/register/google'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ token: 'token', username: 'username', ubicacion: 'Madrid' }),
            })
        );
        expect(result).toEqual(mockResponse);
    });

    // ── logout ────────────────────────────────────────────────────────────────

    it('logout debe hacer POST a /logout', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await authService.logout();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/logout'),
            expect.objectContaining({ method: 'POST' })
        );
    });

    // ── getMe ─────────────────────────────────────────────────────────────────

    it('getMe debe hacer GET a /me', async () => {
        const mockUser = { username: 'testuser' };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockUser,
        });

        const result = await authService.getMe();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/me'),
            expect.objectContaining({ method: 'GET' })
        );
        expect(result).toEqual(mockUser);
    });

    it('getMe lanza error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: false });

        await expect(authService.getMe()).rejects.toThrow('No autorizado');
    });

    // ── register ──────────────────────────────────────────────────────────────

    it('register debe hacer POST a /register', async () => {
        const userData = { email: 'a@a.com', password: 'password', username: 'user' };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Registrado' }),
        });

        const result = await authService.register(userData);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/register'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(userData),
            })
        );
        expect(result.message).toBe('Registrado');
    });

    // ── requestPasswordReset ──────────────────────────────────────────────────

    it('requestPasswordReset debe hacer POST a /password-reset', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await authService.requestPasswordReset('test@test.com');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/password-reset'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ email: 'test@test.com' }),
            })
        );
    });

    // ── checkEmailVerification ───────────────────────────────────────────────

    it('checkEmailVerification debe retornar true si es verificado', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ verified: true }),
        });

        const result = await authService.checkEmailVerification('test@test.com');

        expect(result).toBe(true);
    });

    // ── checkAvailability ────────────────────────────────────────────────────

    it('checkAvailability debe retornar el estado de disponibilidad', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ email_taken: true, username_taken: false }),
        });

        const result = await authService.checkAvailability('taken@test.com', 'free');

        expect(result).toEqual({ email_taken: true, username_taken: false });
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('email=taken%40test.com&username=free')
        );
    });

    // ── updateProfile ─────────────────────────────────────────────────────────

    it('updateProfile debe hacer PATCH a /profile', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Actualizado' }),
        });

        const result = await authService.updateProfile({ nombre: 'Nuevo' });

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/profile'),
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ nombre: 'Nuevo' }),
            })
        );
        expect(result.message).toBe('Actualizado');
    });

    // ── updateEmail ───────────────────────────────────────────────────────────

    it('updateEmail debe hacer PATCH a /profile/email', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Email enviado' }),
        });

        const result = await authService.updateEmail({ new_email: 'new@test.com', password: 'pass' });

        expect(result.message).toBe('Email enviado');
    });

    // ── updatePassword ────────────────────────────────────────────────────────

    it('updatePassword debe hacer PATCH a /profile/password', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Password ok' }),
        });

        const result = await authService.updatePassword({ new_password: 'pass' });

        expect(result.message).toBe('Password ok');
    });

    // ── deleteAccount ─────────────────────────────────────────────────────────

    it('deleteAccount debe hacer DELETE a /profile', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Deleted' }),
        });

        const result = await authService.deleteAccount('secret');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/profile?password=secret'),
            expect.objectContaining({ method: 'DELETE' })
        );
        expect(result.message).toBe('Deleted');
    });
});
