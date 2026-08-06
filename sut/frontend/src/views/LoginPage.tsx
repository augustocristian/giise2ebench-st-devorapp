import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import { useLogin } from '../controllers/hooks/useLogin';
import { usePasswordReset } from '../controllers/hooks/usePasswordReset';
import TopBar from '../components/TopBar';
import { useGoogleLogin } from '@react-oauth/google';
import Autocomplete from 'react-google-autocomplete';
import { authService } from '../models/api/authService';

/* ─── Google SVG logo ─────────────────────────────── */
const GoogleLogo: React.FC = () => (
  <svg
    className="google-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

// ── Sub-component: ResetPasswordForm ──────────────────────────────────────────
interface ResetPasswordFormProps {
  onSubmit: (e: React.FormEvent) => void;
  resetEmail: string;
  setResetEmail: (v: string) => void;
  resetLoading: boolean;
  resetMessage: any;
  onBackToLogin: () => void;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  onSubmit,
  resetEmail,
  setResetEmail,
  resetLoading,
  resetMessage,
  onBackToLogin,
}) => {
  return (
    <form
      id="reset-form"
      onSubmit={onSubmit}
      className="auth-form"
      noValidate
      aria-label="Formulario de recuperación de contraseña"
    >
      <div className="form-group">
        <label htmlFor="resetEmail" className="form-label">
          Correo electrónico
        </label>
        <div className="form-input-wrap">
          <span className="form-input-icon" aria-hidden="true">
            <Mail size={18} />
          </span>
          <input
            id="resetEmail"
            type="email"
            className="form-input has-icon-left"
            placeholder="tu@email.com"
            autoComplete="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            required
            disabled={resetLoading}
            aria-required="true"
          />
        </div>
      </div>

      <button
        type="submit"
        id="reset-submit-btn"
        className={`btn-primary${resetLoading ? ' loading' : ''}`}
        disabled={resetLoading}
      >
        {!resetLoading && 'Enviar enlace'}
      </button>

      {resetMessage && (
        <div className={`message ${resetMessage.type}`} role="alert" aria-live="polite">
          {resetMessage.type === 'error'
            ? <AlertCircle size={16} aria-hidden="true" />
            : <CheckCircle2 size={16} aria-hidden="true" />}
          {resetMessage.text}
        </div>
      )}

      <button
        type="button"
        id="back-to-login-btn"
        className="btn-back"
        onClick={onBackToLogin}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver al inicio de sesión
      </button>
    </form>
  );
};

// ── Sub-component: LoginForm ──────────────────────────────────────────────────
interface LoginFormProps {
  onSubmit: (e: React.FormEvent) => void;
  identifier: string;
  setIdentifier: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loginLoading: boolean;
  loginMessage: any;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  onForgotPassword: () => void;
  handleGoogleLogin: () => void;
  googleLoading: boolean;
  googleError: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  identifier,
  setIdentifier,
  password,
  setPassword,
  loginLoading,
  loginMessage,
  showPassword,
  setShowPassword,
  onForgotPassword,
  handleGoogleLogin,
  googleLoading,
  googleError,
}) => {
  return (
    <>
      <form
        id="login-form"
        onSubmit={onSubmit}
        className="auth-form"
        noValidate
        aria-label="Formulario de inicio de sesión"
      >
        {/* Email / usuario */}
        <div className="form-group">
          <label htmlFor="identifier" className="form-label">
            Email o usuario
          </label>
          <div className="form-input-wrap">
            <span className="form-input-icon" aria-hidden="true">
              <Mail size={18} />
            </span>
            <input
              id="identifier"
              type="text"
              className="form-input has-icon-left"
              placeholder="tu@email.com"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              disabled={loginLoading}
              aria-required="true"
            />
          </div>
        </div>

        {/* Contraseña */}
        <div className="form-group">
          <div className="form-label-row">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <button
              type="button"
              id="forgot-password-btn"
              className="forgot-link"
              onClick={onForgotPassword}
              aria-label="Recuperar contraseña olvidada"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="form-input-wrap">
            <span className="form-input-icon" aria-hidden="true">
              <Lock size={18} />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input has-icon-left has-icon-right"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loginLoading}
              aria-required="true"
            />
            <button
              type="button"
              id="toggle-password-btn"
              className="input-action-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword
                ? <EyeOff size={18} aria-hidden="true" />
                : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          id="login-submit-btn"
          className={`btn-primary${loginLoading ? ' loading' : ''}`}
          disabled={loginLoading}
        >
          {!loginLoading && 'Entrar'}
        </button>

        {loginMessage && (
          <div className={`message ${loginMessage.type}`} role="alert" aria-live="polite">
            {loginMessage.type === 'error'
              ? <AlertCircle size={16} aria-hidden="true" />
              : <CheckCircle2 size={16} aria-hidden="true" />}
            {loginMessage.text}
          </div>
        )}
      </form>

      {/* Social auth */}
      <div className="auth-divider" aria-hidden="true">
        <span className="line" />
        <span>o</span>
        <span className="line" />
      </div>

      {googleError && (
        <div className="message error" role="alert" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={16} /> {googleError}
        </div>
      )}
      
      <button
        type="button"
        id="google-login-btn"
        className="btn-social"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        aria-label="Iniciar sesión con Google"
      >
        {googleLoading ? 'Cargando...' : (
          <>
            <GoogleLogo />
            Continuar con Google
          </>
        )}
      </button>

      <p className="auth-footer">
        ¿No tienes cuenta?{' '}
        <Link to="/register" id="go-register-link">
          Regístrate
        </Link>
      </p>
    </>
  );
};

