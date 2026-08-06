import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Clock, Search, Star, UtensilsCrossed, X, MoreVertical,
    Filter, ChevronDown, ChevronRight, Heart, MessageSquare,
    Trash2, Map, Plus, Bookmark, Coffee,
    Pizza, Wine, Sandwich, Flame, MapPin, Trophy, Smile,
    ThumbsUp, Gift, Cake, ShoppingBag, Moon, Sun, Zap,
    HelpCircle, DollarSign, Home, User, ChevronLeft
} from 'lucide-react';
import { historialService } from '../models/api/historialService';
import { favoritosService } from '../models/api/favoritosService';
import { valoracionesService } from '../models/api/valoracionesService';
import type { FavoritosList } from '../models/api/favoritosService';
import TopBar from '../components/TopBar';
import RestaurantCompactCard from '../components/RestaurantCompactCard';
import RestaurantDetailView from '../components/RestaurantDetailView';
import { useNotification } from '../components/NotificationSystem';

interface HistoryEntry {
    id: string;
    name: string;
    rating: number;
    user_ratings_total: number;
    types: string[];
    address: string;
    main_photo?: string;
    summary?: string;
    opening_hours?: string[];
    google_maps_uri?: string;
    website_uri?: string;
    visited_at?: string;
    place_id: string;
}

// ── Icons Logic (Shared with FavoritesPage) ──────────────────────────────────
const ICONS: { name: string; component: React.FC<any> }[] = [
    { name: 'Heart', component: Heart },
    { name: 'Star', component: Star },
    { name: 'Bookmark', component: Bookmark },
    { name: 'Clock', component: Clock },
    { name: 'Coffee', component: Coffee },
    { name: 'Pizza', component: Pizza },
    { name: 'UtensilsCrossed', component: UtensilsCrossed },
    { name: 'Wine', component: Wine },
    { name: 'Sandwich', component: Sandwich },
    { name: 'Flame', component: Flame },
    { name: 'MapPin', component: MapPin },
    { name: 'Trophy', component: Trophy },
    { name: 'Smile', component: Smile },
    { name: 'ThumbsUp', component: ThumbsUp },
    { name: 'Gift', component: Gift },
    { name: 'Cake', component: Cake },
    { name: 'ShoppingBag', component: ShoppingBag },
    { name: 'Moon', component: Moon },
    { name: 'Sun', component: Sun },
    { name: 'Zap', component: Zap },
];

const ICON_COLORS = [
    '#b07d3a', '#5b6af0', '#2ebd7e', '#e05252',
    '#a259e6', '#e0823d', '#3dadd4', '#c4b347',
];

function getIconColor(iconName: string): string {
    const idx = ICONS.findIndex(i => i.name === iconName);
    return ICON_COLORS[idx % ICON_COLORS.length] ?? '#b07d3a';
}

function renderIconComponent(name: string, size = 22, color = 'white') {
    const found = ICONS.find(i => i.name === name);
    if (!found) return <Heart size={size} color={color} />;
    const IconComp = found.component;
    return <IconComp size={size} color={color} />;
}

// ── Item Menu (Actions for history entries) ──────────────────────────────────
interface ItemMenuProps {
    isRated: boolean;
    onRate: () => void;
    onFavorite: () => void;
    onRechoose: () => void;
    onDelete: () => void;
    onDetails: () => void;
}

