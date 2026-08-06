/**
 * Tests para los custom hooks de la aplicación:
 *   - useLogin
 *   - useLogout
 *   - usePasswordReset
 *   - useRegister
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Mock de authService ───────────────────────────────────────────────────────
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

    it('estado inicial: campos vacíos, sin mensaje, sin carga', () => {
        const { result } = renderHook(() => useLogin());
        expect(result.current.identifier).toBe('');
        expect(result.current.password).toBe('');
        expect(result.current.message).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('setIdentifier y setPassword actualizan el estado', () => {
        const { result } = renderHook(() => useLogin());
        act(() => result.current.setIdentifier('ana@test.com'));
        act(() => result.current.setPassword('Segura123'));
        expect(result.current.identifier).toBe('ana@test.com');
        expect(result.current.password).toBe('Segura123');
    });

    it('validación: muestra error si los campos están vacíos al enviar', async () => {
        const { result } = renderHook(() => useLogin());
        await act(async () => { await result.current.submitLogin(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toMatch(/rellene/i);
        expect(authService.login).not.toHaveBeenCalled();
    });

    it('validación: muestra error si falta el password', async () => {
        const { result } = renderHook(() => useLogin());
        act(() => result.current.setIdentifier('ana@test.com'));
        await act(async () => { await result.current.submitLogin(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(authService.login).not.toHaveBeenCalled();
    });

    it('login exitoso: llama al servicio y muestra bienvenida', async () => {
        (authService.login as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { nombre: 'Ana' } });
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

    it('login exitoso: llama a onSuccess tras timeout', async () => {
        vi.useFakeTimers();
        (authService.login as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { nombre: 'Ana' } });
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

    it('login fallido: muestra el mensaje de error del servicio', async () => {
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

    it('loading se pone a true durante la petición y a false al terminar', async () => {
        let resolveLogin: (v: any) => void;
        (authService.login as ReturnType<typeof vi.fn>).mockReturnValue(
            new Promise(res => { resolveLogin = res; })
        );
        const { result } = renderHook(() => useLogin());
        act(() => {
            result.current.setIdentifier('ana@test.com');
            result.current.setPassword('Segura123');
        });
        // Iniciamos pero no esperamos (la promesa no resuelve aún)
        act(() => { result.current.submitLogin(mockEvent); });
        expect(result.current.loading).toBe(true);
        // Resolvemos la promesa
        await act(async () => { resolveLogin!({ user: { nombre: 'Ana' } }); });
        expect(result.current.loading).toBe(false);
    });
});


// =============================================================================
// useLogout
// =============================================================================

describe('useLogout', () => {
    beforeEach(() => vi.clearAllMocks());

    it('estado inicial: sin carga, sin error', () => {
        const { result } = renderHook(() => useLogout(() => {}));
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('logout exitoso: llama a onSuccess', async () => {
        (authService.logout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useLogout(onSuccess));
        await act(async () => { await result.current.submitLogout(); });
        expect(authService.logout).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('logout fallido: guarda el error y NO llama a onSuccess', async () => {
        (authService.logout as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useLogout(onSuccess));
        await act(async () => { await result.current.submitLogout(); });
        expect(result.current.error).toBe('Network error');
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('loading es true durante la petición y false al terminar', async () => {
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

    it('estado inicial sin argumento: identifier vacío', () => {
        const { result } = renderHook(() => usePasswordReset());
        expect(result.current.identifier).toBe('');
        expect(result.current.message).toBeNull();
        expect(result.current.loading).toBe(false);
    });

    it('estado inicial con argumento: usa el identifier dado', () => {
        const { result } = renderHook(() => usePasswordReset('pre@test.com'));
        expect(result.current.identifier).toBe('pre@test.com');
    });

    it('validación: muestra error si el email está vacío', async () => {
        const { result } = renderHook(() => usePasswordReset());
        await act(async () => { await result.current.submitPasswordReset(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(authService.requestPasswordReset).not.toHaveBeenCalled();
    });

    it('reset exitoso: muestra mensaje de éxito y limpia el identifier', async () => {
        (authService.requestPasswordReset as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
        const { result } = renderHook(() => usePasswordReset('test@test.com'));
        await act(async () => { await result.current.submitPasswordReset(mockEvent); });
        expect(authService.requestPasswordReset).toHaveBeenCalledWith('test@test.com');
        expect(result.current.message?.type).toBe('success');
        expect(result.current.identifier).toBe('');
    });

    it('reset fallido: muestra el mensaje de error del servicio', async () => {
        (authService.requestPasswordReset as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Email no encontrado'));
        const { result } = renderHook(() => usePasswordReset('bad@test.com'));
        await act(async () => { await result.current.submitPasswordReset(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toBe('Email no encontrado');
    });

    it('setIdentifier actualiza el valor', () => {
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
            result.current.setFieldValue('nombre',    'Test');
            result.current.setFieldValue('apellidos', 'User');
            result.current.setFieldValue('ubicacion', 'Oviedo');
        });
    };

    it('estado inicial: form vacío, sin mensaje, sin carga', () => {
        const { result } = renderHook(() => useRegister(() => {}));
        expect(result.current.form.email).toBe('');
        expect(result.current.message).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.isWaitingVerification).toBe(false);
    });

    it('handleInputChange actualiza el campo correspondiente', () => {
        const { result } = renderHook(() => useRegister(() => {}));
        const fakeEvent = { target: { name: 'email', value: 'a@b.com' } } as React.ChangeEvent<HTMLInputElement>;
        act(() => result.current.handleInputChange(fakeEvent));
        expect(result.current.form.email).toBe('a@b.com');
    });

    it('setFieldValue actualiza un campo del formulario', () => {
        const { result } = renderHook(() => useRegister(() => {}));
        act(() => result.current.setFieldValue('nombre', 'María'));
        expect(result.current.form.nombre).toBe('María');
    });

    it('validación: error si faltan campos obligatorios', async () => {
        const { result } = renderHook(() => useRegister(() => {}));
        await act(async () => { await result.current.submitRegister(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(authService.register).not.toHaveBeenCalled();
    });

    it('validación: error si falta la ubicación', async () => {
        const { result } = renderHook(() => useRegister(() => {}));
        act(() => {
            result.current.setFieldValue('email', 'a@b.com');
            result.current.setFieldValue('username', 'user');
            result.current.setFieldValue('password', 'Pass1234');
            result.current.setFieldValue('nombre', 'Ana');
            result.current.setFieldValue('apellidos', 'García');
            // ubicacion vacía (por defecto)
        });
        await act(async () => { await result.current.submitRegister(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toMatch(/ubicaci/i);
    });

    it('registro exitoso: mensaje de éxito e isWaitingVerification = true', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (authService.checkEmailVerification as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        const { result } = renderHook(() => useRegister(() => {}));
        fillForm(result);
        await act(async () => { await result.current.submitRegister(mockEvent); });
        expect(result.current.message?.type).toBe('success');
        expect(result.current.isWaitingVerification).toBe(true);
    });

    it('registro fallido: muestra el error del servicio', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Email ya registrado'));
        const { result } = renderHook(() => useRegister(() => {}));
        fillForm(result);
        await act(async () => { await result.current.submitRegister(mockEvent); });
        expect(result.current.message?.type).toBe('error');
        expect(result.current.message?.text).toBe('Email ya registrado');
    });

    it('polling: llama a onSuccess cuando checkEmailVerification devuelve true', async () => {
        (authService.register as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (authService.checkEmailVerification as ReturnType<typeof vi.fn>).mockResolvedValue(true);
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useRegister(onSuccess));
        fillForm(result);
        await act(async () => { await result.current.submitRegister(mockEvent); });
        // Avanzamos el intervalo de 5 segundos
        await act(async () => {
            vi.advanceTimersByTime(5000);
            await Promise.resolve();
        });
        // Avanzamos el setTimeout de redirección (2 segundos)
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });
});
