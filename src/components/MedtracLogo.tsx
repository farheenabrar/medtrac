'use client';

import React from 'react';

interface MedtracLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showHeart?: boolean;
  className?: string;
}

export default function MedtracLogo({
  size = 'md',
  showHeart = false,
  className = '',
}: MedtracLogoProps) {
  const dimensions = {
    sm: 'w-8 h-8 rounded-[10px]',
    md: 'w-10 h-10 rounded-[13px]',
    lg: 'w-14 h-14 rounded-[18px]',
    xl: 'w-20 h-20 rounded-[24px]',
  }[size];

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-11 h-11',
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none bg-gradient-to-b from-[#1e90ff] via-[#1273ff] to-[#0051e6] border border-[#63b3ff]/60 shadow-[0_6px_18px_rgba(0,85,255,0.28),inset_0_1px_1px_rgba(255,255,255,0.35)] ${dimensions} ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes} text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.12)]`}
      >
        {/* Outer Globe Circle */}
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.1" />
        {/* Equator Horizontal Line */}
        <path d="M3.2 12H20.8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        {/* Vertical Meridian Ellipse */}
        <ellipse cx="12" cy="12" rx="4.2" ry="9" stroke="currentColor" strokeWidth="2.1" />

        {/* Optional Coral-Pink Heart inside Globe (used on AI Splash Screen) */}
        {showHeart && (
          <path
            d="M12 15.7C12 15.7 8.2 13.1 8.2 10.5C8.2 9.2 9.2 8.2 10.4 8.2C11.1 8.2 11.7 8.6 12 9.1C12.3 8.6 12.9 8.2 13.6 8.2C14.8 8.2 15.8 9.2 15.8 10.5C15.8 13.1 12 15.7 12 15.7Z"
            fill="#ff5c77"
            stroke="#ffffff"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}
