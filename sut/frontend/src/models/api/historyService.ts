import { cacheService } from './cacheService';
import { getApiUrl, fetchAllPages } from './apiConfig';

const API_URL = getApiUrl();

export interface HistoryEntry {
    id: number;
    user_id: string;
    place_id: string;
    accessed_at: string;
}

const CACHE_KEYS = {
    HISTORY: 'history',
};

export const historyService = {
    getHistory: async (): Promise<HistoryEntry[]> => {
        const cached = cacheService.get<HistoryEntry[]>(CACHE_KEYS.HISTORY);
        if (cached) return cached;

        const data = await fetchAllPages<HistoryEntry>(`${API_URL}/history`, async (response) => {
            const body = await response.json().catch(() => ({}));
            return new Error(body.detail || 'Error al obtener el historial');
        });
        cacheService.set(CACHE_KEYS.HISTORY, data);
        return data;
    },

    getPopular: async (location?: string, limit: number = 5): Promise<any[]> => {
        // We don't cache this as it might depend on location and changes often
        const params = new URLSearchParams();
        params.append('limit', String(limit));
        if (location) params.append('location', location);
        const response = await fetch(`${API_URL}/history/popular?${params}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al obtener populares');
        }

        return await response.json();
    },

    addToHistory: async (placeId: string): Promise<HistoryEntry> => {
        const response = await fetch(`${API_URL}/history`, {
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
        cacheService.invalidate(CACHE_KEYS.HISTORY);
        return data;
    },

    deleteFromHistory: async (entryId: string): Promise<void> => {
        const response = await fetch(`${API_URL}/history/${entryId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar del historial');
        }

        cacheService.invalidate(CACHE_KEYS.HISTORY);
    }
};

