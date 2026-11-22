import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, MapPin, Navigation,
  Bookmark, ChevronRight, AlertCircle, UtensilsCrossed, Loader2, Heart
} from 'lucide-react';
import { useLogout } from '../controllers/hooks/useLogout';
import { authService } from '../models/api/authService';
import { historyService } from '../models/api/historyService';
import { savedForLaterService } from '../models/api/savedForLaterService';
import { ratingsService } from '../models/api/ratingsService';
import type { PublicRating } from '../models/api/ratingsService';
import TopBar from '../components/TopBar';
import RestaurantCompactCard from '../components/RestaurantCompactCard';
import RestaurantDetailView from '../components/RestaurantDetailView';
import { useNotification } from '../components/useNotification';
import { env } from '../config/env';

/* ─── RestaurantReviews Component ───────────────── */
interface ReviewStarsRowProps {
  label: string;
  val: number;
}

const ReviewStarsRow: React.FC<ReviewStarsRowProps> = ({ label, val }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{label}</span>
      <div style={{ display: 'flex', gap: '1px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} style={{ fontSize: '0.65rem', color: i < val ? '#ffb400' : 'var(--muted)', opacity: i < val ? 1 : 0.3 }}>★</span>
        ))}
      </div>
    </div>
  );
};

interface RestaurantReviewsProps {
  currReviews: PublicRating[];
  isLoading: boolean;
  restaurantId: string;
  handleLike: (restaurantId: string, ratingId: number) => void;
}

