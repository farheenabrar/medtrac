'use client';

import React, { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [showTagline, setShowTagline] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 1. At 1.0 second (1000ms), animate in the tagline below Medtrac
    const taglineTimer = setTimeout(() => {
      setShowTagline(true);
    }, 1000);

    // 2. At 2.0 seconds (2000ms), begin smooth fade out
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2000);

    // 3. At 2.5 seconds (2500ms), completely remove from DOM
    const unmountTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2500);

    return () => {
      clearTimeout(taglineTimer);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      id="medtrac-splash-screen"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#2563eb] text-white transition-opacity duration-500 ease-in-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Medtrac Splash Screen"
    >
      {/* Ambient soft glow background */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent" />

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 sm:gap-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            M
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white drop-shadow-sm font-sans">
            Medtrac
          </h1>
        </div>

        {/* Tagline animating in after 1 second in italics */}
        <div
          className={`mt-4 sm:mt-5 transition-all duration-500 ease-out transform ${
            showTagline
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-3 scale-95'
          }`}
        >
          <p className="italic text-base sm:text-lg md:text-xl text-blue-100/95 font-medium tracking-wide drop-shadow-xs">
            &ldquo;Track. Retrieve. Share.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
