import React, { useState } from 'react';

const Event = () => {
  const [isSparkling, setIsSparkling] = useState(false);

  const triggerCelebration = () => {
    setIsSparkling(true);
    setTimeout(() => setIsSparkling(false), 2500);
  };

  return (
    <div
      onClick={triggerCelebration}
      className="relative flex items-center gap-1.5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-[#FDE047] text-slate-950 shadow-md border border-amber-300 hover:scale-105 transition-all cursor-pointer select-none group shrink-0"
      title="Click to celebrate Friendship Day! 🤝✨"
    >
      <h2 className="text-xs sm:text-sm md:text-base font-black tracking-tight text-slate-950 uppercase leading-none whitespace-nowrap drop-shadow-xs">
        Happy Friendship Day!🤝
      </h2>

      {/* Celebration burst */}
      {isSparkling && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
          <span className="absolute text-base sm:text-xl -top-6 left-2 animate-bounce">🎈</span>
          <span className="absolute text-base sm:text-xl -top-8 left-1/3 animate-ping">🎉</span>
          <span className="absolute text-base sm:text-xl -top-6 right-2 animate-bounce">💖</span>
          <span className="absolute text-base sm:text-xl -top-8 right-1/3 animate-pulse">⭐</span>
          <span className="absolute text-lg sm:text-2xl -bottom-6 left-1/4 animate-bounce">🥳</span>
          <span className="absolute text-lg sm:text-2xl -bottom-6 right-1/4 animate-bounce">✨</span>
        </div>
      )}
    </div>
  );
};

export default Event;
