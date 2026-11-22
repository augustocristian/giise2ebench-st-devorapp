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

    it('login should POST to /sessions and return the response on success', async () => {
        const mockResponse = { message: 'Ok', user: { username: 'test' } };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await authService.login('test@test.com', 'password');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sessions'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ identifier: 'test@test.com', password: 'password' }),
            })
        );
        expect(result).toEqual(mockResponse);
    });

    it('login should throw if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Credenciales inválidas' }),
        });

        await expect(authService.login('test@test.com', 'pass')).rejects.toThrow('Credenciales inválidas');
    });

    // ── loginWithGoogle ───────────────────────────────────────────────────────

    it('loginWithGoogle should return { require_username: true } if the status is 202', async () => {
        const mockResponse = { require_username: true, email: 'g@g.com' };
        (globalThis.fetch as any).mockResolvedValue({
            status: 202,
            ok: true,
            json: async () => mockResponse,
        });

        const result = await authService.loginWithGoogle('google-token');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sessions/google'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ token: 'google-token' }),
            })
        );
        expect(result).toEqual(mockResponse);
    });

    it('loginWithGoogle should throw if the response is not ok and not 202', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            status: 401,
            ok: false,
            json: async () => ({ detail: 'Token inválido' }),
        });

        await expect(authService.loginWithGoogle('bad-token')).rejects.toThrow('Token inválido');
    });

    // ── registerWithGoogle ────────────────────────────────────────────────────

    it('registerWithGoogle should POST to /users/google', async () => {
        const mockResponse = { message: 'Cuenta creada' };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const result = await authService.registerWithGoogle('token', 'username', 'Madrid');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/users/google'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ token: 'token', username: 'username', location: 'Madrid' }),
            })
        );
        expect(result).toEqual(mockResponse);
    });

    // ── logout ────────────────────────────────────────────────────────────────

    it('logout should DELETE /sessions/current', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await authService.logout();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/sessions/current'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    // ── getMe ─────────────────────────────────────────────────────────────────

    it('getMe should GET to /me', async () => {
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

    it('getMe throws if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: false });

        await expect(authService.getMe()).rejects.toThrow('No autorizado');
    });

    // ── register ──────────────────────────────────────────────────────────────

    it('register should POST to /users', async () => {
        const userData = { email: 'a@a.com', password: 'password', username: 'user' };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Registrado' }),
        });

        const result = await authService.register(userData);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/users'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(userData),
            })
        );
        expect(result.message).toBe('Registrado');
    });

    // ── requestPasswordReset ──────────────────────────────────────────────────

    it('requestPasswordReset should POST to /password-resets', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await authService.requestPasswordReset('test@test.com');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/password-resets'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ email: 'test@test.com' }),
            })
        );
    });

    // ── checkEmailVerification ───────────────────────────────────────────────

    it('checkEmailVerification should return true if verified', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ verified: true }),
        });

        const result = await authService.checkEmailVerification('test@test.com');

        expect(result).toBe(true);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/email-verification?email=test%40test.com')
        );
    });

    // ── checkAvailability ────────────────────────────────────────────────────

    it('checkAvailability should return the availability status', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ email_taken: true, username_taken: false }),
        });

        const result = await authService.checkAvailability('taken@test.com', 'free');

        expect(result).toEqual({ email_taken: true, username_taken: false });
        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/users/availability?email=taken%40test.com&username=free')
        );
    });

    // ── updateProfile ─────────────────────────────────────────────────────────

    it('updateProfile should PATCH to /profile', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Actualizado' }),
        });

        const result = await authService.updateProfile({ first_name: 'Nuevo' });

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/profile'),
            expect.objectContaining({
                method: 'PATCH',
                body: JSON.stringify({ first_name: 'Nuevo' }),
            })
        );
        expect(result.message).toBe('Actualizado');
    });

    // ── updateEmail ───────────────────────────────────────────────────────────

    it('updateEmail should PATCH to /profile/email', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Email enviado' }),
        });

        const result = await authService.updateEmail({ new_email: 'new@test.com', password: 'pass' });

        expect(result.message).toBe('Email enviado');
    });

    // ── updatePassword ────────────────────────────────────────────────────────

    it('updatePassword should PATCH to /profile/password', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ message: 'Password ok' }),
        });

        const result = await authService.updatePassword({ new_password: 'pass' });

        expect(result.message).toBe('Password ok');
    });

    // ── deleteAccount ─────────────────────────────────────────────────────────

    it('deleteAccount should DELETE to /profile', async () => {
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
