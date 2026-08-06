import { useState, useEffect, useRef } from 'react';
import { authService } from '../../models/api/authService';

export const useRegister = (onSuccessSwitchToLogin: () => void) => {
    const [form, setForm] = useState({
        email: '', password: '', username: '',
        nombre: '', apellidos: '', ubicacion: '',
    });
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [isWaitingVerification, setIsWaitingVerification] = useState(false);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Cleanup interval on unmount
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    }

    const setFieldValue = (name: string, value: string) => {
        setForm(f => ({ ...f, [name]: value }));
    }

    const submitRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.email.trim() || !form.username.trim() || !form.password || !form.nombre.trim() || !form.apellidos.trim()) {
            setMessage({ type: 'error', text: 'Rellene todos los campos obligatorios' });
            return;
        }

        if (!form.ubicacion.trim()) {
            setMessage({ type: 'error', text: 'Debe seleccionar una ubicación válida de la lista' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const cleanData = {
                email: form.email.trim(),
                password: form.password,
                username: form.username.trim(),
                nombre: form.nombre.trim(),
                apellidos: form.apellidos.trim(),
                ubicacion: form.ubicacion.trim(),
            };

            await authService.register(cleanData);

            setMessage({
                type: 'success',
                text: 'Cuenta creada. Por favor, revisa tu bandeja de entrada y pulsa en el enlace para verificar tu correo.',
            });
            setIsWaitingVerification(true);

            pollingIntervalRef.current = setInterval(async () => {
                const isVerified = await authService.checkEmailVerification(cleanData.email);
                if (isVerified) {
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                    }
                    setMessage({
                        type: 'success',
                        text: `¡Correo verificado con éxito! Redirigiendo al login...`,
                    });
                    setTimeout(() => onSuccessSwitchToLogin(), 2000);
                }
            }, 5000);

        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return {
        form,
        handleInputChange,
        setFieldValue,
        message,
        loading,
        isWaitingVerification,
        submitRegister
    };
};
