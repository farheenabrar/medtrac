'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Activity, Globe, ArrowRight } from 'lucide-react';
import MedtracLogo from './MedtracLogo';

export default function SplashScreen() {
  const [progress, setProgress] = useState(12);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return Math.min(100, prev + 8);
      });
    }, 150);

    // Begin smooth fade out at 2.1 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2100);

    // Completely remove from DOM at 2.6 seconds
    const unmountTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2600);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  const handleSkip = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 250);
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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center text-white transition-opacity duration-500 ease-out select-none px-6 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Medtrac AI Splash Screen"
    >
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center">
        {/* AI Orbital Emblem Container */}
        <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-[38px] bg-[#132154]/75 border border-[#2c4a9e]/50 shadow-[0_0_60px_rgba(37,99,235,0.35)] flex items-center justify-center mb-6">
          {/* Top Floating Pill: Global AI */}
          <div className="absolute -top-3 z-20 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#193178] border border-[#3d6ee0]/80 text-[11px] font-extrabold text-blue-100 shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
            <Sparkles className="w-3 h-3 text-[#60c5ff]" />
            <span>Global AI</span>
          </div>

          {/* Dashed Orbital Ring */}
          <div className="absolute w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-dashed border-[#4d80e6]/45 animate-[spin_28s_linear_infinite]" />

          {/* Glowing Medtrac Squircle Logo with Globe & Heart */}
          <MedtracLogo
            size="xl"
            showHeart={true}
            className="bg-gradient-to-br from-[#0088ff] via-[#1d63ff] to-[#00c6ff] border-[#7dd3fc]/70 shadow-[0_8px_28px_rgba(0,168,255,0.45)]"
          />
        </div>

        {/* Two-Tone Brand Title: Med + trac */}
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-4">
          <span className="text-white">Med</span>
          <span className="text-[#58b9ff]">trac</span>
        </h1>

        {/* AI Subtitle */}
        <p className="text-sm sm:text-base text-slate-200/95 font-medium max-w-md leading-relaxed mb-6">
          Your unified health records vault and AI chronic care briefing companion across cities and doctors.
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#111e4d]/85 border border-[#2a4796]/70 text-xs font-semibold text-slate-200 shadow-2xs">
            <Globe className="w-3.5 h-3.5 text-[#58b9ff]" />
            <span>Multi-Country Lab Sync</span>
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#111e4d]/85 border border-[#2a4796]/70 text-xs font-semibold text-slate-200 shadow-2xs">
            <Activity className="w-3.5 h-3.5 text-[#58b9ff]" />
            <span>Chronic Condition Tracking</span>
          </span>
        </div>

        {/* Progress Bar & Status Footer */}
        <div className="w-full max-w-md space-y-2.5">
          <div className="w-full h-1.5 rounded-full bg-[#1b2956] overflow-hidden p-0">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2563eb] via-[#0ea5e9] to-[#00d4ff] transition-all duration-150 ease-out shadow-[0_0_12px_rgba(0,212,255,0.7)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300/80 font-medium px-0.5">
            <span>Initializing AI health intelligence...</span>
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1 font-bold text-slate-300 hover:text-white transition"
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
