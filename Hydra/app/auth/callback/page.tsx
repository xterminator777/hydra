'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Process and capture session from URL
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Auth callback session error:', error.message);
      }
      // Session saved! Redirect user to home page
      router.replace('/');
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
        <p className="text-sm font-medium text-slate-400">Verifying session & logging you in...</p>
      </div>
    </div>
  );
}