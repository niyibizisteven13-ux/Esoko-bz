import React, { useEffect, useState } from 'react';

const stats = [
  { value: 'RWF 45,000', label: 'saved per merchant monthly' },
  { value: '250,000+', label: 'SMEs in Rwanda' },
  { value: '<1%', label: 'transaction fee vs 10% telecom' },
];

const modes = ['stats', 'merchant', 'impact', 'map'] as const;

type Mode = (typeof modes)[number];

export default function CircleShowcase() {
  const [modeIndex, setModeIndex] = useState(0);
  const [statIndex, setStatIndex] = useState(0);
  const [impactCount, setImpactCount] = useState(0);

  useEffect(() => {
    const switchInterval = window.setInterval(() => {
      setModeIndex((current) => (current + 1) % modes.length);
    }, 5000);

    return () => window.clearInterval(switchInterval);
  }, []);

  useEffect(() => {
    if (modes[modeIndex] !== 'stats') {
      return undefined;
    }

    setStatIndex(0);
    const ticker = window.setInterval(() => {
      setStatIndex((current) => (current + 1) % stats.length);
    }, 1500);

    return () => window.clearInterval(ticker);
  }, [modeIndex]);

  useEffect(() => {
    if (modes[modeIndex] !== 'impact') {
      return undefined;
    }

    setImpactCount(0);
    const start = performance.now();
    const duration = 2000;

    const tick = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / duration);
      setImpactCount(Math.round(45000 * progress));
      if (progress >= 1) {
        window.clearInterval(tick);
      }
    }, 40);

    return () => window.clearInterval(tick);
  }, [modeIndex]);

  return (
    <div className="circle-showcase-root">
      <style>{`
        .circle-showcase-root {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .circle-showcase-panel {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.4s ease;
          padding: 1rem;
        }

        .circle-showcase-panel.active {
          opacity: 1;
        }

        .circle-showcase-stats {
          text-align: center;
        }

        .circle-showcase-stats-value {
          font-size: 36px;
          font-weight: 900;
          line-height: 1;
          margin-bottom: 0.625rem;
        }

        .circle-showcase-stats-label {
          font-size: 12px;
          color: #E05A00;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .circle-showcase-merchant svg {
          width: 100%;
          height: 100%;
        }

        .circle-showcase-impact-ring {
          position: relative;
          width: 170px;
          height: 170px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .circle-showcase-impact-ring::before,
        .circle-showcase-impact-ring::after {
          content: '';
          position: absolute;
          border-radius: 50%;
        }

        .circle-showcase-impact-ring::before {
          width: 170px;
          height: 170px;
          border: 2px solid rgba(224, 90, 0, 0.85);
          animation: pulse-slow 1.5s ease-in-out infinite;
        }

        .circle-showcase-impact-ring::after {
          width: 130px;
          height: 130px;
          border: 2px solid rgba(224, 90, 0, 0.3);
          animation: pulse-slower 1.8s ease-in-out infinite;
        }

        .circle-showcase-impact-number {
          position: relative;
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
          text-align: center;
        }

        .circle-showcase-impact-label {
          margin-top: 0.5rem;
          font-size: 12px;
          color: #E05A00;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .circle-showcase-map svg {
          width: 100%;
          height: 100%;
        }

        .circle-showcase-progress {
          position: absolute;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 0.35rem;
        }

        .circle-showcase-dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.3);
        }

        .circle-showcase-dot.active {
          background: #E05A00;
        }

        .circle-showcase-map-label {
          position: absolute;
          top: 1rem;
          color: rgba(255, 255, 255, 0.85);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }

        .circle-showcase-map-pin {
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #E05A00;
          left: 60%;
          top: 58%;
          transform: translate(-50%, -50%);
        }

        .circle-showcase-map-pin::after {
          content: '';
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: rgba(224, 90, 0, 0.25);
          animation: ripple 1.5s ease-out infinite;
        }

        @keyframes pulse-slow {
          0%, 100% {
            transform: scale(0.95);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }

        @keyframes pulse-slower {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.02);
            opacity: 0.85;
          }
        }

        @keyframes ripple {
          0% {
            transform: scale(0.75);
            opacity: 0.75;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>

      <div className={`circle-showcase-panel ${modeIndex === 0 ? 'active' : ''}`}>
        <div className="circle-showcase-stats">
          <div className="circle-showcase-stats-value">{stats[statIndex].value}</div>
          <div className="circle-showcase-stats-label">{stats[statIndex].label}</div>
        </div>
      </div>

      <div className={`circle-showcase-panel ${modeIndex === 1 ? 'active' : ''}`}>
        <div className="circle-showcase-merchant" style={{ width: '100%', height: '100%' }}>
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="18" y="38" width="164" height="106" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(224,90,0,0.25)" strokeWidth="2" />
            <path d="M40 58h120v18H40z" fill="#E05A00" opacity="0.15" />
            <rect x="54" y="74" width="92" height="80" rx="14" fill="rgba(255,255,255,0.12)" />
            <rect x="70" y="88" width="60" height="32" rx="8" fill="#fff" />
            <rect x="78" y="96" width="16" height="4" rx="2" fill="#E05A00" />
            <rect x="78" y="104" width="36" height="4" rx="2" fill="#E05A00" />
            <path d="M80 74c0-10 8-18 18-18s18 8 18 18v10h-36V74Z" fill="#fff" />
            <circle cx="100" cy="60" r="16" fill="#fff" />
            <path d="M84 58c0-8 6-14 14-14s14 6 14 14v12H84V58Z" fill="#050505" />
            <path d="M60 112h24v28H60z" fill="#fff" />
            <path d="M70 112v-16h10v16h-10Z" fill="#E05A00" />
            <path d="M118 110h26v30h-26z" fill="#fff" />
            <path d="M134 110v-16h10v16h-10Z" fill="#E05A00" />
            <path d="M34 76h132v12H34z" fill="rgba(224,90,0,0.16)" />
            <path d="M32 88l12 60h24l10-37 24 12 18-24 24-11 6 28h24l-12-65H32Z" fill="rgba(255,255,255,0.2)" />
          </svg>
        </div>
      </div>

      <div className={`circle-showcase-panel ${modeIndex === 2 ? 'active' : ''}`}>
        <div className="circle-showcase-impact-ring">
          <div className="circle-showcase-impact-number">{impactCount.toLocaleString()}</div>
        </div>
        <div className="circle-showcase-impact-label">RWF saved today</div>
      </div>

      <div className={`circle-showcase-panel ${modeIndex === 3 ? 'active' : ''}`}>
        <div className="circle-showcase-map-label">East Africa</div>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M40 48 L54 38 L72 34 L92 42 L104 54 L110 72 L108 94 L118 110 L132 120 L138 138 L134 154 L124 158 L108 148 L98 130 L90 114 L80 104 L68 100 L56 102 L46 98 L42 86 L40 72 Z"
              fill="rgba(224,90,0,0.1)"
              stroke="#E05A00"
              strokeWidth="2"
            />
            <path
              d="M112 58 L120 54 L128 56 L134 64 L134 76 L128 88 L118 96 L108 98 L100 94 L96 84 L96 72 L100 64 Z"
              fill="rgba(255,255,255,0.2)"
            />
          </svg>
          <div className="circle-showcase-map-pin" style={{ left: '60%', top: '64%' }} />
          <div style={{ position: 'absolute', left: '67%', top: '64%', transform: 'translate(-50%, -50%)', color: 'white', fontSize: '10px', fontWeight: 700 }}>Kigali</div>
        </div>
      </div>

      <div className="circle-showcase-progress">
        {modes.map((_, index) => (
          <span key={index} className={`circle-showcase-dot ${modeIndex === index ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}
