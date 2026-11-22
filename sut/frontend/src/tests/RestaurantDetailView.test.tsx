import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import RestaurantDetailView from '../components/RestaurantDetailView';
import { formatTimeRange } from '../components/restaurantTime';

// Mock SideMenu (transitive dependency through TopBar)
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
    // ── Basic rendering and type ─────────────────────────────────────────────

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

    it('shows "Abierto ahora" when open_now=true', () => {
        renderView({ open_now: true });
        expect(screen.getByText('Abierto ahora')).toBeInTheDocument();
    });

    it('shows "Cerrado" when open_now=false', () => {
        renderView({ open_now: false });
        expect(screen.getByText('Cerrado')).toBeInTheDocument();
    });

    // ── Restaurant image ────────────────────────────────────────────────

    it('renders the image when main_photo is defined', () => {
        renderView({ main_photo: 'https://example.com/photo.jpg' });
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
        expect(img).toHaveAttribute('alt', 'Restaurante Test');
    });

    it('does not render an image when there is no main_photo', () => {
        renderView({ main_photo: undefined });
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    // ── Back button ───────────────────────────────────────────────────────

    it('calls onBack when clicking the back button', () => {
        const onBack = vi.fn();
        renderView({}, { onBack });
        fireEvent.click(screen.getByText('Atrás'));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('uses "Atrás" as the default text when backText is not passed', () => {
        renderView();
        expect(screen.getByText('Atrás')).toBeInTheDocument();
    });

    it('uses the custom backText if provided', () => {
        renderView({}, { backText: 'Volver a Favoritos' });
        expect(screen.getByText('Volver a Favoritos')).toBeInTheDocument();
    });

    // ── Subtitle ─────────────────────────────────────────────────────────────

    it('shows the subtitle when provided', () => {
        renderView({}, { subtitle: 'Visitado el 01/01/2024' });
        expect(screen.getByText('Visitado el 01/01/2024')).toBeInTheDocument();
    });

    it('does not show subtitle when not provided', () => {
        renderView();
        expect(screen.queryByText('Visitado el')).not.toBeInTheDocument();
    });

    // ── Opening hours ───────────────────────────────────────────────────

    it('shows the hours when hoursExpanded is true (default)', () => {
        renderView();
        // The hours render in the DOM (the table is visible by default)
        expect(screen.getByText('Lunes')).toBeInTheDocument();
    });

    it('hides the hours when clicking the toggle button', () => {
        renderView();
        // The button contains "Horario de apertura" as text
        const toggleBtn = screen.getByRole('button', { name: /horario de apertura/i });
        fireEvent.click(toggleBtn);
        expect(screen.queryByText('Lunes')).not.toBeInTheDocument();
    });

    it('shows the hours again when clicking the toggle again', () => {
        renderView();
        const toggleBtn = screen.getByRole('button', { name: /horario de apertura/i });
        fireEvent.click(toggleBtn); // colapsar
        fireEvent.click(toggleBtn); // expandir
        expect(screen.getByText('Lunes')).toBeInTheDocument();
    });

    it('does not show the hours table when opening_hours is not defined', () => {
        renderView({ opening_hours: undefined });
        // The toggle button exists but the table is empty
        expect(screen.queryByText('Lunes')).not.toBeInTheDocument();
    });

    // ── Phone link ────────────────────────────────────────────────────

    it('shows the call link when phone_number is defined', () => {
        renderView({ phone_number: '+34 985 000 000' });
        const link = screen.getByText('Llamar');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', 'tel:+34985000000');
    });

    it('does not show the call link when phone_number is not defined', () => {
        renderView({ phone_number: undefined });
        expect(screen.queryByText('Llamar')).not.toBeInTheDocument();
    });

    // ── Website link ───────────────────────────────────────────────────

    it('shows the website link when website_uri is defined', () => {
        renderView({ website_uri: 'https://restaurante-test.com' });
        const link = screen.getByText('Sitio web');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', 'https://restaurante-test.com');
    });

    it('does not show the website link when website_uri is not defined', () => {
        renderView({ website_uri: undefined });
        expect(screen.queryByText('Sitio web')).not.toBeInTheDocument();
    });

    // ── Google Maps (siempre visible) ─────────────────────────────────────────

    it('always shows the Google Maps link', () => {
        renderView();
        expect(screen.getByText('Google Maps')).toBeInTheDocument();
    });

    // ── Hours formatter (formatTimeRange) ──────────────────────────────

    describe('formatTimeRange', () => {
        it('normalizes 12h (AM/PM) time ranges to 24h format', () => {
            expect(formatTimeRange('12:00 PM – 11:30 PM')).toBe('12:00 - 23:30');
            expect(formatTimeRange('12:00 p.m. – 11:30 p.m.')).toBe('12:00 - 23:30');
            expect(formatTimeRange('9:00 AM - 5:00 PM')).toBe('09:00 - 17:00');
            expect(formatTimeRange('9 AM - 5 PM')).toBe('09:00 - 17:00');
        });

        it('replaces "24:00" with "00:00" and keeps the 24h format', () => {
            expect(formatTimeRange('12:00–24:00')).toBe('12:00 - 00:00');
            expect(formatTimeRange('24:00')).toBe('00:00');
        });

        it('handles multiple comma-separated shifts correctly', () => {
            expect(formatTimeRange('12:00 PM – 4:00 PM, 7:00 PM – 12:00 AM')).toBe('12:00 - 16:00, 19:00 - 00:00');
            expect(formatTimeRange('12:00-16:00,19:00-24:00')).toBe('12:00 - 16:00, 19:00 - 00:00');
        });

        it('does not alter descriptive words such as Cerrado or Open 24 hours', () => {
            expect(formatTimeRange('Cerrado')).toBe('Cerrado');
            expect(formatTimeRange('Closed')).toBe('Cerrado');
            expect(formatTimeRange('Abierto 24 horas')).toBe('Abierto 24 horas');
        });
    });
});

