'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  UploadCloud,
  FileText,
  User,
  Database,
  CheckCircle2,
  Clock,
  Sparkles,
  Home,
} from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/data-service';

export default function Navigation() {
  const pathname = usePathname();
  const [hasSupabase, setHasSupabase] = useState(false);

  useEffect(() => {
    setHasSupabase(isSupabaseConfigured());
  }, []);

  // In doctor share view, do not display patient navigation
  if (pathname.startsWith('/share/')) {
    return null;
  }

  const navLinks = [
    { href: '/', label: 'Setup', icon: User },
    { href: '/upload', label: 'Upload', icon: UploadCloud },
    { href: '/dashboard', label: 'Dashboard', icon: Activity },
    { href: '/brief', label: 'Doctor Brief', icon: FileText },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm group-hover:bg-blue-700 transition">
              M
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900 block leading-tight">
                Medtrac
              </span>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:block leading-none">
                Cross-Border Metabolic Tracking
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Supabase Status Pill */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                hasSupabase
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={
                hasSupabase
                  ? 'Connected to Supabase PostgreSQL database'
                  : 'Running in instant preview mode with browser persistence'
              }
            >
              <Database className="w-3 h-3" />
              <span>{hasSupabase ? 'Supabase Synced' : 'Persistent Storage Active'}</span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center gap-1 text-xs font-semibold">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[64px] min-h-[44px] ${
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] mt-0.5">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
