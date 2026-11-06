
import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

// ==========================================
// CUSTOM TRADITIONAL DIWALI DIYA
// ==========================================

const Diya = ({ className = '' }) => (
  <svg
    viewBox="0 0 100 75"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
  >
    <defs>
      <linearGradient id="diyaBowl" x1="0" y1="35" x2="0" y2="72">
        <stop stopColor="#FBBF24" />
        <stop offset="0.45" stopColor="#B45309" />
        <stop offset="1" stopColor="#78350F" />
      </linearGradient>

      <linearGradient id="diyaRim" x1="0" y1="35" x2="0" y2="47">
        <stop stopColor="#FDE68A" />
        <stop offset="0.5" stopColor="#D97706" />
        <stop offset="1" stopColor="#92400E" />
      </linearGradient>

      <linearGradient id="diyaFlame" x1="50" y1="0" x2="50" y2="36">
        <stop stopColor="#FDE047" />
        <stop offset="0.5" stopColor="#F97316" />
        <stop offset="1" stopColor="#DC2626" />
      </linearGradient>

      <radialGradient id="diyaCenter">
        <stop stopColor="#FDE68A" />
        <stop offset="1" stopColor="#92400E" />
      </radialGradient>
    </defs>

    {/* Clay Bowl */}
    <path
      d="M5 37 Q50 27 95 37 Q88 69 50 72 Q12 69 5 37Z"
      fill="url(#diyaBowl)"
      stroke="#92400E"
      strokeWidth="1.5"
    />

    {/* Decorative Bowl Lines */}
    <path
      d="M17 48 Q50 58 83 48"
      stroke="#FCD34D"
      strokeWidth="1"
      opacity=".8"
    />

    <path
      d="M23 56 Q50 65 77 56"
      stroke="#FBBF24"
      strokeWidth="1"
      opacity=".7"
    />

    {/* Floral Design */}
    <g transform="translate(50 53)" stroke="#FDE68A" strokeWidth="1">
      <circle r="9" fill="url(#diyaCenter)" />
      <circle r="5" />
      <circle r="2" fill="#FDE68A" />

      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
        <ellipse
          key={angle}
          cx="0"
          cy="-6"
          rx="2"
          ry="3.5"
          transform={`rotate(${angle})`}
          fill="#D97706"
        />
      ))}
    </g>

    {/* Golden Rim */}
    <ellipse
      cx="50"
      cy="37"
      rx="46"
      ry="10"
      fill="url(#diyaRim)"
      stroke="#92400E"
      strokeWidth="1.5"
    />

    <ellipse
      cx="50"
      cy="36"
      rx="40"
      ry="5.5"
      fill="#78350F"
      opacity=".7"
    />

    {/* Oil Reflection */}
    <ellipse
      cx="50"
      cy="35"
      rx="26"
      ry="3.5"
      fill="#FDE68A"
      opacity=".45"
    />

    {/* Wick */}
    <path
      d="M50 37 Q49 31 52 28"
      stroke="#451A03"
      strokeWidth="2.5"
      strokeLinecap="round"
    />

    {/* Animated Flame */}
    <g className="diya-flame">
      <path
        d="M51 30 C37 19 46 8 52 0 C54 10 65 18 57 29 Q54 33 51 30Z"
        fill="url(#diyaFlame)"
      />

      <path
        d="M52 27 C47 21 51 15 53 11 C59 20 58 25 52 27Z"
        fill="#FEF3C7"
      />
    </g>
  </svg>
);

// ==========================================
// ANIMATION STYLES
// ==========================================

const AnimationStyles = () => (
  <style>{`
    @keyframes diyaFloat {
      0%, 100% {
        transform: translateY(0) rotate(-3deg);
      }
      50% {
        transform: translateY(-4px) rotate(3deg);
      }
    }

    @keyframes diyaFlame {
      0%, 100% {
        transform: scale(1) rotate(-2deg);
      }
      50% {
        transform: scale(1.08) rotate(2deg);
      }
    }

    @keyframes goldShimmer {
      0% {
        background-position: 200% center;
      }
      100% {
        background-position: -200% center;
      }
    }

    @keyframes sparkle {
      0%, 100% {
        opacity: 0.25;
        transform: scale(0.6);
      }
      50% {
        opacity: 1;
        transform: scale(1.3);
      }
    }

    @keyframes particleBurst {
      0% {
        transform: translate(0, 0) scale(0.3) rotate(0deg);
        opacity: 0;
      }
      15% {
        opacity: 1;
      }
      100% {
        transform:
          translate(var(--x), var(--y))
          scale(var(--scale))
          rotate(var(--rotate));
        opacity: 0;
      }
    }

    .diwali-diya {
      animation: diyaFloat 3s ease-in-out infinite;
    }

    .diya-flame {
      transform-origin: 52px 30px;
      animation: diyaFlame 0.8s ease-in-out infinite;
    }

    .diwali-title {
      background: linear-gradient(
        100deg,
        #b45309 0%,
        #f59e0b 25%,
        #fef3c7 45%,
        #eab308 60%,
        #b45309 100%
      );
      background-size: 250% auto;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: goldShimmer 5s linear infinite;
    }

    .diwali-sparkle {
      animation: sparkle 2s ease-in-out infinite;
    }

    .diwali-particle {
      animation: particleBurst 2.6s cubic-bezier(0.16,1,0.3,1) forwards;
    }

    @media (prefers-reduced-motion: reduce) {
      .diwali-diya,
      .diya-flame,
      .diwali-title,
      .diwali-sparkle {
        animation: none !important;
      }
    }
  `}</style>
);

