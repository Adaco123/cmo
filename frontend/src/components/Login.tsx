import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useErrorToast } from './ErrorToastProvider';
import cmoLogo from '../assets/cmo.png';
import TiltCard from './TiltCard';
import styles from './Login.module.css';

const ECG_PATH =
  'M0,35 L140,35 L165,10 L190,58 L215,4 L240,62 L265,35 L560,35 L585,22 L610,35 ' +
  'L740,35 L765,10 L790,58 L815,4 L840,62 L865,35 L1200,35';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showError } = useErrorToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      {/* Marca de agua a pantalla completa, detrás de ambos paneles */}
      <div className={styles.watermark}>
        <img src={cmoLogo} alt="" />
      </div>

      {/* ===== Panel izquierdo: identidad + monitor ===== */}
      <div className={styles.brandPane}>
        <div className={styles.glowOrb} />

        <h1 className={styles.heading}>Gestión clínica en tiempo real, sin fricción.</h1>
        <p className={styles.desc}>
          Historiales, episodios y seguimiento de pacientes en un solo panel, pensado
          para el ritmo de un consultorio real.
        </p>

        <div className={styles.ecgTrack}>
          <div className={styles.ecgScroll}>
            <svg viewBox="0 0 1200 70" preserveAspectRatio="none">
              <path d={ECG_PATH} />
            </svg>
            <svg viewBox="0 0 1200 70" preserveAspectRatio="none">
              <path d={ECG_PATH} />
            </svg>
          </div>
        </div>

        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <b>128</b>
            <span>Pacientes hoy</span>
          </div>
          <div className={styles.stat}>
            <b>24/7</b>
            <span>Disponibilidad</span>
          </div>
          <div className={styles.stat}>
            <b>99.9%</b>
            <span>Continuidad</span>
          </div>
        </div>
      </div>

      {/* ===== Panel derecho: formulario ===== */}
      <div className={styles.formPane}>
        <TiltCard className={styles.loginTilt}>
          <div className={styles.card}>
            <div className={styles.brand}>
              <img src={cmoLogo} alt="CMO" />
              <div className={styles.brandName}>
                CMO
                <span>Gestión clínica</span>
              </div>
            </div>

            <h2 className={styles.cardHeading}>Bienvenido de nuevo</h2>
            <p className={styles.subtitle}>Ingresa tus credenciales para continuar</p>

            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor="email">Correo electrónico</label>
                <input
                  type="email"
                  id="email"
                  placeholder="correo@ejemplo.com"
                  autoComplete="email"
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
    </div>
  );
};

export default Login;