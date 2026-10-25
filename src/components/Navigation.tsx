'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  UploadCloud,
  FileText,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { getStoredProfile } from '@/lib/data-service';
import { isSessionAuthenticated } from '@/lib/auth-storage';
import MedtracLogo from './MedtracLogo';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
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
    { href: '/feed-filters', label: 'Health Feed', icon: SlidersHorizontal },
    { href: '/upload', label: 'Uploads', icon: UploadCloud },
    { href: '/dashboard', label: 'Dashboard', icon: Activity },
    { href: '/brief', label: 'Doctor Brief', icon: FileText },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <>
      {/* Top Desktop / Tablet Header */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-blue-100/90 px-4 py-3.5 shadow-[0_4px_20px_rgba(18,40,107,0.05)] transition-all">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link href="/feed-filters" className="flex items-center gap-3.5 group tap-press shrink-0">
            <MedtracLogo size="md" className="group-hover:scale-105 transition-transform duration-200" />
            <div>
              <span className="font-black text-xl tracking-tight text-slate-900 block leading-tight">
                Med<span className="text-[#1d63ff]">trac</span>
              </span>
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase hidden md:block leading-none mt-0.5">
                Metabolic Health Review
              </span>
            </div>
          </Link>

          {/* Properly Sized & App-Color-Synced Desktop Navigation Buttons */}
          <nav className="hidden sm:flex items-center gap-2 p-1.5 bg-[#f0f6ff] rounded-[20px] border border-[#d8e6ff] shadow-inner">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              const isProfileTab = link.href === '/profile';
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs md:text-sm transition-all duration-200 ease-out tap-press ${
                    isActive
                      ? 'bg-gradient-to-b from-[#1e90ff] to-[#1d63ff] text-white font-black shadow-[0_4px_14px_rgba(29,99,255,0.3)] border border-[#60b0ff]/40'
                      : 'bg-white/70 text-[#1e3a8a] hover:bg-white hover:text-[#1d63ff] font-extrabold border border-transparent hover:border-blue-200/70 shadow-2xs'
                  }`}
                >
                  {isProfileTab && profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="Profile"
                      className="w-5 h-5 rounded-full object-cover border border-white/60 shrink-0"
                    />
                  ) : (
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white stroke-[2.5]' : 'text-[#1d63ff] stroke-[2.2]'
                      }`}
                    />
                  )}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Native-Feel Mobile Floating Bottom Navigation Bar */}
      <nav className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-blue-100 px-2 py-2 flex items-center justify-around shadow-[0_-4px_24px_rgba(18,40,107,0.07)] pb-safe">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 ease-out min-w-[60px] min-h-[48px] active:scale-90 ${
                isActive
                  ? 'text-[#1d63ff] font-black'
                  : 'text-slate-500 hover:text-[#1d63ff]'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-b from-[#1e90ff] to-[#1d63ff] text-white shadow-[0_3px_10px_rgba(29,99,255,0.28)]'
                    : 'bg-[#f0f6ff] text-[#1d63ff]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
              </div>
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'font-black' : 'font-bold'}`}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