// ── Sub-component: GoogleUsernameModal ───────────────────────────────────────
interface GoogleUsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  newUsername: string;
  setNewUsername: (v: string) => void;
  newUbicacion: string;
  setNewUbicacion: (v: string) => void;
  googleError: string | null;
  googleLoading: boolean;
  submitGoogleUsername: () => void;
}

const GoogleUsernameModal: React.FC<GoogleUsernameModalProps> = ({
  isOpen,
  onClose,
  newUsername,
  setNewUsername,
  newUbicacion,
  setNewUbicacion,
  googleError,
  googleLoading,
  submitGoogleUsername,
}) => {
  if (!isOpen) return null;

  return (
    <div className="sidemenu-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div
        className="sidemenu-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="auth-content" style={{ position: 'relative', zIndex: 10000, background: 'var(--bg)', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '400px' }}>
        <h2>Elige tu nombre de usuario</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          Ya casi terminamos. Solo necesitas elegir un nombre de usuario y tu ubicación preferida para completar tu registro con Google.
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="modal-username-input">Nombre de usuario <span style={{color:'var(--error)'}}>*</span></label>
          <input
            id="modal-username-input"
            type="text"
            className="form-input"
            placeholder="@usuario"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginTop: '0.75rem' }}>
          <label className="form-label" htmlFor="modal-ubicacion-input">Ubicación preferida <span style={{color:'var(--error)'}}>*</span></label>
          <Autocomplete
            apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
            onPlaceSelected={(place) => {
              if (place?.formatted_address) {
                setNewUbicacion(place.formatted_address);
              }
            }}
            onChange={(e: any) => setNewUbicacion(e.target.value)}
            options={{ types: [] }}
            className="form-input"
            placeholder="Ciudad, barrio o dirección..."
            defaultValue={newUbicacion}
            style={{ position: 'relative', zIndex: 10001 }}
          />
        </div>
        {googleError && (
          <div className="message error" role="alert" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={16} /> {googleError}
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn-back" onClick={onClose} disabled={googleLoading}>Cancelar</button>
          <button className={`btn-primary${googleLoading ? ' loading' : ''}`} onClick={submitGoogleUsername} disabled={googleLoading || !newUsername.trim() || !newUbicacion.trim()}>
            {!googleLoading && 'Completar registro'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Sub-component: ServerConfigModal ───────────────────────────────────────
interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ServerConfigModal: React.FC<ServerConfigModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState(localStorage.getItem('CUSTOM_API_URL') || '');

  if (!isOpen) return null;

  const handleSave = () => {
    if (url.trim()) {
      localStorage.setItem('CUSTOM_API_URL', url.trim());
    } else {
      localStorage.removeItem('CUSTOM_API_URL');
    }
    window.location.reload();
  };

  const handleReset = () => {
    localStorage.removeItem('CUSTOM_API_URL');
    window.location.reload();
  };

  return (
    <div className="sidemenu-overlay open" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div
        className="sidemenu-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="auth-content" style={{ position: 'relative', zIndex: 10000, background: 'var(--bg)', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '400px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Configuración de Servidor</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.85rem', lineHeight: '1.3' }}>
          Configura una URL personalizada de Backend (por ejemplo, tu dirección temporal de Ngrok o IP local).
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="modal-server-url-input" style={{ marginBottom: '0.35rem', display: 'block', fontSize: '0.85rem' }}>URL del Backend (API)</label>
          <input
            id="modal-server-url-input"
            type="text"
            className="form-input"
            placeholder="https://xxxx.ngrok-free.app/api o http://192.168.1.50:8000/api"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ width: '100%' }}
          />
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.75rem' }}>
            Valor por defecto: <code style={{ wordBreak: 'break-all' }}>{import.meta.env.VITE_API_URL || `${window.location.origin}/api`}</code>
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button className="btn-primary" onClick={handleSave} style={{ width: '100%' }}>
            Guardar y Conectar
          </button>
          <button className="btn-back" onClick={handleReset} style={{ width: '100%', borderColor: 'var(--border)' }}>
            Restablecer por defecto
          </button>
          <button className="btn-back" onClick={onClose} style={{ width: '100%', border: 'none', background: 'transparent' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── LoginPage ───────────────────────────────────── */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLoginSuccess = () => navigate('/home');

  const {
    identifier, setIdentifier,
    password, setPassword,
    message: loginMessage,
    loading: loginLoading,
    submitLogin,
  } = useLogin(handleLoginSuccess);

  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);

  const {
    identifier: resetEmail,
    setIdentifier: setResetEmail,
    message: resetMessage,
    setMessage: setResetMessage,
    loading: resetLoading,
    submitPasswordReset,
  } = usePasswordReset();

  const handleToggleReset = () => {
    setIsResettingPassword((prev) => !prev);
    setResetMessage(null);
    if (!isResettingPassword && identifier) setResetEmail(identifier);
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUbicacion, setNewUbicacion] = useState('');
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setGoogleError(null);
      try {
        const res = await authService.loginWithGoogle(tokenResponse.access_token);
        if (res.require_username) {
          setGoogleToken(tokenResponse.access_token);
          setShowUsernameModal(true);
        } else {
          handleLoginSuccess();
        }
      } catch (err: any) {
        setGoogleError(err.message);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setGoogleError('Error al conectar con Google'),
  });

  const submitGoogleUsername = async () => {
    if (!newUsername.trim() || !googleToken) return;
    if (!newUbicacion.trim()) {
      setGoogleError('La ubicación es obligatoria para completar el registro.');
      return;
    }
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      await authService.registerWithGoogle(googleToken, newUsername.trim(), newUbicacion.trim());
      setShowUsernameModal(false);
      handleLoginSuccess();
    } catch (err: any) {
      setGoogleError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="page-screen">
      <TopBar rightSlot={
        <button 
          type="button" 
          onClick={() => setShowServerModal(true)} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}
          aria-label="Configuración de Servidor"
        >
          <Settings size={20} />
        </button>
      } />

      <main className="auth-screen-body" role="main">
        <div className="auth-content">

          {/* ── Título de sección ── */}
          <div className="auth-heading">
            {isResettingPassword ? (
              <>
                <h1>Recuperar contraseña</h1>
                <p>Introduce tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
              </>
            ) : (
              <>
                <h1>Iniciar sesión</h1>
                <p>Bienvenido de nuevo</p>
              </>
            )}
          </div>

          {isResettingPassword ? (
            <ResetPasswordForm
              onSubmit={submitPasswordReset}
              resetEmail={resetEmail}
              setResetEmail={setResetEmail}
              resetLoading={resetLoading}
              resetMessage={resetMessage}
              onBackToLogin={handleToggleReset}
            />
          ) : (
            <LoginForm
              onSubmit={submitLogin}
              identifier={identifier}
              setIdentifier={setIdentifier}
              password={password}
              setPassword={setPassword}
              loginLoading={loginLoading}
              loginMessage={loginMessage}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              onForgotPassword={handleToggleReset}
              handleGoogleLogin={handleGoogleLogin}
              googleLoading={googleLoading}
              googleError={googleError}
            />
          )}
        </div>
      </main>

      <GoogleUsernameModal
        isOpen={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        newUsername={newUsername}
        setNewUsername={setNewUsername}
        newUbicacion={newUbicacion}
        setNewUbicacion={setNewUbicacion}
        googleError={googleError}
        googleLoading={googleLoading}
        submitGoogleUsername={submitGoogleUsername}
      />

      <ServerConfigModal
        isOpen={showServerModal}
        onClose={() => setShowServerModal(false)}
      />
    </div>
  );
};

export default LoginPage;
