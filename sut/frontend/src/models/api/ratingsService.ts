import { cacheService } from './cacheService';
import { getApiUrl, fetchAllPages } from './apiConfig';

export interface RatingCreate {
    place_id: string;
    quality: number;
    price: number;
    hygiene: number;
    service: number;
    comment?: string;
}

export interface RatingResponse extends RatingCreate {
    id: number;
    user_id: string;
    likes: number;
    created_at: string;
}

export interface PublicRating {
    id: number;
    username: string;
    quality: number;
    price: number;
    hygiene: number;
    service: number;
    comment?: string;
    likes: number;
    liked_by_me: boolean;
    created_at: string;
}

export interface DetailedRatingResponse {
    id: number;
    place_id: string;
    quality: number;
    price: number;
    hygiene: number;
    service: number;
    comment?: string;
    restaurant: any; 
    created_at: string;
}

const API_URL = getApiUrl();

const CACHE_KEYS = {
    MY_RATINGS: 'my_ratings',
    MY_RATING: (placeId: string) => `my_rating_${placeId}`,
    RESTAURANT_REVIEWS: (placeId: string) => `restaurant_reviews_${placeId}`,
};

export const ratingsService = {
    rateRestaurant: async (data: RatingCreate): Promise<RatingResponse> => {
        const { place_id, ...body } = data;
        // PUT is an idempotent upsert: 201 when created, 200 when replaced
        const response = await fetch(`${API_URL}/restaurants/${encodeURIComponent(place_id)}/rating`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al guardar la valoración');
        }

        const result = await response.json();
        cacheService.invalidate(CACHE_KEYS.MY_RATINGS);
        cacheService.invalidate(CACHE_KEYS.MY_RATING(data.place_id));
        cacheService.invalidate(CACHE_KEYS.RESTAURANT_REVIEWS(data.place_id));
        return result;
    },

    getMyRating: async (place_id: string): Promise<RatingResponse | null> => {
        const cacheKey = CACHE_KEYS.MY_RATING(place_id);
        const cached = cacheService.get<RatingResponse>(cacheKey);
        if (cached) return cached;

        const response = await fetch(`${API_URL}/restaurants/${encodeURIComponent(place_id)}/rating`, {
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

    getAllMyRatings: async (): Promise<DetailedRatingResponse[]> => {
        const cached = cacheService.get<DetailedRatingResponse[]>(CACHE_KEYS.MY_RATINGS);
        if (cached) return cached;

        const data = await fetchAllPages<DetailedRatingResponse>(`${API_URL}/ratings`, () =>
            new Error('Error al obtener el historial de valoraciones'));
        cacheService.set(CACHE_KEYS.MY_RATINGS, data);
        return data;
    },

    deleteRating: async (place_id: string): Promise<void> => {
        const response = await fetch(`${API_URL}/restaurants/${encodeURIComponent(place_id)}/rating`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al eliminar la valoración');
        }

        cacheService.invalidate(CACHE_KEYS.MY_RATINGS);
        cacheService.invalidate(CACHE_KEYS.MY_RATING(place_id));
        cacheService.invalidate(CACHE_KEYS.RESTAURANT_REVIEWS(place_id));
    },

    getRestaurantReviews: async (place_id: string): Promise<PublicRating[]> => {
        const cacheKey = CACHE_KEYS.RESTAURANT_REVIEWS(place_id);
        const cached = cacheService.get<PublicRating[]>(cacheKey);
        if (cached) return cached;

        const url = `${API_URL}/restaurants/${encodeURIComponent(place_id)}/ratings`;
        const parsedUrl = new URL(url, window.location.origin);
        if (!parsedUrl.pathname.startsWith('/api/v1/restaurants/') && !parsedUrl.pathname.startsWith('/restaurants/')) {
            throw new Error('Invalid API endpoint path');
        }

        const data = await fetchAllPages<PublicRating>(parsedUrl.toString(), () =>
            new Error('Error al obtener las reseñas del restaurante'));
        cacheService.set(cacheKey, data);
        return data;
    },

    // `currentlyLiked` is the state BEFORE the click: POST adds the like, DELETE removes it.
    likeReview: async (rating_id: number, currentlyLiked: boolean = false): Promise<PublicRating | null> => {
        const response = await fetch(`${API_URL}/ratings/${rating_id}/likes`, {
            method: currentlyLiked ? 'DELETE' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al dar me gusta');
        }

        // DELETE answers 204 without a body
        const result = response.status === 204 ? null : await response.json();
        // Since we don't know the place_id from the rating_id here without more context,
        // we invalidate all restaurant reviews.
        cacheService.invalidatePattern('restaurant_reviews_');
        return result;
    },
};


