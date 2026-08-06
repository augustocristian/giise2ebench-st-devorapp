import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Autocomplete from "react-google-autocomplete";
import { Star, MapPin, SlidersHorizontal, Heart, Bookmark, UtensilsCrossed } from 'lucide-react';
import TopBar from '../components/TopBar';
import { authService } from '../models/api/authService';
import { recommendationService } from '../models/api/recommendationService';
import { historialService } from '../models/api/historialService';
import { savedForLaterService } from '../models/api/savedForLaterService';
import { valoracionesService } from '../models/api/valoracionesService';
import type { ValoracionPublica } from '../models/api/valoracionesService';
import tagsData from '../data/tags.json';
import RestaurantDetailView from '../components/RestaurantDetailView';
import { useNotification } from '../components/NotificationSystem';

interface Tag {
    id: string;
    label: string;
    category: string;
}

const PRICE_LEVELS = [
    { id: 'PRICE_LEVEL_INEXPENSIVE', level: 1, label: 'Económico' },
    { id: 'PRICE_LEVEL_MODERATE', level: 2, label: 'Moderado' },
    { id: 'PRICE_LEVEL_EXPENSIVE', level: 3, label: 'Caro' },
    { id: 'PRICE_LEVEL_VERY_EXPENSIVE', level: 4, label: 'Exclusivo' }
];

const getCurrencyForCountry = (countryCode: string): string => {
    const currencyMap: Record<string, string> = {
        'ES': '€', 'FR': '€', 'DE': '€', 'IT': '€', 'PT': '€',
        'US': '$', 'MX': '$', 'AR': '$', 'CO': '$', 'CL': '$',
        'GB': '£',
        'JP': '¥',
        'BR': 'R$',
    };
    return currencyMap[countryCode] || '€';
};

