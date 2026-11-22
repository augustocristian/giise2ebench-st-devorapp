import type { LoginResponse, RegisterResponse } from '../types/auth';
import { cacheService } from './cacheService';

import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export const authService = {
    login: async (identifier: string, password: string): Promise<LoginResponse> => {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ identifier, password }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Ocurrió un error al iniciar sesión');
        }

        return data;
    },

    loginWithGoogle: async (token: string): Promise<any> => {
        const response = await fetch(`${API_URL}/sessions/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token }),
        });

        if (response.status === 202) {
            return await response.json(); // Devuelve {require_username: true, ...}
        }
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Ocurrió un error al iniciar sesión con Google');
        }
        return data;
    },

    registerWithGoogle: async (token: string, username: string, location: string = ''): Promise<any> => {
        const response = await fetch(`${API_URL}/users/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ token, username, location }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Ocurrió un error al completar el registro con Google');
        }
        return data;
    },

    logout: async (): Promise<void> => {
        const response = await fetch(`${API_URL}/sessions/current`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Error al cerrar sesión');
        }
        cacheService.clear();
    },

    getMe: async (): Promise<any> => {
        const response = await fetch(`${API_URL}/me`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('No autorizado');
        }

        return await response.json();
    },

    register: async (userData: any): Promise<RegisterResponse> => {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Error al crear la cuenta');
        }

        return data;
    },

    requestPasswordReset: async (email: string): Promise<void> => {
        const response = await fetch(`${API_URL}/password-resets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            throw new Error('Ocurrió un error al solicitar el restablecimiento');
        }
    },

    checkEmailVerification: async (email: string): Promise<boolean> => {
        const response = await fetch(`${API_URL}/email-verification?email=${encodeURIComponent(email)}`);
        if (!response.ok) {
            return false;
        }
        const data = await response.json();
        return data.verified;
    },

    checkAvailability: async (
        email: string,
        username: string
    ): Promise<{ email_taken: boolean; username_taken: boolean }> => {
        const params = new URLSearchParams();
        if (email)    params.append('email', email);
        if (username) params.append('username', username);

        const response = await fetch(`${API_URL}/users/availability?${params}`);
        if (!response.ok) {
            // If the network fails, do not block the flow
            return { email_taken: false, username_taken: false };
        }
        return response.json();
    },

    updateProfile: async (data: any): Promise<any> => {
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || 'Error al actualizar el perfil');
        }
        return result;
    },

    updateEmail: async (data: any): Promise<any> => {
        const response = await fetch(`${API_URL}/profile/email`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || 'Error al actualizar el email');
        }
        return result;
    },

    updatePassword: async (data: any): Promise<any> => {
        const response = await fetch(`${API_URL}/profile/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || 'Error al actualizar la contraseña');
        }
        return result;
    },

    deleteAccount: async (password: string): Promise<any> => {
        const response = await fetch(`${API_URL}/profile?password=${encodeURIComponent(password)}`, {
            method: 'DELETE',
            credentials: 'include',
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || 'Error al eliminar la cuenta');
        }
        return result;
    },
};
