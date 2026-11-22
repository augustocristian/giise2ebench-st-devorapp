import { cacheService } from './cacheService';
import { getApiUrl } from './apiConfig';

const API_URL = getApiUrl();

export interface FavoriteList {
    id: number;
    user_id: string;
    name: string;
    icon: string;
}

export interface FavoriteItem {
    id: number;
    list_id: number;
    place_id: string;
    restaurant: any;
}

const CACHE_KEYS = {
    LISTS: 'fav_lists',
    LIST_DETAIL: (id: number) => `fav_list_${id}`,
};

export const favoritesService = {
    getLists: async (): Promise<FavoriteList[]> => {
        const cached = cacheService.get<FavoriteList[]>(CACHE_KEYS.LISTS);
        if (cached) return cached;

        const response = await fetch(`${API_URL}/favorites/lists`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al obtener las listas de favoritos');
        }
        const data = await response.json();
        cacheService.set(CACHE_KEYS.LISTS, data);
        return data;
    },

    createList: async (name: string, icon: string = 'Heart'): Promise<FavoriteList> => {
        const response = await fetch(`${API_URL}/favorites/lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, icon }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al crear la lista');
        }
        const data = await response.json();
        cacheService.invalidate(CACHE_KEYS.LISTS);
        return data;
    },

    updateList: async (listId: number, name: string): Promise<FavoriteList> => {
        const response = await fetch(`${API_URL}/favorites/lists/${listId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name }),
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al actualizar la lista');
        }
        const data = await response.json();
        cacheService.invalidate(CACHE_KEYS.LISTS);
        cacheService.invalidate(CACHE_KEYS.LIST_DETAIL(listId));
        return data;
    },

    deleteList: async (listId: number): Promise<void> => {
        const response = await fetch(`${API_URL}/favorites/lists/${listId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar la lista de favoritos');
        }
        cacheService.invalidate(CACHE_KEYS.LISTS);
        cacheService.invalidate(CACHE_KEYS.LIST_DETAIL(listId));
    },

    getListDetail: async (listId: number): Promise<{ list: FavoriteList; restaurants: FavoriteItem[] }> => {
        const cacheKey = CACHE_KEYS.LIST_DETAIL(listId);
        const cached = cacheService.get<{ list: FavoriteList; restaurants: FavoriteItem[] }>(cacheKey);
        if (cached) return cached;

        const response = await fetch(`${API_URL}/favorites/lists/${listId}`, {
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

    addFavorite: async (listId: number, placeId: string): Promise<FavoriteItem> => {
        const response = await fetch(`${API_URL}/favorites/lists/${listId}/restaurants`, {
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
        cacheService.invalidate(CACHE_KEYS.LIST_DETAIL(listId));
        return data;
    },

    deleteFavorite: async (listId: number, favoriteId: number): Promise<void> => {
        const response = await fetch(`${API_URL}/favorites/lists/${listId}/restaurants/${favoriteId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar de favoritos');
        }
        cacheService.invalidate(CACHE_KEYS.LIST_DETAIL(listId));
    },
};

