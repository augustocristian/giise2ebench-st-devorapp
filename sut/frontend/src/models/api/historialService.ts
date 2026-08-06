import { cacheService } from './cacheService';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface HistorialEntry {
    id: number;
    user_id: string;
    place_id: string;
    fecha_acceso: string;
}

const CACHE_KEYS = {
    HISTORIAL: 'historial',
};

export const historialService = {
    getHistorial: async (): Promise<HistorialEntry[]> => {
        const cached = cacheService.get<HistorialEntry[]>(CACHE_KEYS.HISTORIAL);
        if (cached) return cached;

        const response = await fetch(`${API_URL}/historial`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al obtener el historial');
        }

        const data = await response.json();
        cacheService.set(CACHE_KEYS.HISTORIAL, data);
        return data;
    },

    getPopulares: async (location?: string, limit: number = 5): Promise<any[]> => {
        // We don't cache this as it might depend on location and changes often
        const response = await fetch(`${API_URL}/historial/populares`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location, limit }),
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al obtener populares');
        }

        return await response.json();
    },

    addToHistorial: async (placeId: string): Promise<HistorialEntry> => {
        const response = await fetch(`${API_URL}/historial`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ place_id: placeId }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al añadir al historial');
        }

        const data = await response.json();
        cacheService.invalidate(CACHE_KEYS.HISTORIAL);
        return data;
    },

    deleteFromHistorial: async (entryId: string): Promise<void> => {
        const response = await fetch(`${API_URL}/historial/${entryId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar del historial');
        }

        cacheService.invalidate(CACHE_KEYS.HISTORIAL);
    }
};

