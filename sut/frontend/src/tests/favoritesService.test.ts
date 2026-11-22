import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { favoritesService } from '../models/api/favoritesService';

const mockLists = [{ id: 1, user_id: 'user1', name: 'Favoritos' }];
const mockRestaurantes = [{ id: 1, list_id: 1, place_id: 'place1', restaurant: {} }];

describe('favoritesService', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.clearAllMocks();
    });

    it('getLists should GET to /favorites/lists', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockLists,
        });

        const result = await favoritesService.getLists();

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favorites/lists'), expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(mockLists);
    });

    it('createList should POST to /favorites/lists with name', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockLists[0],
        });

        const result = await favoritesService.createList('Favoritos');

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favorites/lists'), expect.objectContaining({ 
            method: 'POST',
            body: JSON.stringify({ name: 'Favoritos', icon: 'Heart' })
        }));
        expect(result).toEqual(mockLists[0]);
    });

    it('createList should throw if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Ya existe una lista' }),
        });

        await expect(favoritesService.createList('Favoritos')).rejects.toThrow('Ya existe una lista');
    });

    it('deleteList should DELETE to /favorites/lists/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
        });

        await favoritesService.deleteList(1);

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favorites/lists/1'), expect.objectContaining({ method: 'DELETE' }));
    });

    it('getListDetail should GET to /favorites/lists/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ list: mockLists[0], restaurants: mockRestaurantes }),
        });

        const result = await favoritesService.getListDetail(1);

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favorites/lists/1'), expect.objectContaining({ method: 'GET' }));
        expect(result.list).toEqual(mockLists[0]);
        expect(result.restaurants).toEqual(mockRestaurantes);
    });

    it('addFavorite should POST to /favorites/lists/:id/restaurants', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockRestaurantes[0],
        });

        const result = await favoritesService.addFavorite(1, 'place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favorites/lists/1'), expect.objectContaining({ 
            method: 'POST',
            body: JSON.stringify({ place_id: 'place1' })
        }));
        expect(result).toEqual(mockRestaurantes[0]);
    });

    it('addFavorite should throw if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Duplicado' }),
        });

        await expect(favoritesService.addFavorite(1, 'place1')).rejects.toThrow('Duplicado');
    });

    it('deleteFavorite should DELETE to /favorites/lists/:listId/restaurants/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
        });

        await favoritesService.deleteFavorite(2, 1);

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favorites/lists/2/restaurants/1'), expect.objectContaining({ method: 'DELETE' }));
    });
});
