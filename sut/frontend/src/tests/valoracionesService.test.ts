import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { valoracionesService } from '../models/api/valoracionesService';
import { cacheService } from '../models/api/cacheService';

const mockValoracion = {
    id: 1, user_id: 'uid1', place_id: 'place1',
    calidad: 5, precio: 4, higiene: 3, trato: 5, comentario: 'Excelente', me_gustas: 0
};

const mockValoracionesDetalladas = [
    { ...mockValoracion, restaurant: { name: 'Restaurante Test', address: 'Calle Falsa 123' } }
];

const mockResenas = [
    { id: 1, username: 'pepe', calidad: 5, precio: 4, higiene: 3, trato: 5, comentario: 'Genial', me_gustas: 2 },
    { id: 2, username: 'ana',  calidad: 3, precio: 3, higiene: 4, trato: 4, comentario: undefined, me_gustas: 0 },
];

describe('valoracionesService', () => {
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

    // ── valorarRestaurante ──────────────────────────────────────────────────

    it('valorarRestaurante debe hacer POST a /valoraciones con los datos correctos', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockValoracion,
        });

        const result = await valoracionesService.valorarRestaurante({
            place_id: 'place1', calidad: 5, precio: 4, higiene: 3, trato: 5
        });

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/valoraciones'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ place_id: 'place1', calidad: 5, precio: 4, higiene: 3, trato: 5 })
            })
        );
        expect(result.place_id).toBe('place1');
        expect(result.calidad).toBe(5);
    });

    it('valorarRestaurante debe lanzar error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Error al guardar' }),
        });

        await expect(valoracionesService.valorarRestaurante({
            place_id: 'place1', calidad: 5, precio: 4, higiene: 3, trato: 5
        })).rejects.toThrow('Error al guardar');
    });

    // ── obtenerMiValoracion ─────────────────────────────────────────────────

    it('obtenerMiValoracion debe hacer GET a /valoraciones/:place_id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockValoracion,
        });

        const result = await valoracionesService.obtenerMiValoracion('place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/valoraciones/place1'),
            expect.objectContaining({ credentials: 'include' })
        );
        expect(result?.place_id).toBe('place1');
    });

    it('obtenerMiValoracion debe devolver null si no hay valoración (objeto vacío)', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });

        const result = await valoracionesService.obtenerMiValoracion('place_nuevo');

        expect(result).toBeNull();
    });

    it('obtenerMiValoracion debe lanzar error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({}),
        });

        await expect(valoracionesService.obtenerMiValoracion('place1')).rejects.toThrow('Error al obtener la valoración');
    });

    // ── obtenerTodasMisValoraciones ─────────────────────────────────────────

    it('obtenerTodasMisValoraciones debe hacer GET a /valoraciones', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockValoracionesDetalladas,
        });

        const result = await valoracionesService.obtenerTodasMisValoraciones();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/valoraciones'),
            expect.objectContaining({ credentials: 'include' })
        );
        expect(result).toHaveLength(1);
        expect(result[0].place_id).toBe('place1');
        expect(result[0].restaurant.name).toBe('Restaurante Test');
    });

    it('obtenerTodasMisValoraciones debe lanzar error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({}),
        });

        await expect(valoracionesService.obtenerTodasMisValoraciones()).rejects.toThrow('Error al obtener el historial de valoraciones');
    });

    // ── eliminarValoracion ──────────────────────────────────────────────────

    it('eliminarValoracion debe hacer DELETE a /valoraciones/:place_id', async () => {
        (globalThis.fetch as any).mockResolvedValue({ ok: true });

        await valoracionesService.eliminarValoracion('place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/valoraciones/place1'),
            expect.objectContaining({ method: 'DELETE', credentials: 'include' })
        );
    });

    it('eliminarValoracion debe lanzar error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Valoración no encontrada' }),
        });

        await expect(valoracionesService.eliminarValoracion('place_inexistente')).rejects.toThrow('Valoración no encontrada');
    });

    // ── obtenerResenasRestaurante ───────────────────────────────────────────

    it('obtenerResenasRestaurante debe hacer GET a /valoraciones/restaurante/:place_id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResenas,
        });

        const result = await valoracionesService.obtenerResenasRestaurante('place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/valoraciones/restaurante/place1'),
            expect.objectContaining({ credentials: 'include' })
        );
        expect(result).toHaveLength(2);
        expect(result[0].username).toBe('pepe');
        expect(result[0].me_gustas).toBe(2);
        expect(result[1].username).toBe('ana');
    });

    it('obtenerResenasRestaurante debe devolver array vacío si no hay reseñas', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        const result = await valoracionesService.obtenerResenasRestaurante('place_nuevo');

        expect(result).toEqual([]);
    });

    it('obtenerResenasRestaurante debe lanzar error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({}),
        });

        await expect(valoracionesService.obtenerResenasRestaurante('place1'))
            .rejects.toThrow('Error al obtener las reseñas del restaurante');
    });

    // ── darMeGusta ──────────────────────────────────────────────────────────

    it('darMeGusta debe hacer POST a /valoraciones/:id/like', async () => {
        const updatedResena = { ...mockResenas[0], me_gustas: 3 };
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => updatedResena,
        });

        const result = await valoracionesService.darMeGusta(1);

        expect(globalThis.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/valoraciones/1/like'),
            expect.objectContaining({ method: 'POST', credentials: 'include' })
        );
        expect(result.me_gustas).toBe(3);
        expect(result.username).toBe('pepe');
    });

    it('darMeGusta debe lanzar error si la valoración no existe', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Valoración no encontrada' }),
        });

        await expect(valoracionesService.darMeGusta(9999))
            .rejects.toThrow('Valoración no encontrada');
    });
});


