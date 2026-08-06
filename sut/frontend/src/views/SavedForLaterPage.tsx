import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Clock, Search, UtensilsCrossed, X, MoreVertical,
    Map, Trash2, Bookmark
} from 'lucide-react';
import { savedForLaterService } from '../models/api/savedForLaterService';
import type { SavedForLaterEntry } from '../models/api/savedForLaterService';
import { historialService } from '../models/api/historialService';
import TopBar from '../components/TopBar';
import RestaurantDetailView from '../components/RestaurantDetailView';
import RestaurantCompactCard from '../components/RestaurantCompactCard';
import { useNotification } from '../components/NotificationSystem';

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
                    animation: 'fadeSlideIn 0.1s ease'
                }}>
                    <button onClick={() => { setOpen(false); onDetails(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem' }}>
                        <Map size={14} /> Ver detalles
                    </button>
                    <button onClick={() => { setOpen(false); onHistory(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-light)', fontSize: '0.85rem' }}>
                        <Clock size={14} /> Volver a seleccionar
                    </button>
                    <button onClick={() => { setOpen(false); onDelete(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.85rem' }}>
                        <X size={14} /> Quitar de la lista
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const SavedForLaterPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [savedEntries, setSavedEntries] = useState<SavedForLaterEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEntryForDetail, setSelectedEntryForDetail] = useState<SavedForLaterEntry | null>(null);
    const { showNotification, showConfirm } = useNotification();

    // Sync selected entry with URL parameter 'detail'
    useEffect(() => {
        const detailId = searchParams.get('detail');
        if (detailId) {
            const entry = savedEntries.find(e => e.id === detailId);
            if (entry) {
                setSelectedEntryForDetail(entry);
            }
        } else {
            setSelectedEntryForDetail(null);
        }
    }, [searchParams, savedEntries]);

    useEffect(() => {
        const fetchSaved = async () => {
            try {
                setLoading(true);
                const data = await savedForLaterService.getSaved();
                setSavedEntries(data);
            } catch (err: any) {
                setError(err.message || "No se pudieron cargar los lugares guardados.");
            } finally {
                setLoading(false);
            }
        };
        fetchSaved();
    }, []);

    const handleRemoveEntry = async (id: string) => {
        try {
            await savedForLaterService.deleteSaved(id);
            setSavedEntries(prev => prev.filter(item => item.id !== id));
        } catch (err: any) {
            showNotification("Error al eliminar: " + err.message, 'error');
        }
    };

    const filteredEntries = useMemo(() => {
        if (!searchTerm.trim()) return savedEntries;
        const lowSearch = searchTerm.toLowerCase();
        return savedEntries.filter(entry =>
            entry.name.toLowerCase().includes(lowSearch) ||
            entry.address.toLowerCase().includes(lowSearch)
        );
    }, [savedEntries, searchTerm]);

    const renderMainContent = () => {
        if (loading) {
            return (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: 30, height: 30, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--muted)' }}>Cargando lugares pendientes...</p>
                </div>
            );
        }

        if (error) {
            return <div className="message error">{error}</div>;
        }

        return (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
                {/* Summary Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--muted)', fontWeight: 600 }}>
                        {savedEntries.length} {savedEntries.length === 1 ? 'restaurante pendiente' : 'restaurantes pendientes'}
                    </span>
                </div>

                {/* List Content */}
                {savedEntries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
                        <Bookmark size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Tu lista está vacía</p>
                        <p style={{ fontSize: 'var(--font-sm)' }}>Guarda restaurantes desde las recomendaciones para verlos aquí.</p>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                        <Search size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>No hay resultados para "{searchTerm}"</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {filteredEntries.map((entry: any) => (
                            <RestaurantCompactCard
                                key={entry.id}
                                name={entry.name}
                                rating={entry.rating}
                                user_ratings_total={entry.user_ratings_total}
                                types={entry.types}
                                address={entry.address}
                                main_photo={entry.main_photo}
                                onClick={() => { if (entry.id) setSearchParams({ detail: entry.id.toString() }); }}
                                actionSlot={
                                    <ItemMenu
                                        onDelete={async () => {
                                            const confirmed = await showConfirm(`¿Quitar ${entry.name}?`, 'Quitar lugar', true);
                                            if (confirmed) {
                                                await handleRemoveEntry(entry.id);
                                                showNotification(`${entry.name} quitado de la lista`, 'success');
                                            }
                                        }}
                                        onHistory={async () => {
                                            try {
                                                await historialService.addToHistorial(entry.place_id);
                                                await handleRemoveEntry(entry.id);
                                                showNotification(`Has elegido ${entry.name}`, 'success');
                                                navigate('/home');
                                            } catch (err: any) {
                                                showNotification("Error: " + err.message, 'error');
                                            }
                                        }}
                                        onDetails={() => { if (entry.id) setSearchParams({ detail: entry.id.toString() }); }}
                                    />
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (selectedEntryForDetail) {
        return (
            <div className="page-screen">
                <RestaurantDetailView
                    restaurant={selectedEntryForDetail as any}
                    onBack={() => navigate(-1)}
                    actions={
                        <div className="detail-actions-column">
                            <button
                                onClick={async () => {
                                    try {
                                        await historialService.addToHistorial(selectedEntryForDetail.place_id);
                                        await handleRemoveEntry(selectedEntryForDetail.id);
                                        showNotification(`Has seleccionado ${selectedEntryForDetail.name}`, 'success');
                                        navigate('/home');
                                    } catch (err: any) {
                                        showNotification("Error al seleccionar: " + err.message, 'error');
                                    }
                                }}
                                className="btn-detail-main"
                                style={{
                                    boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
                                    fontWeight: 700,
                                    letterSpacing: '1px',
                                    textTransform: 'uppercase'
                                }}>
                                <UtensilsCrossed size={18} /> Volver a seleccionar
                            </button>
                            <button className="btn-detail-outline danger" onClick={async () => {
                                const confirmed = await showConfirm(`¿Quitar ${selectedEntryForDetail.name} de la lista?`, 'Quitar de la lista', true);
                                if (confirmed) {
                                    await handleRemoveEntry(selectedEntryForDetail.id);
                                    showNotification(`${selectedEntryForDetail.name} quitado de la lista`, 'success');
                                    setSearchParams({});
                                }
                            }}>
                                <Trash2 size={16} /> Quitar de la lista
                            </button>
                        </div>
                    }
                />
            </div>
        );
    }

    return (
        <div className="page-screen">
            <TopBar showMenu={true} />

            <main className="home-body" style={{ padding: '0 var(--space-5) var(--space-8)' }}>
                {/* Header Section */}
                <div style={{ paddingTop: 'var(--space-6)', textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 18,
                        background: 'linear-gradient(135deg, #d4a017, #f39c12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(212,160,23,0.3)',
                        animation: 'scaleUp 0.3s ease'
                    }}>
                        <Bookmark size={28} color="white" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Para más tarde</h1>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.95rem', color: 'var(--muted)' }}>
                        Restaurantes que quieres visitar
                    </p>
                </div>

                {/* Search Bar */}
                <div className="internal-search-box">
                    <Search className="search-icon" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar en la lista..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {renderMainContent()}

                {/* Footer Action */}
                <div style={{ marginTop: '2rem' }}>
                    <button
                        onClick={() => navigate('/recommend-restaurants')}
                        style={{
                            width: '100%', padding: '16px',
                            background: 'linear-gradient(135deg, var(--accent), #4f46e5)',
                            color: 'white', border: 'none', borderRadius: 'var(--radius-lg)',
                            fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                            boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.3)',
                            transition: 'transform 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <Search size={20} /> Buscar más restaurantes
                    </button>
                </div>
            </main>
        </div>
    );
};

export default SavedForLaterPage;
