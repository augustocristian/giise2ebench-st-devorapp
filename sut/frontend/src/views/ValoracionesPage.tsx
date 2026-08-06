import React, { useState, useEffect } from 'react';
import { 
    MessageSquare, Star, Trash2, Edit3, ChevronDown, ChevronRight,
    UtensilsCrossed, HelpCircle, Heart, DollarSign, Home, User, ChevronLeft
} from 'lucide-react';
import { valoracionesService } from '../models/api/valoracionesService';
import type { ValoracionDetailedResponse } from '../models/api/valoracionesService';
import TopBar from '../components/TopBar';
import RestaurantCompactCard from '../components/RestaurantCompactCard';
import { useNotification } from '../components/NotificationSystem';

const ValoracionesPage: React.FC = () => {
const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
    const [valoraciones, setValoraciones] = useState<ValoracionDetailedResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { showNotification, showConfirm } = useNotification();

    // Modals state
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [selectedEntryForRating, setSelectedEntryForRating] = useState<ValoracionDetailedResponse | null>(null);
    const [ratingVal, setRatingVal] = useState({ calidad: 0, precio: 0, higiene: 0, trato: 0 });
    const [ratingComment, setRatingComment] = useState('');
    const [modalLoading, setModalLoading] = useState(false);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

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
        const fetchValoraciones = async () => {
            try {
                setLoading(true);
                const data = await valoracionesService.obtenerTodasMisValoraciones();
                setValoraciones(data);
                // Expand first by default if exists
                if (data.length > 0) setExpandedEntryId(data[0].id);
            } catch (err: any) {
                console.error("Error fetching valoraciones:", err);
                setError(err.message || "No se pudieron cargar tus valoraciones.");
            } finally {
                setLoading(false);
            }
        };
        fetchValoraciones();
    }, []);

    const getRelativeTime = (dateStr?: string) => {
        if (!dateStr) return '';
        const now = new Date();
        const past = new Date(dateStr);
        const diffMs = now.getTime() - past.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'hoy';
        if (diffDays === 1) return 'ayer';
        if (diffDays < 7) return `hace ${diffDays} días`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
        }
        const months = Math.floor(diffDays / 30);
        return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    };

    const handleRateClick = (val: ValoracionDetailedResponse) => {
        setSelectedEntryForRating(val);
        setRatingVal({ calidad: val.calidad, precio: val.precio, higiene: val.higiene, trato: val.trato });
        setRatingComment(val.comentario || '');
        setIsRatingModalOpen(true);
    };

    const handleRatingSubmit = async () => {
        if (!selectedEntryForRating || modalLoading) return;
        try {
            setModalLoading(true);
            await valoracionesService.valorarRestaurante({
                place_id: selectedEntryForRating.place_id,
                calidad: ratingVal.calidad, precio: ratingVal.precio,
                higiene: ratingVal.higiene, trato: ratingVal.trato,
                comentario: ratingComment
            });
            setValoraciones(prev => prev.map(v => 
                v.place_id === selectedEntryForRating.place_id 
                    ? { ...v, calidad: ratingVal.calidad, precio: ratingVal.precio, higiene: ratingVal.higiene, trato: ratingVal.trato, comentario: ratingComment } 
                    : v
            ));
            setIsRatingModalOpen(false);
            showNotification(`Has actualizado la reseña de ${selectedEntryForRating.restaurant?.name || 'este restaurante'}`, 'success');
        } catch (error: any) {
            showNotification(error.message || "Hubo un error al guardar la valoración.", 'error');
        } finally {
            setModalLoading(false);
        }
    };

    const handleDeleteRating = async (val: ValoracionDetailedResponse, e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmed = await showConfirm(`¿Estás seguro de que deseas eliminar la reseña de ${val.restaurant?.name || 'este restaurante'}?`, 'Eliminar reseña', true);
        if (!confirmed) return;
        try {
            await valoracionesService.eliminarValoracion(val.place_id);
            setValoraciones(prev => prev.filter(v => v.place_id !== val.place_id));
            setExpandedEntryId(null);
            showNotification('La reseña ha sido eliminada con éxito.', 'success');
        } catch (error: any) {
            showNotification(error.message || "Hubo un error al borrar la valoración.", 'error');
        }
    };

    const renderStars = (rating: number) => (
        <div style={{ display: 'flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={14} fill={star <= rating ? "#ffb400" : "transparent"} color={star <= rating ? "#ffb400" : "var(--muted)"} style={{ opacity: star <= rating ? 1 : 0.3 }} />
            ))}
        </div>
    );

    const renderMainContent = () => {
        if (loading) {
            return (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: 30, height: 30, animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--muted)' }}>Cargando valoraciones...</p>
                </div>
            );
        }

        if (error) {
            return <div className="message error">{error}</div>;
        }

        return (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <span style={{ fontSize: 'var(--font-sm)', color: 'var(--muted)', fontWeight: 600 }}>
                        {valoraciones.length} {valoraciones.length === 1 ? 'valoración' : 'valoraciones'}
                    </span>
                </div>

                {valoraciones.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--muted)', background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' }}>
                        <Star size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p style={{ fontWeight: 600 }}>Aún no has valorado ningún restaurante.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {valoraciones.map((val) => {
                            const restaurant = val.restaurant || {};
                            const types = restaurant.types || [];
                            const typeStr = types.length > 0 ? types[0].replaceAll('_', ' ').replaceAll(/\b\w/g, (l: string) => l.toUpperCase()) : 'Restaurante';
                            const isExpanded = expandedEntryId === val.id;

                            return (
                                <div key={val.id} style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <RestaurantCompactCard
                                        name={restaurant.name || 'Restaurante'}
                                        address={restaurant.address || ''}
                                        main_photo={restaurant.main_photo}
                                        onClick={() => setExpandedEntryId(isExpanded ? null : val.id)}
                                        metaSlot={
                                            <>
                                                <span style={{ color: 'var(--accent-light)' }}>{typeStr}</span>
                                                <span>• {getRelativeTime(val.fecha)}</span>
                                            </>
                                        }
                                        actionSlot={
                                            <div style={{ color: 'var(--muted)', opacity: 0.5, marginLeft: 'auto' }}>
                                                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                            </div>
                                        }
                                    />

                                    {isExpanded && (
                                        <div style={{ 
                                            padding: '1.5rem', background: 'var(--surface-2)', 
                                            borderTop: '1px solid var(--border)', 
                                            animation: 'fadeSlideIn 0.3s ease' 
                                        }}>
                                            <div className="ratings-grid">
                                                <div className="rating-item">
                                                    <span className="rating-item-label">Calidad</span>
                                                    {renderStars(val.calidad)}
                                                </div>
                                                <div className="rating-item">
                                                    <span className="rating-item-label">Precio</span>
                                                    {renderStars(val.precio)}
                                                </div>
                                                <div className="rating-item">
                                                    <span className="rating-item-label">Higiene</span>
                                                    {renderStars(val.higiene)}
                                                </div>
                                                <div className="rating-item">
                                                    <span className="rating-item-label">Trato</span>
                                                    {renderStars(val.trato)}
                                                </div>
                                            </div>

                                            {val.comentario && (
                                                <div className="review-comment-bubble">
                                                    &ldquo;{val.comentario}&rdquo;
                                                </div>
                                            )}

                                            <div className="review-actions-row">
                                                <button 
                                                    onClick={() => handleRateClick(val)}
                                                    className="btn-primary"
                                                    style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                                >
                                                    <Edit3 size={16} /> Editar reseña
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDeleteRating(val, e)}
                                                    className="btn-review-delete"
                                                >
                                                    <Trash2 size={16} /> Eliminar reseña
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="page-screen">
            <TopBar showMenu={true} />

            <main className="home-body" style={{ padding: '0 var(--space-5) var(--space-8)' }}>
                {/* Header Section */}
                <div style={{ paddingTop: 'var(--space-6)', textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 18,
                        background: 'linear-gradient(135deg, #b07d3a, #cf9d56)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(176,125,58,0.3)',
                        animation: 'scaleUp 0.3s ease'
                    }}>
                        <MessageSquare size={28} color="white" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Mis valoraciones</h1>
                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.95rem', color: 'var(--muted)' }}>
                        Opiniones y puntuaciones que has dejado
                    </p>
                </div>

                {renderMainContent()}
            </main>

            {/* Modal Premium para valorar restaurante */}
            {isRatingModalOpen && selectedEntryForRating && (
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
                                <h3>{selectedEntryForRating.restaurant?.name || 'Restaurante'}</h3>
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
                                                    type="button"
                                                    className="rating-label-with-help"
                                                    onClick={() => setActiveTooltip(activeTooltip === aspect ? null : aspect)}
                                                    onKeyDown={(e) => e.key === 'Enter' && setActiveTooltip(activeTooltip === aspect ? null : aspect)}
                                                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', position: 'relative', textAlign: 'left' }}
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

                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star 
                                                    key={star}
                                                    size={22}
                                                    fill={star <= (ratingVal as any)[aspect] ? "#ffb400" : "transparent"}
                                                    color={star <= (ratingVal as any)[aspect] ? "#ffb400" : "var(--muted)"}
                                                    onClick={() => setRatingVal({ ...ratingVal, [aspect]: star })}
                                                    style={{ cursor: 'pointer', transition: 'all 0.2s ease', opacity: star <= (ratingVal as any)[aspect] ? 1 : 0.8 }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="comment-section-premium">
                            <label htmlFor="valuation-comment-textarea" className="comment-label-premium">Comentario (opcional)</label>
                            <textarea
                                id="valuation-comment-textarea"
                                className="textarea-premium"
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                placeholder="¿Qué te ha parecido?"
                                rows={4}
                            />
                        </div>

                        <button
                            onClick={handleRatingSubmit}
                            disabled={modalLoading || Object.values(ratingVal).includes(0)}
                            className={`btn-submit-valuation ${Object.values(ratingVal).includes(0) ? '' : 'active'}`}
                        >
                            {modalLoading ? 'Guardando...' : 'Enviar valoración'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ValoracionesPage;
