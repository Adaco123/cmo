import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightToBracket, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from './AuthProvider';
import { useErrorToast } from './ErrorToastProvider';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/800.css';
import garabato from '../assets/garabatos.png';
import cmoLogo from '../assets/cmo.png';
import TiltCard from './TiltCard';
import styles from './Login.module.css';

const ECG_PATH =
  'M0,35 L140,35 L165,10 L190,58 L215,4 L240,62 L265,35 L560,35 L585,22 L610,35 ' +
  'L740,35 L765,10 L790,58 L815,4 L840,62 L865,35 L1200,35';

// Pantalla de espera: es lo que ve el paciente mientras el médico lo atiende.
// Cada letra es una TiltCard; la palabra chica de abajo completa el nombre.
const LETRAS = [
  { letra: 'C', palabra: 'Consultores' },
  { letra: 'M', palabra: 'Médicos' },
  { letra: 'O', palabra: 'Oruro' },
];

// El ECG se repite cada 1200px; con 4 copias cubre pantallas de hasta 3600px.
const ECG_COPIAS = [0, 1, 2, 3];


const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showError } = useErrorToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarLogin, setMostrarLogin] = useState(false);

  // Al cerrar se limpia la contraseña: la pantalla queda a la vista del paciente.
  const cerrarLogin = useCallback(() => {
    if (loading) return;
    setMostrarLogin(false);
    setPassword('');
  }, [loading]);

  useEffect(() => {
    if (!mostrarLogin) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarLogin();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mostrarLogin, cerrarLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación propia (el <form> lleva noValidate): ningún aviso sale como
    // tooltip nativo del navegador, todo pasa por el toast.
    const correo = email.trim();
    if (!correo) {
      showError('Escribe tu correo electrónico.');
      return;
    }
    // Misma tolerancia que el <input type="email"> nativo.
    if (!/^[^\s@]+@[^\s@]+$/.test(correo)) {
      showError('El correo electrónico no es válido.');
      return;
    }
    if (!password) {
      showError('Escribe tu contraseña.');
      return;
    }

    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
      return;
    }
    showError(result.message ?? 'Credenciales inválidas');
  };

  return (
    <div className={styles.stage}>
      {/* Fondo animado: marca de agua y dos orbes de luz */}
      <div className={styles.watermark}>
        <img src={garabato} alt="" />
      </div>
      <div className={styles.glowOrb} />
      <div className={styles.glowOrbSecondary} />

      {/* ===== Pantalla de espera: C · M · O ===== */}
      <main className={styles.letters}>
        {LETRAS.map(({ letra, palabra }, i) => (
          <TiltCard
            key={letra}
            className={styles.letterTilt}
            glow="var(--status-inactive)"
            idle
            phase={i * 2.1}
          >
            <div className={styles.letterCard}>
              <span className={styles.letter}>{letra}</span>
              <span className={styles.word}>{palabra}</span>
            </div>
          </TiltCard>
        ))}
      </main>

      {/* ECG a todo el ancho, justo debajo de las tarjetas */}
      <div className={styles.ecgTrack} aria-hidden="true">
        <div className={styles.ecgScroll}>
          {ECG_COPIAS.map((n) => (
            <svg key={n} viewBox="0 0 1200 70" preserveAspectRatio="none">
              <path d={ECG_PATH} />
            </svg>
          ))}
        </div>
      </div>

      

      {/* ===== Botón discreto que abre el login ===== */}
      <button type="button" className={styles.openLoginBtn} onClick={() => setMostrarLogin(true)}>
        <FontAwesomeIcon icon={faRightToBracket} />
        Iniciar sesión
      </button>

      {/* ===== Login emergente ===== */}
      {mostrarLogin && (
        <div
          className={styles.backdrop}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrarLogin();
          }}
        >
          <TiltCard className={styles.loginTilt} glow="var(--status-inactive)">
            <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="login-titulo">
              <button type="button" className={styles.closeBtn} onClick={cerrarLogin} aria-label="Cerrar">
                <FontAwesomeIcon icon={faXmark} />
              </button>

              <div className={styles.brand}>
                <img src={cmoLogo} alt="CMO" />
                <div className={styles.brandName}>
                  CMO
                  <span>Gestión clínica</span>
                </div>
              </div>

              <h2 id="login-titulo" className={styles.cardHeading}>Bienvenido de nuevo</h2>
              <p className={styles.subtitle}>Ingresa tus credenciales para continuar</p>

              <form onSubmit={handleSubmit} noValidate>
                <div className={styles.field}>
                  <label htmlFor="email">Correo electrónico</label>
                  <input
                    type="email"
                    id="email"
                    placeholder="correo@ejemplo.com"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="password">Contraseña</label>
                  <input
                    type="password"
                    id="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar al sistema'}
                </button>
              </form>

              <p className={styles.hint}>
                ¿Problemas para ingresar? Contacta al administrador del sistema.
              </p>
            </div>
          </TiltCard>
        </div>
      )}
    </div>
  );
};

export default Login;