// ==========================================
// MAIN DIWALI EVENT COMPONENT
// ==========================================

const Event = () => {
  const [particles, setParticles] = useState([]);
  const [isCelebrating, setIsCelebrating] = useState(false);

  // Automatically clear celebration
  useEffect(() => {
    if (!isCelebrating) return;

    const timer = setTimeout(() => {
      setIsCelebrating(false);
      setParticles([]);
    }, 2800);

    return () => clearTimeout(timer);
  }, [isCelebrating]);

  // Trigger Diwali Celebration
  const triggerCelebration = () => {
    if (isCelebrating) return;

    const items = [
      '✨', '🪔', '🌟', '🎆', '🎇',
      '💛', '🌸', '🪷', '💫', '🎉',
      '⭐', '✨', '🪔', '🌼'
    ];

    const newParticles = Array.from({ length: 28 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      char: items[Math.floor(Math.random() * items.length)],
      x: `${(Math.random() - 0.5) * 280}px`,
      y: `${-(Math.random() * 140 + 30)}px`,
      rotate: `${Math.random() * 360}deg`,
      scale: Math.random() * 0.8 + 0.6,
      delay: `${Math.random() * 0.3}s`
    }));

    setParticles(newParticles);
    setIsCelebrating(true);
  };

  return (
    <div className="relative inline-flex items-center shrink-0 select-none">

      <AnimationStyles />

      {/* Main Diwali Header */}
      <button
        type="button"
        onClick={triggerCelebration}
        title="Click to celebrate Happy Diwali! 🪔"
        aria-label="Celebrate Happy Diwali"
        className="
          relative group overflow-visible
          flex items-center
          gap-1 sm:gap-2
          px-1 sm:px-2.5
          py-0.5 sm:py-1.5
          rounded-full
          bg-transparent
          shadow-none
          transition-all duration-300
          hover:scale-105
          active:scale-95
          cursor-pointer
        "
      >

        {/* Left Sparkle */}
        <Sparkles
          size={10}
          className="
            absolute -top-1 -left-1
            text-amber-500 diwali-sparkle
            sm:w-3 sm:h-3
          "
        />

        {/* Left Custom Diya */}
        <div className="diwali-diya shrink-0">
          <Diya className="w-7 h-6 sm:w-11 sm:h-10" />
        </div>

        {/* Center Text */}
        <div className="
          flex flex-col items-center justify-center
          gap-0 min-w-0
        ">

          <span className="
            text-[6px] sm:text-[9px]
            font-bold uppercase
            tracking-[0.2em] sm:tracking-[0.3em]
            text-orange-700 leading-tight
          ">
            Wishing You A
          </span>

          <span className="
            diwali-title
            text-[12px] sm:text-base
            font-black font-serif
            tracking-wide leading-tight
            whitespace-nowrap
          ">
            Happy Diwali
          </span>

          <span className="
            text-[6px] sm:text-[9px]
            font-semibold tracking-wider
            text-amber-700 leading-tight
          ">
            Festival of Lights ✨
          </span>

        </div>

        {/* Right Custom Diya */}
        <div className="diwali-diya shrink-0">
          <Diya className="w-7 h-6 sm:w-11 sm:h-10" />
        </div>

        {/* Right Sparkle */}
        <Sparkles
          size={10}
          className="
            absolute -bottom-1 -right-1
            text-orange-500 diwali-sparkle
            sm:w-3 sm:h-3
          "
        />

      </button>

      {/* Diwali Celebration Burst */}
      {isCelebrating && (
        <div className="
          absolute inset-0 z-50
          flex items-center justify-center
          pointer-events-none overflow-visible
        ">
          {particles.map((p) => (
            <span
              key={p.id}
              className="
                absolute text-xl sm:text-2xl
                diwali-particle
              "
              style={{
                '--x': p.x,
                '--y': p.y,
                '--rotate': p.rotate,
                '--scale': p.scale,
                animationDelay: p.delay,
                filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.6))'
              }}
            >
              {p.char}
            </span>
          ))}
        </div>
      )}

    </div>
  );
};

export default Event;