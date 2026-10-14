import React from 'react';

interface PawnMascotProps {
  className?: string;
  size?: number;
  mood?: 'happy' | 'thinking' | 'celebrating';
}

export const PawnMascot: React.FC<PawnMascotProps> = ({
  className = '',
  size = 56,
  mood = 'happy',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          {/* Wood / Cream body gradient */}
          <linearGradient id="pawnBody" x1="20" y1="20" x2="80" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFF2DC" />
            <stop offset="60%" stopColor="#EED2AE" />
            <stop offset="100%" stopColor="#D5AC7E" />
          </linearGradient>

          {/* Golden crown gradient */}
          <linearGradient id="pawnCrown" x1="30" y1="10" x2="70" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFE066" />
            <stop offset="60%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Shadow gradient */}
          <radialGradient id="baseShadow" cx="50" cy="94" r="38" fx="50" fy="94" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft ground shadow */}
        <ellipse cx="50" cy="93" rx="36" ry="6" fill="url(#baseShadow)" />

        {/* Base ring */}
        <ellipse cx="50" cy="88" rx="32" ry="7" fill="url(#pawnBody)" stroke="#8C6338" strokeWidth="2" />
        <ellipse cx="50" cy="85" rx="27" ry="5.5" fill="#FFF4E3" />

        {/* Pawn body / neck curve */}
        <path
          d="M32 84 C34 68 40 56 42 46 C42 44 43 42 50 42 C57 42 58 44 58 46 C60 56 66 68 68 84 Z"
          fill="url(#pawnBody)"
          stroke="#8C6338"
          strokeWidth="2"
        />

        {/* Neck collar ring */}
        <ellipse cx="50" cy="44" rx="14" ry="3.5" fill="url(#pawnBody)" stroke="#8C6338" strokeWidth="1.5" />

        {/* Pawn head (round sphere) */}
        <circle cx="50" cy="30" r="18" fill="url(#pawnBody)" stroke="#8C6338" strokeWidth="2" />

        {/* Rosy blushing cheeks */}
        <circle cx="38" cy="35" r="3.5" fill="#FCA5A5" fillOpacity="0.75" />
        <circle cx="62" cy="35" r="3.5" fill="#FCA5A5" fillOpacity="0.75" />

        {/* Friendly cute eyes */}
        {mood === 'celebrating' ? (
          <>
            <path d="M37 28 Q41 24 45 28" stroke="#37210D" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M55 28 Q59 24 63 28" stroke="#37210D" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="41" cy="28" r="3" fill="#2E1C0C" />
            <circle cx="42.2" cy="26.8" r="1" fill="#FFFFFF" />
            <circle cx="59" cy="28" r="3" fill="#2E1C0C" />
            <circle cx="60.2" cy="26.8" r="1" fill="#FFFFFF" />
          </>
        )}

        {/* Smiling mouth */}
        {mood === 'celebrating' ? (
          <path d="M44 34 Q50 42 56 34" fill="#C2410C" stroke="#37210D" strokeWidth="1.5" strokeLinecap="round" />
        ) : (
          <path d="M45 34 Q50 38 55 34" stroke="#45260F" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}

        {/* Cute 3-point Golden Crown */}
        <path
          d="M34 16 L38 23 L50 17 L62 23 L66 16 L65 24 Q50 26 35 24 Z"
          fill="url(#pawnCrown)"
          stroke="#92400E"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Crown pearls on tips */}
        <circle cx="34" cy="15" r="2" fill="#FEF08A" stroke="#B45309" strokeWidth="0.8" />
        <circle cx="50" cy="16" r="2.2" fill="#FEF08A" stroke="#B45309" strokeWidth="0.8" />
        <circle cx="66" cy="15" r="2" fill="#FEF08A" stroke="#B45309" strokeWidth="0.8" />
      </svg>
    </div>
  );
};

export default PawnMascot;
