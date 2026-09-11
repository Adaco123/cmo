import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './TiltCard.module.css';

/**
 * TiltCard — tarjeta con inclinación 3D que sigue el puntero (adaptada del
 * componente Vue "ProfileCard" que nos compartieron).
 *
 * A propósito NO tiene ciclo de colores: a diferencia del original (que
 * iba rotando por todo un arcoíris según la posición del mouse), acá solo
 * se mueve la tarjeta (rotateX/rotateY) y hay un brillo de un solo tono
 * (--tilt-glow, teal por defecto) que se mueve con el puntero. El color
 * nunca cambia, solo su intensidad según qué tan cerca del centro esté
 * el mouse.
 *
 * Tampoco fija alto/aspect-ratio (el tamaño lo da el contenido, para poder
 * meter un formulario real) ni bloquea el pointer-events de lo de adentro
 * (el original hacía eso para un avatar no interactivo; acá los inputs y
 * botones quedan clickeables con normalidad).
 */

export interface TiltCardProps {
  children: React.ReactNode;
  enableTilt?: boolean;
  className?: string;
}

const ANIMATION_CONFIG = {
  SMOOTH_DURATION: 600,
  INITIAL_DURATION: 1500,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
};

const clamp = (value: number, min = 0, max = 100) => Math.min(Math.max(value, min), max);
const round = (value: number, precision = 3) => parseFloat(value.toFixed(precision));
const adjust = (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) =>
  round(toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin));
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const TiltCard: React.FC<TiltCardProps> = ({ children, enableTilt = true, className }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  const updateCardTransform = useCallback((offsetX: number, offsetY: number) => {
    const card = cardRef.current;
    const wrap = wrapperRef.current;
    if (!card || !wrap) return;

    const width = card.clientWidth;
    const height = card.clientHeight;
    if (!width || !height) return;

    const percentX = clamp((100 / width) * offsetX);
    const percentY = clamp((100 / height) * offsetY);
    const centerX = percentX - 50;
    const centerY = percentY - 50;
    const distanceFromCenter = clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1);

    const properties: Record<string, string> = {
      '--pointer-x': `${percentX}%`,
      '--pointer-y': `${percentY}%`,
      '--pointer-from-top': `${percentY / 100}`,
      '--pointer-from-left': `${percentX / 100}`,
      '--glow-intensity': `${distanceFromCenter}`,
      '--rotate-x': `${round(-(centerX / 5))}deg`,
      '--rotate-y': `${round(centerY / 4)}deg`,
    };

    Object.entries(properties).forEach(([prop, value]) => wrap.style.setProperty(prop, value));
  }, []);

  const cancelAnimation = useCallback(() => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  const createSmoothAnimation = useCallback(
    (duration: number, startX: number, startY: number) => {
      const wrap = wrapperRef.current;
      if (!wrap) return;

      const startTime = performance.now();
      const targetX = wrap.clientWidth / 2;
      const targetY = wrap.clientHeight / 2;

      const loop = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = clamp(elapsed / duration, 0, 1);
        const eased = easeInOutCubic(progress);
        const currentX = adjust(eased, 0, 1, startX, targetX);
        const currentY = adjust(eased, 0, 1, startY, targetY);

        updateCardTransform(currentX, currentY);

        if (progress < 1) {
          rafId.current = requestAnimationFrame(loop);
        } else {
          wrap.style.setProperty('--glow-intensity', '0');
        }
      };

      rafId.current = requestAnimationFrame(loop);
    },
    [updateCardTransform]
  );

  const handlePointerMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!enableTilt || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      updateCardTransform(event.clientX - rect.left, event.clientY - rect.top);
    },
    [enableTilt, updateCardTransform]
  );

  const handlePointerEnter = useCallback(() => {
    if (!enableTilt) return;
    cancelAnimation();
    setIsActive(true);
  }, [enableTilt, cancelAnimation]);

  const handlePointerLeave = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!enableTilt) return;
      setIsActive(false);
      createSmoothAnimation(ANIMATION_CONFIG.SMOOTH_DURATION, event.nativeEvent.offsetX, event.nativeEvent.offsetY);
    },
    [enableTilt, createSmoothAnimation]
  );

  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap || !enableTilt) return;

    wrap.style.setProperty('--glow-intensity', '0');

    const initialX = wrap.clientWidth - ANIMATION_CONFIG.INITIAL_X_OFFSET;
    const initialY = ANIMATION_CONFIG.INITIAL_Y_OFFSET;
    updateCardTransform(initialX, initialY);
    createSmoothAnimation(ANIMATION_CONFIG.INITIAL_DURATION, initialX, initialY);

    return () => cancelAnimation();
    // Se ejecuta una sola vez al montar (equivalente a mounted()/beforeUnmount() del original).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={[styles['pc-card-wrapper'], isActive ? styles.active : '', className].filter(Boolean).join(' ')}
      onMouseEnter={handlePointerEnter}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
    >
      <section
        ref={cardRef}
        className={[styles['pc-card'], isActive ? styles.active : ''].filter(Boolean).join(' ')}
      >
        <div className={styles['pc-inside']}>
          <div className={styles['pc-glare']} />
          <div className={styles['pc-content']}>{children}</div>
        </div>
      </section>
    </div>
  );
};

export default TiltCard;