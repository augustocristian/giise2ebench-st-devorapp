import React, { useState, useEffect } from 'react';
import {
  User, Mail, Lock, ChevronLeft, Edit3,
  ShieldCheck, AlertCircle, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Autocomplete from 'react-google-autocomplete';
import { authService } from '../models/api/authService';
import { useNotification } from '../components/NotificationSystem';

// ── Sub-component: PersonalInfoSection ───────────────────────────────────────
interface PersonalInfoSectionProps {
  user: any;
  editSection: string;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (e: React.FormEvent) => void;
}

const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({
  user,
  editSection,
  formData,
  setFormData,
  isSaving,
  onEdit,
  onCancel,
  onSave,
}) => {
  const isEditing = editSection === 'personal';
  return (
    <div className={`location-info-card`} style={{
      flexDirection: 'column', gap: '1rem', alignItems: 'stretch',
      border: isEditing ? '1px solid var(--accent)' : '1px solid var(--border)',
      background: isEditing ? 'var(--surface-3)' : 'var(--surface-2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="location-info-icon" style={{ width: 36, height: 36 }}>
            <User size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Información Personal</span>
        </div>
        {!isEditing && (
          <button className="btn-ghost" onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Edit3 size={14} /> Editar
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={onSave} className="auth-form" style={{ marginTop: '0.5rem' }}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="profile-nombre-input" className="form-label">Nombre</label>
              <input
                id="profile-nombre-input"
                type="text"
                className="form-input"
                value={formData.nombre}
                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="profile-apellidos-input" className="form-label">Apellidos</label>
              <input
                id="profile-apellidos-input"
                type="text"
                className="form-input"
                value={formData.apellidos}
                onChange={e => setFormData({ ...formData, apellidos: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn-social" onClick={onCancel} style={{ flex: 1, minHeight: '44px' }}>
              Cancelar
            </button>
            <button type="submit" className={`btn-primary ${isSaving ? 'loading' : ''}`} style={{ flex: 2, minHeight: '44px', marginTop: 0 }} disabled={isSaving}>
              Guardar cambios
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.5rem 0' }}>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Nombre</span>
            <span style={{ fontSize: '1rem', fontWeight: 500 }}>{user?.nombre || '—'}</span>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Apellidos</span>
            <span style={{ fontSize: '1rem', fontWeight: 500 }}>{user?.apellidos || '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-component: LocationSection ───────────────────────────────────────────
interface LocationSectionProps {
  user: any;
  editSection: string;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isSaving: boolean;
  locationError: string;
  setLocationValid: (v: boolean) => void;
  setLocationError: (v: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (e: React.FormEvent) => void;
}

const LocationSection: React.FC<LocationSectionProps> = ({
  user,
  editSection,
  formData,
  setFormData,
  isSaving,
  locationError,
  setLocationValid,
  setLocationError,
  onEdit,
  onCancel,
  onSave,
}) => {
  const isEditing = editSection === 'location';
  return (
    <div className={`location-info-card`} style={{
      flexDirection: 'column', gap: '1rem', alignItems: 'stretch',
      border: isEditing ? '1px solid var(--accent)' : '1px solid var(--border)',
      background: isEditing ? 'var(--surface-3)' : 'var(--surface-2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="location-info-icon" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
            <MapPin size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Ubicación Preferida</span>
        </div>
        {!isEditing && (
          <button className="btn-ghost" onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Edit3 size={14} /> Cambiar
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={onSave} className="auth-form" style={{ marginTop: '0.5rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="profile-location-input">Ubicación</label>
            <Autocomplete
              id="profile-location-input"
              apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
              onPlaceSelected={(place) => {
                if (place?.formatted_address) {
                  setFormData((prev: any) => ({ ...prev, ubicacion: place.formatted_address }));
                  setLocationValid(true);
                  setLocationError('');
                }
              }}
              onChange={(e: any) => {
                setFormData((prev: any) => ({ ...prev, ubicacion: e.target.value }));
                setLocationValid(false);
                setLocationError('');
              }}
              options={{ types: [] }}
              className={`form-input${locationError ? ' input-error' : ''}`}
              placeholder="Ciudad, barrio o dirección..."
              defaultValue={formData.ubicacion}
            />
            {locationError && (
              <span style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                {locationError}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn-social" onClick={onCancel} style={{ flex: 1, minHeight: '44px' }}>
              Cancelar
            </button>
            <button type="submit" className={`btn-primary ${isSaving ? 'loading' : ''}`} style={{ flex: 2, minHeight: '44px', marginTop: 0 }} disabled={isSaving}>
              Guardar cambios
            </button>
          </div>
        </form>
      ) : (
        <div style={{ padding: '0.5rem 0' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>Ubicación actual</span>
          <span style={{ fontSize: '1rem', fontWeight: 500 }}>{user?.ubicacion || '—'}</span>
        </div>
      )}
    </div>
  );
};

// ── Sub-component: EmailSection ──────────────────────────────────────────────
interface EmailSectionProps {
  user: any;
  editSection: string;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (e: React.FormEvent) => void;
}

const EmailSection: React.FC<EmailSectionProps> = ({
  user,
  editSection,
  formData,
  setFormData,
  isSaving,
  onEdit,
  onCancel,
  onSave,
}) => {
  const isEditing = editSection === 'email';
  return (
    <div className={`location-info-card`} style={{
      flexDirection: 'column', gap: '1rem', alignItems: 'stretch',
      border: isEditing ? '1px solid var(--accent)' : '1px solid var(--border)',
      background: isEditing ? 'var(--surface-3)' : 'var(--surface-2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="location-info-icon" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #3dadd4, #2ebd7e)' }}>
            <Mail size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Correo Electrónico</span>
        </div>
        {!isEditing && !user?.is_google && (
          <button className="btn-ghost" onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Edit3 size={14} /> Cambiar
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={onSave} className="auth-form" style={{ marginTop: '0.5rem' }}>
          <div className="form-group">
            <label htmlFor="profile-email-input" className="form-label">Nuevo Correo</label>
            <input
              id="profile-email-input"
              type="email"
              className="form-input"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email-password-input">Contraseña de confirmación</label>
            <input
              id="email-password-input"
              type="password"
              className="form-input"
              placeholder="Introduce tu contraseña"
              value={formData.currentPassword}
              onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn-social" onClick={onCancel} style={{ flex: 1, minHeight: '44px' }}>
              Cancelar
            </button>
            <button type="submit" className={`btn-primary ${isSaving ? 'loading' : ''}`} style={{ flex: 2, minHeight: '44px', marginTop: 0 }} disabled={isSaving}>
              Cambiar correo
            </button>
          </div>
        </form>
      ) : (
        <div style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 500 }}>{user?.email}</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            padding: '2px 8px', borderRadius: '12px',
            background: 'rgba(74, 222, 128, 0.1)', color: 'var(--success)',
            fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(74, 222, 128, 0.2)'
          }}>
            <ShieldCheck size={12} /> Verificado
          </div>
          {user?.is_google && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              padding: '2px 8px', borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent)',
              fontSize: '0.7rem', fontWeight: 700, border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              Vinculado a Google
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Sub-component: PasswordSection ───────────────────────────────────────────
interface PasswordSectionProps {
  user: any;
  editSection: string;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (e: React.FormEvent) => void;
}

const PasswordSection: React.FC<PasswordSectionProps> = ({
  user,
  editSection,
  formData,
  setFormData,
  isSaving,
  onEdit,
  onCancel,
  onSave,
}) => {
  const isEditing = editSection === 'password';
  return (
    <div className={`location-info-card`} style={{
      flexDirection: 'column', gap: '1rem', alignItems: 'stretch',
      border: isEditing ? '1px solid var(--accent)' : '1px solid var(--border)',
      background: isEditing ? 'var(--surface-3)' : 'var(--surface-2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="location-info-icon" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #e05252, #f05b8e)' }}>
            <Lock size={18} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Seguridad</span>
        </div>
        {!isEditing && !user?.is_google && (
          <button className="btn-ghost" onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Edit3 size={14} /> Cambiar contraseña
          </button>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={onSave} className="auth-form" style={{ marginTop: '0.5rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="current-password-input">Contraseña Actual</label>
            <input
              id="current-password-input"
              type="password"
              className="form-input"
              value={formData.currentPassword}
              onChange={e => setFormData({ ...formData, currentPassword: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="new-password-input">Nueva Contraseña</label>
              <input
                id="new-password-input"
                type="password"
                className="form-input"
                value={formData.newPassword}
                onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password-input">Repetir Nueva Contraseña</label>
              <input
                id="confirm-password-input"
                type="password"
                className="form-input"
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn-social" onClick={onCancel} style={{ flex: 1, minHeight: '44px' }}>
              Cancelar
            </button>
            <button type="submit" className={`btn-primary ${isSaving ? 'loading' : ''}`} style={{ flex: 2, minHeight: '44px', marginTop: 0 }} disabled={isSaving}>
              Actualizar contraseña
            </button>
          </div>
        </form>
      ) : (
        <div style={{ padding: '0.5rem 0' }}>
          {user?.is_google ? (
            <span style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
              Iniciaste sesión con Google. La seguridad de tu cuenta se gestiona a través de Google.
            </span>
          ) : (
            <>
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>••••••••••••</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Último cambio hace 3 meses</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Sub-component: DangerZoneSection ─────────────────────────────────────────
interface DangerZoneSectionProps {
  editSection: string;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDeleteSubmit: (e: React.FormEvent) => void;
}

const DangerZoneSection: React.FC<DangerZoneSectionProps> = ({
  editSection,
  deleteConfirmText,
  setDeleteConfirmText,
  isSaving,
  onEdit,
  onCancel,
  onDeleteSubmit,
}) => {
  const isDeleting = editSection === 'delete';
  return (
    <div className={`location-info-card`} style={{
      flexDirection: 'column', gap: '1rem', alignItems: 'stretch',
      border: editSection === 'none' ? '1px solid var(--error-border)' : '1px solid var(--border)',
      background: 'var(--error-bg)', opacity: 0.9
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', padding: '0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={20} style={{ color: 'var(--error)' }} />
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zona de Peligro</span>
        </div>

        {isDeleting ? (
          <form onSubmit={onDeleteSubmit} className="auth-form">
            <p style={{ fontSize: '0.85rem', color: 'var(--error)', margin: 0 }}>
              Esta acción es <strong>irreversible</strong>. Se borrarán todos tus favoritos, historial y valoraciones.
            </p>
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label className="form-label" htmlFor="delete-confirm-input" style={{ color: 'var(--error)' }}>
                Escribe <strong>CONFIRMAR</strong> para continuar
              </label>
              <input
                id="delete-confirm-input"
                type="text"
                className="form-input"
                style={{ borderColor: 'var(--error-border)' }}
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="CONFIRMAR"
                autoComplete="off"
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn-social" onClick={onCancel} style={{ flex: 1, minHeight: '40px' }}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" style={{ flex: 1, minHeight: '40px', marginTop: 0, background: 'var(--error)', boxShadow: 'none' }} disabled={isSaving || deleteConfirmText !== 'CONFIRMAR'}>
                {isSaving ? 'Eliminando...' : 'Eliminar permanentemente'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
              Al eliminar tu cuenta, todos tus favoritos, historial y datos se borrarán de forma permanente.
            </p>
            <button
              className="btn-primary"
              onClick={onEdit}
              style={{
                background: 'transparent',
                border: '2px solid var(--error)',
                color: 'var(--error)',
                width: '100%',
                maxWidth: '300px',
                padding: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                marginTop: '0.5rem',
                boxShadow: 'none'
              }}
            >
              Eliminar cuenta permanentemente
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── ProfilePage ─────────────────────────────────── */
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editSection, setEditSection] = useState<'none' | 'personal' | 'location' | 'email' | 'password' | 'delete'>('none');
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    ubicacion: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [locationValid, setLocationValid] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await authService.getMe();
        setUser(data);
        localStorage.setItem('devorapp_user_cache', JSON.stringify(data));
        globalThis.dispatchEvent(new CustomEvent('userUpdated', { detail: data }));
        setFormData(prev => ({
          ...prev,
          nombre: data.nombre || '',
          apellidos: data.apellidos || '',
          email: data.email || '',
          ubicacion: data.ubicacion || ''
        }));
      } catch (err) {
        console.error('Error al cargar datos del perfil:', err);
        showNotification('Error al cargar datos del perfil', 'error');
        navigate('/home');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate, showNotification]);

  const handleEdit = (section: 'personal' | 'location' | 'email' | 'password' | 'delete') => {
    setEditSection(section);
    setFormData(prev => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }));
    if (section === 'location') {
      setLocationValid(true);
      setLocationError('');
    }
  };

  const handleCancel = () => {
    setEditSection('none');
    if (user) {
      setFormData(prev => ({
        ...prev,
        nombre: user.nombre || '',
        apellidos: user.apellidos || '',
        email: user.email || '',
        ubicacion: user.ubicacion || ''
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    try {
      if (editSection === 'personal' || editSection === 'location') {
        if (editSection === 'location' && !locationValid) {
          setLocationError('Debes seleccionar una ubicación válida de la lista.');
          setIsSaving(false);
          return;
        }
        const result = await authService.updateProfile({
          nombre: formData.nombre,
          apellidos: formData.apellidos,
          ubicacion: formData.ubicacion,
          password: formData.currentPassword
        });
        setUser(result.user);
        localStorage.setItem('devorapp_user_cache', JSON.stringify(result.user));
        globalThis.dispatchEvent(new CustomEvent('userUpdated', { detail: result.user }));
        showNotification('Perfil actualizado correctamente', 'success');
      }
      else if (editSection === 'email') {
        await authService.updateEmail({
          new_email: formData.email,
          password: formData.currentPassword
        });
        setFormData(prev => ({ ...prev, email: user.email }));
        showNotification('Se ha enviado un correo de confirmación. Por favor, verifica tu nueva bandeja de entrada.', 'success');
      }
      else if (editSection === 'password') {
        if (formData.newPassword !== formData.confirmPassword) {
          throw new Error('Las contraseñas no coinciden');
        }
        await authService.updatePassword({
          old_password: formData.currentPassword,
          new_password: formData.newPassword
        });
        showNotification('Contraseña actualizada correctamente', 'success');
      }

      setEditSection('none');
    } catch (err: any) {
      showNotification(err.message || 'Error al actualizar el perfil', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmText !== 'CONFIRMAR') {
      showNotification('Debes escribir CONFIRMAR para continuar', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await authService.deleteAccount('');
      showNotification('Cuenta eliminada correctamente. Adiós.', 'success');
      localStorage.removeItem('devorapp_user_cache');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      showNotification(err.message || 'Error al eliminar la cuenta', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (n?: string, u?: string) => {
    if (n) return n.charAt(0).toUpperCase();
    if (u) return u.charAt(0).toUpperCase();
    return '?';
  };

  if (loading) {
    return (
      <div className="page-screen">
        <TopBar showMenu={false} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner" style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: 30, height: 30, animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-screen">
      <TopBar
        showMenu={true}
        leftSlot={
          <button className="btn-nav-back" onClick={() => navigate('/home')}>
            <ChevronLeft size={20} />
            <span>Volver</span>
          </button>
        }
      />

      <main className="auth-screen-body">
        <div className="auth-content" style={{ maxWidth: '600px' }}>

          <div className="auth-heading" style={{ marginBottom: '2rem' }}>
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem', fontWeight: 800, color: 'white',
                boxShadow: '0 8px 24px rgba(124, 109, 250, 0.3)'
              }}>
                {getInitials(user?.nombre, user?.username)}
              </div>
            </div>
            <h1>{user?.nombre ? `${user.nombre} ${user.apellidos || ''}` : user?.username}</h1>
            <p>{user?.email}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <PersonalInfoSection
              user={user}
              editSection={editSection}
              formData={formData}
              setFormData={setFormData}
              isSaving={isSaving}
              onEdit={() => handleEdit('personal')}
              onCancel={handleCancel}
              onSave={handleSave}
            />

            <LocationSection
              user={user}
              editSection={editSection}
              formData={formData}
              setFormData={setFormData}
              isSaving={isSaving}
              locationError={locationError}
              setLocationValid={setLocationValid}
              setLocationError={setLocationError}
              onEdit={() => handleEdit('location')}
              onCancel={handleCancel}
              onSave={handleSave}
            />

            <EmailSection
              user={user}
              editSection={editSection}
              formData={formData}
              setFormData={setFormData}
              isSaving={isSaving}
              onEdit={() => handleEdit('email')}
              onCancel={handleCancel}
              onSave={handleSave}
            />

            <PasswordSection
              user={user}
              editSection={editSection}
              formData={formData}
              setFormData={setFormData}
              isSaving={isSaving}
              onEdit={() => handleEdit('password')}
              onCancel={handleCancel}
              onSave={handleSave}
            />
          </div>

          <div className="auth-footer" style={{ marginTop: '2rem' }}>
            <DangerZoneSection
              editSection={editSection}
              deleteConfirmText={deleteConfirmText}
              setDeleteConfirmText={setDeleteConfirmText}
              isSaving={isSaving}
              onEdit={() => handleEdit('delete')}
              onCancel={() => { handleCancel(); setDeleteConfirmText(''); }}
              onDeleteSubmit={handleDeleteSubmit}
            />
          </div>

        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
