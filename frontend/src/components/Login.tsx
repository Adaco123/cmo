import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authStore } from '../auth';
import './Login.css';

const Login: React.FC = () => {

  // ---- Electric Border Canvas ----
  const electricCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameId = useRef<number>(0);
  const time = useRef(0);
  const lastFrameTime = useRef(performance.now());

  useEffect(() => {
    const container = containerRef.current;
    const canvas = electricCanvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuration
    const color = '#14b8a6';
    const speed = 0.8;
    const chaos = 0.10;
    const borderRadius = 24;
    const thickness = 1.8;
    const octaves = 10;
    const lacunarity = 1.6;
    const gain = 0.7;
    const amplitude = chaos;
    const frequency = 10;
    const baseFlatness = 0;
    const displacement = 55;
    const borderOffset = 50;

    let width = 0;
    let height = 0;
    let lastDpr = Math.min(window.devicePixelRatio || 1, 2);

    // Noise functions
    const random = (x: number) => (Math.sin(x * 12.9898) * 43758.5453) % 1;

    const noise2D = (x: number, y: number) => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;
      const a = random(i + j * 57);
      const b = random(i + 1 + j * 57);
      const c = random(i + (j + 1) * 57);
      const d = random(i + 1 + (j + 1) * 57);
      const ux = fx * fx * (3.0 - 2.0 * fx);
      const uy = fy * fy * (3.0 - 2.0 * fy);
      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    };

    const octavedNoise = (
      x: number,
      octaves: number,
      lacunarity: number,
      gain: number,
      baseAmplitude: number,
      baseFrequency: number,
      t: number,
      seed: number,
      baseFlatness: number
    ) => {
      let y = 0;
      let amp = baseAmplitude;
      let freq = baseFrequency;
      for (let i = 0; i < octaves; i++) {
        let octAmp = amp;
        if (i === 0) octAmp *= baseFlatness;
        y += octAmp * noise2D(freq * x + seed * 100, t * freq * 0.3);
        freq *= lacunarity;
        amp *= gain;
      }
      return y;
    };

    const getCornerPoint = (
      cx: number,
      cy: number,
      r: number,
      startAngle: number,
      arcLength: number,
      progress: number
    ) => {
      const angle = startAngle + progress * arcLength;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };

    const getRoundedRectPoint = (
      t: number,
      left: number,
      top: number,
      w: number,
      h: number,
      r: number
    ) => {
      const straightW = w - 2 * r;
      const straightH = h - 2 * r;
      const cornerArc = (Math.PI * r) / 2;
      const totalPerim = 2 * straightW + 2 * straightH + 4 * cornerArc;
      const dist = t * totalPerim;
      let acc = 0;

      if (dist <= acc + straightW) {
        const p = (dist - acc) / straightW;
        return { x: left + r + p * straightW, y: top };
      }
      acc += straightW;
      if (dist <= acc + cornerArc) {
        const p = (dist - acc) / cornerArc;
        return getCornerPoint(left + w - r, top + r, r, -Math.PI / 2, Math.PI / 2, p);
      }
      acc += cornerArc;
      if (dist <= acc + straightH) {
        const p = (dist - acc) / straightH;
        return { x: left + w, y: top + r + p * straightH };
      }
      acc += straightH;
      if (dist <= acc + cornerArc) {
        const p = (dist - acc) / cornerArc;
        return getCornerPoint(left + w - r, top + h - r, r, 0, Math.PI / 2, p);
      }
      acc += cornerArc;
      if (dist <= acc + straightW) {
        const p = (dist - acc) / straightW;
        return { x: left + w - r - p * straightW, y: top + h };
      }
      acc += straightW;
      if (dist <= acc + cornerArc) {
        const p = (dist - acc) / cornerArc;
        return getCornerPoint(left + r, top + h - r, r, Math.PI / 2, Math.PI / 2, p);
      }
      acc += cornerArc;
      if (dist <= acc + straightH) {
        const p = (dist - acc) / straightH;
        return { x: left, y: top + h - r - p * straightH };
      }
      acc += straightH;
      const p = (dist - acc) / cornerArc;
      return getCornerPoint(left + r, top + r, r, Math.PI, Math.PI / 2, p);
    };

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width + borderOffset * 2;
      height = rect.height + borderOffset * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      lastDpr = dpr;
    };

    const drawElectricBorder = (currentTime: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (dpr !== lastDpr) {
        updateSize();
      }

      const deltaTime = (currentTime - lastFrameTime.current) / 1000;
      time.current += deltaTime * speed;
      lastFrameTime.current = currentTime;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      const scale = displacement;
      const left = borderOffset;
      const top = borderOffset;
      const borderW = width - 2 * borderOffset;
      const borderH = height - 2 * borderOffset;
      const maxR = Math.min(borderW, borderH) / 2;
      const r = Math.min(borderRadius, maxR);

      const approxPerim = 2 * (borderW + borderH) + 2 * Math.PI * r;
      const sampleCount = Math.floor(approxPerim / 2);

      ctx.beginPath();

      for (let i = 0; i <= sampleCount; i++) {
        const progress = i / sampleCount;
        const point = getRoundedRectPoint(progress, left, top, borderW, borderH, r);

        const xNoise = octavedNoise(
          progress * 8,
          octaves,
          lacunarity,
          gain,
          amplitude,
          frequency,
          time.current,
          0,
          baseFlatness
        );
        const yNoise = octavedNoise(
          progress * 8,
          octaves,
          lacunarity,
          gain,
          amplitude,
          frequency,
          time.current,
          1,
          baseFlatness
        );

        const dx = point.x + xNoise * scale;
        const dy = point.y + yNoise * scale;

        if (i === 0) ctx.moveTo(dx, dy);
        else ctx.lineTo(dx, dy);
      }

      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      animFrameId.current = requestAnimationFrame(drawElectricBorder);
    };

    // Initialize
    updateSize();
    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(container);
    animFrameId.current = requestAnimationFrame(drawElectricBorder);

    // Cleanup
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      resizeObserver.disconnect();
    };
  }, []);



  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ---- Form submission (prevent default) ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await authStore.login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
      return;
    }
    setError(result.message ?? 'Credenciales inválidas');
  };

  return (
    <>
      {/* Ambient Layers */}
      <div className="ambient-layer">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
      </div>
      <div className="dot-grid" />

      <div className="main-wrapper">
      
        

        {/* Hero Section */}
        <section className="hero">
          <div className="hero-grid">
            <div className="hero-content">
              <span className="hero-eyebrow">Acceso Profesional</span>
              <button type="button" className="hero-title hero-title-button" onClick={() => navigate('/')}
                style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}>
                Bienvenido a <span className="hero-title-accent">CMO</span>
              </button>
              <p className="hero-desc">
                Ingrese a su panel de gestión de estudios, historial clínico y herramientas de diagnóstico avanzado.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 22v-4M4 12H2M6 12H4M20 12h-2M22 12h-2M19.07 4.93l-2.83 2.83M4.93 19.07l2.83-2.83M19.07 19.07l-2.83-2.83M4.93 4.93l2.83 2.83" />
                  </svg>
                  Nombre de Usuario: agg &amp; Contraseña: 123456
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Acceso 24/7
                </span>
              </div>
            </div>

            {/* Login Form with Electric Border */}
            <div className="login-visual electric-border-wrapper" ref={containerRef}>
              <div className="eb-canvas-container">
                <canvas className="eb-canvas" ref={electricCanvasRef} />
              </div>
              <div className="eb-layers">
                <div className="eb-glow-1" />
                <div className="eb-glow-2" />
                <div className="eb-background-glow" />
              </div>
              <div className="eb-content-inner">
                <div className="login-form-container">
                  <h2 className="form-title">Iniciar Sesión</h2>
                  <p className="form-subtitle">Acceda a su cuenta CMO</p>
                  <form className="login-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                      <label htmlFor="email">Correo</label>
                      <input
                        type="email"
                        id="email"
                        placeholder="correo@ejemplo.com"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
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
                    {error ? <div className="form-error">{error}</div> : null}
                    <div className="form-options">
                      <label>
                        <input type="checkbox" defaultChecked /> Recordarme
                      </label>
                      <a href="#">¿Olvidó su contraseña?</a>
                    </div>
                    <button type="submit" className="btn-submit" disabled={loading}>
                      {loading ? 'Entrando...' : 'Entrar al Sistema'}
                    </button>
                    
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Login;