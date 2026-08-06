import React, { useState } from 'react';
import {
    ChevronLeft, Star, Clock, Map, Globe, ChevronDown, ChevronUp,
    Phone
} from 'lucide-react';
import TopBar from './TopBar';

interface RestaurantDetailViewProps {
    restaurant: {
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
    };
    subtitle?: string;
    backText?: string;
    onBack: () => void;
    actions: React.ReactNode;
}

/**
 * Normalizes opening hours to 24-hour format and cleans up spacing.
 * e.g.:
 * - "12:00 PM – 11:30 PM" -> "12:00 - 23:30"
 * - "12:00 p.m. – 11:30 p.m." -> "12:00 - 23:30"
 * - "9:00 AM - 5:00 PM" -> "09:00 - 17:00"
 * - "9 AM - 5 PM" -> "09:00 - 17:00"
 * - "12:00–24:00" -> "12:00 - 00:00"
 * - "24:00" -> "00:00"
 * - "Cerrado" -> "Cerrado"
 */
export const formatTimeRange = (timeStr: string): string => {
    if (!timeStr) return '';
    const cleanLower = timeStr.toLowerCase().trim();
    if (cleanLower === 'cerrado' || cleanLower === 'closed') {
        return 'Cerrado';
    }

    // Replace all kinds of dashes/spaces with a standard representation
    const normalized = timeStr.replace(/[–—]/g, '-');

    // Pattern to match time values, e.g., 12:00 PM, 12:00 p.m., 12 PM, 12 p.m., 12:00, 24:00, etc.
    const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*([aApP]\.?[mM]\.?)?(?!\w)/g;

    let formatted = normalized.replace(timeRegex, (match, hStr, mStr, meridian) => {
        let h = parseInt(hStr, 10);
        const m = mStr ? parseInt(mStr, 10) : 0;

        // If it's a lone number (no colon and no AM/PM, e.g. "24" in "24 horas"), do not format
        if (!meridian && !mStr) {
            return match;
        }

        if (meridian) {
            const isPM = meridian.toLowerCase().startsWith('p');
            if (isPM) {
                if (h !== 12) h += 12;
            } else { // AM
                if (h === 12) h = 0;
            }
        } else {
            // Check for 24:00 boundary condition
            if (h === 24) {
                h = 0;
            }
        }

        const hFormatted = h.toString().padStart(2, '0');
        const mFormatted = m.toString().padStart(2, '0');
        return `${hFormatted}:${mFormatted}`;
    });

    // Normalize spacing around the range separator (hyphen) when surrounded by times (e.g. HH:MM - HH:MM)
    formatted = formatted.replace(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/g, '$1 - $2');
    
    // Normalize spacing after commas for multiple shifts
    formatted = formatted.replace(/,\s*/g, ', ');

    return formatted;
};

