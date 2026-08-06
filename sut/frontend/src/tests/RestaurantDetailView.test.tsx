import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import RestaurantDetailView, { formatTimeRange } from '../components/RestaurantDetailView';

// Mockeamos SideMenu (dependencia transitiva a través de TopBar)
vi.mock('../components/SideMenu', () => ({
    default: () => <div data-testid="mock-side-menu" />,
}));

interface TestRestaurant {
    name: string;
    rating: number;
    user_ratings_total: number;
    types: string[];
    address: string;
    main_photo?: string;
    opening_hours?: string[];
    open_now?: boolean;
    website_uri?: string;
    google_maps_uri?: string;
    phone_number?: string;
}

const BASE_RESTAURANT: TestRestaurant = {
    name: 'Restaurante Test',
    rating: 4.2,
    user_ratings_total: 150,
    types: ['restaurant', 'food'],
    address: 'Calle Mayor 1, Oviedo',
    google_maps_uri: 'https://maps.google.com/?q=test',
    open_now: true,
    opening_hours: [
        'Lunes: 12:00–23:00',
        'Martes: 12:00–23:00',
        'Miércoles: 12:00–23:00',
        'Jueves: 12:00–23:00',
        'Viernes: 12:00–01:00',
        'Sábado: 12:00–01:00',
        'Domingo: 12:00–22:00',
    ],
};

const renderView = (
    overrides: Partial<TestRestaurant> = {},
    extra: { subtitle?: string; backText?: string; actions?: React.ReactNode; onBack?: () => void } = {}
) =>
    render(
        <MemoryRouter>
            <RestaurantDetailView
                restaurant={{ ...BASE_RESTAURANT, ...overrides }}
                onBack={extra.onBack ?? vi.fn()}
                actions={extra.actions ?? <button>Añadir a favoritos</button>}
                subtitle={extra.subtitle}
                backText={extra.backText}
            />
        </MemoryRouter>
    );

