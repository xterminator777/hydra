'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentUsername?: string;
  currentAvatarUrl?: string;
  onProfileUpdated: (username: string, avatarUrl: string) => void;
}

const AVATAR_PRESETS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Zodiac',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Hydra',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Spark',
];

export default function ProfileSetupModal({
  isOpen,
  onClose,
  userId,
  currentUsername = '',
  currentAvatarUrl = AVATAR_PRESETS[0],
  onProfileUpdated,
}: ProfileSetupModalProps) {
  const [username, setUsername] = useState(currentUsername);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // 1. Validate active user session from Supabase directly
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      setErrorMsg('Active session not found. Please log in or refresh the page.');
      return;
    }

    // Double check that user ID is valid
    const targetUserId = user.id || userId;
    if (!targetUserId || targetUserId === 'guest_user' || targetUserId.startsWith('guest_')) {
      setErrorMsg('You must be logged in with an authenticated account.');
      return;
    }

    const cleanUsername = username.trim().replace(/\s+/g, '_');

    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }

    setLoading(true);

    try {
      // 2. Upsert using verified user.id
      const { error } = await supabase.from('profiles').upsert(
        {
          id: targetUserId,
          username: cleanUsername,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        if (error.code === '23505') {
          setErrorMsg('Username is already taken. Please pick another one.');
        } else if (error.code === '23503') {
          setErrorMsg('Your session has expired or the user account was deleted. Please re-authenticate.');
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      onProfileUpdated(cleanUsername, avatarUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white">Setup Your Profile</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choose a unique username and avatar for chat and panel streams.
        </p>

        {errorMsg && (
          <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Avatar Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Choose Avatar
            </label>
            <div className="flex items-center justify-between gap-2">
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className={`relative rounded-full p-1 transition-all ${
                    avatarUrl === preset
                      ? 'ring-2 ring-indigo-500 scale-110 bg-indigo-500/20'
                      : 'opacity-60 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <img
                    src={preset}
                    alt="Avatar preset"
                    className="h-12 w-12 rounded-full bg-zinc-800"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Display Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_handle"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pl-8 pr-4 text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}