const ItemMenu: React.FC<ItemMenuProps> = ({ isRated, onRate, onFavorite, onRechoose, onDelete, onDetails }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '6px' }}
            >
                <MoreVertical size={18} />
            </button>
            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: '100%',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 8, minWidth: 180, zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    overflow: 'hidden',
                    animation: 'fadeSlideIn 0.1s ease'
                }}>
                    <button onClick={() => { setOpen(false); onDetails(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem' }}>
                        <Map size={14} /> Ver detalles
                    </button>
                    <button onClick={() => { setOpen(false); onRechoose(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', fontSize: '0.85rem' }}>
                        <UtensilsCrossed size={14} /> Volver a elegir
                    </button>
                    <button onClick={() => { setOpen(false); onFavorite(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem' }}>
                        <Heart size={14} /> Añadir a favoritos
                    </button>
                    <button onClick={() => { setOpen(false); onRate(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: isRated ? 'var(--text)' : 'var(--accent-light)', fontSize: '0.85rem' }}>
                        {isRated ? <MessageSquare size={14} /> : <Star size={14} />} {isRated ? 'Editar reseña' : 'Valorar restaurante'}
                    </button>
                    <button onClick={() => { setOpen(false); onDelete(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.85rem', borderTop: '1px solid var(--border)' }}>
                        <Trash2 size={14} /> Eliminar del historial
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Aspect Stars Row (Reduces nesting level) ──────────────────────────────────
interface AspectStarsRowProps {
    aspect: string;
    ratingVal: { calidad: number; precio: number; higiene: number; trato: number };
    onStarClick: (aspect: string, star: number) => void;
}

const AspectStarsRow: React.FC<AspectStarsRowProps> = ({ aspect, ratingVal, onStarClick }) => {
    return (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    size={22}
                    fill={star <= (ratingVal as any)[aspect] ? "#ffb400" : "transparent"}
                    color={star <= (ratingVal as any)[aspect] ? "#ffb400" : "var(--muted)"}
                    onClick={() => onStarClick(aspect, star)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease', opacity: star <= (ratingVal as any)[aspect] ? 1 : 0.8 }}
                />
            ))}
        </div>
    );
};

// ── Sub-component: History Overview ───────────────────────────────────────────
interface HistoryGroup {
    label: string;
    entries: HistoryEntry[];
}

interface HistoryOverviewProps {
    loading: boolean;
    error: string | null;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: 'all' | 'rated' | 'unrated';
    cycleFilter: () => void;
    historyEntries: HistoryEntry[];
    unratedCount: number;
    groups: [string, HistoryGroup][];
    expandedGroups: Set<string>;
    toggleGroup: (key: string) => void;
    ratedPlaceIds: Set<string>;
    setSearchParams: (params: any) => void;
    handleRateClick: (entry: HistoryEntry) => void;
    handleAddToFavoritesClick: (entry: HistoryEntry) => void;
    handleRechoose: (entry: HistoryEntry) => void;
    handleDeleteFromHistory: (entry: HistoryEntry) => void;
}

const HistoryOverview: React.FC<HistoryOverviewProps> = ({
    loading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    cycleFilter,
    historyEntries,
    unratedCount,
    groups,
    expandedGroups,
    toggleGroup,
    ratedPlaceIds,
    setSearchParams,
    handleRateClick,
    handleAddToFavoritesClick,
    handleRechoose,
    handleDeleteFromHistory,
}) => {
    let statusFilterLabel = 'Filtrar';
    if (statusFilter === 'rated') {
        statusFilterLabel = 'Reseñados';
    } else if (statusFilter === 'unrated') {
        statusFilterLabel = 'Sin reseña';
    }

    return (
        <>
            {/* Header Section */}
            <div style={{ paddingTop: 'var(--space-6)', textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: 'linear-gradient(135deg, #5b6af0, #3dadd4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(91,106,240,0.3)',
                    animation: 'scaleUp 0.3s ease'
                }}>
                    <Clock size={28} color="white" />
                </div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Mi historial</h1>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.95rem', color: 'var(--muted)' }}>
                    Restaurantes que has visitado o seleccionado
                </p>
            </div>

            {/* Search Bar */}
            <div className="history-filter-row">
                <div className="internal-search-box" style={{ flex: 1, marginBottom: 0 }}>
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar en historial..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    className={`history-filter-btn ${statusFilter === 'all' ? '' : 'active'}`}
                    onClick={cycleFilter}
                >
                    <Filter size={16} />
                    {statusFilterLabel}
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: 30, height: 30, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--muted)' }}>Cargando historial...</p>
                </div>
            ) : error ? (
                <div className="message error" style={{ textAlign: 'center', padding: '2rem', color: 'var(--error)' }}>
                    {error}
                </div>
            ) : (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: 'var(--font-sm)', color: 'var(--muted)', fontWeight: 600 }}>
                            {historyEntries.length} restaurantes
                        </span>
                        {unratedCount > 0 && (
                            <div style={{ background: 'rgba(176,125,58,0.1)', color: '#d4a045', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                {unratedCount} sin reseña
                            </div>
                        )}
                    </div>

                    {groups.map(([key, group]) => {
                        const isOpen = expandedGroups.has(key);
                        return (
                            <div key={key}>
                                <button
                                    className="history-group-header"
                                    onClick={() => toggleGroup(key)}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                    <span className="history-group-title">{group.label}</span>
                                    <div className="history-group-meta">
                                        <span>{group.entries.length} restaurantes</span>
                                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </div>
                                </button>

                                {isOpen && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0 1rem' }}>
                                        {group.entries.map((entry) => {
                                            const isRated = ratedPlaceIds.has(entry.place_id);
                                            const visitDate = new Date(entry.visited_at || '');

                                            return (
                                                <RestaurantCompactCard
                                                    key={entry.id}
                                                    name={entry.name}
                                                    rating={entry.rating}
                                                    user_ratings_total={entry.user_ratings_total}
                                                    address={entry.address}
                                                    main_photo={entry.main_photo}
                                                    onClick={() => { if (entry.place_id) setSearchParams({ detail: entry.place_id.toString() }); }}
                                                    metaSlot={<span>• {visitDate.getDate()} {visitDate.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</span>}
                                                    actionSlot={
                                                        <ItemMenu
                                                            isRated={isRated}
                                                            onRate={() => handleRateClick(entry)}
                                                            onFavorite={() => handleAddToFavoritesClick(entry)}
                                                            onRechoose={() => handleRechoose(entry)}
                                                            onDelete={() => handleDeleteFromHistory(entry)}
                                                            onDetails={() => { if (entry.place_id) setSearchParams({ detail: entry.place_id.toString() }); }}
                                                        />
                                                    }
                                                >
                                                    <div style={{ position: 'absolute', top: '10px', right: '35px', zIndex: 10 }}>
                                                        <div className={`rating-status-badge ${isRated ? 'rated' : 'unrated'}`}>
                                                            {isRated ? 'Reseñado' : 'Sin reseñar'}
                                                        </div>
                                                    </div>
                                                </RestaurantCompactCard>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const HistoryPage: React.FC = () => {
    const navigate = useNavigate();
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
    const [ratedPlaceIds, setRatedPlaceIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { showNotification, showConfirm } = useNotification();

    // Filter and Detail state
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'rated' | 'unrated'>('all');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<HistoryEntry | null>(null);

    // Sync detail with URL
    useEffect(() => {
        const detailId = searchParams.get('detail');
        if (detailId) {
            const entry = historyEntries.find(e => e.place_id === detailId);
            if (entry) {
                setSelectedEntryForDetail(entry);
            }
        } else {
            setSelectedEntryForDetail(null);
        }
    }, [searchParams, historyEntries]);

    // Modals state
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [selectedEntryForRating, setSelectedEntryForRating] = useState<HistoryEntry | null>(null);
    const [ratingVal, setRatingVal] = useState({ calidad: 0, precio: 0, higiene: 0, trato: 0 });
    const [ratingComment, setRatingComment] = useState('');

    const [isFavModalOpen, setIsFavModalOpen] = useState(false);
    const [favLists, setFavLists] = useState<FavoritosList[]>([]);
    const [selectedEntryForFav, setSelectedEntryForFav] = useState<HistoryEntry | null>(null);
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [newListName, setNewListName] = useState('Mis Favoritos');
    const [modalLoading, setModalLoading] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

    const handleStarClick = (aspect: string, star: number) => {
        setRatingVal(prev => ({ ...prev, [aspect]: star }));
    };

    const ASPECT_DESCRIPTIONS: Record<string, string> = {
        calidad: "Evalúa la frescura de los ingredientes y el sabor de los platos.",
        precio: "¿Te pareció justa la cuenta en relación a la calidad y cantidad?",
        higiene: "Valora la limpieza de la mesa, los cubiertos y el local en general.",
        trato: "Amabilidad, atención y rapidez del personal del establecimiento."
    };

    const ASPECT_CONFIG: Record<string, { icon: React.FC<any>, class: string }> = {
        calidad: { icon: Heart, class: 'calidad' },
        precio: { icon: DollarSign, class: 'precio' },
        higiene: { icon: Home, class: 'higiene' },
        trato: { icon: User, class: 'trato' }
    };

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const data = await historialService.getHistorial();
                const mappedEntries: HistoryEntry[] = data.map((item: any) => ({
                    id: String(item.id),
                    name: item.restaurant.name,
                    rating: item.restaurant.rating,
                    user_ratings_total: item.restaurant.user_ratings_total,
                    types: item.restaurant.types,
                    address: item.restaurant.address,
                    main_photo: item.restaurant.main_photo,
                    summary: item.restaurant.summary,
                    opening_hours: item.restaurant.opening_hours,
                    google_maps_uri: item.restaurant.google_maps_uri,
                    website_uri: item.restaurant.website_uri,
                    visited_at: item.fecha_acceso,
                    place_id: item.place_id,
                }));
                setHistoryEntries(mappedEntries);

                if (mappedEntries.length > 0) {
                    const firstDate = new Date(mappedEntries[0].visited_at || '');
                    const firstKey = `${firstDate.getMonth()}-${firstDate.getFullYear()}`;
                    setExpandedGroups(new Set([firstKey]));
                }
            } catch (err: any) {
                setError(err.message || "No se pudo cargar el historial.");
            } finally {
                setLoading(false);
            }
        };

        const fetchRatings = async () => {
            try {
                const ratings = await valoracionesService.obtenerTodasMisValoraciones();
                setRatedPlaceIds(new Set(ratings.map(r => r.place_id)));
            } catch (err) {
                console.error("Error fetching ratings:", err);
            }
        };

        fetchHistory();
        fetchRatings();
    }, []);

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const cycleFilter = () => {
        if (statusFilter === 'all') setStatusFilter('unrated');
        else if (statusFilter === 'unrated') setStatusFilter('rated');
        else setStatusFilter('all');
    };

    const groups = useMemo(() => {
        const filtered = historyEntries.filter(entry => {
            const matchesSearch = !searchTerm.trim() ||
                entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.address.toLowerCase().includes(searchTerm.toLowerCase());

            const isRated = ratedPlaceIds.has(entry.place_id);
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'rated' && isRated) ||
                (statusFilter === 'unrated' && !isRated);

            return matchesSearch && matchesStatus;
        });

        const grouped: Record<string, { label: string, entries: HistoryEntry[] }> = {};
        const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

        filtered.forEach(entry => {
            const date = new Date(entry.visited_at || '');
            const key = `${date.getMonth()}-${date.getFullYear()}`;
            if (!grouped[key]) {
                grouped[key] = { label: `${months[date.getMonth()]} ${date.getFullYear()}`, entries: [] };
            }
            grouped[key].entries.push(entry);
        });

        return Object.entries(grouped).sort((a, b) => {
            const [mA, yA] = a[0].split('-').map(Number);
            const [mB, yB] = b[0].split('-').map(Number);
            return (yB * 12 + mB) - (yA * 12 + mA);
        });
    }, [historyEntries, searchTerm, statusFilter, ratedPlaceIds]);

    const unratedCount = useMemo(() => {
        return historyEntries.filter(e => !ratedPlaceIds.has(e.place_id)).length;
    }, [historyEntries, ratedPlaceIds]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleRateClick = async (entry: HistoryEntry) => {
        setSelectedEntryForRating(entry);
        setRatingVal({ calidad: 0, precio: 0, higiene: 0, trato: 0 });
        setRatingComment('');
        setIsRatingModalOpen(true);
        setModalLoading(true);
        try {
            const existingRating = await valoracionesService.obtenerMiValoracion(entry.place_id);
            if (existingRating) {
                setRatingVal({ calidad: existingRating.calidad, precio: existingRating.precio, higiene: existingRating.higiene, trato: existingRating.trato });
                setRatingComment(existingRating.comentario || '');
            }
        } catch (error) {
            console.error("Error fetching existing rating:", error);
        } finally {
            setModalLoading(false);
        }
    };

    const handleRatingSubmit = async () => {
        if (!selectedEntryForRating) return;
        try {
            setModalLoading(true);
            await valoracionesService.valorarRestaurante({
                place_id: selectedEntryForRating.place_id,
                calidad: ratingVal.calidad, precio: ratingVal.precio,
                higiene: ratingVal.higiene, trato: ratingVal.trato,
                comentario: ratingComment
            });
            setRatedPlaceIds(prev => new Set([...prev, selectedEntryForRating.place_id]));
            showNotification(`Gracias por valorar ${selectedEntryForRating.name}`, 'success');
            setIsRatingModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || "Hubo un error al guardar la valoración.", 'error');
        } finally {
            setModalLoading(false);
        }
    };

    const handleAddToFavoritesClick = async (entry: HistoryEntry) => {
        setSelectedEntryForFav(entry);
        setIsFavModalOpen(true);
        setModalLoading(true);
        try {
            const lists = await favoritosService.getListas();
            setFavLists(lists);
            if (lists.length === 0) setIsCreatingList(true);
        } catch (err) {
            console.error("Error fetching fav lists:", err);
        } finally {
            setModalLoading(false);
        }
    };

    const confirmAddToFavorite = async (listId: number) => {
        if (!selectedEntryForFav) return;
        try {
            setModalLoading(true);
            await favoritosService.addFavorito(listId, selectedEntryForFav.place_id);
            showNotification(`${selectedEntryForFav.name} añadido a favoritos`, 'success');
            setIsFavModalOpen(false);
        } catch (err: any) {
            showNotification("Error: " + err.message, 'error');
        } finally {
            setModalLoading(false);
        }
    };

    const handleCreateAndAddToList = async () => {
        if (!selectedEntryForFav || !newListName.trim()) return;
        try {
            setModalLoading(true);
            const newList = await favoritosService.crearLista(newListName.trim());
            await favoritosService.addFavorito(newList.id, selectedEntryForFav.place_id);
            showNotification(`Lista "${newListName}" creada y ${selectedEntryForFav.name} añadido`, 'success');
            setIsFavModalOpen(false);
            setNewListName('Mis Favoritos');
        } catch (err: any) {
            showNotification("Error: " + err.message, 'error');
        } finally {
            setModalLoading(false);
        }
    };

    const handleRechoose = async (entry: HistoryEntry) => {
        try {
            await historialService.addToHistorial(entry.place_id);
            showNotification(`Has vuelto a elegir ${entry.name}`, 'success');
            navigate('/home');
        } catch (err: any) {
            showNotification("Error: " + err.message, 'error');
        }
    };

    const handleDeleteFromHistory = async (entry: HistoryEntry) => {
        const confirmed = await showConfirm(`¿Eliminar ${entry.name} de tu historial?`, 'Eliminar del historial', true);
        if (!confirmed) return;
        try {
            await historialService.deleteFromHistorial(entry.id);
            showNotification(`${entry.name} eliminado del historial`, 'success');
            setHistoryEntries(prev => prev.filter(item => item.id !== entry.id));
            if (selectedEntryForDetail?.id === entry.id) setSearchParams({});
        } catch (err: any) {
            showNotification("Error al eliminar: " + err.message, 'error');
        }
    };

    const renderRatingModal = () => {
        if (!isRatingModalOpen || !selectedEntryForRating) return null;
        const isEdit = ratedPlaceIds.has(selectedEntryForRating.place_id);

        let submitButtonText = 'Enviar valoración';
        if (modalLoading) {
            submitButtonText = 'Guardando...';
        } else if (isEdit) {
            submitButtonText = 'Guardar cambios';
        }

        return (
            <div className="valuation-overlay">
                <TopBar
                    showMenu={false}
                    leftSlot={
                        <button className="btn-nav-back" onClick={() => setIsRatingModalOpen(false)}>
                            <ChevronLeft size={20} />
                            <span>Volver</span>
                        </button>
                    }
                />

                <div className="valuation-content">
                    <div className="valuation-restaurant-info">
                        <div className="valuation-restaurant-icon">
                            <UtensilsCrossed size={28} />
                        </div>
                        <div className="valuation-restaurant-details">
                            <h3>{selectedEntryForRating.name}</h3>
                            <p>Tu valoración sobre este restaurante</p>
                        </div>
                    </div>

                    <div className="aspects-card">
                        {['calidad', 'precio', 'higiene', 'trato'].map((aspect) => {
                            const config = ASPECT_CONFIG[aspect];
                            const IconComp = config.icon;
                            
                            return (
                                <div key={aspect} className="aspect-row-premium">
                                    <div className="aspect-row-left">
                                        <div className={`aspect-icon-box ${config.class}`}>
                                            <IconComp size={20} />
                                        </div>
                                        <div className="aspect-info-premium">
                                            <button 
                                                className="rating-label-with-help"
                                                onClick={() => setActiveTooltip(activeTooltip === aspect ? null : aspect)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                            >
                                                <span className="aspect-name-premium" style={{ textTransform: 'capitalize', marginRight: '0.4rem' }}>
                                                    {aspect}
                                                </span>
                                                <HelpCircle size={12} style={{ color: 'var(--muted)', opacity: 0.6 }} />
                                                
                                                {activeTooltip === aspect && (
                                                    <div className="tooltip-bocadillo">
                                                        {ASPECT_DESCRIPTIONS[aspect]}
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <AspectStarsRow
                                        aspect={aspect}
                                        ratingVal={ratingVal}
                                        onStarClick={handleStarClick}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="comment-section-premium">
                        <label htmlFor="comment-textarea" className="comment-label-premium">Comentario (opcional)</label>
                        <textarea
                            id="comment-textarea"
                            className="textarea-premium"
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            placeholder="Comparte tu experiencia..."
                            rows={4}
                        />
                    </div>

                    <button
                        onClick={handleRatingSubmit}
                        disabled={modalLoading || Object.values(ratingVal).includes(0)}
                        className={`btn-submit-valuation ${Object.values(ratingVal).includes(0) ? '' : 'active'}`}
                    >
                        {submitButtonText}
                    </button>
                </div>
            </div>
        );
    };

    const renderFavModal = () => {
        if (!isFavModalOpen || !selectedEntryForFav) return null;

        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem', backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.4)',
                animation: 'fadeIn 0.2s ease'
            }}>
                <div style={{
                    background: 'var(--surface)', maxWidth: '400px', width: '100%',
                    borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    border: '1px solid var(--border)', overflow: 'hidden', animation: 'scaleUp 0.2s ease'
                }}>
                    <div style={{ padding: '2rem 1.5rem 1.5rem', textAlign: 'center', position: 'relative' }}>
                        <button
                            onClick={() => setIsFavModalOpen(false)}
                            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>

                        <div style={{
                            width: 56, height: 56, borderRadius: 16,
                            background: 'linear-gradient(135deg, #f05b8e, #d43d5c)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.25rem', boxShadow: '0 8px 16px rgba(240,91,142,0.2)'
                        }}>
                            <Heart size={24} color="white" fill="white" />
                        </div>

                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Añadir a favoritos</h3>
                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>Selecciona una lista</p>
                    </div>

                    <div style={{ padding: '0 1.5rem 2rem' }}>
                        {isCreatingList ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.2s ease' }}>
                                <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Nombre de la nueva lista</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newListName}
                                        onChange={(e) => setNewListName(e.target.value)}
                                        placeholder="Ej: Mis favoritos, Para cenar..."
                                        style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text)', fontSize: '1rem', fontWeight: 600, padding: 0, outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={() => setIsCreatingList(false)} className="btn-detail-outline" style={{ flex: 1 }}>Atrás</button>
                                    <button onClick={handleCreateAndAddToList} className="btn-primary" style={{ flex: 2 }}>Crear y añadir</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {favLists.map(list => (
                                    <button
                                        key={list.id}
                                        onClick={() => confirmAddToFavorite(list.id)}
                                        className="restaurant-compact-card"
                                        style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
                                    >
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 8,
                                            background: getIconColor(list.icono),
                                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            {renderIconComponent(list.icono, 18)}
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: '0.95rem' }}>{list.nombre}</div>
                                        <ChevronRight size={16} style={{ opacity: 0.3 }} />
                                    </button>
                                ))}
                                <button
                                    onClick={() => setIsCreatingList(true)}
                                    className="btn-detail-outline"
                                    style={{ width: '100%', borderStyle: 'dashed', color: 'var(--accent-light)', marginTop: '0.4rem' }}
                                >
                                    <Plus size={16} /> Crear nueva lista
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ── Conditional Render (Detail View) ──────────────────────────────────────
    if (selectedEntryForDetail) {
        const visitDate = new Date(selectedEntryForDetail.visited_at || '');
        const visitStr = `Visitado el ${visitDate.getDate()} de ${visitDate.toLocaleDateString('es-ES', { month: 'long' })} de ${visitDate.getFullYear()}`;
        const isRated = ratedPlaceIds.has(selectedEntryForDetail.place_id);

        return (
            <div className="page-screen">
                <RestaurantDetailView
                    restaurant={selectedEntryForDetail}
                    subtitle={visitStr}
                    backText="Historial"
                    onBack={() => navigate(-1)}
                    actions={
                        <div className="detail-actions-column">
                            <button className="btn-detail-main" onClick={() => handleRechoose(selectedEntryForDetail)}>
                                <UtensilsCrossed size={18} /> Volver a seleccionar
                            </button>
                            <div className="btn-detail-secondary-row">
                                <button className="btn-detail-outline" onClick={() => handleAddToFavoritesClick(selectedEntryForDetail)}>
                                    <Heart size={16} /> Añadir a favoritos
                                </button>
                                <button className="btn-detail-outline" onClick={() => handleRateClick(selectedEntryForDetail)}>
                                    <MessageSquare size={16} /> {isRated ? 'Editar reseña' : 'Escribir reseña'}
                                </button>
                            </div>
                            <button className="btn-detail-outline danger" onClick={() => handleDeleteFromHistory(selectedEntryForDetail)}>
                                <Trash2 size={16} /> Eliminar del historial
                            </button>
                        </div>
                    }
                />
                {renderRatingModal()}
                {renderFavModal()}
            </div>
        );
    }

// ── Main List Render ──────────────────────────────────────────────────────
    return (
        <div className="page-screen">
            <TopBar showMenu={true} />

            <main className="home-body" style={{ padding: '0 var(--space-5) var(--space-8)' }}>
                <HistoryOverview
                    loading={loading}
                    error={error}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    cycleFilter={cycleFilter}
                    historyEntries={historyEntries}
                    unratedCount={unratedCount}
                    groups={groups}
                    expandedGroups={expandedGroups}
                    toggleGroup={toggleGroup}
                    ratedPlaceIds={ratedPlaceIds}
                    setSearchParams={setSearchParams}
                    handleRateClick={handleRateClick}
                    handleAddToFavoritesClick={handleAddToFavoritesClick}
                    handleRechoose={handleRechoose}
                    handleDeleteFromHistory={handleDeleteFromHistory}
                />
            </main>
            {renderRatingModal()}
            {renderFavModal()}
        </div>
    );
};

export default HistoryPage;