describe('RestaurantDetailView', () => {
    // ── Renderizado básico y tipo ─────────────────────────────────────────────

    const renderCases = [
        {
            description: 'renderiza el nombre del restaurante',
            overrides: {},
            extra: {},
            expectedText: 'Restaurante Test',
        },
        {
            description: 'renderiza la dirección',
            overrides: {},
            extra: {},
            expectedText: 'Calle Mayor 1, Oviedo',
        },
        {
            description: 'renderiza el valor numérico del rating',
            overrides: {},
            extra: {},
            expectedText: '4.2',
        },
        {
            description: 'renderiza el número total de valoraciones',
            overrides: {},
            extra: {},
            expectedText: '(150)',
        },
        {
            description: 'renderiza el slot de acciones',
            overrides: {},
            extra: { actions: <button>Acción personalizada</button> },
            expectedText: 'Acción personalizada',
        },
        {
            description: 'muestra el primer type formateado con mayúsculas',
            overrides: { types: ['pizza_restaurant'] },
            extra: {},
            expectedText: 'Pizza Restaurant',
        },
        {
            description: 'muestra "Restaurante" cuando types está vacío',
            overrides: { types: [] },
            extra: {},
            expectedText: 'Restaurante',
        },
    ];

    it.each(renderCases)('$description', ({ overrides, extra, expectedText }) => {
        renderView(overrides, extra);
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    // ── Estado abierto / cerrado ──────────────────────────────────────────────

    it('muestra "Abierto ahora" cuando open_now=true', () => {
        renderView({ open_now: true });
        expect(screen.getByText('Abierto ahora')).toBeInTheDocument();
    });

    it('muestra "Cerrado" cuando open_now=false', () => {
        renderView({ open_now: false });
        expect(screen.getByText('Cerrado')).toBeInTheDocument();
    });

    // ── Imagen del restaurante ────────────────────────────────────────────────

    it('renderiza la imagen cuando main_photo está definido', () => {
        renderView({ main_photo: 'https://example.com/photo.jpg' });
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
        expect(img).toHaveAttribute('alt', 'Restaurante Test');
    });

    it('no renderiza una imagen cuando no hay main_photo', () => {
        renderView({ main_photo: undefined });
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    // ── Botón de volver ───────────────────────────────────────────────────────

    it('llama a onBack al hacer click en el botón de volver', () => {
        const onBack = vi.fn();
        renderView({}, { onBack });
        fireEvent.click(screen.getByText('Atrás'));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('usa "Atrás" como texto por defecto cuando no se pasa backText', () => {
        renderView();
        expect(screen.getByText('Atrás')).toBeInTheDocument();
    });

    it('usa el backText personalizado si se proporciona', () => {
        renderView({}, { backText: 'Volver a Favoritos' });
        expect(screen.getByText('Volver a Favoritos')).toBeInTheDocument();
    });

    // ── Subtitle ─────────────────────────────────────────────────────────────

    it('muestra el subtitle cuando se proporciona', () => {
        renderView({}, { subtitle: 'Visitado el 01/01/2024' });
        expect(screen.getByText('Visitado el 01/01/2024')).toBeInTheDocument();
    });

    it('no muestra subtitle cuando no se proporciona', () => {
        renderView();
        expect(screen.queryByText('Visitado el')).not.toBeInTheDocument();
    });

    // ── Horario de apertura ───────────────────────────────────────────────────

    it('muestra los horarios cuando hoursExpanded es true (por defecto)', () => {
        renderView();
        // Los horarios se renderan en el DOM (la tabla es visible por defecto)
        expect(screen.getByText('Lunes')).toBeInTheDocument();
    });

    it('oculta los horarios al hacer click en el botón toggle', () => {
        renderView();
        // El botón contiene "Horario de apertura" como texto
        const toggleBtn = screen.getByRole('button', { name: /horario de apertura/i });
        fireEvent.click(toggleBtn);
        expect(screen.queryByText('Lunes')).not.toBeInTheDocument();
    });

    it('vuelve a mostrar los horarios al hacer click de nuevo en el toggle', () => {
        renderView();
        const toggleBtn = screen.getByRole('button', { name: /horario de apertura/i });
        fireEvent.click(toggleBtn); // colapsar
        fireEvent.click(toggleBtn); // expandir
        expect(screen.getByText('Lunes')).toBeInTheDocument();
    });

    it('no muestra la tabla de horarios cuando opening_hours no está definido', () => {
        renderView({ opening_hours: undefined });
        // El botón toggle existe pero la tabla está vacía
        expect(screen.queryByText('Lunes')).not.toBeInTheDocument();
    });

    // ── Enlace de teléfono ────────────────────────────────────────────────────

    it('muestra el enlace de llamada cuando phone_number está definido', () => {
        renderView({ phone_number: '+34 985 000 000' });
        const link = screen.getByText('Llamar');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', 'tel:+34985000000');
    });

    it('no muestra el enlace de llamada cuando phone_number no está definido', () => {
        renderView({ phone_number: undefined });
        expect(screen.queryByText('Llamar')).not.toBeInTheDocument();
    });

    // ── Enlace de sitio web ───────────────────────────────────────────────────

    it('muestra el enlace de sitio web cuando website_uri está definido', () => {
        renderView({ website_uri: 'https://restaurante-test.com' });
        const link = screen.getByText('Sitio web');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', 'https://restaurante-test.com');
    });

    it('no muestra el enlace de sitio web cuando website_uri no está definido', () => {
        renderView({ website_uri: undefined });
        expect(screen.queryByText('Sitio web')).not.toBeInTheDocument();
    });

    // ── Google Maps (siempre visible) ─────────────────────────────────────────

    it('siempre muestra el enlace de Google Maps', () => {
        renderView();
        expect(screen.getByText('Google Maps')).toBeInTheDocument();
    });

    // ── Formateador de horarios (formatTimeRange) ──────────────────────────────

    describe('formatTimeRange', () => {
        it('normaliza rangos de horas en formato 12h (AM/PM) a formato 24h', () => {
            expect(formatTimeRange('12:00 PM – 11:30 PM')).toBe('12:00 - 23:30');
            expect(formatTimeRange('12:00 p.m. – 11:30 p.m.')).toBe('12:00 - 23:30');
            expect(formatTimeRange('9:00 AM - 5:00 PM')).toBe('09:00 - 17:00');
            expect(formatTimeRange('9 AM - 5 PM')).toBe('09:00 - 17:00');
        });

        it('reemplaza "24:00" por "00:00" y mantiene el formato 24h', () => {
            expect(formatTimeRange('12:00–24:00')).toBe('12:00 - 00:00');
            expect(formatTimeRange('24:00')).toBe('00:00');
        });

        it('maneja múltiples turnos con comas de manera correcta', () => {
            expect(formatTimeRange('12:00 PM – 4:00 PM, 7:00 PM – 12:00 AM')).toBe('12:00 - 16:00, 19:00 - 00:00');
            expect(formatTimeRange('12:00-16:00,19:00-24:00')).toBe('12:00 - 16:00, 19:00 - 00:00');
        });

        it('no altera palabras descriptivas como Cerrado u Open 24 hours', () => {
            expect(formatTimeRange('Cerrado')).toBe('Cerrado');
            expect(formatTimeRange('Closed')).toBe('Cerrado');
            expect(formatTimeRange('Abierto 24 horas')).toBe('Abierto 24 horas');
        });
    });
});

