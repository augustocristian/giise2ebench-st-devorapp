import React from 'react';
import { Star, UtensilsCrossed } from 'lucide-react';

export interface RestaurantCompactCardProps {
    name: string;
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
    address: string;
    main_photo?: string;
    onClick?: () => void;
    actionSlot?: React.ReactNode;
    metaSlot?: React.ReactNode;
    children?: React.ReactNode;
}

const RestaurantCompactCard: React.FC<RestaurantCompactCardProps> = ({
    name,
    rating,
    user_ratings_total,
    types,
    address,
    main_photo,
    onClick,
    actionSlot,
    metaSlot,
    children,
}) => {
    // Format the first type: capitalize first letter and replace underscores with spaces
    const typeStr = types && types.length > 0
        ? types[0].charAt(0).toUpperCase() + types[0].slice(1).replaceAll('_', ' ')
        : '';

    return (
        <div
            className="restaurant-compact-card"
            style={{ width: '100%', display: 'flex', alignItems: 'center', position: 'relative', textAlign: 'left', padding: 0 }}
        >
            <button
                onClick={onClick}
                aria-label={`Ver detalles de ${name}`}
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontFamily: 'inherit',
                    color: 'inherit',
                    textAlign: 'left'
                }}
            >
                {children}
                <div className="compact-img-box">
                    {main_photo ? (
                        <img src={main_photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <UtensilsCrossed size={20} style={{ opacity: 0.3 }} />
                    )}
                </div>
                
                <div className="compact-info">
                    <div className="compact-name">{name}</div>
                    <div className="compact-meta">
                        {rating !== undefined && (
                            <>
                                <div className="compact-rating">
                                    <Star size={12} fill="currentColor" /> {rating}
                                </div>
                                <span>({user_ratings_total})</span>
                            </>
                        )}
                        {metaSlot ?? (typeStr && <span>• {typeStr}</span>)}
                    </div>
                    <div className="compact-address">{address}</div>
                </div>
            </button>

            {actionSlot && (
                <div style={{ zIndex: 20 }}>
                    {actionSlot}
                </div>
            )}
        </div>
    );
};

export default RestaurantCompactCard;
