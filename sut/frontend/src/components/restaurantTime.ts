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
