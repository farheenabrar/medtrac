'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  UploadCloud,
  FileText,
  SlidersHorizontal,
  Database,
  User,
} from 'lucide-react';
import { isSupabaseConfigured, getStoredProfile } from '@/lib/data-service';
import { isSessionAuthenticated } from '@/lib/auth-storage';
import MedtracLogo from './MedtracLogo';
import LiveHealthBanner from './LiveHealthBanner';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [hasSupabase, setHasSupabase] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
    setHasSupabase(isSupabaseConfigured());
    setIsAuthenticated(isSessionAuthenticated());

    const syncState = async () => {
      const authed = isSessionAuthenticated();
      setIsAuthenticated(authed);
      if (authed) {
        router.prefetch('/feed-filters');
        router.prefetch('/upload');
        router.prefetch('/dashboard');
        router.prefetch('/brief');
        router.prefetch('/profile');
        const stored = await getStoredProfile();
        setProfilePhoto(stored?.profile_photo || null);
      } else {
        setProfilePhoto(null);
      }
    };

    syncState();

    window.addEventListener('medtrac-auth-changed', syncState);
    window.addEventListener('medtrac-profile-updated', syncState);
    window.addEventListener('storage', syncState);
    return () => {
      window.removeEventListener('medtrac-auth-changed', syncState);
      window.removeEventListener('medtrac-profile-updated', syncState);
      window.removeEventListener('storage', syncState);
    };
  }, [pathname, router]);

  // On the landing Welcome page ('/'), doctor share view ('/share/...'), or when unauthenticated,
  // hide navigation so only the first screen is visible until a user profile is created after sign up.
  if (pathname === '/' || pathname.startsWith('/share/') || !isAuthenticated) {
    return null;
  }

  const navLinks = [
    { href: '/feed-filters', label: 'Feed Filters', icon: SlidersHorizontal },
    { href: '/upload', label: 'Uploads', icon: UploadCloud },
    { href: '/dashboard', label: 'Dashboard', icon: Activity },
    { href: '/brief', label: 'Doctor Brief', icon: FileText },
  ];

  const isProfileActive = pathname === '/profile';

  return (
    <>
      {/* Top Desktop / Tablet Header */}
      <header className="no-print sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/feed-filters" className="flex items-center gap-3 group tap-press">
            <MedtracLogo size="md" className="group-hover:scale-105 transition-transform duration-200" />
            <div>
              <span className="font-black text-lg tracking-tight text-slate-900 block leading-tight">
                Med<span className="text-[#1273ff]">trac</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase hidden sm:block leading-none mt-0.5">
                Metabolic Health Review
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Supabase Status Pill */}
            <div
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                hasSupabase
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-[0_1px_3px_rgba(16,185,129,0.08)]'
                  : 'bg-amber-50 text-amber-700 border-amber-200/80'
              }`}
              title={
                hasSupabase
                  ? 'Connected to Supabase PostgreSQL database'
                  : 'Running in instant preview mode with browser persistence'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  hasSupabase ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <Database className="w-3 h-3" />
              <span>{hasSupabase ? 'Supabase Synced' : 'Persistent Storage Active'}</span>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden sm:flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 text-xs font-bold">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all duration-200 ease-out tap-press ${
                      isActive
                        ? 'bg-white text-[#1273ff] shadow-[0_2px_8px_rgba(18,115,255,0.1)] font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Profile Navigation Button (Replaces Sign Out) */}
            <Link
              href="/profile"
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 ease-out tap-press ${
                isProfileActive
                  ? 'bg-gradient-to-b from-[#1e90ff] to-[#0058ff] text-white border-[#1273ff] shadow-[0_4px_12px_rgba(18,115,255,0.28)] font-black'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-2xs'
              }`}
              title="Profile"
            >
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Profile"
                  className="w-5 h-5 rounded-full object-cover border border-white/50 shrink-0"
                />
              ) : (
                <User className={`w-3.5 h-3.5 ${isProfileActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
              )}
              <span>Profile</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Global Live Health Intelligence 4-Second Smart Cycling Feed */}
      <div className="no-print max-w-5xl w-full mx-auto px-4 md:px-6 pt-4">
        <LiveHealthBanner />
      </div>

      {/* Native-Feel Mobile Floating Bottom Navigation Bar */}
      <nav className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_24px_rgba(0,0,0,0.05)] pb-safe">
        {[...navLinks, { href: '/profile', label: 'Profile', icon: User }].map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-2xl transition-all duration-200 ease-out min-w-[56px] min-h-[46px] active:scale-90 ${
                isActive
                  ? 'text-[#1273ff] font-black'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-[#1273ff] shadow-[0_2px_8px_rgba(18,115,255,0.15)]'
                    : 'bg-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-black' : 'font-semibold'}`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
