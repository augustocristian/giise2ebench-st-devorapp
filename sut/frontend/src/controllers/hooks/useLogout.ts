import { useState } from 'react';
import { authService } from '../../models/api/authService';

export const useLogout = (onSuccess: () => void) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitLogout = async () => {
        setLoading(true);
        setError(null);

        try {
            await authService.logout();
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        submitLogout
    };
};