const fetchCountryCodeFromLocation = async (ubicacion: string): Promise<string | null> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(ubicacion)}&key=${apiKey}`;
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'maps.googleapis.com') {
        throw new Error('Invalid geocoding service domain');
    }

    const response = await fetch(parsedUrl.toString());
    const data = await response.json();

    if (data.results && data.results.length > 0) {
        const addressComponents = data.results[0].address_components;
        const countryComponent = addressComponents.find((c: any) => c.types.includes('country'));
        if (countryComponent) {
            return countryComponent.short_name;
        }
    }
    return null;
};


interface StarRatingProps {
    rating: number;
}

const StarRating: React.FC<StarRatingProps> = ({ rating }) => {
    return (
        <div style={{ display: 'flex', gap: '1px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{
                    fontSize: '0.65rem',
                    color: i < rating ? '#ffb400' : 'var(--muted)',
                    opacity: i < rating ? 1 : 0.3
                }}>★</span>
            ))}
        </div>
    );
};


interface RestaurantReviewsSectionProps {
    currResenas: any[];
    onLike: (resenaId: number) => void;
    isLoading?: boolean;
}

const RestaurantReviewsSection: React.FC<RestaurantReviewsSectionProps> = ({
    currResenas,
    onLike,
    isLoading = false
}) => {
    if (isLoading) {
        return (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: 'var(--space-8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '1.2rem', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>Reseñas de la comunidad</span>
                </div>
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    Cargando reseñas...
                </div>
            </div>
        );
    }

    const avg = { calidad: 0, precio: 0, higiene: 0, trato: 0 };
    if (currResenas.length > 0) {
        avg.calidad = currResenas.reduce((s: number, r: any) => s + r.calidad, 0) / currResenas.length;
        avg.precio = currResenas.reduce((s: number, r: any) => s + r.precio, 0) / currResenas.length;
        avg.higiene = currResenas.reduce((s: number, r: any) => s + r.higiene, 0) / currResenas.length;
        avg.trato = currResenas.reduce((s: number, r: any) => s + r.trato, 0) / currResenas.length;
    }

    const formatDateStr = (dateString?: string) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'hoy';
        if (diffDays === 1) return 'hace 1 día';
        if (diffDays < 7) return `hace ${diffDays} días`;
        if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semanas`;
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };

    return (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '1.2rem', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>Reseñas de la comunidad</span>
                {currResenas.length > 0 && (
                    <span style={{
                        background: 'rgba(255,255,255,0.1)',
                        color: 'var(--muted)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.6rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                    }}>
                        {currResenas.length}
                    </span>
                )}
            </div>

            {currResenas.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '1.5rem',
                    color: 'var(--muted)', fontSize: '0.875rem',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border)'
                }}>
                    Aún no hay reseñas para este restaurante.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Promedios Card */}
                    <div style={{
                        background: 'var(--surface-2)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem 2rem',
                        border: '1px solid var(--border)'
                    }}>
                        {[
                            { label: 'Calidad', val: avg.calidad },
                            { label: 'Precio', val: avg.precio },
                            { label: 'Higiene', val: avg.higiene },
                            { label: 'Trato', val: avg.trato },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{item.label}</span>
                                    <span style={{ color: 'var(--text)', fontWeight: 700 }}>{item.val.toFixed(1)}</span>
                                </div>
                                <div style={{ width: '100%', height: '4px', background: 'var(--surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(item.val / 5) * 100}%`, height: '100%', background: '#ffb400', borderRadius: '2px' }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Reviews Feed */}
                    <div className="reviews-feed" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {currResenas.map((resena: any) => (
                            <div key={resena.id} className="review-item-card" style={{
                                background: 'var(--surface-2)',
                                padding: '1.5rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                {/* Header: User + Date */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: 'var(--accent)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 700, fontSize: '0.9rem'
                                    }}>
                                        {resena.username?.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                                            {resena.username}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                                            {formatDateStr(resena.fecha)}
                                        </span>
                                    </div>
                                </div>

                                {/* 4 Scores Inline */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                                    gap: '0.6rem 1rem'
                                }}>
                                    {[
                                        { label: 'Calidad', val: resena.calidad },
                                        { label: 'Precio', val: resena.precio },
                                        { label: 'Higiene', val: resena.higiene },
                                        { label: 'Trato', val: resena.trato },
                                    ].map(({ label, val }) => (
                                        <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{label}</span>
                                            <StarRating rating={val} />
                                        </div>
                                    ))}
                                </div>

                                {/* Comment */}
                                {resena.comentario && (
                                    <p style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text)',
                                        lineHeight: '1.4',
                                        margin: 0,
                                        fontStyle: 'italic',
                                        fontWeight: 600
                                    }}>
                                        "{resena.comentario}"
                                    </p>
                                )}

                                {/* Like button right aligned */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onLike(resena.id); }}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '0.25rem 0.5rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            fontSize: '0.8rem',
                                            color: resena.ha_dado_me_gusta ? '#f472b6' : 'var(--muted)',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <Heart size={14} fill={resena.ha_dado_me_gusta ? '#f472b6' : 'transparent'} color={resena.ha_dado_me_gusta ? '#f472b6' : 'var(--muted)'} />
                                        <span style={{ fontWeight: 500, fontSize: '0.75rem' }}>{resena.me_gustas}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


const RestaurantRecommendationPage: React.FC = () => {
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    // Tags Autocomplete
    const [tagInput, setTagInput] = useState('');
    const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [isTagsDropdownOpen, setIsTagsDropdownOpen] = useState(false);

    // Prices
    const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
    const [includeUnconfirmedPrice, setIncludeUnconfirmedPrice] = useState(false);
    const [openNow, setOpenNow] = useState(false);
    const [currencySymbol, setCurrencySymbol] = useState('€');

    // Location
    const [locationMode, setLocationMode] = useState<'preferred' | 'custom'>('preferred');
    const [preferredLocation, setPreferredLocation] = useState('');
    const [customLocation, setCustomLocation] = useState('');

    // Sort
    const [sortBy, setSortBy] = useState<'rating' | 'distance' | 'recommended' | 'reviews'>('recommended');

    // Results logic
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<any>(null);

    // Sync selected entry with URL parameter 'detail'
    useEffect(() => {
        const detailId = searchParams.get('detail');
        if (detailId) {
            // Check if we already have it in results
            const entry = results.find(p => p.id === detailId);
            if (entry) {
                setSelectedEntryForDetail(entry);
                if (!resenasPorRestaurante[detailId]) {
                    fetchResenas(detailId);
                }
            } else {
                setSearchParams({});
            }
        } else {
            setSelectedEntryForDetail(null);
        }
    }, [searchParams, results]);

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Reseñas por restaurante: { [place_id]: ValoracionPublica[] }
    const [resenasPorRestaurante, setResenasPorRestaurante] = useState<Record<string, ValoracionPublica[]>>({});
    const [loadingResenas, setLoadingResenas] = useState<Record<string, boolean>>({});


    useEffect(() => {
        if (!tagInput.trim()) {
            setFilteredTags([]);
            setIsTagsDropdownOpen(false);
            return;
        }

        const lowerInput = tagInput.toLowerCase();
        const availableTags = (tagsData as Tag[]).filter(tag =>
            !selectedTags.some(selected => selected.id === tag.id) &&
            tag.label.toLowerCase().includes(lowerInput)
        );

        setFilteredTags(availableTags);
        setIsTagsDropdownOpen(true);
    }, [tagInput, selectedTags]);

    useEffect(() => {
        if (locationMode === 'preferred') {
            handlePreferredLocationCurrency();
        }
    }, [locationMode]);

    const handleAddTag = (tag: Tag) => {
        setSelectedTags([...selectedTags, tag]);
        setTagInput('');
        setIsTagsDropdownOpen(false);
    };

    const handleRemoveTag = (tagId: string) => {
        setSelectedTags(selectedTags.filter(t => t.id !== tagId));
    };

    const handlePriceToggle = (priceId: string) => {
        if (selectedPrices.includes(priceId)) {
            setSelectedPrices(selectedPrices.filter(p => p !== priceId));
        } else {
            setSelectedPrices([...selectedPrices, priceId]);
        }
    };

    const triggerSearch = async (currentSortBy: string) => {
        setError(null);
        setLoading(true);
        setCurrentPage(1);
        setNextPageToken(null);
        setSelectedEntryForDetail(null);
        setResenasPorRestaurante({});

        const currentSearchLocation = locationMode === 'preferred' ? preferredLocation : customLocation;

        if (!currentSearchLocation) {
            setError('Por favor, selecciona o introduce una ubicación.');
            setLoading(false);
            return;
        }

        try {
            const data = await recommendationService.search({
                categories: selectedTags.map(t => t.id),
                prices: selectedPrices,
                include_unconfirmed_price: includeUnconfirmedPrice,
                open_now: openNow,
                location: currentSearchLocation,
                sort_by: currentSortBy
            });

            setResults(data.results);
            setNextPageToken(data.next_page_token || null);
            setIsPanelCollapsed(true);
        } catch (err: any) {
            setError(err.message || 'Error al buscar recomendaciones');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await triggerSearch(sortBy);
    };

    const handleNextPage = async () => {
        const maxCurrentPages = Math.ceil(results.length / ITEMS_PER_PAGE);
        if (currentPage < maxCurrentPages) {
            setCurrentPage(prev => prev + 1);
            return;
        }

        if (!nextPageToken || loadingMore) return;

        setLoadingMore(true);
        const currentSearchLocation = locationMode === 'preferred' ? preferredLocation : customLocation;

        try {
            const data = await recommendationService.search({
                categories: selectedTags.map(t => t.id),
                prices: selectedPrices,
                include_unconfirmed_price: includeUnconfirmedPrice,
                open_now: openNow,
                location: currentSearchLocation,
                sort_by: sortBy,
                page_token: nextPageToken
            });

            setResults(prev => [...prev, ...data.results]);
            setNextPageToken(data.next_page_token || null);
            setCurrentPage(prev => prev + 1);
        } catch (err: any) {
            console.error("Error al cargar más resultados:", err);
            setError('No se pudieron cargar más resultados.');
        } finally {
            setLoadingMore(false);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    };

    const handleExpandRestaurant = (place: any) => {
        if (place?.id) {
            setSearchParams({ detail: place.id.toString() });
        }
    };

    const fetchResenas = async (placeId: string) => {
        if (!resenasPorRestaurante[placeId]) {
            setLoadingResenas(prev => ({ ...prev, [placeId]: true }));
            try {
                const resenas = await valoracionesService.obtenerResenasRestaurante(placeId);
                setResenasPorRestaurante(prev => ({ ...prev, [placeId]: resenas }));
            } catch (err) {
                console.error('Error fetching reviews:', err);
                setResenasPorRestaurante(prev => ({ ...prev, [placeId]: [] }));
            } finally {
                setLoadingResenas(prev => ({ ...prev, [placeId]: false }));
            }
        }
    };

    const handleMeGusta = async (placeId: string, valoracionId: number) => {
        // Encontrar la reseña actual para saber su estado previo
        const resenaActual = (resenasPorRestaurante[placeId] || []).find(r => r.id === valoracionId);
        if (!resenaActual) return;

        const yaDabaLike = resenaActual.ha_dado_me_gusta;

        // Actualización optimista de la UI
        setResenasPorRestaurante(prev => ({
            ...prev,
            [placeId]: (prev[placeId] || []).map(r =>
                r.id === valoracionId
                    ? {
                        ...r,
                        ha_dado_me_gusta: !yaDabaLike,
                        me_gustas: yaDabaLike ? Math.max(0, r.me_gustas - 1) : r.me_gustas + 1
                    }
                    : r
            )
        }));

        try {
            const updated = await valoracionesService.darMeGusta(valoracionId);
            setResenasPorRestaurante(prev => ({
                ...prev,
                [placeId]: (prev[placeId] || []).map(r =>
                    r.id === updated.id ? updated : r
                )
            }));
        } catch {
            // Revertir en caso de error
            setResenasPorRestaurante(prev => ({
                ...prev,
                [placeId]: (prev[placeId] || []).map(r =>
                    r.id === valoracionId
                        ? {
                            ...r,
                            ha_dado_me_gusta: yaDabaLike,
                            me_gustas: yaDabaLike ? r.me_gustas + 1 : Math.max(0, r.me_gustas - 1)
                        }
                        : r
                )
            }));
        }
    };

    const handlePreferredLocationCurrency = async () => {
        try {
            const userData = await authService.getMe();
            const ubicacion = userData.ubicacion;

            if (ubicacion) {
                const countryCode = await fetchCountryCodeFromLocation(ubicacion);
                const symbol = countryCode ? getCurrencyForCountry(countryCode) : '€';
                setCurrencySymbol(symbol);
                setPreferredLocation(ubicacion);
            } else {
                setCurrencySymbol('€');
                setPreferredLocation('');
            }
        } catch (error) {
            console.error("Error al conectar con FastAPI para obtener el perfil:", error);
            setCurrencySymbol('€');
            // Intentar recuperar la ubicación aunque falle la geocodificación
            try {
                const userData = await authService.getMe();
                if (userData.ubicacion) setPreferredLocation(userData.ubicacion);
            } catch (e) {
                console.error("Error definitivo al obtener ubicación:", e);
            }
        }
    };

    // ── Early Return Detail View ──────────────────────────────────────
    if (selectedEntryForDetail) {
        return (
            <div className="page-screen">
                <div style={{ animation: 'fadeIn 0.2s ease', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <RestaurantDetailView
                        restaurant={selectedEntryForDetail}
                        backText="Resultados"
                        onBack={() => navigate(-1)}
                        actions={
                            <>
                                <div className="detail-actions-column">
                                    <button
                                        onClick={async (_e) => {
                                            try {
                                                await historialService.addToHistorial(selectedEntryForDetail.id);
                                                showNotification(`¡Has seleccionado ${selectedEntryForDetail.name}!`, 'success');
                                                navigate('/home');
                                            } catch (err: any) {
                                                console.error("Error saving to history:", err);
                                                showNotification("Error al guardar en el historial: " + err.message, 'error');
                                            }
                                        }}
                                        className="btn-detail-main"
                                    >
                                        SELECCIONAR ESTE RESTAURANTE
                                    </button>
                                    <button
                                        onClick={async (_e) => {
                                            try {
                                                const response = await savedForLaterService.saveForLater({
                                                    place_id: selectedEntryForDetail.id,
                                                    name: selectedEntryForDetail.name,
                                                    rating: selectedEntryForDetail.rating || 0,
                                                    user_ratings_total: selectedEntryForDetail.user_ratings_total || 0,
                                                    types: selectedEntryForDetail.types || [],
                                                    address: selectedEntryForDetail.address || '',
                                                    main_photo: selectedEntryForDetail.main_photo,
                                                    summary: selectedEntryForDetail.summary,
                                                    opening_hours: selectedEntryForDetail.opening_hours,
                                                    google_maps_uri: selectedEntryForDetail.google_maps_uri,
                                                    website_uri: selectedEntryForDetail.website_uri,
                                                    open_now: (selectedEntryForDetail as any).opening_hours?.open_now || selectedEntryForDetail.open_now
                                                });
                                                if (response.already_saved) {
                                                    showNotification(`Ya tienes guardado ${selectedEntryForDetail.name} para más tarde.`, 'warning');
                                                } else {
                                                    showNotification(`¡Has guardado ${selectedEntryForDetail.name} para más tarde!`, 'success');
                                                }
                                            } catch (err: any) {
                                                console.error("Error saving for later:", err);
                                                showNotification(err.message || "Error al guardar para más tarde.", 'error');
                                            }
                                        }}
                                        type="button"
                                        className="btn-detail-outline"
                                    >
                                        <Bookmark size={16} /> Guardar para más tarde
                                    </button>
                                </div>

                                {/* ── Sección de reseñas ── */}
                                <RestaurantReviewsSection
                                    currResenas={resenasPorRestaurante[selectedEntryForDetail.id] || []}
                                    onLike={(resenaId) => handleMeGusta(selectedEntryForDetail.id, resenaId)}
                                />
                            </>
                        }
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="page-screen">
            {!selectedEntryForDetail && <TopBar showMenu={true} />}

            <main className="home-body" style={{ padding: '0 var(--space-5) var(--space-8)' }}>
                {selectedEntryForDetail && (
                    <RestaurantDetailView
                        restaurant={selectedEntryForDetail}
                        backText="Resultados"
                        onBack={() => setSelectedEntryForDetail(null)}
                        actions={
                            <>
                                <div className="detail-actions-column">
                                    <button
                                        onClick={async (_e) => {
                                            try {
                                                await historialService.addToHistorial(selectedEntryForDetail.id);
                                                showNotification(`Has seleccionado ${selectedEntryForDetail.name}`, 'success');
                                                navigate('/home');
                                            } catch (err: any) {
                                                console.error("Error saving to history:", err);
                                                showNotification("Error al guardar en el historial: " + err.message, 'error');
                                            }
                                        }}
                                        className="btn-detail-main"
                                    >
                                        SELECCIONAR ESTE RESTAURANTE
                                    </button>
                                    <button
                                        onClick={async (_e) => {
                                            try {
                                                const response = await savedForLaterService.saveForLater({
                                                    place_id: selectedEntryForDetail.id,
                                                    name: selectedEntryForDetail.name,
                                                    rating: selectedEntryForDetail.rating || 0,
                                                    user_ratings_total: selectedEntryForDetail.user_ratings_total || 0,
                                                    types: selectedEntryForDetail.types || [],
                                                    address: selectedEntryForDetail.address || '',
                                                    main_photo: selectedEntryForDetail.main_photo,
                                                    summary: selectedEntryForDetail.summary,
                                                    opening_hours: selectedEntryForDetail.opening_hours,
                                                    google_maps_uri: selectedEntryForDetail.google_maps_uri,
                                                    website_uri: selectedEntryForDetail.website_uri,
                                                });
                                                if (response.already_saved) {
                                                    showNotification(`Ya tienes guardado ${selectedEntryForDetail.name} para más tarde.`, 'warning');
                                                } else {
                                                    showNotification(`Has guardado ${selectedEntryForDetail.name} para más tarde`, 'success');
                                                }
                                            } catch (err: any) {
                                                console.error("Error saving for later:", err);
                                                showNotification(err.message || "Error al guardar para más tarde.", 'error');
                                            }
                                        }}
                                        type="button"
                                        className="btn-detail-outline"
                                    >
                                        <Bookmark size={16} /> Guardar para más tarde
                                    </button>
                                </div>

                                {/* ── Sección de reseñas ── */}
                                <RestaurantReviewsSection
                                    currResenas={resenasPorRestaurante[selectedEntryForDetail.id] || []}
                                    onLike={(resenaId) => handleMeGusta(selectedEntryForDetail.id, resenaId)}
                                    isLoading={loadingResenas[selectedEntryForDetail.id]}
                                />
                            </>
                        }
                    />
                )}

                <form onSubmit={handleSubmit} noValidate>


                    {!isPanelCollapsed && (
                        <div style={{ animation: 'fadeSlideIn 0.3s ease', paddingTop: 'var(--space-6)' }}>
                            {/* Header */}
                            <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: '1rem' }}>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text)', letterSpacing: '-0.5px' }}>Recomendador</h2>
                                <p style={{ margin: 0, fontSize: '1rem', color: 'var(--muted)', marginTop: '0.4rem' }}>Encuentra tu próximo lugar favorito</p>
                            </div>

                            {/* Tipo de cocina */}
                            <div style={{ marginBottom: '1.8rem' }}>
                                <label htmlFor="tags-input-field" style={{ fontSize: 'var(--font-sm)', color: 'var(--text)', marginBottom: '0.5rem', display: 'block', fontWeight: 500 }}>Tipo de cocina</label>
                                {selectedTags.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
                                        {selectedTags.map(tag => (
                                            <span key={tag.id} style={{
                                                background: 'rgba(124, 109, 250, 0.15)', color: 'var(--accent-light)',
                                                padding: '6px 12px', borderRadius: '99px', border: '1px solid rgba(124, 109, 250, 0.3)',
                                                fontSize: 'var(--font-sm)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                                            }}>
                                                {tag.label}
                                                <button type="button" onClick={() => handleRemoveTag(tag.id)} style={{ padding: 0, color: 'inherit', fontSize: '1.2rem', lineHeight: '0.5', marginTop: '-2px' }}>&times;</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="tags-input-field"
                                        type="text"
                                        placeholder="+ Añadir tipo de cocina..."
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onFocus={() => { if (tagInput) setIsTagsDropdownOpen(true) }}
                                        style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', color: 'var(--text)', width: '100%', fontSize: 'var(--font-base)' }}
                                    />
                                    {isTagsDropdownOpen && filteredTags.length > 0 && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0,
                                            background: 'var(--surface-2)', border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-sm)', zIndex: 10, maxHeight: '200px',
                                            overflowY: 'auto', marginTop: '0.3rem', boxShadow: 'var(--shadow-md)'
                                        }}>
                                            {filteredTags.map(tag => (
                                                <button key={tag.id}
                                                    onClick={() => handleAddTag(tag)}
                                                    style={{ width: '100%', display: 'block', padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: 'none', border: 'none', borderBottomColor: 'var(--border)', textAlign: 'left' }}
                                                >
                                                    <div style={{ fontWeight: 500, fontSize: 'var(--font-sm)', color: 'var(--text)' }}>{tag.label}</div>
                                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)' }}>{tag.category}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Rango de precios */}
                            <div style={{ marginBottom: '2rem' }}>
                                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text)', marginBottom: '0.5rem', display: 'block', fontWeight: 500 }}>Rango de precios</span>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    {PRICE_LEVELS.map(price => (
                                        <button
                                            key={price.id}
                                            type="button"
                                            onClick={() => handlePriceToggle(price.id)}
                                            style={{
                                                padding: '10px 0',
                                                border: selectedPrices.includes(price.id) ? '1px solid rgba(124, 109, 250, 0.5)' : '1px solid var(--border)',
                                                background: selectedPrices.includes(price.id) ? 'rgba(124, 109, 250, 0.15)' : 'transparent',
                                                borderRadius: 'var(--radius-sm)',
                                                color: selectedPrices.includes(price.id) ? 'var(--accent-light)' : 'var(--muted)',
                                                textAlign: 'center',
                                                fontSize: 'var(--font-sm)',
                                                transition: 'all var(--t-fast)'
                                            }}
                                        >
                                            {currencySymbol.repeat(price.level)}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', color: 'var(--muted)', padding: '0 4px' }}>
                                    <span>Económico</span>
                                    <span>Exclusivo</span>
                                </div>
                            </div>

                            {/* Settings Checkboxes */}
                            <div style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                                <label style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={includeUnconfirmedPrice}
                                        onChange={() => setIncludeUnconfirmedPrice(!includeUnconfirmedPrice)}
                                        style={{ accentColor: 'var(--accent)', transform: 'scale(1.2)', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text)' }}>Incluir sitios sin precio confirmado</span>
                                </label>
                                <label style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={openNow}
                                        onChange={() => setOpenNow(!openNow)}
                                        style={{ accentColor: 'var(--accent)', transform: 'scale(1.2)', cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text)' }}>Solo lugares abiertos ahora</span>
                                </label>
                            </div>

                            {/* Location Settings */}
                            <div style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '2.5rem', display: 'flex', flexDirection: 'column' }}>
                                <label style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="locationMode"
                                        checked={locationMode === 'preferred'}
                                        onChange={() => {
                                            setLocationMode('preferred');
                                            setCustomLocation('');
                                        }}
                                        style={{ accentColor: 'var(--accent)', transform: 'scale(1.2)', cursor: 'pointer' }}
                                    />
                                    <span style={{ display: 'block' }}>
                                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text)', display: 'block', fontWeight: locationMode === 'preferred' ? 600 : 400 }}>Usar ubicación preferida</span>
                                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>{preferredLocation || "Desconocida"}</span>
                                    </span>
                                </label>

                                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="locationMode"
                                            checked={locationMode === 'custom'}
                                            onChange={() => setLocationMode('custom')}
                                            style={{ accentColor: 'var(--accent)', transform: 'scale(1.2)', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text)', fontWeight: locationMode === 'custom' ? 600 : 400 }}>Escoger otra ubicación</span>
                                    </label>

                                    {locationMode === 'custom' && (
                                        <div style={{ paddingLeft: '32px' }}>
                                            <Autocomplete
                                                apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                                                onChange={() => setCustomLocation('')}
                                                onPlaceSelected={(place) => {
                                                    if (place?.formatted_address) {
                                                        setCustomLocation(place.formatted_address);
                                                    }
                                                    if (place?.address_components) {
                                                        const countryComponent = place.address_components.find(
                                                            (c: any) => c.types.includes('country')
                                                        );
                                                        if (countryComponent) {
                                                            const symbol = getCurrencyForCountry(countryComponent.short_name);
                                                            setCurrencySymbol(symbol);
                                                        }
                                                    }
                                                }}
                                                options={{ types: [] }}
                                                className="form-control"
                                                style={{
                                                    background: 'var(--surface-2)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    color: 'var(--text)',
                                                    fontSize: 'var(--font-sm)',
                                                    padding: '12px 14px',
                                                    width: '100%'
                                                }}
                                                placeholder="Ej. Madrid, Barcelona..."
                                                defaultValue={customLocation}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                                    padding: '16px', background: 'rgba(124, 109, 250, 0.15)',
                                    border: '1px solid rgba(124, 109, 250, 0.4)', color: 'var(--accent-light)',
                                    width: '100%', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: 'var(--font-base)',
                                    transition: 'all 0.2s', opacity: loading ? 0.6 : 1
                                }}
                            >
                                {loading ? 'Buscando...' : (
                                    <>
                                        <Star size={20} /> Buscar recomendaciones
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="message error" style={{ marginTop: '1.5rem', background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', border: '1px solid var(--error-border)', borderRadius: 'var(--radius-sm)' }}>
                            {error}
                        </div>
                    )}
                </form>

                {results.length > 0 && isPanelCollapsed && (
                    <div className="filter-chips-row">
                        <div style={{ display: 'flex', gap: 'var(--space-2)', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
                            {selectedTags.map(tag => (
                                <div key={tag.id} className="filter-chip chip-tag read-only">
                                    {tag.label}
                                </div>
                            ))}
                            {selectedPrices.map(p => (
                                <div key={p} className="filter-chip chip-price read-only">
                                    {currencySymbol.repeat(PRICE_LEVELS.find(pl => pl.id === p)?.level || 1)}
                                </div>
                            ))}
                            {openNow && (
                                <div className="filter-chip chip-status read-only">
                                    Abiertos ahora
                                </div>
                            )}
                            <div className="filter-chip chip-location">
                                <MapPin size={14} /> {locationMode === 'preferred' ? preferredLocation || 'Ubicación' : customLocation || 'Ubicación'}
                            </div>
                        </div>
                        <button type="button" className="filter-chip chip-edit" onClick={() => setIsPanelCollapsed(false)}>
                            <SlidersHorizontal size={14} /> Editar
                        </button>
                    </div>
                )}

                {results.length > 0 && (
                    <div style={{ marginTop: '1rem', width: '100%', animation: 'fadeSlideIn 0.3s ease', paddingBottom: '3rem' }}>

                        <div className="results-header-info">
                            <div className="results-title-row">
                                <h2 className="results-title">Sugerencias para ti</h2>
                                <div className="sort-select-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <select
                                        aria-label="Ordenar resultados"
                                        value={sortBy}
                                        onChange={(e) => {
                                            const newSort = e.target.value as any;
                                            setSortBy(newSort);
                                            if (results.length > 0) triggerSearch(newSort);
                                        }}
                                        className="sort-select"
                                        style={{
                                            background: `rgba(255, 255, 255, 0.05) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 0.75rem center`,
                                            backgroundSize: '12px',
                                        }}
                                    >
                                        <option value="recommended">Recomendado</option>
                                        <option value="rating">Mejor valoración</option>
                                        <option value="distance">Cercanía</option>
                                        <option value="reviews">Más populares</option>
                                    </select>
                                </div>
                            </div>
                            <div className="results-count">{results.length} resultados encontrados</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((place: any, index: number) => (
                                <button key={place.id}
                                    className={`suggestion-card ${index === 0 && currentPage === 1 ? 'best-match' : ''}`}
                                    onClick={() => handleExpandRestaurant(place)}
                                    style={{ width: '100%', display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>

                                    {index === 0 && currentPage === 1 && (
                                        <div className="best-match-badge">
                                            <Star size={14} /> Mejor coincidencia
                                        </div>
                                    )}

                                    <div className="card-main-content">
                                        <div className="card-thumb">
                                            {place.main_photo ? (
                                                <img src={place.main_photo} alt={place.name} />
                                            ) : (
                                                <UtensilsCrossed size={24} style={{ opacity: 0.5 }} />
                                            )}
                                        </div>

                                        <div className="card-info">
                                            <div className="card-name">{place.name}</div>
                                            <div className="card-rating-row">
                                                <div style={{ display: 'flex', gap: '1px' }}>
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <span key={`star-${place.id}-${i}`} style={{
                                                            color: i < Math.floor(place.rating || 0) ? '#ffb400' : 'var(--muted)',
                                                            fontSize: '0.8rem',
                                                            opacity: i < Math.floor(place.rating || 0) ? 1 : 0.3
                                                        }}>★</span>
                                                    ))}
                                                </div>
                                                <span className="card-rating-val">{place.rating}</span>
                                                <span className="card-rating-count">({place.user_ratings_total})</span>
                                            </div>
                                            <div className="card-address" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={10} /> {place.address}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <div className={`status-badge ${place.opening_hours?.open_now || place.open_now ? 'status-open' : 'status-closed'}`}>
                                                {place.opening_hours?.open_now || place.open_now ? 'Abierto' : 'Cerrado'}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
                            <button
                                type="button"
                                onClick={handlePrevPage}
                                disabled={currentPage === 1 || loadingMore}
                                className="btn-secondary"
                                style={{
                                    visibility: currentPage === 1 ? 'hidden' : 'visible',
                                    padding: '0.6rem 1.5rem',
                                    minWidth: '100px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                Anterior
                            </button>

                            <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '1rem' }}>
                                {currentPage}
                            </span>

                            <button
                                type="button"
                                onClick={handleNextPage}
                                disabled={loadingMore || (currentPage >= Math.ceil(results.length / ITEMS_PER_PAGE) && !nextPageToken)}
                                className={`btn-secondary${loadingMore ? ' loading' : ''}`}
                                style={{
                                    visibility: (currentPage >= Math.ceil(results.length / ITEMS_PER_PAGE) && !nextPageToken) ? 'hidden' : 'visible',
                                    padding: '0.6rem 1.5rem',
                                    minWidth: '100px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                {loadingMore ? '' : 'Siguiente'}
                            </button>
                        </div>

                        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                            <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" style={{ opacity: 0.7, filter: 'invert(1) grayscale(1)' }} />
                        </div>

                        <style>{`
                            .restaurant-card:hover { background: rgba(0,0,0,0.03) !important; }
                            [data-theme='dark'] .restaurant-card:hover { background: rgba(255,255,255,0.03) !important; }
                        `}</style>
                    </div>
                )}
            </main>
        </div>
    );
};

export default RestaurantRecommendationPage;
