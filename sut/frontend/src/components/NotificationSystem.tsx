import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

import { NotificationContext } from './notificationContext';
import type { Notification, ConfirmState, NotificationType } from './notificationContext';

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, message: '', title: '' });

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markNotificationAsRemoving = useCallback((id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, removing: true } : n));
    setTimeout(() => {
      removeNotification(id);
    }, 200);
  }, [removeNotification]);

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      markNotificationAsRemoving(id);
    }, 4000);
  }, [markNotificationAsRemoving]);

  const showConfirm = useCallback((message: string, title: string = 'Confirmación', isDanger: boolean = false) => {
    return new Promise<boolean>((resolve) => {
      setConfirm({ open: true, message, title, resolve, isDanger });
    });
  }, []);

  const handleConfirm = useCallback((value: boolean) => {
    if (confirm.resolve) confirm.resolve(value);
    setConfirm({ ...confirm, open: false });
  }, [confirm]);

  useEffect(() => {
    if (!confirm.open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirm.open, handleConfirm]);

  const contextValue = useMemo(() => ({
    showNotification,
    showConfirm
  }), [showNotification, showConfirm]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Container */}
      <div className="toast-container">
        {notifications.map(n => (
          <div key={n.id} data-testid={`toast-${n.type}`} className={`toast ${n.type} ${n.removing ? 'removing' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                {n.type === 'success' && <CheckCircle size={22} className="text-success" />}
                {n.type === 'error' && <AlertCircle size={22} className="text-error" />}
                {n.type === 'warning' && <AlertTriangle size={22} style={{ color: '#facc15' }} />}
                {n.type === 'info' && <Info size={22} color="var(--accent)" />}
                <span style={{ lineHeight: 1.5 }}>{n.message}</span>
            </div>
            <button onClick={() => removeNotification(n.id)} style={{ marginLeft: 'var(--space-2)', display: 'flex', opacity: 0.5, padding: '4px' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirm.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" data-testid="confirm-modal">
          <button
            className="modal-overlay-backdrop"
            onClick={() => handleConfirm(false)}
            aria-label="Cerrar confirmación"
            type="button"
          />
          <div className="modal-card">
            <div className="modal-body">
              <div className="modal-title">{confirm.title}</div>
              <div className="modal-text">{confirm.message}</div>
            </div>
            <div className="modal-actions">
              <button data-testid="confirm-cancel" className="modal-btn modal-btn-cancel" onClick={() => handleConfirm(false)}>
                Cancelar
              </button>
              <button 
                data-testid="confirm-accept"
                className={`modal-btn modal-btn-confirm ${confirm.isDanger ? 'danger' : ''}`} 
                onClick={() => handleConfirm(true)}
              >
                {confirm.isDanger ? 'Eliminar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
