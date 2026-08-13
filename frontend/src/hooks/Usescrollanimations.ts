import { useEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Saca de CMODashboard.tsx el useEffect que anima las imágenes al hacer
 * scroll (scale + opacity) dentro del contenedor principal.
 *
 * Uso:
 *   const mainContentRef = useRef<HTMLDivElement>(null);
 *   useScrollAnimations(mainContentRef, activeTab);
 */
export function useScrollAnimations(
  containerRef: RefObject<HTMLDivElement | null>,
  dependency: unknown
) {
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const images = containerRef.current?.querySelectorAll('img');

      images?.forEach((img) => {
        gsap.fromTo(
          img,
          { scale: 0.7, opacity: 0 },
          {
            scale: 1.2,
            opacity: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: img,
              scroller: containerRef.current,
              start: 'top bottom',
              end: '+=600',
              scrub: true,
              invalidateOnRefresh: true,
            },
          }
        );
      });
    }, containerRef);

    const timer = setTimeout(() => ScrollTrigger.refresh(), 120);

    return () => {
      clearTimeout(timer);
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependency]);
}