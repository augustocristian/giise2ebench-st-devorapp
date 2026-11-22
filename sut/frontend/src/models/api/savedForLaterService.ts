import { cacheService } from './cacheService';
import { getApiUrl, fetchAllPages } from './apiConfig';

const API_URL = getApiUrl();

export interface SavedForLaterEntry {
    id: string; // Treated as a string in the frontend even if it arrives as an int
    place_id: string;
    user_id?: string;
    name: string;
    rating: number;
    user_ratings_total: number;
    types: string[];
    address: string;
    main_photo?: string;
    summary?: string;
    opening_hours?: string[];
    open_now?: boolean;
    google_maps_uri?: string;
    website_uri?: string;
    phone_number?: string;
    saved_at?: string; // Kept for possible future use, even though the backend does not send it
}

const CACHE_KEYS = {
    SAVED_FOR_LATER: 'saved_for_later',
};

function mapBackendRestaurantToEntry(item: any): SavedForLaterEntry {
    return {
        id: String(item.id),
        name: item.restaurant.name,
        rating: item.restaurant.rating,
        user_ratings_total: item.restaurant.user_ratings_total,
        types: item.restaurant.types,
        address: item.restaurant.address,
        main_photo: item.restaurant.main_photo,
        summary: item.restaurant.summary,
        opening_hours: item.restaurant.opening_hours,
        open_now: item.restaurant.open_now,
        google_maps_uri: item.restaurant.google_maps_uri,
        website_uri: item.restaurant.website_uri,
        phone_number: item.restaurant.phone_number,
        place_id: item.place_id,
    };
}

class SavedForLaterService {
    async getSaved(): Promise<SavedForLaterEntry[]> {
        const cached = cacheService.get<SavedForLaterEntry[]>(CACHE_KEYS.SAVED_FOR_LATER);
        if (cached) return cached;

        const data = await fetchAllPages(`${API_URL}/saved-for-later`, async (response) => {
            const body = await response.json().catch(() => ({}));
            return new Error(body.detail || 'Error al obtener los lugares guardados');
        });

        // Map the backend response (shaped { id, restaurant: {...} }) 
        // to the format the view expects
        const mapped = data.map((item: any) => mapBackendRestaurantToEntry(item));

        cacheService.set(CACHE_KEYS.SAVED_FOR_LATER, mapped);
        return mapped;
    }

    async saveForLater(restaurantData: { place_id: string;[key: string]: any }): Promise<{ entry: SavedForLaterEntry, already_saved: boolean }> {
        const response = await fetch(`${API_URL}/saved-for-later`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ place_id: restaurantData.place_id }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.detail || 'Error al guardar para más tarde');
        }

        const item = await response.json();

        cacheService.invalidate(CACHE_KEYS.SAVED_FOR_LATER);

        // Map the returned data to the view format
        return {
            entry: mapBackendRestaurantToEntry(item),
            already_saved: item.already_saved
        };
    }

    async deleteSaved(entryId: string): Promise<void> {
        const response = await fetch(`${API_URL}/saved-for-later/${entryId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Error al eliminar de guardados');
        }

        cacheService.invalidate(CACHE_KEYS.SAVED_FOR_LATER);
    }
}

export const savedForLaterService = new SavedForLaterService();

