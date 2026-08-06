import { useState } from 'react';
import { authService } from '../../models/api/authService';

export const useLogin = (onSuccess?: () => void) => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const submitLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!identifier.trim() || !password) {
            setMessage({ type: 'error', text: 'Rellene todos los campos' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const data = await authService.login(identifier.trim(), password);
            setMessage({ type: 'success', text: `¡Bienvenido de nuevo, ${data.user.nombre}!` });

            if (onSuccess) {
                setTimeout(onSuccess, 1500);
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return {
        identifier, setIdentifier,
        password, setPassword,
        message,
        loading,
        submitLogin
    };
};
