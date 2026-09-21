import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRightToBracket, faXmark } from '@fortawesome/free-solid-svg-icons';
import { authStore } from '../auth';
import { useAuth } from './AuthProvider';
import { useErrorToast } from './ErrorToastProvider';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/800.css';
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

// Bloqueo por intentos fallidos (solo frontend): tras MAX_INTENTOS contraseñas
// incorrectas el formulario se bloquea BLOQUEO_MIN minutos. Se guarda en
// localStorage para que recargar la página no lo reinicie. OJO: es un freno de
// interfaz, no seguridad real: se salta borrando el localStorage o llamando a
// la API directamente.
const MAX_INTENTOS = 6;
const BLOQUEO_MIN = 20;
const CLAVE_BLOQUEO = 'cmo_login_bloqueo';

interface EstadoBloqueo {
  intentos: number;
  hasta: number | null; // marca de tiempo (ms) hasta la que dura el bloqueo
}

const SIN_BLOQUEO: EstadoBloqueo = { intentos: 0, hasta: null };

function leerBloqueo(): EstadoBloqueo {
  try {
    const raw = localStorage.getItem(CLAVE_BLOQUEO);
    if (!raw) return SIN_BLOQUEO;
    const { intentos, hasta } = JSON.parse(raw) as Partial<EstadoBloqueo>;
    if (typeof intentos !== 'number') return SIN_BLOQUEO;
    if (typeof hasta === 'number') {
      if (hasta <= Date.now()) {
        localStorage.removeItem(CLAVE_BLOQUEO);
        return SIN_BLOQUEO;
      }
      return { intentos, hasta };
    }
    return { intentos, hasta: null };
  } catch {
    return SIN_BLOQUEO;
  }
}

function guardarBloqueo(estado: EstadoBloqueo) {
  try {
    if (estado.intentos === 0 && estado.hasta === null) localStorage.removeItem(CLAVE_BLOQUEO);
    else localStorage.setItem(CLAVE_BLOQUEO, JSON.stringify(estado));
  } catch {
    // sin localStorage el bloqueo solo dura mientras la pestaña siga abierta
  }
}

function textoBloqueo(msRestantes: number): string {
  const min = Math.max(1, Math.ceil(msRestantes / 60000));
  return `Acceso bloqueado por demasiados intentos fallidos. Intente nuevamente en ${min} ${min === 1 ? 'minuto' : 'minutos'}.`;
}


const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showError } = useErrorToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [bloqueo, setBloqueo] = useState<EstadoBloqueo>(leerBloqueo);
  const [ahora, setAhora] = useState(() => Date.now());

  const bloqueado = bloqueo.hasta !== null && ahora < bloqueo.hasta;

  // Mientras dura el bloqueo, refresca el tiempo restante y lo levanta al vencer.
  useEffect(() => {
    if (bloqueo.hasta === null) return;
    const hasta = bloqueo.hasta;
    const id = window.setInterval(() => {
      const t = Date.now();
      setAhora(t);
      if (t >= hasta) {
        guardarBloqueo(SIN_BLOQUEO);
        setBloqueo(SIN_BLOQUEO);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [bloqueo.hasta]);

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

    // Se relee de localStorage: otra pestaña pudo haber bloqueado o sumado intentos.
    const actual = leerBloqueo();
    if (actual.hasta !== null) {
      setBloqueo(actual);
      setAhora(Date.now());
      showError(textoBloqueo(actual.hasta - Date.now()));
      return;
    }

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
      guardarBloqueo(SIN_BLOQUEO);
      // El administrador entra a su panel (alta de usuarios); los demás, al dashboard de siempre.
      navigate(authStore.esAdministrador ? '/admin' : '/dashboard');
      return;
    }

    // Solo cuentan las credenciales rechazadas por el servidor (401); un corte
    // de red o un error 500 no deben acercar al usuario al bloqueo.
    if (result.status === 401) {
      const intentos = actual.intentos + 1;
      if (intentos >= MAX_INTENTOS) {
        const estado = { intentos, hasta: Date.now() + BLOQUEO_MIN * 60 * 1000 };
        guardarBloqueo(estado);
        setBloqueo(estado);
        setAhora(Date.now());
        setPassword('');
        showError(`Superó los ${MAX_INTENTOS} intentos permitidos. El acceso quedó bloqueado por ${BLOQUEO_MIN} minutos.`);
        return;
      }
      guardarBloqueo({ intentos, hasta: null });
      setBloqueo({ intentos, hasta: null });
      showError(`${result.message ?? 'Credenciales inválidas'}. Intentos restantes: ${MAX_INTENTOS - intentos}.`);
      return;
    }
    showError(result.message ?? 'Credenciales inválidas');
  };

  return (
    <div className={styles.stage}>
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
          <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="login-titulo">
            <button type="button" className={styles.closeBtn} onClick={cerrarLogin} aria-label="Cerrar">
              <FontAwesomeIcon icon={faXmark} />
            </button>

            <h2 id="login-titulo" className={styles.cardHeading}>Iniciar sesión</h2>
            <p className={styles.subtitle}>Ingrese sus credenciales para acceder al sistema.</p>

            {bloqueado && bloqueo.hasta !== null && (
              <p className={styles.bloqueo} role="alert">
                {textoBloqueo(bloqueo.hasta - ahora)}
              </p>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor="email">Correo electrónico</label>
                <input
                  type="email"
                  id="email"
                  autoComplete="email"
                  autoFocus
                  disabled={bloqueado}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  required
                  autoComplete="current-password"
                  disabled={bloqueado}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading || bloqueado}>
                {loading ? 'Ingresando...' : bloqueado ? 'Acceso bloqueado' : 'Ingresar'}
              </button>
            </form>

            <p className={styles.hint}>
              ¿Problemas para ingresar? Contacte al administrador del sistema.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;