import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { savedForLaterService } from '../models/api/savedForLaterService';
import { cacheService } from '../models/api/cacheService';

const mockBackendItem = {
    id: 1,
    place_id: 'place1',
    user_id: 'uid1',
    already_saved: false,
    restaurant: {
        name: 'Restaurante 1',
        rating: 4.5,
        user_ratings_total: 100,
        types: ['restaurant'],
        address: 'Calle 123',
        main_photo: 'photo.jpg',
        summary: 'Muy bueno',
        opening_hours: ['Lun-Vie 9:00-22:00'],
        open_now: true,
        google_maps_uri: 'https://maps.google.com',
        website_uri: 'https://restaurante.com',
        phone_number: '+34 123 456 789',
    },
};

describe('savedForLaterService', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn();
        cacheService.clear();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.clearAllMocks();
    });

    // ── getSaved ──────────────────────────────────────────────────────────────

    it('getSaved debe hacer GET a /mas-tarde y mapear la respuesta', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => [mockBackendItem],
        });

        const result = await savedForLaterService.getSaved();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/mas-tarde'),
            expect.objectContaining({ method: 'GET' })
        );
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
        expect(result[0].name).toBe('Restaurante 1');
        expect(result[0].place_id).toBe('place1');
    });

    it('getSaved devuelve caché si existe (sin segunda llamada a fetch)', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => [mockBackendItem],
        });

        await savedForLaterService.getSaved();
        await savedForLaterService.getSaved();

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('getSaved lanza error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'No autorizado' }),
        });

        await expect(savedForLaterService.getSaved()).rejects.toThrow('No autorizado');
    });

    // ── saveForLater ──────────────────────────────────────────────────────────

    it('saveForLater debe hacer POST a /mas-tarde con place_id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ ...mockBackendItem, already_saved: false }),
        });

        const result = await savedForLaterService.saveForLater({ place_id: 'place1' });

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/mas-tarde'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ place_id: 'place1' }),
            })
        );
        expect(result.entry.place_id).toBe('place1');
        expect(result.already_saved).toBe(false);
    });

    it('saveForLater indica already_saved=true si ya estaba guardado', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ ...mockBackendItem, already_saved: true }),
        });

        const result = await savedForLaterService.saveForLater({ place_id: 'place1' });

        expect(result.already_saved).toBe(true);
    });

    it('saveForLater lanza error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Error al guardar' }),
        });

        await expect(savedForLaterService.saveForLater({ place_id: 'place1' })).rejects.toThrow('Error al guardar');
    });

    // ── deleteSaved ───────────────────────────────────────────────────────────

    it('deleteSaved debe hacer DELETE a /mas-tarde/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await savedForLaterService.deleteSaved('1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/mas-tarde/1'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    it('deleteSaved lanza error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'No encontrado' }),
        });

        await expect(savedForLaterService.deleteSaved('999')).rejects.toThrow('No encontrado');
    });
});
