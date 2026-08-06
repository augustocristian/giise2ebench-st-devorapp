import React, { useState } from 'react';
import Autocomplete from 'react-google-autocomplete';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, User, Lock, Eye, EyeOff,
  MapPin, Navigation, AlertCircle, CheckCircle2, Loader2, ArrowLeft, Search,
} from 'lucide-react';
import { useRegister } from '../controllers/hooks/useRegister';
import { authService } from '../models/api/authService';
import TopBar from '../components/TopBar';


/* ─── Step progress bar ─────────────────────────────── */
interface StepBarProps { current: number; total: number; }
const StepBar: React.FC<StepBarProps> = ({ current, total }) => {
  const segments = Array.from({ length: total }, (_, idx) => ({
    id: `step-bar-segment-id-${idx + 1}`,
    isActive: idx < current
  }));

  return (
    <>
      <progress
        value={current}
        max={total}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
        aria-label={`Paso ${current} de ${total}`}
      />
      <div className="step-bar" aria-hidden="true">
        {segments.map((seg) => (
          <div key={seg.id} className={seg.isActive ? 'step-segment active' : 'step-segment'} />
        ))}
      </div>
    </>
  );
};

// ── Sub-component: RegisterWaitingVerification ──────────────────────────────
interface RegisterWaitingVerificationProps {
  email: string;
  message: any;
}

