'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sparkles, UserPlus } from 'lucide-react';
import { isDemoSession, setSessionAuthenticated } from '@/lib/auth-storage';

export default function DemoModeBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [inDemoMode, setInDemoMode] = useState(false);

  useEffect(() => {
    const syncDemo = () => {
      setInDemoMode(isDemoSession());
    };
    syncDemo();
    window.addEventListener('medtrac-auth-changed', syncDemo);
    window.addEventListener('storage', syncDemo);
    return () => {
      window.removeEventListener('medtrac-auth-changed', syncDemo);
      window.removeEventListener('storage', syncDemo);
    };
  }, [pathname]);

  if (!inDemoMode || pathname === '/' || pathname.startsWith('/share/')) {
    return null;
  }

  const handleCreateAccount = () => {
    // Exits demo mode, auto-deletes temporary demo workspace, and routes to Sign Up
    setSessionAuthenticated(false);
    router.push('/?mode=signup');
  };

  return (
    <div
      role="region"
      aria-label="Demo mode notice"
      className="no-print bg-gradient-to-r from-[#0f1f56] via-[#173182] to-[#0f1f56] text-white border-b border-blue-400/30 px-4 py-2.5 shadow-xs"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[11px] font-extrabold uppercase tracking-wide shrink-0">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Demo Mode</span>
          </span>
          <span className="text-blue-50">
            You&apos;re in demo mode. Sample data only. Create a free account to upload your own reports.
          </span>
        </div>

        <button
          type="button"
          onClick={handleCreateAccount}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-[#1d63ff] font-black text-xs shadow-2xs transition tap-press shrink-0 self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Create account</span>
        </button>
      </div>
    </div>
  );
}
