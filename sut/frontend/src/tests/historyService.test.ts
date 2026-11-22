import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { historyService } from '../models/api/historyService';
import { cacheService } from '../models/api/cacheService';

const mockHistory = [
    { id: 1, user_id: 'uid1', place_id: 'place1', accessed_at: '2026-01-01', restaurant: { name: 'Restaurante 1' } },
];

describe('historyService', () => {
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

    // ── getHistory ──────────────────────────────────────────────────────────

    it('getHistory should GET to /history', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ items: mockHistory, total: mockHistory.length, limit: 100, offset: 0 }),
        });

        const result = await historyService.getHistory();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/history?limit=100&offset=0'),
            expect.objectContaining({ method: 'GET' })
        );
        expect(result).toEqual(mockHistory);
    });

    it('getHistory returns cache if present (no second fetch call)', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ items: mockHistory, total: mockHistory.length, limit: 100, offset: 0 }),
        });

        await historyService.getHistory();
        await historyService.getHistory();

        // The second call must use the cache, so fetch is called only once
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('getHistory fetches every page until offset + limit >= total', async () => {
        const first = Array.from({ length: 100 }, (_, i) => ({ ...mockHistory[0], id: i + 1 }));
        const second = [{ ...mockHistory[0], id: 101 }];
        (globalThis.fetch as any)
            .mockResolvedValueOnce({ ok: true, json: async () => ({ items: first, total: 101, limit: 100, offset: 0 }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ items: second, total: 101, limit: 100, offset: 100 }) });

        const result = await historyService.getHistory();

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        expect((globalThis.fetch as any).mock.calls[1][0]).toContain('limit=100&offset=100');
        expect(result).toHaveLength(101);
    });

    it('getHistory throws if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'No autorizado' }),
        });

        await expect(historyService.getHistory()).rejects.toThrow('No autorizado');
    });

    // ── getPopular ──────────────────────────────────────────────────────────

    it('getPopular should GET /history/popular', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => [{ id: 'place1', name: 'Popular' }],
        });

        const result = await historyService.getPopular('Madrid', 5);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/history/popular?limit=5&location=Madrid'),
            expect.objectContaining({ method: 'GET' })
        );
        expect(result).toHaveLength(1);
    });

    it('getPopular throws if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Error del servidor' }),
        });

        await expect(historyService.getPopular()).rejects.toThrow('Error del servidor');
    });

    // ── addToHistory ────────────────────────────────────────────────────────

    it('addToHistory should POST to /history with place_id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockHistory[0],
        });

        const result = await historyService.addToHistory('place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/history'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ place_id: 'place1' }),
            })
        );
        expect(result).toEqual(mockHistory[0]);
    });

    it('addToHistory throws if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Error al añadir' }),
        });

        await expect(historyService.addToHistory('place1')).rejects.toThrow('Error al añadir');
    });

    // ── deleteFromHistory ───────────────────────────────────────────────────

    it('deleteFromHistory should DELETE to /history/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await historyService.deleteFromHistory('1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/history/1'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    it('deleteFromHistory throws if the response is not ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'No encontrado' }),
        });

        await expect(historyService.deleteFromHistory('999')).rejects.toThrow('No encontrado');
    });
});
