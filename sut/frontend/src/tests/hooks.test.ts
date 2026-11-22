/**
 * Tests for the application custom hooks:
 *   - useLogin
 *   - useLogout
 *   - usePasswordReset
 *   - useRegister
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── authService mock ───────────────────────────────────────────────────────
vi.mock('../models/api/authService', () => ({
    authService: {
        login: vi.fn(),
        logout: vi.fn(),
        requestPasswordReset: vi.fn(),
        register: vi.fn(),
        checkEmailVerification: vi.fn(),
    },
}));

import { authService } from '../models/api/authService';
import { useLogin } from '../controllers/hooks/useLogin';
import { useLogout } from '../controllers/hooks/useLogout';
import { usePasswordReset } from '../controllers/hooks/usePasswordReset';
import { useRegister } from '../controllers/hooks/useRegister';


// =============================================================================
// useLogin
// =============================================================================

describe('useLogin', () => {
    const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initial state: empty fields, no message, not loading', () => {
        const { result } = renderHook(() => useLogin());
        expect(result.current.identifier).toBe('');
        expect(result.current.password).toBe('');
        expect(result.current.message).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('setIdentifier and setPassword update the state', () => {
        const { result } = renderHook(() => useLogin());
        act(() => result.current.setIdentifier('ana@test.com'));
        act(() => result.current.setPassword('Segura123'));
        expect(result.current.identifier).toBe('ana@test.com');
        expect(result.current.password).toBe('Segura123');
    });

    it('validation: shows error if fields are empty on submit', async () => {
        const { result } = renderHook(() => useLogin());
        await act(async () => { await result.current.submitLogin(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toMatch(/rellene/i);
        expect(authService.login).not.toHaveBeenCalled();
    });

    it('validation: shows error if the password is missing', async () => {
        const { result } = renderHook(() => useLogin());
        act(() => result.current.setIdentifier('ana@test.com'));
        await act(async () => { await result.current.submitLogin(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(authService.login).not.toHaveBeenCalled();
    });

    it('successful login: calls the service and shows welcome message', async () => {
        (authService.login as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { first_name: 'Ana' } });
        const { result } = renderHook(() => useLogin());
        act(() => {
            result.current.setIdentifier('ana@test.com');
            result.current.setPassword('Segura123');
        });
        await act(async () => { await result.current.submitLogin(mockEvent); });
        expect(authService.login).toHaveBeenCalledWith('ana@test.com', 'Segura123');
        expect(result.current.message?.type).toBe('success');
        expect(result.current.message?.text).toContain('Ana');
    });

    it('successful login: calls onSuccess after timeout', async () => {
        vi.useFakeTimers();
        (authService.login as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { first_name: 'Ana' } });
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useLogin(onSuccess));
        act(() => {
            result.current.setIdentifier('ana@test.com');
            result.current.setPassword('Segura123');
        });
        await act(async () => { await result.current.submitLogin(mockEvent); });
        expect(onSuccess).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1500));
        expect(onSuccess).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('failed login: shows the service error message', async () => {
        (authService.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Credenciales incorrectas'));
        const { result } = renderHook(() => useLogin());
        act(() => {
            result.current.setIdentifier('bad@test.com');
            result.current.setPassword('wrong');
        });
        await act(async () => { await result.current.submitLogin(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toBe('Credenciales incorrectas');
    });

    it('loading is true during the request and false when done', async () => {
        let resolveLogin: (v: any) => void;
        (authService.login as ReturnType<typeof vi.fn>).mockReturnValue(
            new Promise(res => { resolveLogin = res; })
        );
        const { result } = renderHook(() => useLogin());
        act(() => {
            result.current.setIdentifier('ana@test.com');
            result.current.setPassword('Segura123');
        });
        // Start without awaiting (the promise has not resolved yet)
        act(() => { result.current.submitLogin(mockEvent); });
        expect(result.current.loading).toBe(true);
        // Resolve the promise
        await act(async () => { resolveLogin!({ user: { first_name: 'Ana' } }); });
        expect(result.current.loading).toBe(false);
    });
});


// =============================================================================
// useLogout
// =============================================================================

describe('useLogout', () => {
    beforeEach(() => vi.clearAllMocks());

    it('initial state: not loading, no error', () => {
        const { result } = renderHook(() => useLogout(() => {}));
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('successful logout: calls onSuccess', async () => {
        (authService.logout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useLogout(onSuccess));
        await act(async () => { await result.current.submitLogout(); });
        expect(authService.logout).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('failed logout: stores the error and does NOT call onSuccess', async () => {
        (authService.logout as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useLogout(onSuccess));
        await act(async () => { await result.current.submitLogout(); });
        expect(result.current.error).toBe('Network error');
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('loading is true during the request and false when done', async () => {
        let resolve: (v: any) => void;
        (authService.logout as ReturnType<typeof vi.fn>).mockReturnValue(
            new Promise(res => { resolve = res; })
        );
        const { result } = renderHook(() => useLogout(() => {}));
        act(() => { result.current.submitLogout(); });
        expect(result.current.loading).toBe(true);
        await act(async () => { resolve!(undefined); });
        expect(result.current.loading).toBe(false);
    });
});


// =============================================================================
// usePasswordReset
// =============================================================================

describe('usePasswordReset', () => {
    const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    beforeEach(() => vi.clearAllMocks());

    it('initial state without argument: empty identifier', () => {
        const { result } = renderHook(() => usePasswordReset());
        expect(result.current.identifier).toBe('');
        expect(result.current.message).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('initial state with argument: uses the given identifier', () => {
        const { result } = renderHook(() => usePasswordReset('pre@test.com'));
        expect(result.current.identifier).toBe('pre@test.com');
    });

    it('validation: shows error if the email is empty', async () => {
        const { result } = renderHook(() => usePasswordReset());
        await act(async () => { await result.current.submitPasswordReset(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(authService.requestPasswordReset).not.toHaveBeenCalled();
    });

    it('successful reset: shows success message and clears the identifier', async () => {
        (authService.requestPasswordReset as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        const { result } = renderHook(() => usePasswordReset('test@test.com'));
        await act(async () => { await result.current.submitPasswordReset(mockEvent); });
        expect(authService.requestPasswordReset).toHaveBeenCalledWith('test@test.com');
        expect(result.current.message?.type).toBe('success');
        expect(result.current.identifier).toBe('');
    });

    it('failed reset: shows the service error message', async () => {
        (authService.requestPasswordReset as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Email no encontrado'));
        const { result } = renderHook(() => usePasswordReset('bad@test.com'));
        await act(async () => { await result.current.submitPasswordReset(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toBe('Email no encontrado');
    });

    it('setIdentifier updates the value', () => {
        const { result } = renderHook(() => usePasswordReset());
        act(() => result.current.setIdentifier('nuevo@test.com'));
        expect(result.current.identifier).toBe('nuevo@test.com');
    });
});


// =============================================================================
// useRegister
// =============================================================================

describe('useRegister', () => {
    const mockEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const fillForm = (result: any) => {
        act(() => {
            result.current.setFieldValue('email',     'test@test.com');
            result.current.setFieldValue('username',  'testuser');
            result.current.setFieldValue('password',  'Test1234');
            result.current.setFieldValue('first_name',    'Test');
            result.current.setFieldValue('last_name', 'User');
            result.current.setFieldValue('location', 'Oviedo');
        });
    };

    it('initial state: empty form, no message, not loading', () => {
        const { result } = renderHook(() => useRegister(() => {}));
        expect(result.current.form.email).toBe('');
        expect(result.current.message).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.isWaitingVerification).toBe(false);
    });

    it('handleInputChange updates the corresponding field', () => {
        const { result } = renderHook(() => useRegister(() => {}));
        const fakeEvent = { target: { name: 'email', value: 'a@b.com' } } as React.ChangeEvent<HTMLInputElement>;
        act(() => result.current.handleInputChange(fakeEvent));
        expect(result.current.form.email).toBe('a@b.com');
    });

    it('setFieldValue updates a form field', () => {
        const { result } = renderHook(() => useRegister(() => {}));
        act(() => result.current.setFieldValue('first_name', 'María'));
        expect(result.current.form.first_name).toBe('María');
    });

    it('validation: error if required fields are missing', async () => {
        const { result } = renderHook(() => useRegister(() => {}));
        await act(async () => { await result.current.submitRegister(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(authService.register).not.toHaveBeenCalled();
    });

    it('validation: error if the location is missing', async () => {
        const { result } = renderHook(() => useRegister(() => {}));
        act(() => {
            result.current.setFieldValue('email', 'a@b.com');
            result.current.setFieldValue('username', 'user');
            result.current.setFieldValue('password', 'Pass1234');
            result.current.setFieldValue('first_name', 'Ana');
            result.current.setFieldValue('last_name', 'García');
            // empty location (default)
        });
        await act(async () => { await result.current.submitRegister(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toMatch(/ubicaci/i);
    });

    it('successful registration: success message and isWaitingVerification = true', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (authService.checkEmailVerification as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        const { result } = renderHook(() => useRegister(() => {}));
        fillForm(result);
        await act(async () => { await result.current.submitRegister(mockEvent); });
        expect(result.current.message?.type).toBe('success');
        expect(result.current.isWaitingVerification).toBe(true);
    });

    it('failed registration: shows the service error', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Email ya registrado'));
        const { result } = renderHook(() => useRegister(() => {}));
        fillForm(result);
        await act(async () => { await result.current.submitRegister(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toBe('Email ya registrado');
    });

    it('polling: calls onSuccess when checkEmailVerification returns true', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (authService.checkEmailVerification as ReturnType<typeof vi.fn>).mockResolvedValue(true);
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useRegister(onSuccess));
        fillForm(result);
        await act(async () => { await result.current.submitRegister(mockEvent); });
        // Advance the 5-second interval
        await act(async () => {
            vi.advanceTimersByTime(5000);
            await Promise.resolve();
        });
        // Advance the redirect setTimeout (2 seconds)
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });
});
