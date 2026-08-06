import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { historialService } from '../models/api/historialService';
import { cacheService } from '../models/api/cacheService';

const mockHistorial = [
    { id: 1, user_id: 'uid1', place_id: 'place1', fecha_acceso: '2026-01-01', restaurant: { name: 'Restaurante 1' } },
];

describe('historialService', () => {
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

    // ── getHistorial ──────────────────────────────────────────────────────────

    it('getHistorial debe hacer GET a /historial', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockHistorial,
        });

        const result = await historialService.getHistorial();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/historial'),
            expect.objectContaining({ method: 'GET' })
        );
        expect(result).toEqual(mockHistorial);
    });

    it('getHistorial devuelve caché si existe (sin segunda llamada a fetch)', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockHistorial,
        });

        await historialService.getHistorial();
        await historialService.getHistorial();

        // La segunda llamada debe usar caché, por tanto fetch solo se llama una vez
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('getHistorial lanza error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'No autorizado' }),
        });

        await expect(historialService.getHistorial()).rejects.toThrow('No autorizado');
    });

    // ── getPopulares ──────────────────────────────────────────────────────────

    it('getPopulares debe hacer POST a /historial/populares', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => [{ id: 'place1', name: 'Popular' }],
        });

        const result = await historialService.getPopulares('Madrid', 5);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/historial/populares'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ location: 'Madrid', limit: 5 }),
            })
        );
        expect(result).toHaveLength(1);
    });

    it('getPopulares lanza error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Error del servidor' }),
        });

        await expect(historialService.getPopulares()).rejects.toThrow('Error del servidor');
    });

    // ── addToHistorial ────────────────────────────────────────────────────────

    it('addToHistorial debe hacer POST a /historial con place_id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockHistorial[0],
        });

        const result = await historialService.addToHistorial('place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/historial'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ place_id: 'place1' }),
            })
        );
        expect(result).toEqual(mockHistorial[0]);
    });

    it('addToHistorial lanza error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Error al añadir' }),
        });

        await expect(historialService.addToHistorial('place1')).rejects.toThrow('Error al añadir');
    });

    // ── deleteFromHistorial ───────────────────────────────────────────────────

    it('deleteFromHistorial debe hacer DELETE a /historial/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await historialService.deleteFromHistorial('1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/historial/1'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    it('deleteFromHistorial lanza error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'No encontrado' }),
        });

        await expect(historialService.deleteFromHistorial('999')).rejects.toThrow('No encontrado');
    });
});
