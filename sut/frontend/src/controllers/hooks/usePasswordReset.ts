import { useState } from 'react';
import { authService } from '../../models/api/authService';

export const usePasswordReset = (initialIdentifier: string = '') => {
    const [identifier, setIdentifier] = useState(initialIdentifier);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const submitPasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!identifier.trim()) {
            setMessage({ type: 'error', text: 'Por favor, introduce tu correo electrónico' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await authService.requestPasswordReset(identifier.trim());
            setMessage({
                type: 'success',
                text: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
            });
            setIdentifier('');
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return {
        identifier, setIdentifier,
        message, setMessage,
        loading,
        submitPasswordReset
    };
};
