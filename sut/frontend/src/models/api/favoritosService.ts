import { cacheService } from './cacheService';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface FavoritosList {
    id: number;
    user_id: string;
    nombre: string;
    icono: string;
}

export interface FavoritoItem {
    id: number;
    lista_id: number;
    place_id: string;
    restaurant: any;
}

const CACHE_KEYS = {
    LISTAS: 'fav_listas',
    LISTA_DETALLE: (id: number) => `fav_lista_${id}`,
};

export const favoritosService = {
    getListas: async (): Promise<FavoritosList[]> => {
        const cached = cacheService.get<FavoritosList[]>(CACHE_KEYS.LISTAS);
        if (cached) return cached;

        const response = await fetch(`${API_URL}/favoritos/listas`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al obtener las listas de favoritos');
        }
        const data = await response.json();
        cacheService.set(CACHE_KEYS.LISTAS, data);
        return data;
    },

    crearLista: async (nombre: string, icono: string = 'Heart'): Promise<FavoritosList> => {
        const response = await fetch(`${API_URL}/favoritos/listas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nombre, icono }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al crear la lista');
        }
        const data = await response.json();
        cacheService.invalidate(CACHE_KEYS.LISTAS);
        return data;
    },

    updateLista: async (listaId: number, nombre: string): Promise<FavoritosList> => {
        const response = await fetch(`${API_URL}/favoritos/listas/${listaId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nombre }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al actualizar la lista');
        }
        const data = await response.json();
        cacheService.invalidate(CACHE_KEYS.LISTAS);
        cacheService.invalidate(CACHE_KEYS.LISTA_DETALLE(listaId));
        return data;
    },

    deleteLista: async (listaId: number): Promise<void> => {
        const response = await fetch(`${API_URL}/favoritos/listas/${listaId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar la lista de favoritos');
        }
        cacheService.invalidate(CACHE_KEYS.LISTAS);
        cacheService.invalidate(CACHE_KEYS.LISTA_DETALLE(listaId));
    },

    getListaDetalle: async (listaId: number): Promise<{ lista: FavoritosList; restaurantes: FavoritoItem[] }> => {
        const cacheKey = CACHE_KEYS.LISTA_DETALLE(listaId);
        const cached = cacheService.get<{ lista: FavoritosList; restaurantes: FavoritoItem[] }>(cacheKey);
        if (cached) return cached;

        const response = await fetch(`${API_URL}/favoritos/listas/${listaId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al obtener los favoritos de la lista');
        }
        const data = await response.json();
        cacheService.set(cacheKey, data);
        return data;
    },

    addFavorito: async (listaId: number, placeId: string): Promise<FavoritoItem> => {
        const response = await fetch(`${API_URL}/favoritos/listas/${listaId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ place_id: placeId }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al añadir a favoritos');
        }
        const data = await response.json();
        cacheService.invalidate(CACHE_KEYS.LISTA_DETALLE(listaId));
        return data;
    },

    deleteFavorito: async (favoritoId: number): Promise<void> => {
        const response = await fetch(`${API_URL}/favoritos/${favoritoId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar de favoritos');
        }
        // Invalidate all list details because we don't know which list this favorite belonged to
        // based on the ID alone here (unless we pass it or the API returns it)
        // Alternatively, we can use invalidatePattern
        cacheService.invalidatePattern('fav_lista_');
    },
};

