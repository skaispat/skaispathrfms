import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';

// Custom CSS Keyframe Animations for Event Component
const AnimationStyles = () => (
  <style>{`
    @keyframes gentleFloat {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-4px) rotate(2deg); }
    }
    @keyframes floatNote1 {
      0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
      40% { opacity: 0.9; }
      100% { transform: translate(14px, -24px) scale(1.1); opacity: 0; }
    }
    @keyframes floatNote2 {
      0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
      40% { opacity: 0.9; }
      100% { transform: translate(-10px, -28px) scale(1.1); opacity: 0; }
    }
    @keyframes handiBob {
      0%, 100% { transform: translateY(0) rotate(-3deg); }
      50% { transform: translateY(-5px) rotate(3deg); }
    }
    @keyframes textShimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .animate-img-float {
      animation: gentleFloat 3.2s ease-in-out infinite;
    }
    .animate-handi-bob {
      animation: handiBob 3.5s ease-in-out infinite;
    }
    .animate-note-float-1 {
      animation: floatNote1 2.8s ease-out infinite;
    }
    .animate-note-float-2 {
      animation: floatNote2 2.8s ease-out 1.4s infinite;
    }
    .animate-text-shimmer {
      background-size: 200% auto;
      animation: textShimmer 4s linear infinite;
    }
  `}</style>
);

const Event = () => {
  const [isSparkling, setIsSparkling] = useState(false);
  const [particles, setParticles] = useState([]);

  const celebrationItems = ['🪶', '🍯', '🪈', '🧈', '🪷', '🌟', '🪔', '🚩', '🎉', '🎵', '🎶'];

  const triggerCelebration = () => {
    setIsSparkling(true);

    // Generate dynamic celebration particles
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: Date.now() + i,
      char: celebrationItems[Math.floor(Math.random() * celebrationItems.length)],
      x: (Math.random() - 0.5) * 220,
      y: -(Math.random() * 110 + 40),
      rotate: (Math.random() - 0.5) * 360,
      scale: Math.random() * 0.6 + 0.8,
      delay: Math.random() * 0.15,
    }));

    setParticles(newParticles);

    setTimeout(() => {
      setIsSparkling(false);
    }, 2800);
  };

  return (
    <div className="relative inline-flex items-center select-none shrink-0 max-w-full">
      <AnimationStyles />

      {/* Main Responsive Animated Janmashtami Event Header Item (Compact & Fits Header Height) */}
      <div
        onClick={triggerCelebration}
        className="relative group flex items-center gap-1 xs:gap-1.5 py-0 my-0 transition-all duration-300 cursor-pointer select-none max-w-[calc(100vw-130px)] sm:max-w-none hover:scale-105 active:scale-95"
        title="Click to celebrate Happy Janmashtami! 🪶🍯✨"
      >
        {/* Animated Custom Image from public/img.png (Krishna Flute & Feather) - Fits header perfectly */}
        <div className="relative flex items-center justify-center shrink-0">
          <img
            src="/img.png"
            alt="Krishna Bansuri & Mor Pankh"
            className="h-10 xs:h-10 sm:h-10 max-h-10 w-auto object-contain animate-img-float drop-shadow-[0_2px_6px_rgba(217,119,6,0.3)]"
          />
          <span className="absolute -top-1 -right-1 text-[9px] sm:text-[10px] animate-note-float-1 pointer-events-none">🎵</span>
        </div>

        {/* Center-aligned Animated Happy Janmashtami Text in Two Compact Rows (No Vertical Gap) */}
        <div className="flex flex-col items-center text-center leading-none my-0 py-0 min-w-0 -space-y-0.5">
          <span className="text-[12px] xs:text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700 font-serif animate-text-shimmer drop-shadow-xs leading-none">
            Happy
          </span>
          <div className="flex items-center justify-center gap-0.5 m-0 p-0">
            <span className="text-[12px] xs:text-xs sm:text-sm font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700 font-serif whitespace-nowrap leading-none drop-shadow-xs animate-text-shimmer">
              Janmashtami
            </span>
            <span className="text-[9px] sm:text-[10px] animate-pulse shrink-0">✨</span>
          </div>
        </div>

        <div className="relative flex items-center justify-center shrink-0">
          <img
            src="/dahi.png"
            alt="Krishna Dahi Handi"
            className="h-10 xs:h-10 sm:h-10 max-h-10 w-auto object-contain animate-img-float drop-shadow-[0_2px_6px_rgba(217,119,6,0.3)]"
          />
        </div>
      </div>

      {/* Particle Celebration Burst */}
      {isSparkling && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-visible">
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute text-lg sm:text-2xl transition-all pointer-events-none"
              style={{
                transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg) scale(${p.scale})`,
                transition: `all 2.4s cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}s`,
                opacity: isSparkling ? 1 : 0,
                filter: 'drop-shadow(0 2px 8px rgba(217,119,6,0.5))',
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





