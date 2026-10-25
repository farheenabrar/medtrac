'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

export default function Navigation() {
  const pathname = usePathname();
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
  }, [pathname]);

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
      <header className="no-print sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-all">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/feed-filters" className="flex items-center gap-3 group tap-press">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-[0_4px_12px_rgba(37,99,235,0.25)] group-hover:shadow-[0_6px_16px_rgba(37,99,235,0.35)] transition-all">
              M
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-slate-900 block leading-tight">
                Medtrac
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
            <nav className="hidden sm:flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/70 text-xs font-bold">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all tap-press ${
                      isActive
                        ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)] font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
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
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all tap-press ${
                isProfileActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-[0_2px_8px_rgba(37,99,235,0.25)] font-black'
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

      {/* Native-Feel Mobile Floating Bottom Navigation Bar */}
      <nav className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-2xl border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_24px_rgba(0,0,0,0.05)] pb-safe">
        {[...navLinks, { href: '/profile', label: 'Profile', icon: User }].map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-2xl transition-all min-w-[56px] min-h-[46px] active:scale-90 ${
                isActive
                  ? 'text-blue-600 font-black'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 shadow-[0_2px_8px_rgba(37,99,235,0.15)]'
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
