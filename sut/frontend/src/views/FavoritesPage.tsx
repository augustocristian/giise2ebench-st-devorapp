import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Heart, Clock, Star, Bookmark, Coffee, Pizza, UtensilsCrossed, Wine,
    Sandwich, Flame, MapPin, Trophy, Smile, ThumbsUp, Gift, Cake,
    ShoppingBag, Moon, Sun, Zap, Plus, MoreVertical, X, Map,
    ChevronLeft, Search
} from 'lucide-react';
import { favoritosService } from '../models/api/favoritosService';
import type { FavoritosList, FavoritoItem } from '../models/api/favoritosService';
import { historialService } from '../models/api/historialService';
import TopBar from '../components/TopBar';
import RestaurantDetailView from '../components/RestaurantDetailView';
import RestaurantCompactCard from '../components/RestaurantCompactCard';
import { useNotification } from '../components/NotificationSystem';

// ── Icon catalogue ────────────────────────────────────────────────────────────
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

// Color palette per icon slot (cycles through 8 colours)
const ICON_COLORS = [
    '#b07d3a', '#5b6af0', '#2ebd7e', '#e05252',
    '#a259e6', '#e0823d', '#3dadd4', '#c4b347',
];

function getIconColor(iconName: string): string {
    const idx = ICONS.findIndex(i => i.name === iconName);
    return ICON_COLORS[idx % ICON_COLORS.length] ?? '#b07d3a';
}

function renderIcon(name: string, size = 22, color = 'white') {
    const found = ICONS.find(i => i.name === name);
    if (!found) return <Heart size={size} color={color} />;
    const IconComp = found.component;
    return <IconComp size={size} color={color} />;
}

// ── New‑list modal ────────────────────────────────────────────────────────────
interface NewListModalProps {
    onClose: () => void;
    onCreate: (nombre: string, icono: string) => Promise<void>;
}