const RestaurantDetailView: React.FC<RestaurantDetailViewProps> = ({ 
    restaurant, subtitle, backText, onBack, actions 
}) => {
    const [hoursExpanded, setHoursExpanded] = useState(true);
    
    // Derived data
    const typeStr = restaurant.types && restaurant.types.length > 0 
        ? restaurant.types[0].replaceAll('_', ' ').replaceAll(/\b\w/g, (l: string) => l.toUpperCase()) 
        : 'Restaurante';

    // Parse opening hours for the table
    const daysOrderES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const daysOrderEN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const currentDayIdx = (new Date().getDay() + 6) % 7; // Convert 0-6 (Sun-Sat) to 0-6 (Mon-Sun)
    
    const formattedHours = restaurant.opening_hours ? restaurant.opening_hours.map(h => {
        const parts = h.split(': ');
        // If there's no colon, parts[1] is undefined, which is fine (handled by Cerrado fallback below)
        const dayRaw = parts[0] || '';
        const dayFormatted = dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1);
        const timeRaw = parts[1] || 'Cerrado';
        return { day: dayFormatted, time: formatTimeRange(timeRaw) };
    }) : [];

    // Find today's hours string for more robust status display
    const todayNameES = daysOrderES[currentDayIdx];
    const todayNameEN = daysOrderEN[currentDayIdx];

    // Try to find matching day in either ES or EN
    const todayHoursEntry = formattedHours.find(fh => 
        fh.day === todayNameES || fh.day === todayNameEN
    );
    
    // Final fallback for identifying today's hours: use the currentDayIdx if array size is 7
    const todayHours = todayHoursEntry?.time || 
                      (formattedHours.length === 7 ? formattedHours[currentDayIdx].time : '');

    // Open/Closed logic: prioritize API open_now if present, otherwise fallback to todayHours check
    const isOpen = typeof restaurant.open_now === 'boolean' 
        ? restaurant.open_now 
        : (todayHours !== '' && !todayHours.toLowerCase().includes('cerrado'));

    return (
        <>
            <TopBar 
                showMenu={false}
                leftSlot={
                    <button className="btn-nav-back" onClick={onBack}>
                        <ChevronLeft size={20} />
                        <span>{backText || 'Atrás'}</span>
                    </button>
                }
            />

            <main className="home-body" style={{ padding: '0 var(--space-5) var(--space-8)' }}>
                {/* Main Info Card */}
                <div className="detail-info-card" style={{ marginTop: 'var(--space-6)' }}>
                    <div className="detail-img-box">
                        {restaurant.main_photo ? (
                            <img src={restaurant.main_photo} alt={restaurant.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Clock size={32} style={{ opacity: 0.2 }} />
                        )}
                    </div>
                    <div className="detail-main-info">
                        <h1 className="detail-name">{restaurant.name}</h1>
                        <div className="detail-rating-row">
                            <div className="detail-stars">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <Star key={s} size={14} fill={s <= Math.round(restaurant.rating) ? 'currentColor' : 'none'} stroke={s <= Math.round(restaurant.rating) ? 'none' : 'currentColor'} />
                                ))}
                            </div>
                            <span className="detail-rating-val">{restaurant.rating}</span>
                            <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>({restaurant.user_ratings_total})</span>
                        </div>
                        <div className="detail-meta-text">{typeStr}</div>
                        <div className="detail-address-text">{restaurant.address}</div>
                        {subtitle && (
                            <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                                {subtitle}
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Bar */}
                <div className={`detail-status-bar ${isOpen ? 'open' : 'closed'}`}>
                    <div className="status-dot-pulse"></div>
                    <span>{isOpen ? 'Abierto ahora' : 'Cerrado'}</span>
                    <span style={{ opacity: 0.6, fontSize: '0.8rem', fontWeight: 400 }}>
                        {(() => {
                            if (!isOpen || !todayHours) return '';
                            // Get last part if multiple shifts (e.g. "12:00–16:00, 19:00–23:00")
                            const lastShift = todayHours.split(',').pop() || '';
                            // Split by any dash (en-dash or hyphen)
                            const times = lastShift.split(/[–-]/);
                            if (times.length < 2) return '';
                            const closingTime = times.pop()?.trim() || '';
                            // Clean up "24:00" to "00:00" and remove trailing dots or spaces
                            const finalTime = closingTime.replace('24:00', '00:00').replace(/\.$/, '');
                            return ` · Cierra a las ${finalTime}`;
                        })()}
                    </span>
                </div>

                {/* Opening Hours Section */}
                <div className="detail-section">
                    <button
                        className="detail-section-header"
                        onClick={() => setHoursExpanded(!hoursExpanded)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                        <div className="detail-section-title">
                            <Clock size={18} /> Horario de apertura
                        </div>
                        {hoursExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    
                    {hoursExpanded && formattedHours.length > 0 && (
                        <div className="opening-hours-content" style={{ animation: 'fadeSlideIn 0.2s ease' }}>
                            <div className="hours-table">
                                {formattedHours.map((h, i) => {
                                    const shifts = h.time.split(', ');
                                    return (
                                        <div key={h.day} className={`hours-row ${i === currentDayIdx ? 'today' : ''}`}>
                                            <span className="hours-day">{h.day}</span>
                                            <div style={{ display: 'flex', gap: '1rem' }}>
                                                {shifts.map((s) => (
                                                    <span key={`${h.day}-${s}`} className="hours-time">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Links Section */}
                <div className="detail-section">
                    <div className="detail-section-title" style={{ marginBottom: '1rem' }}>
                        Enlaces de interés
                    </div>
                    <div className="interest-links-row">
                        {restaurant.phone_number && (
                            <a href={`tel:${restaurant.phone_number.replace(/\s+/g, '')}`} className="interest-link-btn">
                                <Phone size={18} /> Llamar
                            </a>
                        )}
                        {restaurant.website_uri && (
                            <a href={restaurant.website_uri} target="_blank" rel="noopener noreferrer" className="interest-link-btn">
                                <Globe size={18} /> Sitio web
                            </a>
                        )}
                        <a href={restaurant.google_maps_uri} target="_blank" rel="noopener noreferrer" className="interest-link-btn">
                            <Map size={18} /> Google Maps
                        </a>
                    </div>
                </div>

                {/* Actions Section */}
                <div className="detail-actions-column">
                    {actions}
                </div>
            </main>
        </>
    );
};

export default RestaurantDetailView;
