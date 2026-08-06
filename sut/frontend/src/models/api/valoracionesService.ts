import { cacheService } from './cacheService';
import { getApiUrl } from './apiConfig';

export interface ValoracionCreate {
    place_id: string;
    calidad: number;
    precio: number;
    higiene: number;
    trato: number;
    comentario?: string;
}

export interface ValoracionResponse extends ValoracionCreate {
    id: number;
    user_id: string;
    me_gustas: number;
    fecha: string;
}

export interface ValoracionPublica {
    id: number;
    username: string;
    calidad: number;
    precio: number;
    higiene: number;
    trato: number;
    comentario?: string;
    me_gustas: number;
    ha_dado_me_gusta: boolean;
    fecha: string;
}

export interface ValoracionDetailedResponse {
    id: number;
    place_id: string;
    calidad: number;
    precio: number;
    higiene: number;
    trato: number;
    comentario?: string;
    restaurant: any; 
    fecha: string;
}

const API_URL = getApiUrl();

const CACHE_KEYS = {
    MIS_VALORACIONES: 'mis_valoraciones',
    MI_VALORACION: (placeId: string) => `mi_valoracion_${placeId}`,
    RESENAS_RESTAURANTE: (placeId: string) => `resenas_restaurante_${placeId}`,
};

export const valoracionesService = {
    valorarRestaurante: async (data: ValoracionCreate): Promise<ValoracionResponse> => {
        const response = await fetch(`${API_URL}/valoraciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al guardar la valoración');
        }

        const result = await response.json();
        cacheService.invalidate(CACHE_KEYS.MIS_VALORACIONES);
        cacheService.invalidate(CACHE_KEYS.MI_VALORACION(data.place_id));
        cacheService.invalidate(CACHE_KEYS.RESENAS_RESTAURANTE(data.place_id));
        return result;
    },

    obtenerMiValoracion: async (place_id: string): Promise<ValoracionResponse | null> => {
        const cacheKey = CACHE_KEYS.MI_VALORACION(place_id);
        const cached = cacheService.get<ValoracionResponse>(cacheKey);
        if (cached) return cached;

        const response = await fetch(`${API_URL}/valoraciones/${place_id}`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Error al obtener la valoración');
        }

        const data = await response.json();
        if (Object.keys(data).length === 0) {
            return null;
        }

        cacheService.set(cacheKey, data);
        return data;
    },

    obtenerTodasMisValoraciones: async (): Promise<ValoracionDetailedResponse[]> => {
        const cached = cacheService.get<ValoracionDetailedResponse[]>(CACHE_KEYS.MIS_VALORACIONES);
        if (cached) return cached;

        const response = await fetch(`${API_URL}/valoraciones`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Error al obtener el historial de valoraciones');
        }

        const data = await response.json();
        cacheService.set(CACHE_KEYS.MIS_VALORACIONES, data);
        return data;
    },

    eliminarValoracion: async (place_id: string): Promise<void> => {
        const response = await fetch(`${API_URL}/valoraciones/${place_id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al eliminar la valoración');
        }

        cacheService.invalidate(CACHE_KEYS.MIS_VALORACIONES);
        cacheService.invalidate(CACHE_KEYS.MI_VALORACION(place_id));
        cacheService.invalidate(CACHE_KEYS.RESENAS_RESTAURANTE(place_id));
    },

    obtenerResenasRestaurante: async (place_id: string): Promise<ValoracionPublica[]> => {
        const cacheKey = CACHE_KEYS.RESENAS_RESTAURANTE(place_id);
        const cached = cacheService.get<ValoracionPublica[]>(cacheKey);
        if (cached) return cached;

        const url = `${API_URL}/valoraciones/restaurante/${encodeURIComponent(place_id)}`;
        const parsedUrl = new URL(url, window.location.origin);
        if (!parsedUrl.pathname.startsWith('/api/valoraciones/restaurante/') && !parsedUrl.pathname.startsWith('/valoraciones/restaurante/')) {
            throw new Error('Invalid API endpoint path');
        }

        const response = await fetch(parsedUrl.toString(), {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Error al obtener las reseñas del restaurante');
        }

        const data = await response.json();
        cacheService.set(cacheKey, data);
        return data;
    },

    darMeGusta: async (valoracion_id: number): Promise<ValoracionPublica> => {
        const response = await fetch(`${API_URL}/valoraciones/${valoracion_id}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al dar me gusta');
        }

        const result = await response.json();
        // Since we don't know the place_id from the valoracion_id here without more context,
        // we invalidate all restaurant reviews.
        cacheService.invalidatePattern('resenas_restaurante_');
        return result;
    },
};