const RestaurantReviews: React.FC<RestaurantReviewsProps> = ({
  currReviews,
  isLoading,
  restaurantId,
  handleLike,
}) => {
  const avg = { quality: 0, price: 0, hygiene: 0, service: 0 };

  if (currReviews.length > 0) {
    avg.quality = currReviews.reduce((s: number, r: any) => s + r.quality, 0) / currReviews.length;
    avg.price = currReviews.reduce((s: number, r: any) => s + r.price, 0) / currReviews.length;
    avg.hygiene = currReviews.reduce((s: number, r: any) => s + r.hygiene, 0) / currReviews.length;
    avg.service = currReviews.reduce((s: number, r: any) => s + r.service, 0) / currReviews.length;
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)' }}>
          <Loader2 size={24} className="spin-icon" style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
          Cargando reseñas...
        </div>
      );
    }

    if (currReviews.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.875rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)' }}>
          Aún no hay reseñas para este restaurante.
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Promedios Card */}
        <div style={{ background: 'var(--surface-2)', borderRadius: '12px', padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem 2rem', border: '1px solid var(--border)' }}>
          {[
            { label: 'Calidad', val: avg.quality },
            { label: 'Precio', val: avg.price },
            { label: 'Higiene', val: avg.hygiene },
            { label: 'Trato', val: avg.service },
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
          {currReviews.map((review: any) => (
            <div key={review.id} className="review-item-card" style={{ background: 'var(--surface-2)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>
                  {review.username?.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{review.username}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{formatDateStr(review.created_at)}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '0.6rem 1rem' }}>
                <ReviewStarsRow label="Calidad" val={review.quality} />
                <ReviewStarsRow label="Precio" val={review.price} />
                <ReviewStarsRow label="Higiene" val={review.hygiene} />
                <ReviewStarsRow label="Trato" val={review.service} />
              </div>

              {review.comment && (
                <p style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: '1.4', margin: 0, fontStyle: 'italic', fontWeight: 600 }}>"{review.comment}"</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleLike(restaurantId, review.id); }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.25rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: review.liked_by_me ? '#f472b6' : 'var(--muted)', transition: 'all 0.2s' }}
                >
                  <Heart size={14} fill={review.liked_by_me ? '#f472b6' : 'transparent'} color={review.liked_by_me ? '#f472b6' : 'var(--muted)'} />
                  <span style={{ fontWeight: 500, fontSize: '0.75rem' }}>{review.likes}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '1.2rem', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </span>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>Reseñas de la comunidad</span>
        {currReviews.length > 0 && (
          <span style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'var(--muted)',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.15rem 0.6rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
          }}>
            {currReviews.length}
          </span>
        )}
      </div>

      {renderContent()}
    </div>
  );
};

/* ─── PopularRestaurants Component ───────────────── */
interface PopularRestaurantsProps {
  loading: boolean;
  error: string | null;
  populares: any[];
  locationMode: 'current' | 'preferred';
  setLocationMode: (mode: 'current' | 'preferred') => void;
  setSearchParams: (params: any) => void;
}

const PopularRestaurants: React.FC<PopularRestaurantsProps> = ({
  loading,
  error,
  populares,
  locationMode,
  setLocationMode,
  setSearchParams,
}) => {
  if (loading) {
    return (
      <div className="home-state-box">
        <Loader2 size={32} className="spin-icon" aria-hidden="true" style={{ color: 'var(--accent)' }} />
        <p>Buscando los mejores sitios en tu zona…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-state-box home-state-error">
        <AlertCircle size={28} aria-hidden="true" />
        <p>{error}</p>
        {locationMode === 'current' && (
          <button
            className="btn-social"
            style={{ marginTop: 'var(--space-3)' }}
            onClick={() => setLocationMode('preferred')}
          >
            Usar ubicación preferida
          </button>
        )}
      </div>
    );
  }

  if (populares.length === 0) {
    return (
      <div className="home-state-box">
        <UtensilsCrossed size={28} aria-hidden="true" style={{ color: 'var(--muted)' }} />
        <p>No se encontraron restaurantes populares cerca.</p>
      </div>
    );
  }

  return (
    <div className="restaurant-list">
      {populares.map((place: any) => (
        <RestaurantCompactCard
          key={place.id}
          name={place.name}
          rating={place.rating ?? 0}
          user_ratings_total={place.user_ratings_total ?? 0}
          types={place.types}
          address={place.address}
          main_photo={place.main_photo}
          onClick={() => { if (place.id) setSearchParams({ detail: place.id.toString() }); }}
          actionSlot={<ChevronRight size={18} style={{ color: 'var(--muted)', marginLeft: 'auto' }} />}
        />
      ))}
    </div>
  );
};

/* ─── HomePage ───────────────────────────────────── */
interface PopularResult {
  key: string;
  data: any[];
  error: string | null;
}

const NO_POPULAR: any[] = [];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useLogout(() => navigate('/login'));
  const { showNotification } = useNotification();

  const [firstName, setFirstName] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [locationMode, setLocationMode] = useState<'current' | 'preferred'>('current');

  // Result of the last popular fetch, tagged with the request it belongs to so
  // loading/error state can be derived during render instead of synced in effects.
  const [popularResult, setPopularResult] = useState<PopularResult | null>(null);

  const [reviewsBy, setReviewsBy] = useState<Record<string, PublicRating[]>>({});

  const popularKey = locationMode === 'current' ? 'current' : `preferred:${preferredLocation}`;
  const geoUnsupported = locationMode === 'current' && !('geolocation' in navigator);
  const noPreferredLocation = locationMode === 'preferred' && !preferredLocation;
  const settledPopular = popularResult?.key === popularKey ? popularResult : null;
  const blockedPopular = geoUnsupported || noPreferredLocation;
  let errorPopular: string | null = settledPopular?.error ?? null;
  if (geoUnsupported) errorPopular = 'Geolocalización no soportada en este navegador.';
  else if (noPreferredLocation) errorPopular = 'No tienes una ubicación preferida configurada.';
  const loadingPopular = !blockedPopular && !settledPopular;
  const populares = blockedPopular ? NO_POPULAR : settledPopular?.data ?? NO_POPULAR;

  // Derive detail view from search params
  const detailId = searchParams.get('detail');
  const selectedEntryForDetail = useMemo(() => {
    if (!detailId) return null;
    return populares.find(p => p.id === detailId || p.id.toString() === detailId) || null;
  }, [detailId, populares]);

  /* ── Fetch user ── */
  useEffect(() => {
    authService.getMe()
      .then(u => {
        setFirstName(u.first_name || u.username || 'Usuario');
        if (u.location) setPreferredLocation(u.location);
      })
      .catch(() => { });
  }, []);

  /* ── Fetch popular ── */
  useEffect(() => {
    let active = true;

    const key = locationMode === 'current' ? 'current' : `preferred:${preferredLocation}`;
    const finish = (data: any[], error: string | null) => {
      if (active) setPopularResult({ key, data, error });
    };

    const doFetch = async (loc: string) => {
      if (!active) return;
      try {
        const data = await historyService.getPopular(loc, 5);
        finish(data, null);
      } catch (e: any) {
        finish([], e.message ?? 'Error al cargar populares.');
      }
    };

    if (locationMode === 'current') {
      if (!('geolocation' in navigator)) return; // Derived during render
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!active) return;
          try {
            const { latitude: lat, longitude: lng } = pos.coords;
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${env.googleApiKey}&language=es`
            );
            const raw = await res.json();
            const loc = raw.results?.[0]?.formatted_address ?? `${lat},${lng}`;
            if (active) await doFetch(loc);
          } catch {
            finish([], 'Error al obtener la dirección actual.');
          }
        },
        () => {
          finish([], 'No se puede acceder a la ubicación. Activa los permisos o usa tu ubicación preferida.');
        }
      );
    } else {
      if (!preferredLocation) return; // Derived during render
      doFetch(preferredLocation);
    }

    return () => {
      active = false;
    };
  }, [locationMode, preferredLocation]);

  /* ── Fetch details on detail entry ── */
  useEffect(() => {
    if (selectedEntryForDetail) {
      const pid = selectedEntryForDetail.id;
      if (!reviewsBy[pid]) {
        ratingsService.getRestaurantReviews(pid)
          .then(r => setReviewsBy(p => ({ ...p, [pid]: r })))
          .catch(() => setReviewsBy(p => ({ ...p, [pid]: [] })));
      }
    } else if (detailId && populares.length > 0) {
      // Invalid map search
      setSearchParams({});
    }
  }, [selectedEntryForDetail, detailId, populares, reviewsBy, setSearchParams]);

  /* ── Like toggle ── */
  const handleLike = async (placeId: string, ratingId: number) => {
    const review = reviewsBy[placeId]?.find(r => r.id === ratingId);
    if (!review) return;
    const liked = review.liked_by_me;
    setReviewsBy(p => ({
      ...p,
      [placeId]: p[placeId].map(r =>
        r.id === ratingId
          ? { ...r, liked_by_me: !liked, likes: liked ? Math.max(0, r.likes - 1) : r.likes + 1 }
          : r
      ),
    }));
    try {
      const updated = await ratingsService.likeReview(ratingId, liked);
      if (updated) setReviewsBy(p => ({ ...p, [placeId]: p[placeId].map(r => r.id === updated.id ? updated : r) }));
    } catch { }
  };

  /* ── Actions ── */
  const handleSelect = async (place: any) => {
    try {
      await historyService.addToHistory(place.id);
      showNotification(`Has seleccionado ${place.name}`, 'success');
      navigate('/home');
    } catch (e: any) {
      showNotification('Error al seleccionar el restaurante: ' + e.message, 'error');
    }
  };

  const handleSave = async (place: any) => {
    try {
      const response = await savedForLaterService.saveForLater({
        place_id: place.id, name: place.name,
        rating: place.rating ?? 0, user_ratings_total: place.user_ratings_total ?? 0,
        types: place.types ?? [], address: place.address ?? '',
        main_photo: place.main_photo, summary: place.summary,
        opening_hours: place.opening_hours,
        google_maps_uri: place.google_maps_uri,
        website_uri: place.website_uri,
      });
      if (response.already_saved) {
        showNotification(`Ya tienes guardado ${place.name} para más tarde.`, 'warning');
      } else {
        showNotification(`${place.name} guardado para más tarde.`, 'success');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  /* ── Render ── */
  if (selectedEntryForDetail) {
    return (
      <div className="page-screen">
        <RestaurantDetailView
            restaurant={selectedEntryForDetail}
            onBack={() => navigate(-1)}
            actions={
              <>
                <div className="detail-actions-column">
                  <button className="btn-detail-main" onClick={() => handleSelect(selectedEntryForDetail)}>
                    Seleccionar este restaurante
                  </button>
                  <button className="btn-detail-outline" onClick={() => handleSave(selectedEntryForDetail)}>
                    <Bookmark size={16} /> Guardar para más tarde
                  </button>
                </div>

                {/* ── Reviews section ── */}
                <RestaurantReviews
                  currReviews={reviewsBy[selectedEntryForDetail.id] || []}
                  isLoading={!reviewsBy[selectedEntryForDetail.id]}
                  restaurantId={selectedEntryForDetail.id}
                  handleLike={handleLike}
                />
              </>
            }
          />
      </div>
    );
  }

  return (
    <div className="page-screen">
      <TopBar showMenu={true} />

      <main className="home-body">
        {/* ══ Hero ══ */}
        <section className="home-hero" aria-label="Bienvenida">
          <p className="home-hero-sub">Bienvenido, <strong>{firstName}</strong></p>
          <h1 className="home-hero-title">¿Qué quieres comer hoy?</h1>
          <button
            id="go-recommend-btn"
            className="btn-primary home-search-btn"
            onClick={() => navigate('/recommend-restaurants')}
          >
            <Search size={18} aria-hidden="true" />
            Buscar restaurantes
          </button>
        </section>

        {/* ══ Populares ══ */}
        <section className="home-populares" aria-label="Restaurantes populares">
          <div className="home-section-header">
            <h2 className="home-section-title">Populares cerca de ti</h2>

            {/* Location toggle */}
            <fieldset className="location-toggle" aria-label="Modo de ubicación" style={{ border: 'none', padding: 0, margin: 0 }}>
              <button
                id="location-current-btn"
                className={`location-toggle-btn${locationMode === 'current' ? ' active' : ''}`}
                onClick={() => setLocationMode('current')}
                aria-pressed={locationMode === 'current'}
              >
                <Navigation size={13} aria-hidden="true" />
                Actual
              </button>
              <button
                id="location-preferred-btn"
                className={`location-toggle-btn${locationMode === 'preferred' ? ' active' : ''}`}
                onClick={() => setLocationMode('preferred')}
                aria-pressed={locationMode === 'preferred'}
              >
                <MapPin size={13} aria-hidden="true" />
                Preferida
              </button>
            </fieldset>
          </div>

          {/* States */}
          <PopularRestaurants
            loading={loadingPopular}
            error={errorPopular}
            populares={populares}
            locationMode={locationMode}
            setLocationMode={setLocationMode}
            setSearchParams={setSearchParams}
          />
        </section>
      </main>
    </div>
  );
};

export default HomePage;
