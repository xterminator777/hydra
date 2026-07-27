'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import ProfileSetupModal from '@/components/ProfileSetupModal';
import AuthModal from '@/components/AuthModal';

interface Stream {
  id: string;
  title: string;
  livekit_room_name: string;
  created_at: string;
  categories: {
    name: string;
    slug: string;
  };
}

export default function DirectoryPage() {

  // 1. Add auth state variables
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // 2. Auth listener & initial session loader
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        await fetchProfile(session.user.id);
      }
    }

    checkSession();

    // Listen for auth state changes (login, logout, signup)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        await fetchProfile(session.user.id);
      } else {
        setCurrentUserId(null);
        setUserProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      // New user with no profile yet -> open profile modal!
      setProfileModalOpen(true);
    } else {
      setUserProfile({
        username: profile.username,
        avatarUrl: profile.avatar_url,
      });
    }
  };


  // Profile State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ username: string; avatarUrl: string } | null>(null);

  // Streams State
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch User Profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          console.log('No active authenticated user session.');
          return;
        }

        // Set user ID immediately so ProfileSetupModal can mount
        setCurrentUserId(user.id);

        // Fetch profile (use maybeSingle to avoid 0-row exception)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error querying profile table:', profileError.message);
        }

        if (!profile) {
          console.log('No profile row found for user. Triggering setup modal...');
          setProfileModalOpen(true);
        } else {
          setUserProfile({
            username: profile.username,
            avatarUrl: profile.avatar_url,
          });
        }
      } catch (err) {
        console.error('Unexpected error loading user profile:', err);
      }
    }

    loadProfile();
  }, []);

  // 2. Fetch Active Streams
  const fetchStreams = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = selectedCategory
        ? `/api/streams?category=${selectedCategory}`
        : '/api/streams';

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load streams');
      }

      setStreams(data.streams || []);
    } catch (err: any) {
      console.error('Error fetching stream directory:', err);
      setError(err.message || 'Could not load active streams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, [selectedCategory]);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Live Streams</h1>
          <p className="text-gray-400 text-sm mt-1">
            Discover active broadcasts across technology, gaming, music, and more.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* User Profile / Handle Button */}
          <button
            onClick={() => {
              if (!currentUserId) {
                // If logged out, prompt login first so they get a valid UUID
                setAuthModalOpen(true);
              } else {
                setProfileModalOpen(true);
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg transition text-xs font-semibold text-gray-300"
          >
            {
              userProfile ? (
                <>
                  <img
                    src={userProfile.avatarUrl}
                    alt={userProfile.username}
                    className="w-4 h-4 rounded-full bg-zinc-800"
                  />
                  <span className="text-white">@{userProfile.username}</span>
                </>
              ) : (
                <span>👤 Setup Profile</span>
              )}
          </button>

          {/* Sign Out Button */}
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-3 py-2 bg-zinc-900 hover:bg-red-950/50 hover:text-red-400 border border-zinc-800 rounded-lg transition text-xs text-zinc-400"
          >
            Sign Out
          </button>

          <button
            onClick={fetchStreams}
            className="px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 transition"
          >
            Refresh
          </button>

          <Link
            href="/broadcast"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 font-semibold text-xs rounded-lg text-white transition flex items-center gap-1.5"
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Go Live
          </Link>
        </div>
      </div >

      {/* Category Filter Pills */}
      < div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none" >
        {
          [
            { name: 'All Categories', slug: '' },
            { name: 'Tech', slug: 'tech' },
            { name: 'Music', slug: 'music' },
            { name: 'Gaming', slug: 'gaming' },
            { name: 'General', slug: 'general' },
          ].map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${selectedCategory === cat.slug
                ? 'bg-white text-black font-bold'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800'
                }`}
            >
              {cat.name}
            </button>
          ))
        }
      </div >

      {/* State A: Error Banner */}
      {
        error && (
          <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )
      }

      {/* State B: Loading Skeleton */}
      {
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-gray-800 rounded-xl h-64 animate-pulse p-4 flex flex-col justify-between"
              >
                <div className="w-full h-36 bg-gray-800 rounded-lg"></div>
                <div className="space-y-2 mt-4">
                  <div className="w-3/4 h-4 bg-gray-800 rounded"></div>
                  <div className="w-1/2 h-3 bg-gray-800 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : streams.length === 0 ? (
          /* State C: Empty State */
          <div className="text-center py-20 bg-gray-900/50 border border-gray-800/80 rounded-2xl p-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-800 rounded-full mb-3 text-gray-400">
              📡
            </div>
            <h3 className="text-lg font-bold text-white">No active streams found</h3>
            <p className="text-gray-400 text-xs mt-1 max-w-sm mx-auto">
              {selectedCategory
                ? `There are currently no broadcasts in the "${selectedCategory}" category.`
                : 'There are no active streams live right now. Be the first to start streaming!'}
            </p>
            <Link
              href="/broadcast"
              className="inline-block mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-xs font-semibold rounded-lg text-white transition"
            >
              Start Broadcast Studio
            </Link>
          </div>
        ) : (
          /* State D: Active Stream Card Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {streams.map((stream) => (
              <Link
                key={stream.id}
                href={`/watch/${stream.livekit_room_name}`}
                className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl overflow-hidden transition-all duration-200 flex flex-col shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                {/* Thumbnail / Stage Preview Box */}
                <div className="w-full h-44 bg-gray-950 relative flex items-center justify-center border-b border-gray-800/80 group-hover:bg-gray-900 transition">
                  <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded flex items-center gap-1.5 shadow">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    LIVE
                  </div>

                  {/* SVG Play Icon (Replaces ▶️ Emoji/Character on iOS & Web) */}
                  <div className="text-gray-700 group-hover:text-cyan-400 group-hover:scale-110 transition duration-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-12 h-12"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>

                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur text-[10px] text-gray-300 font-mono px-2 py-0.5 rounded border border-white/10">
                    {stream.categories?.name || 'General'}
                  </div>
                </div>

                {/* Card Meta Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="font-bold text-sm text-white line-clamp-1 group-hover:text-red-400 transition">
                      {stream.title}
                    </h2>
                    <p className="text-xs font-mono text-gray-500 mt-1 line-clamp-1">
                      Room: {stream.livekit_room_name}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400">
                    <span>
                      Started {new Date(stream.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-red-400 group-hover:underline font-semibold">
                      Watch Stream →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      }

      {/* Profile Setup / Edit Modal */}
      {/* Profile Setup / Edit Modal */}
      <ProfileSetupModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        userId={currentUserId || 'guest_user'}
        currentUsername={userProfile?.username || ''}
        currentAvatarUrl={userProfile?.avatarUrl}
        onProfileUpdated={(username, avatarUrl) => {
          setUserProfile({ username, avatarUrl });
        }}
      />

      {/* Auth Modal (Must be outside currentUserId check so logged-out users can see it!) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => {
          // Session state change listener handles fetching/prompting profile
        }}
      />


    </main >
  );
}