const NewListModal: React.FC<NewListModalProps> = ({ onClose, onCreate }) => {
    const [nombre, setNombre] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('Heart');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) return;
        setSaving(true);
        try {
            await onCreate(nombre.trim(), selectedIcon);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
        }} role="dialog" aria-modal="true">
            <button
                onClick={onClose}
                aria-label="Cerrar"
                type="button"
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'default',
                }}
            />
            <div style={{
                background: 'var(--surface-2)',
                borderRadius: '24px 24px 0 0',
                width: '100%', maxWidth: '600px',
                padding: '1.5rem',
                border: '1px solid var(--border)',
                animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
                {/* Handle */}
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 1.5rem' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Nueva lista</h2>
                    <button onClick={onClose} style={{ background: 'var(--surface-3)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text)' }}>
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Preview */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: 18,
                            background: getIconColor(selectedIcon),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 8px 24px ${getIconColor(selectedIcon)}55`,
                            transition: 'all 0.3s ease',
                        }}>
                            {renderIcon(selectedIcon, 32)}
                        </div>
                    </div>

                    {/* Name input */}
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Nombre de la lista..."
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        maxLength={40}
                        style={{
                            width: '100%', padding: '14px 16px',
                            background: 'var(--surface-3)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                            fontSize: '1rem', marginBottom: '1.5rem',
                            boxSizing: 'border-box',
                        }}
                    />

                    {/* Icon picker */}
                    <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Elige un icono
                    </p>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: '0.6rem', marginBottom: '1.5rem',
                    }}>
                        {ICONS.map(({ name }) => (
                            <button
                                key={name}
                                type="button"
                                onClick={() => setSelectedIcon(name)}
                                style={{
                                    aspectRatio: '1', borderRadius: 14,
                                    background: selectedIcon === name ? getIconColor(name) : 'var(--surface-3)',
                                    border: selectedIcon === name ? 'none' : '1px solid var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                    transform: selectedIcon === name ? 'scale(1.1)' : 'scale(1)',
                                    transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                                    boxShadow: selectedIcon === name ? `0 4px 12px ${getIconColor(name)}55` : 'none',
                                }}
                            >
                                {renderIcon(name, 20, selectedIcon === name ? 'white' : 'var(--muted)')}
                            </button>
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={!nombre.trim() || saving}
                        style={{
                            width: '100%', padding: '14px',
                            background: nombre.trim() ? 'var(--accent)' : 'var(--surface-3)',
                            color: nombre.trim() ? 'white' : 'var(--muted)',
                            border: 'none', borderRadius: 'var(--radius-sm)',
                            fontWeight: 700, fontSize: '1rem', cursor: nombre.trim() ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {saving ? 'Creando...' : 'Crear lista'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ── 3-dot menu ────────────────────────────────────────────────────────────────
interface ListMenuProps {
    onRename: () => void;
    onDelete: () => void;
}

const ListMenu: React.FC<ListMenuProps> = ({ onRename, onDelete }) => {
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
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', padding: '8px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
                <MoreVertical size={18} />
            </button>
            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: '110%',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', minWidth: 140, zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    animation: 'fadeSlideIn 0.15s ease',
                    overflow: 'hidden',
                }}>
                    <button onClick={() => { setOpen(false); onRename(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--font-sm)' }}>
                        <Clock size={14} /> Cambiar nombre
                    </button>
                    <button onClick={() => { setOpen(false); onDelete(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: 'var(--font-sm)' }}>
                        <X size={14} /> Eliminar lista
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Item Menu (for restaurants) ──────────────────────────────────────────────
interface ItemMenuProps {
    onDelete: () => void;
    onHistory: () => void;
    onDetails: () => void;
}

const ItemMenu: React.FC<ItemMenuProps> = ({ onDelete, onHistory, onDetails }) => {
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
                    borderRadius: 8, minWidth: 160, zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    overflow: 'hidden',
                }}>
                    <button onClick={() => { setOpen(false); onDetails(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem' }}>
                        <Map size={14} /> Ver detalles
                    </button>
                    <button onClick={() => { setOpen(false); onHistory(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', fontSize: '0.85rem' }}>
                        <Clock size={14} /> Volver a seleccionar
                    </button>
                    <button onClick={() => { setOpen(false); onDelete(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.85rem' }}>
                        <X size={14} /> Quitar de favoritos
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Sub-component: Favorites Overview ─────────────────────────────────────────
interface FavoritesOverviewProps {
    lists: FavoritosList[];
    loading: boolean;
    error: string | null;
    setShowNewModal: (show: boolean) => void;
    setSearchParams: (params: any) => void;
    handleRename: (list: FavoritosList) => Promise<void>;
    handleDelete: (list: FavoritosList) => Promise<void>;
}

const FavoritesOverview: React.FC<FavoritesOverviewProps> = ({
    lists,
    loading,
    error,
    setShowNewModal,
    setSearchParams,
    handleRename,
    handleDelete,
}) => {
    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: 30, height: 30, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--muted)' }}>Cargando tus listas...</p>
            </div>
        );
    }

    if (error) {
        return <div className="message error">{error}</div>;
    }

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Header */}
            <div style={{ paddingTop: 'var(--space-6)', textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: 'linear-gradient(135deg, #b07d3a, #d4a045)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(176,125,58,0.35)',
                }}>
                    <Heart size={28} color="white" />
                </div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Mis favoritos</h1>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.95rem', color: 'var(--muted)' }}>
                    Tus listas de restaurantes favoritos
                </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: 'var(--font-sm)', color: 'var(--muted)', fontWeight: 500 }}>
                    {lists.length} {lists.length === 1 ? 'lista' : 'listas'}
                </span>
                <button
                    onClick={() => setShowNewModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 18px',
                        background: 'var(--accent)', color: 'white',
                        border: 'none', borderRadius: 'var(--radius-lg)',
                        fontWeight: 700, fontSize: 'var(--font-sm)',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(var(--accent-rgb), 0.4)',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <Plus size={16} /> Nueva lista
                </button>
            </div>

            {lists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--muted)' }}>
                    <Heart size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Aún no tienes listas</p>
                    <p style={{ fontSize: 'var(--font-sm)' }}>Crea tu primera lista para guardar restaurantes favoritos</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {lists.map(list => (
                        <button
                            key={list.id}
                            className="fav-list-card"
                            onClick={() => setSearchParams({ list: list.id.toString() })}
                            aria-label={`Ver lista ${list.nombre}`}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                        >
                            <div className="fav-icon-box" style={{ background: getIconColor(list.icono || 'Heart') }}>
                                {renderIcon(list.icono || 'Heart', 22)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {list.nombre}
                                </div>
                                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', marginTop: 2 }}>
                                    Toca para ver restaurantes
                                </div>
                            </div>
                            <ListMenu
                                onRename={() => handleRename(list)}
                                onDelete={() => handleDelete(list)}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Sub-component: Favorites List Detail ──────────────────────────────────────
interface FavoritesListDetailProps {
    selectedList: FavoritosList;
    favoritos: FavoritoItem[];
    filteredFavoritos: FavoritoItem[];
    modalLoading: boolean;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    setSearchParams: (params: any) => void;
    handleDeleteFavorito: (fav: FavoritoItem) => Promise<void>;
    handleRechooseFavorito: (fav: FavoritoItem) => Promise<void>;
}

const FavoritesListDetail: React.FC<FavoritesListDetailProps> = ({
    selectedList,
    favoritos,
    filteredFavoritos,
    modalLoading,
    searchTerm,
    setSearchTerm,
    setSearchParams,
    handleDeleteFavorito,
    handleRechooseFavorito,
}) => {
    const renderContent = () => {
        if (modalLoading) {
            return (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: 24, height: 24, animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                </div>
            );
        }

        if (filteredFavoritos.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                    {searchTerm ? <Search size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} /> : <Heart size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />}
                    <p>{searchTerm ? 'No hay resultados para tu búsqueda' : 'Esta lista está vacía'}</p>
                </div>
            );
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredFavoritos.map((fav) => {
                    const r = fav.restaurant;
                    return (
                        <RestaurantCompactCard
                            key={fav.id}
                            name={r.name}
                            rating={r.rating}
                            user_ratings_total={r.user_ratings_total}
                            types={r.types}
                            address={r.address}
                            main_photo={r.main_photo}
                            onClick={() => setSearchParams({ list: selectedList.id.toString(), detail: r.id.toString() })}
                            actionSlot={
                                <ItemMenu
                                    onDelete={() => handleDeleteFavorito(fav)}
                                    onHistory={() => handleRechooseFavorito(fav)}
                                    onDetails={() => setSearchParams({ list: selectedList.id.toString(), detail: r.id.toString() })}
                                />
                            }
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fav-detail-view">
            <div className="fav-detail-title-row">
                <div className="fav-large-icon" style={{ background: getIconColor(selectedList.icono || 'Heart') }}>
                    {renderIcon(selectedList.icono || 'Heart', 28)}
                </div>
                <div className="fav-title-info">
                    <h2>{selectedList.nombre}</h2>
                    <p>{favoritos.length} restaurantes guardados</p>
                </div>
            </div>

            <div className="internal-search-box">
                <Search className="search-icon" size={18} />
                <input
                    type="text"
                    placeholder="Buscar en esta lista..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {renderContent()}
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const FavoritesPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [lists, setLists] = useState<FavoritosList[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showNewModal, setShowNewModal] = useState(false);
    const { showNotification, showConfirm } = useNotification();

    // Detail View State
    const [selectedList, setSelectedList] = useState<FavoritosList | null>(null);
    const [favoritos, setFavoritos] = useState<FavoritoItem[]>([]);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<FavoritoItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Load the selected list of favorites if 'list' query param changes
    useEffect(() => {
        const listIdStr = searchParams.get('list');
        const listId = listIdStr ? Number.parseInt(listIdStr, 10) : null;

        if (listId === null) {
            setSelectedList(null);
            setFavoritos([]);
            return;
        }

        const listObj = lists.find(l => l.id === listId);
        if (!listObj) return;

        if (selectedList?.id !== listId) {
            setSelectedList(listObj);
            if (!modalLoading) {
                (async () => {
                    setModalLoading(true);
                    try {
                        const data = await favoritosService.getListaDetalle(listId);
                        setFavoritos(data.restaurantes);
                    } catch (err) {
                        console.error('Error al cargar la lista:', err);
                        alert('Error al cargar la lista');
                        setSearchParams({});
                    } finally {
                        setModalLoading(false);
                    }
                })();
            }
        }
    }, [searchParams, lists, selectedList?.id, modalLoading, setSearchParams]);

    // Sync the detailed restaurant selection if 'detail' query param changes
    useEffect(() => {
        const detailId = searchParams.get('detail');
        if (!detailId) {
            setSelectedEntryForDetail(null);
            return;
        }

        const entry = favoritos.find(f => f.restaurant.id.toString() === detailId);
        setSelectedEntryForDetail(entry ?? null);
    }, [searchParams, favoritos]);

    useEffect(() => {
        const fetchLists = async () => {
            try {
                setLoading(true);
                const data = await favoritosService.getListas();
                setLists(data);
            } catch (err: any) {
                setError(err.message || 'No se pudieron cargar tus listas.');
            } finally {
                setLoading(false);
            }
        };
        fetchLists();
    }, []);

    const handleCreate = async (nombre: string, icono: string) => {
        const nueva = await favoritosService.crearLista(nombre, icono);
        setLists(prev => [...prev, nueva]);
        setShowNewModal(false);
    };

    const handleDelete = async (list: FavoritosList) => {
        const confirmed = await showConfirm(`¿Eliminar la lista "${list.nombre}" y todos sus restaurantes?`, 'Eliminar lista', true);
        if (!confirmed) return;
        try {
            await favoritosService.deleteLista(list.id);
            setLists(prev => prev.filter(l => l.id !== list.id));
            showNotification(`Lista "${list.nombre}" eliminada`, 'success');
            if (selectedList?.id === list.id) setSearchParams({});
        } catch (err: any) {
            showNotification('Error al eliminar: ' + err.message, 'error');
        }
    };

    const handleRename = async (list: FavoritosList) => {
        const nuevoNombre = globalThis.prompt('Nuevo nombre para la lista:', list.nombre);
        if (!nuevoNombre || nuevoNombre.trim() === '' || nuevoNombre === list.nombre) return;
        try {
            await favoritosService.updateLista(list.id, nuevoNombre.trim());
            setLists(prev => prev.map(l => l.id === list.id ? { ...l, nombre: nuevoNombre.trim() } : l));
            if (selectedList?.id === list.id) {
                setSelectedList(prev => prev ? { ...prev, nombre: nuevoNombre.trim() } : null);
            }
        } catch (err: any) {
            showNotification('Error al renombrar: ' + err.message, 'error');
        }
    };

    const handleDeleteFavorito = async (fav: FavoritoItem) => {
        const confirmed = await showConfirm(`¿Quitar ${fav.restaurant.name} de favoritos?`, 'Quitar de favoritos', true);
        if (!confirmed) return;
        try {
            await favoritosService.deleteFavorito(fav.id);
            showNotification(`${fav.restaurant.name} quitado de favoritos`, 'success');
            setFavoritos(prev => prev.filter(item => item.id !== fav.id));
        } catch (err: any) {
            showNotification('Error: ' + err.message, 'error');
        }
    };

    const handleRechooseFavorito = async (fav: FavoritoItem) => {
        try {
            await historialService.addToHistorial(fav.place_id);
            showNotification(`¡Has vuelto a elegir ${fav.restaurant.name}!`, 'success');
            navigate('/home');
        } catch (err: any) {
            showNotification('Error: ' + err.message, 'error');
        }
    };

    const filteredFavoritos = useMemo(() => {
        if (!searchTerm.trim()) return favoritos;
        const lowSearch = searchTerm.toLowerCase();
        return favoritos.filter(fav =>
            fav.restaurant.name.toLowerCase().includes(lowSearch) ||
            fav.restaurant.address.toLowerCase().includes(lowSearch)
        );
    }, [favoritos, searchTerm]);

    return (
        <div className="page-screen">
            {/* ── CONDITIONAL TOPBAR AND CONTENT ── */}
            {selectedEntryForDetail ? (
                <RestaurantDetailView
                    restaurant={selectedEntryForDetail.restaurant as any}
                    onBack={() => navigate(-1)}
                    subtitle={`En lista: ${selectedList?.nombre}`}
                    actions={
                        <div className="detail-actions-column">
                            <button className="btn-detail-main" onClick={async () => {
                                try {
                                    await historialService.addToHistorial(selectedEntryForDetail.place_id);
                                    showNotification(`Has seleccionado ${selectedEntryForDetail.restaurant.name}`, 'success');
                                    navigate('/home');
                                } catch (err: any) {
                                    showNotification('Error al seleccionar: ' + err.message, 'error');
                                }
                            }}>
                                <UtensilsCrossed size={18} /> Volver a seleccionar
                            </button>
                            <button className="btn-detail-outline danger" onClick={async () => {
                                const confirmed = await showConfirm(`¿Quitar ${selectedEntryForDetail.restaurant.name} de favoritos?`, 'Quitar de favoritos', true);
                                if (confirmed) {
                                    try {
                                        await favoritosService.deleteFavorito(selectedEntryForDetail.id);
                                        showNotification(`${selectedEntryForDetail.restaurant.name} quitado de favoritos`, 'success');
                                        setFavoritos(prev => prev.filter(item => item.id !== selectedEntryForDetail.id));
                                        setSearchParams({ list: selectedList?.id.toString() || '' });
                                    } catch (err: any) {
                                        showNotification('Error: ' + err.message, 'error');
                                    }
                                }
                            }}>
                                <X size={16} /> Quitar de la lista
                            </button>
                        </div>
                    }
                />
            ) : (
                <>
                    {selectedList ? (
                        <TopBar
                            showMenu={false}
                            leftSlot={
                                <button className="btn-nav-back" onClick={() => navigate(-1)}>
                                    <ChevronLeft size={20} /> Mis listas
                                </button>
                            }
                        />
                    ) : (
                        <TopBar showMenu={true} />
                    )}

                    <main className="home-body" style={{ padding: '0 var(--space-5) var(--space-8)' }}>
                        {selectedList === null ? (
                            <FavoritesOverview
                                lists={lists}
                                loading={loading}
                                error={error}
                                setShowNewModal={setShowNewModal}
                                setSearchParams={setSearchParams}
                                handleRename={handleRename}
                                handleDelete={handleDelete}
                            />
                        ) : (
                            <FavoritesListDetail
                                selectedList={selectedList}
                                favoritos={favoritos}
                                filteredFavoritos={filteredFavoritos}
                                modalLoading={modalLoading}
                                searchTerm={searchTerm}
                                setSearchTerm={setSearchTerm}
                                setSearchParams={setSearchParams}
                                handleDeleteFavorito={handleDeleteFavorito}
                                handleRechooseFavorito={handleRechooseFavorito}
                            />
                        )}
                    </main>
                </>
            )}

            {/* New list modal */}
            {showNewModal && (
                <NewListModal
                    onClose={() => setShowNewModal(false)}
                    onCreate={handleCreate}
                />
            )}
        </div>
    );
};

export default FavoritesPage;