const RegisterWaitingVerification: React.FC<RegisterWaitingVerificationProps> = ({
  email,
  message,
}) => {
  return (
    <div className="page-screen">
      <TopBar />
      <main className="auth-screen-body">
        <div className="auth-content" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="auth-heading">
            <h1>Verifica tu correo</h1>
            <p>
              Hemos enviado un enlace a{' '}
              <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              {' '}Revisa tu bandeja de entrada y la carpeta de spam.
            </p>
          </div>
          <Loader2 size={44} strokeWidth={1.5} aria-hidden="true"
            style={{ color: 'var(--accent)', animation: 'spin 1.2s linear infinite' }} />
          <p className="text-muted text-sm">Esperando confirmación…</p>
          {message && (
            <div className={`message ${message.type}`} role="alert">
              {message.type === 'error'
                ? <AlertCircle size={16} aria-hidden="true" />
                : <CheckCircle2 size={16} aria-hidden="true" />}
              {message.text}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// ── Sub-component: RegisterStep1 ─────────────────────────────────────────────
interface RegisterStep1Props {
  form: any;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setFieldErrors: React.Dispatch<React.SetStateAction<any>>;
  fieldErrors: any;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  pwStrength: number;
  pwStrengthClass: string;
  pwStrengthLabel: string;
  stepError: string | null;
  checkLoading: boolean;
  onContinue: () => void;
}

const RegisterStep1: React.FC<RegisterStep1Props> = ({
  form,
  handleInputChange,
  setFieldErrors,
  fieldErrors,
  showPassword,
  setShowPassword,
  pwStrength,
  pwStrengthClass,
  pwStrengthLabel,
  stepError,
  checkLoading,
  onContinue,
}) => {
  return (
    <>
      <div className="auth-form">
        {/* Email */}
        <div className="form-group">
          <label htmlFor="reg-email" className="form-label">Email</label>
          <div className="form-input-wrap">
            <span className="form-input-icon" aria-hidden="true"><Mail size={18} /></span>
            <input
              id="reg-email" name="email" type="email"
              className={`form-input has-icon-left${fieldErrors.email ? ' input-error' : ''}`}
              placeholder="tu@email.com"
              autoComplete="email"
              value={form.email} onChange={(e) => { handleInputChange(e); setFieldErrors((fe: any) => ({ ...fe, email: undefined })); }}
              aria-required="true"
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
          </div>
          {fieldErrors.email && (
            <p id="email-error" className="field-error" role="alert">
              <AlertCircle size={13} aria-hidden="true" />{fieldErrors.email}
            </p>
          )}
        </div>

        {/* Username */}
        <div className="form-group">
          <label htmlFor="reg-username" className="form-label">Nombre de usuario</label>
          <div className="form-input-wrap">
            <span className="form-input-icon" aria-hidden="true"><User size={18} /></span>
            <input
              id="reg-username" name="username" type="text"
              className={`form-input has-icon-left${fieldErrors.username ? ' input-error' : ''}`}
              placeholder="@usuario"
              autoComplete="username"
              value={form.username} onChange={(e) => { handleInputChange(e); setFieldErrors((fe: any) => ({ ...fe, username: undefined })); }}
              aria-required="true"
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
            />
          </div>
          {fieldErrors.username && (
            <p id="username-error" className="field-error" role="alert">
              <AlertCircle size={13} aria-hidden="true" />{fieldErrors.username}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label htmlFor="reg-password" className="form-label">Contraseña</label>
          <div className="form-input-wrap">
            <span className="form-input-icon" aria-hidden="true"><Lock size={18} /></span>
            <input
              id="reg-password" name="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input has-icon-left has-icon-right"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              value={form.password} onChange={handleInputChange}
              aria-required="true"
            />
            <button
              type="button" id="toggle-reg-password-btn"
              className="input-action-btn"
              onClick={() => setShowPassword((v: boolean) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>

          {/* Password strength */}
          {form.password && (
            <div className="pw-strength" aria-live="polite">
              <div className="pw-strength-bar">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className={pwStrength >= n ? `pw-seg ${pwStrengthClass}` : 'pw-seg'} />
                ))}
              </div>
              <span className={`pw-label ${pwStrengthClass}`}>{pwStrengthLabel}</span>
            </div>
          )}
        </div>

        {/* Nombre + Apellidos */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="reg-nombre" className="form-label">Nombre</label>
            <input
              id="reg-nombre" name="nombre" type="text"
              className="form-input"
              autoComplete="given-name"
              value={form.nombre} onChange={handleInputChange}
              aria-required="true"
            />
          </div>
          <div className="form-group">
            <label htmlFor="reg-apellidos" className="form-label">Apellidos</label>
            <input
              id="reg-apellidos" name="apellidos" type="text"
              className="form-input"
              autoComplete="family-name"
              value={form.apellidos} onChange={handleInputChange}
              aria-required="true"
            />
          </div>
        </div>

        {/* Step error */}
        {stepError && (
          <div className="message error" role="alert" aria-live="polite">
            <AlertCircle size={16} aria-hidden="true" />
            {stepError}
          </div>
        )}

        <button
          type="button" id="register-continue-btn"
          className={`btn-primary${checkLoading ? ' loading' : ''}`}
          onClick={onContinue}
          disabled={checkLoading}
        >
          {!checkLoading && 'Continuar'}
        </button>
      </div>

      <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" id="go-login-link">Inicia sesión</Link>
      </p>
    </>
  );
};

// ── Sub-component: RegisterStep2 ─────────────────────────────────────────────
interface RegisterStep2Props {
  form: any;
  onSubmit: (e: React.FormEvent) => void;
  setFieldValue: (field: string, value: any) => void;
  gpsLabel: string | null;
  setGpsLabel: (v: string | null) => void;
  gpsLoading: boolean;
  onUseGPS: () => void;
  message: any;
  loading: boolean;
  onBack: () => void;
}

const RegisterStep2: React.FC<RegisterStep2Props> = ({
  form,
  onSubmit,
  setFieldValue,
  gpsLabel,
  setGpsLabel,
  gpsLoading,
  onUseGPS,
  message,
  loading,
  onBack,
}) => {
  return (
    <form id="register-form" onSubmit={onSubmit} className="auth-form" noValidate>
      {/* Info card */}
      <div className="location-info-card">
        <span className="location-info-icon" aria-hidden="true">
          <MapPin size={20} />
        </span>
        <div>
          <p className="location-info-title">Tu ubicación preferida</p>
          <p className="location-info-desc">
            Usaremos esta zona para mostrarte restaurantes cercanos. Podrás cambiarla después desde tu perfil.
          </p>
        </div>
      </div>

      {/* Search + GPS row */}
      <div className="form-group">
        <label htmlFor="reg-ubicacion" className="form-label">Busca tu ubicación</label>
        <div className="location-search-row">
          <div className="form-input-wrap" style={{ flex: 1 }}>
            <span className="form-input-icon" aria-hidden="true"><Search size={18} /></span>
            <Autocomplete
              id="reg-ubicacion"
              apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
              onChange={() => {
                setFieldValue('ubicacion', '');
                setGpsLabel(null);
              }}
              onPlaceSelected={(place) => {
                if (place?.formatted_address) {
                  setFieldValue('ubicacion', place.formatted_address);
                  setGpsLabel(place.formatted_address);
                }
              }}
              options={{ types: [] }}
              className="form-input has-icon-left"
              placeholder="Ciudad, barrio o dirección..."
              defaultValue={gpsLabel ?? form.ubicacion}
            />
          </div>

          <button
            type="button" id="use-gps-btn"
            className={`btn-gps${gpsLoading ? ' loading' : ''}`}
            onClick={onUseGPS}
            disabled={gpsLoading}
            aria-label="Usar mi ubicación actual"
            title="Usar mi ubicación"
          >
            {gpsLoading
              ? <Loader2 size={16} className="spin-icon" aria-hidden="true" />
              : <Navigation size={16} aria-hidden="true" />}
            <span>Usar mi ubicación</span>
          </button>
        </div>
      </div>

      {/* GPS detected result */}
      {gpsLabel && (
        <div className="location-detected" role="status" aria-live="polite">
          <span className="location-detected-icon" aria-hidden="true"><MapPin size={16} /></span>
          <div className="location-detected-text">
            <span className="location-detected-name">{gpsLabel}</span>
            <span className="location-detected-sub">Ubicación detectada automáticamente</span>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setGpsLabel(null); setFieldValue('ubicacion', ''); }}
            aria-label="Cambiar ubicación"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* API error */}
      {message && (
        <div className={`message ${message.type}`} role="alert" aria-live="polite">
          {message.type === 'error'
            ? <AlertCircle size={16} aria-hidden="true" />
            : <CheckCircle2 size={16} aria-hidden="true" />}
          {message.text}
        </div>
      )}

      <button
        type="submit" id="register-submit-btn"
        className={`btn-primary${loading ? ' loading' : ''}`}
        disabled={loading}
      >
        {!loading && 'Crear cuenta'}
      </button>

      <button
        type="button" id="register-back-btn"
        className="btn-back"
        onClick={onBack}
        style={{ alignSelf: 'center' }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver
      </button>
    </form>
  );
};

/* ─── RegisterPage ───────────────────────────────────── */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const handleSwitchToLogin = () => navigate('/login');

  const { form, handleInputChange, setFieldValue, message, loading, isWaitingVerification, submitRegister } =
    useRegister(handleSwitchToLogin);

  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; username?: string }>({});
  const [checkLoading, setCheckLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsLabel, setGpsLabel] = useState<string | null>(null);

  /* ── Step 1 validation + availability check ── */
  const handleContinue = async () => {
    setStepError(null);
    setFieldErrors({});

    // Local validation first (fast, no network)
    if (!form.email.trim()) return setStepError('El email es obligatorio.');
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) return setStepError('Introduce un email válido.');
    if (!form.username.trim()) return setStepError('El nombre de usuario es obligatorio.');
    if (form.username.length < 3) return setStepError('El usuario debe tener al menos 3 caracteres.');
    if (!form.password) return setStepError('La contraseña es obligatoria.');
    if (form.password.length < 8) return setStepError('La contraseña debe tener al menos 8 caracteres.');
    if (!form.nombre.trim()) return setStepError('El nombre es obligatorio.');
    if (!form.apellidos.trim()) return setStepError('Los apellidos son obligatorios.');

    // Remote availability check
    setCheckLoading(true);
    try {
      const { email_taken, username_taken } = await authService.checkAvailability(
        form.email.trim(),
        form.username.trim()
      );

      const errs: { email?: string; username?: string } = {};
      if (email_taken) errs.email = 'Este email ya está registrado.';
      if (username_taken) errs.username = 'Este nombre de usuario ya está en uso.';

      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        return;
      }
    } catch (err) {
      console.debug('Pre-check network error, continuing to next step:', err);
    } finally {
      setCheckLoading(false);
    }

    setStep(2);
  };

  /* ── GPS detection ── */
  const handleUseGPS = () => {
    if (!navigator.geolocation) {
      setStepError('Tu dispositivo no soporta geolocalización.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_API_KEY}&language=es`
          );
          const data = await res.json();
          if (data.results?.[0]) {
            const address = data.results[0].formatted_address;
            setFieldValue('ubicacion', address);
            setGpsLabel(address);
          }
        } catch (err) {
          console.debug('Reverse geocode failed:', err);
          setStepError('No se pudo obtener la dirección. Intenta buscarla manualmente.');
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setStepError('Permiso de ubicación denegado. Busca tu ubicación manualmente.');
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  };

  /* ── Password strength ── */
  const pwStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z\d]/.test(p)) s++;
    return s;
  })();
  const pwStrengthLabel = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][pwStrength];
  const pwStrengthClass = ['', 'weak', 'fair', 'good', 'strong'][pwStrength];

  if (isWaitingVerification) {
    return <RegisterWaitingVerification email={form.email} message={message} />;
  }

  return (
    <div className="page-screen">
      <TopBar />
      <main className="auth-screen-body">
        <div className="auth-content">

          {/* ── Header ── */}
          <div className="auth-heading">
            <h1>Crear cuenta</h1>
            <p>
              {step === 1
                ? 'Paso 1 de 2 · Datos de acceso'
                : 'Paso 2 de 2 · Tu ubicación'}
            </p>
            <StepBar current={step} total={2} />
          </div>

          {step === 1 ? (
            <RegisterStep1
              form={form}
              handleInputChange={handleInputChange}
              setFieldErrors={setFieldErrors}
              fieldErrors={fieldErrors}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              pwStrength={pwStrength}
              pwStrengthClass={pwStrengthClass}
              pwStrengthLabel={pwStrengthLabel}
              stepError={stepError}
              checkLoading={checkLoading}
              onContinue={handleContinue}
            />
          ) : (
            <RegisterStep2
              form={form}
              onSubmit={submitRegister}
              setFieldValue={setFieldValue}
              gpsLabel={gpsLabel}
              setGpsLabel={setGpsLabel}
              gpsLoading={gpsLoading}
              onUseGPS={handleUseGPS}
              message={message}
              loading={loading}
              onBack={() => { setStep(1); setStepError(null); }}
            />
          )}

        </div>
      </main>
    </div>
  );
};

export default RegisterPage;
