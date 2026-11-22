import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ratingsService } from '../models/api/ratingsService';
import { cacheService } from '../models/api/cacheService';

const mockRating = {
    id: 1, user_id: 'uid1', place_id: 'place1',
    quality: 5, price: 4, hygiene: 3, service: 5, comment: 'Excelente', likes: 0
};

const mockDetailedRatings = [
    { ...mockRating, restaurant: { name: 'Restaurante Test', address: 'Calle Falsa 123' } }
];

const mockReviews = [
    { id: 1, username: 'pepe', quality: 5, price: 4, hygiene: 3, service: 5, comment: 'Genial', likes: 2 },
    { id: 2, username: 'ana',  quality: 3, price: 3, hygiene: 4, service: 4, comment: undefined, likes: 0 },
];

describe('ratingsService', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.clearAllMocks();
        cacheService.clear();
    });

    // ── rateRestaurant ──────────────────────────────────────────────────

    it('rateRestaurant should PUT to /restaurants/:place_id/rating without place_id in the body', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockRating,
        });

        const result = await ratingsService.rateRestaurant({
            place_id: 'place1', quality: 5, price: 4, hygiene: 3, service: 5
        });

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/restaurants/place1/rating'),
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({ quality: 5, price: 4, hygiene: 3, service: 5 })
            })
        );
        expect(result.place_id).toBe('place1');
        expect(result.quality).toBe(5);
    });

    it('rateRestaurant should throw if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Error al guardar' }),
        });

        await expect(ratingsService.rateRestaurant({
            place_id: 'place1', quality: 5, price: 4, hygiene: 3, service: 5
        })).rejects.toThrow('Error al guardar');
    });

    // ── getMyRating ─────────────────────────────────────────────────

    it('getMyRating should GET to /restaurants/:place_id/rating', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockRating,
        });

        const result = await ratingsService.getMyRating('place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/restaurants/place1/rating'),
            expect.objectContaining({ credentials: 'include' })
        );
        expect(result?.place_id).toBe('place1');
    });

    it('getMyRating should return null if there is no rating (empty object)', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });

        const result = await ratingsService.getMyRating('place_nuevo');

        expect(result).toBeNull();
    });

    it('getMyRating should throw if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({}),
        });

        await expect(ratingsService.getMyRating('place1')).rejects.toThrow('Error al obtener la valoración');
    });

    // ── getAllMyRatings ─────────────────────────────────────────

    it('getAllMyRatings should GET to /ratings', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ items: mockDetailedRatings, total: 1, limit: 100, offset: 0 }),
        });

        const result = await ratingsService.getAllMyRatings();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/ratings?limit=100&offset=0'),
            expect.objectContaining({ credentials: 'include' })
        );
        expect(result).toHaveLength(1);
        expect(result[0].place_id).toBe('place1');
        expect(result[0].restaurant.name).toBe('Restaurante Test');
    });

    it('getAllMyRatings should throw if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({}),
        });

        await expect(ratingsService.getAllMyRatings()).rejects.toThrow('Error al obtener el historial de valoraciones');
    });

    // ── deleteRating ──────────────────────────────────────────────────

    it('deleteRating should DELETE to /restaurants/:place_id/rating', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await ratingsService.deleteRating('place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/restaurants/place1/rating'),
            expect.objectContaining({ method: 'DELETE', credentials: 'include' })
        );
    });

    it('deleteRating should throw if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Valoración no encontrada' }),
        });

        await expect(ratingsService.deleteRating('place_inexistente')).rejects.toThrow('Valoración no encontrada');
    });

    // ── getRestaurantReviews ───────────────────────────────────────────

    it('getRestaurantReviews should GET to /restaurants/:place_id/ratings', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ items: mockReviews, total: 2, limit: 100, offset: 0 }),
        });

        const result = await ratingsService.getRestaurantReviews('place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/restaurants/place1/ratings?limit=100&offset=0'),
            expect.objectContaining({ credentials: 'include' })
        );
        expect(result).toHaveLength(2);
        expect(result[0].username).toBe('pepe');
        expect(result[0].likes).toBe(2);
        expect(result[1].username).toBe('ana');
    });

    it('getRestaurantReviews should return an empty array if there are no reviews', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
        });

        const result = await ratingsService.getRestaurantReviews('place_nuevo');

        expect(result).toEqual([]);
    });

    it('getRestaurantReviews should throw if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({}),
        });

        await expect(ratingsService.getRestaurantReviews('place1'))
            .rejects.toThrow('Error al obtener las reseñas del restaurante');
    });

    // ── likeReview ──────────────────────────────────────────────────────────

    it('likeReview should POST to /ratings/:id/likes when not liked yet', async () => {
        const updatedReview = { ...mockReviews[0], likes: 3 };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => updatedReview,
        });

        const result = await ratingsService.likeReview(1, false);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/ratings/1/likes'),
            expect.objectContaining({ method: 'POST', credentials: 'include' })
        );
        expect(result?.likes).toBe(3);
        expect(result?.username).toBe('pepe');
    });

    it('likeReview should DELETE /ratings/:id/likes when already liked (204, no body)', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true, status: 204 });

        const result = await ratingsService.likeReview(1, true);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/ratings/1/likes'),
            expect.objectContaining({ method: 'DELETE', credentials: 'include' })
        );
        expect(result).toBeNull();
    });

    it('likeReview should throw if the rating does not exist', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Valoración no encontrada' }),
        });

        await expect(ratingsService.likeReview(9999))
            .rejects.toThrow('Valoración no encontrada');
    });
});


