import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { favoritosService } from '../models/api/favoritosService';

const mockListas = [{ id: 1, user_id: 'user1', nombre: 'Favoritos' }];
const mockRestaurantes = [{ id: 1, lista_id: 1, place_id: 'place1', restaurant: {} }];

describe('favoritosService', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.clearAllMocks();
    });

    it('getListas debe hacer GET a /favoritos/listas', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockListas,
        });

        const result = await favoritosService.getListas();

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favoritos/listas'), expect.objectContaining({ method: 'GET' }));
        expect(result).toEqual(mockListas);
    });

    it('crearLista debe hacer POST a /favoritos/listas con nombre', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockListas[0],
        });

        const result = await favoritosService.crearLista('Favoritos');

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favoritos/listas'), expect.objectContaining({ 
            method: 'POST',
            body: JSON.stringify({ nombre: 'Favoritos', icono: 'Heart' })
        }));
        expect(result).toEqual(mockListas[0]);
    });

    it('crearLista debe lanzar error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Ya existe una lista' }),
        });

        await expect(favoritosService.crearLista('Favoritos')).rejects.toThrow('Ya existe una lista');
    });

    it('deleteLista debe hacer DELETE a /favoritos/listas/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
        });

        await favoritosService.deleteLista(1);

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favoritos/listas/1'), expect.objectContaining({ method: 'DELETE' }));
    });

    it('getListaDetalle debe hacer GET a /favoritos/listas/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ lista: mockListas[0], restaurantes: mockRestaurantes }),
        });

        const result = await favoritosService.getListaDetalle(1);

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favoritos/listas/1'), expect.objectContaining({ method: 'GET' }));
        expect(result.lista).toEqual(mockListas[0]);
        expect(result.restaurantes).toEqual(mockRestaurantes);
    });

    it('addFavorito debe hacer POST a /favoritos/listas/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockRestaurantes[0],
        });

        const result = await favoritosService.addFavorito(1, 'place1');

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favoritos/listas/1'), expect.objectContaining({ 
            method: 'POST',
            body: JSON.stringify({ place_id: 'place1' })
        }));
        expect(result).toEqual(mockRestaurantes[0]);
    });

    it('addFavorito debe lanzar error si la respuesta no es ok', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ detail: 'Duplicado' }),
        });

        await expect(favoritosService.addFavorito(1, 'place1')).rejects.toThrow('Duplicado');
    });

    it('deleteFavorito debe hacer DELETE a /favoritos/:id', async () => {
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
        });

        await favoritosService.deleteFavorito(1);

        expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/favoritos/1'), expect.objectContaining({ method: 'DELETE' }));
    });
});
