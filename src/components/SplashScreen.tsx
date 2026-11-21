'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import MedtracLogo from './MedtracLogo';

export default function SplashScreen() {
  const [progress, setProgress] = useState(35);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const progressTimer = setTimeout(() => {
      setProgress(100);
    }, 120);

    // Shortened to under 1 second (<1000ms)
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 550);

    const unmountTimer = setTimeout(() => {
      setIsVisible(false);
    }, 820);

    return () => {
      clearTimeout(progressTimer);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 150);
  };

  if (!isVisible) return null;

  return (
    <div
      id="medtrac-splash-screen"
      style={{
        backgroundColor: '#0c1333',
        backgroundImage: `
          radial-gradient(rgba(96, 165, 250, 0.22) 1.5px, transparent 1.5px),
          radial-gradient(ellipse at 50% 38%, rgba(29, 78, 216, 0.35) 0%, rgba(12, 19, 51, 0.95) 65%, #080d24 100%)
        `,
        backgroundSize: '28px 28px, 100% 100%',
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center text-white transition-opacity duration-200 ease-out select-none px-6 motion-reduce:hidden ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Medtrac loading screen"
    >
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center">
        <div className="mb-5">
          <MedtracLogo
            size="xl"
            showHeart={true}
            className="bg-gradient-to-br from-[#0088ff] via-[#1d63ff] to-[#00c6ff] border-[#7dd3fc]/70 shadow-[0_8px_28px_rgba(0,168,255,0.45)]"
          />
        </div>

        <div className="text-3xl sm:text-4xl font-black tracking-tight leading-none mb-3">
          <span className="text-white">Med</span>
          <span className="text-[#58b9ff]">trac</span>
        </div>

        {/* Copy aligned with main headline */}
        <p className="text-base sm:text-lg font-extrabold text-white tracking-tight mb-1.5">
          All your lab reports. One clear health timeline.
        </p>
        <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-md leading-relaxed mb-6">
          Upload your reports once. Medtrac tracks every marker over time and prepares a one-page summary for your next doctor visit.
        </p>

        {/* Progress Bar & Immediate Skip Control */}
        <div className="w-full max-w-sm space-y-2">
          <div className="w-full h-1.5 rounded-full bg-[#1b2956] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2563eb] via-[#0ea5e9] to-[#00d4ff] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 font-medium px-0.5">
            <span>Loading your timeline...</span>
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1 font-bold text-white hover:text-[#58b9ff] transition py-1 px-2 rounded-lg bg-white/10"
            >
              <span>Skip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
