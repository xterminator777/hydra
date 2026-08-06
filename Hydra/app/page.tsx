'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Exo } from 'next/font/google';
import { supabase } from '@/lib/supabaseClient';
import ProfileSetupModal from '@/components/ProfileSetupModal';
import AuthModal from '@/components/AuthModal';

// 🟢 Google Exo Font Setup
const exo = Exo({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  variable: '--font-exo',
});

interface Stream {
  id: string;
  title: string;
  livekit_room_name: string;
  created_at: string;
  thumbnail_url?: string | null;
  is_live: boolean;
  profiles?: {
    id: string;
    username: string;
    avatar_url?: string | null;
  } | null;
  categories?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function DirectoryPage() {
  // Auth state variables
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Profile State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{
    username: string;
    avatarUrl: string;
  } | null>(null);

  // Streams State
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 🟢 Generated once on client to prevent SSR hydration mismatch
  const [soloRoomName, setSoloRoomName] = useState<string>('solo_room');

  useEffect(() => {
    setSoloRoomName(`solo_${Math.floor(Math.random() * 10000)}`);
  }, []);

  // 1. Auth listener & initial session loader
  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        await fetchProfile(session.user.id);
      }
    }

    checkSession();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setCurrentUserId(session.user.id);
          await fetchProfile(session.user.id);
        } else {
          setCurrentUserId(null);
          setUserProfile(null);
        }
      }
    );

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
      setProfileModalOpen(true);
    } else {
      setUserProfile({
        username: profile.username,
        avatarUrl: profile.avatar_url,
      });
    }
  };

  // 2. Fetch Active Streams with Realtime Subscription
  const fetchStreams = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('streams')
        .select(`
          id,
          title,
          livekit_room_name,
          thumbnail_url,
          is_live,
          created_at,
          profiles (
            id,
            username,
            avatar_url
          ),
          categories (
            id,
            name,
            slug
          )
        `)
        .eq('is_live', true)
        .order('created_at', { ascending: false });

      if (selectedCategory) {
        query = query.eq('categories.slug', selectedCategory);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;
      
      // Filter out any entries where category filter returned null categories
      const activeStreams = (data || []).filter((s) => {
        if (!selectedCategory) return true;
        return (s as any).categories?.slug === selectedCategory;
      });

      setStreams(activeStreams as unknown as Stream[]);
    } catch (err: any) {
      console.error('Error fetching home streams:', err);
      setError(err.message || 'Failed to load active broadcasts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();

    // 🟢 Realtime Subscription: Update grid when a stream starts or ends on any device
    const channel = supabase
      .channel('public:streams')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'streams' },
        () => {
          fetchStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCategory]);

  return (
    <div className={`min-h-screen bg-gray-950 text-white ${exo.className}`}>
      {/* ⚡️ NEOPULSE.LIVE TOP ANNOUNCEMENT BANNER */}
      <div className="bg-gray-900/90 border-b border-gray-800 px-4 py-2.5 text-center relative z-50 backdrop-blur-md">
        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold tracking-wide">
          <span className="inline-block w-2 h-2 rounded-full bg-[#03fcad] animate-pulse" />
          <span className="text-gray-300">Welcome to the future of live streaming on</span>

          {/* Brand Name */}
          <span
            className="font-black tracking-wider uppercase text-base sm:text-lg drop-shadow-[0_0_12px_rgba(3,252,173,0.4)]"
            style={{ color: '#03fcad' }}
          >
            NeoPulse.live
          </span>

          <span className="hidden sm:inline text-gray-400">| Interactive Multi-Seat Stages</span>
        </div>
      </div>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Live Streams</h1>
            <p className="text-gray-400 text-sm mt-1">
              Discover active broadcasts across technology, gaming, music, and more.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/wallet"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-yellow-500/40 text-yellow-400 rounded-xl transition text-xs font-bold shadow-[0_0_10px_rgba(234,179,8,0.1)] hover:border-yellow-400 cursor-pointer"
            >
              <span>🪙</span>
              <span>My Wallet</span>
            </Link>

            {/* User Profile / Handle Button */}
            <button
              onClick={() => {
                if (!currentUserId) {
                  setAuthModalOpen(true);
                } else {
                  setProfileModalOpen(true);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg transition text-xs font-semibold text-gray-300 cursor-pointer"
            >
              {userProfile ? (
                <>
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={userProfile.username}
                      className="w-4 h-4 rounded-full bg-zinc-800 object-cover"
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-[#03fcad] text-slate-950 font-black text-[9px] flex items-center justify-center">
                      {userProfile.username?.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-white">@{userProfile.username}</span>
                </>
              ) : (
                <span>Log In</span>
              )}
            </button>

            {/* Sign Out Button */}
            {currentUserId && (
              <button
                onClick={() => supabase.auth.signOut()}
                className="px-3 py-2 bg-zinc-900 hover:bg-red-950/50 hover:text-red-400 border border-zinc-800 rounded-lg transition text-xs text-zinc-400 cursor-pointer"
              >
                Sign Out
              </button>
            )}

            <button
              onClick={fetchStreams}
              className="px-3 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg text-xs font-semibold text-gray-300 transition cursor-pointer"
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
        </div>

        {/* 📱 🟢 Solo Stream Launch Banner */}
        <Link
          href={`/solo/${soloRoomName}?host=${userProfile?.username || 'Streamer'}`}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gradient-to-r from-purple-900/40 via-slate-900 to-pink-900/40 border border-purple-500/30 rounded-2xl hover:border-purple-400 transition cursor-pointer gap-4 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xl shrink-0">
              📱
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Start Solo Mobile Stream
                <span className="bg-purple-500/20 text-purple-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-purple-500/30">
                  NEW
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-screen 9:16 layout optimized for mobile streaming, live chat & gifts.
              </p>
            </div>
          </div>
          <span className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs rounded-xl transition whitespace-nowrap self-end sm:self-center">
            Go Solo →
          </span>
        </Link>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { name: 'All Categories', slug: '' },
            { name: 'Tech', slug: 'tech' },
            { name: 'Music', slug: 'music' },
            { name: 'Gaming', slug: 'gaming' },
            { name: 'General', slug: 'general' },
          ].map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-white text-black font-bold'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* State A: Error Banner */}
        {error && (
          <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* State B: Loading Skeleton */}
        {loading ? (
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
            {streams.map((stream) => {
              const isSoloStream = stream.livekit_room_name?.startsWith('solo_');
              const targetHref = isSoloStream
                ? `/solo/${stream.livekit_room_name}?host=${stream.profiles?.username || 'Streamer'}`
                : `/watch/${stream.livekit_room_name}`;

              return (
                <Link
                  key={stream.id}
                  href={targetHref}
                  className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl overflow-hidden transition-all duration-200 flex flex-col shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  {/* Thumbnail / Stage Preview Box */}
                  <div className="w-full h-44 bg-gray-950 relative flex items-center justify-center border-b border-gray-800/80 group-hover:bg-gray-900 transition overflow-hidden">
                    {stream.thumbnail_url ? (
                      <img
                        src={stream.thumbnail_url}
                        alt={stream.title || 'Live Stream'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      /* SVG Play Icon Fallback */
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
                    )}

                    <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded flex items-center gap-1.5 shadow">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                      LIVE
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
                      <p className="text-xs text-slate-400 mt-1">
                        @{stream.profiles?.username || 'Streamer'}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400">
                      <span>
                        Started{' '}
                        {new Date(stream.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-red-400 group-hover:underline font-semibold">
                        Watch Stream →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

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

        {/* Auth Modal */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            // Session listener triggers profile load
          }}
        />
      </main>
    </div>
  );
}