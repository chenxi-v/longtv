'use client';

import { useEffect, useRef } from 'react';

const ParticleBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadParticles = () => {
      if (typeof window !== 'undefined' && (window as any).particlesJS === undefined) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js';
        script.async = true;
        script.onload = () => {
          initParticles();
        };
        document.body.appendChild(script);
      } else if ((window as any).particlesJS !== undefined) {
        initParticles();
      }
    };

    const initParticles = () => {
      if (containerRef.current && (window as any).particlesJS !== undefined) {
        (window as any).particlesJS('particles-js', {
          particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: '#ffffff' },
            shape: { type: 'circle' },
            opacity: { value: 0.5, random: false },
            size: { value: 1.5, random: true },
            line_linked: {
              enable: true,
              distance: 150,
              color: '#ffffff',
              opacity: 0.3,
              width: 1
            },
            move: {
              enable: true,
              speed: 2,
              direction: 'none',
              random: true,
              straight: false,
              out_mode: 'out',
              bounce: false
            }
          },
          interactivity: {
            detect_on: 'canvas',
            events: {
              onhover: { enable: false, mode: 'repulse' },
              onclick: { enable: false, mode: 'push' },
              resize: true
            }
          },
          retina_detect: true
        });
      }
    };

    loadParticles();
  }, []);

  return (
    <div 
      ref={containerRef}
      id="particles-js"
      className="absolute inset-0"
      style={{ zIndex: 1 }}
    />
  );
};

export default ParticleBackground;
