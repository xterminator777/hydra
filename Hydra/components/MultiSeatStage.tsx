'use client';

import React, { useState, useEffect } from 'react';
import {
  useParticipants,
  VideoTrack,
  ParticipantContext,
  useChat,
  useLocalParticipant,
  useRoomContext,
  RoomAudioRenderer,
  useIsSpeaking,
} from '@livekit/components-react';
import { Track, RoomEvent, Participant } from 'livekit-client';
import { GiftOverlay, GiftEvent } from './GiftOverlay';
import { EndStreamButton } from './EndStreamButton';
import { RechargeModal } from './RechargeModal';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const TOTAL_SEATS = 9;

const AVAILABLE_GIFTS = [
  { type: 'rose', icon: '🌹', cost: 1 },
  { type: 'diamond', icon: '💎', cost: 10 },
  { type: 'rocket', icon: '🚀', cost: 100 },
  { type: 'crown', icon: '👑', cost: 500 },
] as const;

// 1. ISOLATED SEAT TILE COMPONENT (With Click-to-Open Moderation Menu)
const SeatTile = React.memo(function SeatTile({
  participant,
  index,
  isHost,
  roomName,
  isLocalHost,
  hostUserId,
}: {
  participant: Participant;
  index: number;
  isHost?: boolean;
  isLocalHost?: boolean;
  roomName?: string;
  hostUserId?: string;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = !participant.isMicrophoneEnabled;
  const [showMenu, setShowMenu] = useState(false);

  const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
  const cameraTrack = cameraPublication?.track;

  const displayIdentity = participant.identity
    ? participant.identity.replace(/^host_/, '')
    : `Guest ${index}`;

  const handleModerate = async (action: 'kick' | 'ban', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents tile click toggle
    setShowMenu(false);

    if (!roomName || !participant.identity) return;

    const confirmed = confirm(
      `Are you sure you want to ${action.toUpperCase()} @${displayIdentity}?`
    );
    if (!confirmed) return;

    try {
      const response = await fetch('/api/streams/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          identity: participant.identity,
          action,
          hostUserId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert(`Failed to ${action}: ${data.error}`);
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
    }
  };

  const handleTileClick = () => {
    // Only open the menu if the local user is Host and they clicked a guest tile
    if (isLocalHost && !isHost) {
      setShowMenu((prev) => !prev);
    }
  };

  return (
    <div
      onClick={handleTileClick}
      className={`w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden rounded-lg border border-slate-800 transition ${
        isLocalHost && !isHost ? 'cursor-pointer hover:border-slate-700' : ''
      }`}
    >
      {/* Active speaker border overlay */}
      {isSpeaking && (
        <div className="absolute inset-0 border-2 border-cyan-400 z-10 pointer-events-none rounded-lg ring-2 ring-cyan-400/40" />
      )}

      {cameraTrack && cameraPublication ? (
        <VideoTrack
          trackRef={{
            participant,
            source: Track.Source.Camera,
            publication: cameraPublication,
          }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
          {displayIdentity.charAt(0).toUpperCase() || 'U'}
        </div>
      )}

      {/* 🔴 HOST CLICK-TO-OPEN MODERATION MENU */}
      {isLocalHost && !isHost && showMenu && (
        <div
          className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-1.5 p-2 animate-fadeIn"
          onClick={(e) => e.stopPropagation()} // Prevent clicking overlay from closing immediately
        >
          <span className="text-[10px] font-bold text-slate-300 truncate w-full text-center mb-0.5">
            @{displayIdentity}
          </span>
          <button
            onClick={(e) => handleModerate('kick', e)}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] py-1.5 rounded transition shadow cursor-pointer"
          >
            ⚠️ Kick Guest
          </button>
          <button
            onClick={(e) => handleModerate('ban', e)}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] py-1.5 rounded transition shadow cursor-pointer"
          >
            🚫 Ban User
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] py-1 rounded transition mt-0.5 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Mic Status Indicator */}
      {isMuted && (
        <div className="absolute top-1 right-1 bg-black/60 p-0.5 rounded-full text-[8px] z-10">
          🔇
        </div>
      )}

      {/* Bottom Label Tag */}
      <div className="absolute bottom-1 left-1 right-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center justify-between text-[9px] z-10">
        <span className="font-semibold truncate max-w-[65px] text-white">
          {displayIdentity}
        </span>
        {isHost && (
          <div className="flex items-center gap-1">
            <span className="text-cyan-400 font-bold text-[8px]">HOST</span>
          </div>
        )}
      </div>
    </div>
  );
});

export function MultiSeatStage() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { chatMessages, send } = useChat();
  const [messageText, setMessageText] = React.useState('');
  const [activeGifts, setActiveGifts] = useState<GiftEvent[]>([]);

  const [streamTitle, setStreamTitle] = useState<string>('');
  const [hostUsername, setHostUsername] = useState<string>('');
  const [hostUserId, setHostUserId] = useState<string | null>(null);

  const room = useRoomContext();
  const router = useRouter();

  const [copied, setCopied] = useState(false);

  // 🪙 MONETIZATION STATE
  const [userCoins, setUserCoins] = useState<number>(0);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  // Function to copy the shareable watch link to clipboard
  const handleCopyShareLink = () => {
    if (!room?.name) return;

    // Constructs https://neopulse.live/watch/room_tech_12345
    const shareUrl = `${window.location.origin}/watch/${room.name}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset button label after 2s
    });
  };

  // State for authenticated local user ID
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 🟢 Fetch current user ID & Wallet Balance on mount
  useEffect(() => {
    async function loadUserAndWallet() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);

        // Fetch current coin balance from 'wallets'
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle();

        if (wallet) {
          setUserCoins(wallet.balance);
        }
      }
    }
    loadUserAndWallet();
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchStreamDetails() {
      // 1. Fallback to URL path if room?.name hasn't hydrated yet
      const urlRoomName = window.location.pathname.split('/').pop();
      const targetRoomName = room?.name || (urlRoomName !== 'watch' ? urlRoomName : null);

      if (!targetRoomName) return;

      // 2. Query 'streams' strictly by room name (case-insensitive)
      const { data: streamData, error: streamError } = await supabase
        .from('streams')
        .select('title, host_id')
        .ilike('livekit_room_name', targetRoomName)
        .maybeSingle();

      if (streamError) {
        console.error('Error fetching stream details:', streamError.message);
        return;
      }

      if (streamData && isMounted) {
        if (streamData.title) {
          setStreamTitle(streamData.title);
        }

        if (streamData.host_id) {
          setHostUserId(streamData.host_id);

          // Query 'profiles' using stream's host_id
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', streamData.host_id)
            .maybeSingle();

          if (profileData?.username && isMounted) {
            setHostUsername(profileData.username);
          }
        }
      }
    }

    fetchStreamDetails();

    const retryTimer = setTimeout(() => {
      if (isMounted) {
        fetchStreamDetails();
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
    };
  }, [room?.name, room?.state]);

  // 🟢 COIN DEDUCTION & GIFT HANDLER
  const handleSendGift = async (gift: (typeof AVAILABLE_GIFTS)[number]) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert('Please log in to send gifts!');
      return;
    }

    if (userCoins < gift.cost) {
      // Open Recharge modal if balance is insufficient
      setRechargeOpen(true);
      return;
    }

    try {
      // 1. Call API route to process wallet deduction in Supabase
      const response = await fetch('/api/coins/send-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          hostId: hostUserId,
          giftCost: gift.cost,
          giftType: gift.type,
          roomName: room?.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to send gift.');
        return;
      }

      // 2. Update local state with new balance
      setUserCoins(data.newBalance);

      // 3. Broadcast gift JSON payload over WebRTC data channel for stage animation
      const giftPayload = JSON.stringify({
        isGift: true,
        giftType: gift.type,
        icon: gift.icon,
        senderName: localParticipant.identity
          ? localParticipant.identity.replace(/^host_/, '')
          : 'Anonymous',
      });

      await send(giftPayload);

      triggerGiftAnimation(
        localParticipant.identity
          ? localParticipant.identity.replace(/^host_/, '')
          : 'You',
        gift.type,
        gift.icon
      );
    } catch (err) {
      console.error('Error executing gift transaction:', err);
    }
  };

  const triggerGiftAnimation = (
    senderName: string,
    giftType: 'rose' | 'diamond' | 'rocket' | 'crown',
    icon: string
  ) => {
    const newGift: GiftEvent = {
      id: `${Date.now()}-${Math.random()}`,
      senderName,
      giftType,
      icon,
    };
    setActiveGifts((prev) => [...prev, newGift]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    await send(messageText);
    setMessageText('');
  };

  React.useEffect(() => {
    if (chatMessages.length === 0) return;
    const latestMsg = chatMessages[chatMessages.length - 1];

    try {
      const parsed = JSON.parse(latestMsg.message);
      if (parsed.isGift) {
        triggerGiftAnimation(
          latestMsg.from?.identity
            ? latestMsg.from.identity.replace(/^host_/, '')
            : 'Viewer',
          parsed.giftType,
          parsed.icon
        );
      }
    } catch {
      // Normal chat message
    }
  }, [chatMessages]);

  const handleRemoveGift = (id: string) => {
    setActiveGifts((prev) => prev.filter((g) => g.id !== id));
  };

  const handleJoinStage = async (seatIndex: number) => {
    try {
      await localParticipant.setCameraEnabled(true);
      await localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      console.error('Failed to enable camera/mic:', error);
      alert('Could not access camera/microphone to join the stage.');
    }
  };

  const hostParticipant =
    participants.find((p) => p.identity.toLowerCase().startsWith('host_')) ||
    participants.find((p) => p.identity.toLowerCase().includes('host'));

  const stageGuests = participants.filter((p) => {
    if (p === hostParticipant) return false;

    let hasPublishedVideo = false;
    let hasPublishedAudio = false;

    p.videoTrackPublications.forEach((track) => {
      if (track && !track.isMuted) hasPublishedVideo = true;
    });

    p.audioTrackPublications.forEach((track) => {
      if (track && !track.isMuted) hasPublishedAudio = true;
    });

    return hasPublishedVideo || hasPublishedAudio;
  });

  const seats = Array.from({ length: TOTAL_SEATS }, (_, index) => {
    if (index === 0) return hostParticipant;
    return stageGuests[index - 1] || null;
  });

  const textChatMessages = chatMessages.filter((msg) => {
    try {
      const parsed = JSON.parse(msg.message);
      return !parsed.isGift;
    } catch {
      return true;
    }
  });

  const isHost = Boolean(
    localParticipant?.identity &&
    hostParticipant?.identity &&
    localParticipant.identity === hostParticipant.identity
  );

  const isLocalUserOnStage = Boolean(
    !isHost &&
    localParticipant &&
    (localParticipant.isCameraEnabled || localParticipant.isMicrophoneEnabled)
  );

  const handleLeaveStage = async () => {
    try {
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setMicrophoneEnabled(false);
    } catch (error) {
      console.error('Failed to leave stage:', error);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      if (room) {
        await room.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting from room:', error);
    } finally {
      router.push('/');
    }
  };

  React.useEffect(() => {
    if (!room) return;
    const handleDisconnected = () => {
      router.push('/');
    };

    room.on(RoomEvent.Disconnected, handleDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room, router]);

  const displayHostHandle = hostUsername
    ? `@${hostUsername}`
    : hostParticipant?.identity
      ? `@${hostParticipant.identity.replace(/^host_/, '')}`
      : '@host';

  const displayTitle = streamTitle || 'Live Broadcast';
  const hostInitial = displayHostHandle.replace('@', '').charAt(0).toUpperCase() || 'H';

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden relative font-sans">
      <RoomAudioRenderer />

      <GiftOverlay
        activeGifts={activeGifts}
        onAnimationEnd={handleRemoveGift}
      />

      {/* HEADER BAR */}
      <header className="px-4 py-3 bg-slate-950/40 backdrop-blur-md flex items-center justify-between z-10 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center font-bold text-xs border border-white/20">
            {hostInitial}
          </div>
          <div>
            <h1 className="text-xs font-bold leading-none text-white capitalize">
              {displayTitle}
            </h1>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
              Host: {displayHostHandle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 🪙 COIN BALANCE & TOP-UP CHIP */}
          <button
            onClick={() => setRechargeOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 border border-yellow-500/40 text-yellow-400 font-mono text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            title="Click to recharge coins"
          >
            <span>🪙</span>
            <span className="font-bold">{userCoins}</span>
            <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1 rounded font-sans uppercase">
              + Add
            </span>
          </button>

          {/* 🔗 Share Stream Link Button */}
          <button
            onClick={handleCopyShareLink}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-2.5 py-1 rounded-lg border border-white/10 transition cursor-pointer flex items-center gap-1.5"
            title="Copy watch link to share"
          >
            <span>{copied ? '✅ Copied!' : '🔗 Share Link'}</span>
          </button>

          <span className="bg-black/40 px-2 py-0.5 rounded-full text-[10px] text-slate-300 font-semibold border border-white/10">
            👥 {participants.length}
          </span>

          {isLocalUserOnStage && (
            <button
              onClick={handleLeaveStage}
              className="bg-amber-600/80 hover:bg-amber-500 text-white font-bold text-xs px-2.5 py-1 rounded-lg border border-amber-500/30 transition cursor-pointer"
              title="Stop sharing video/audio and return to audience"
            >
              Leave Stage
            </button>
          )}

          {isHost ? (
            <EndStreamButton streamId={room?.name || 'stream_stage'} />
          ) : (
            <button
              onClick={handleLeaveRoom}
              className="bg-red-600/80 hover:bg-red-500 text-white font-bold text-xs px-2.5 py-1 rounded-lg border border-red-500/30 transition cursor-pointer"
              title="Leave room"
            >
              Leave Room
            </button>
          )}
        </div>
      </header>

      {/* 3x3 GRID */}
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 p-2 bg-slate-950/80 aspect-square w-full max-w-md mx-auto z-10 rounded-xl my-auto">
        {seats.map((participant, index) => {
          if (participant) {
            return (
              <ParticipantContext.Provider key={participant.identity} value={participant}>
                <SeatTile
                  participant={participant}
                  index={index}
                  isHost={index === 0}
                  isLocalHost={isHost}
                  roomName={room?.name}
                  hostUserId={currentUserId || undefined}
                />
              </ParticipantContext.Provider>
            );
          }

          return (
            <button
              key={`empty-seat-${index}`}
              onClick={() => handleJoinStage(index)}
              className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800/80 rounded-lg text-slate-500 hover:bg-slate-800/50 transition cursor-pointer group"
            >
              <span className="text-lg font-light text-slate-400 group-hover:text-cyan-400">+</span>
              <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300">
                Seat {index}
              </span>
            </button>
          );
        })}
      </div>

      {/* GIFT BAR */}
      <div className="px-3 py-2 bg-slate-950/90 border-t border-white/10 flex items-center justify-around z-20">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Send Gift:
        </span>
        {AVAILABLE_GIFTS.map((gift) => (
          <button
            key={gift.type}
            onClick={() => handleSendGift(gift)}
            className="flex items-center gap-1 bg-slate-800/80 hover:bg-pink-600/80 border border-white/10 hover:border-pink-400 px-2.5 py-1 rounded-full text-xs font-bold transition transform active:scale-95 shadow cursor-pointer"
          >
            <span>{gift.icon}</span>
            <span className="text-[9px] text-yellow-400 font-mono">
              {gift.cost}🪙
            </span>
          </button>
        ))}
      </div>

      {/* CHAT */}
      <div className="p-3 bg-slate-950/60 backdrop-blur-md border-t border-white/10 z-10 mt-auto">
        <div className="h-28 overflow-y-auto mb-2 flex flex-col gap-1 text-xs">
          {textChatMessages.map((msg, idx) => (
            <div key={idx} className="bg-slate-800/50 px-2 py-1 rounded">
              <span className="font-bold text-cyan-400">
                {msg.from?.identity ? msg.from.identity.replace(/^host_/, '') : 'User'}:{' '}
              </span>
              <span>{msg.message}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Say something..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-3 py-1.5 rounded-lg text-xs"
          >
            Send
          </button>
        </form>
      </div>

      {/* 🪙 RECHARGE COINS MODAL */}
      <RechargeModal
        isOpen={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        userId={currentUserId || ''}
        onBalanceUpdated={(newBalance) => setUserCoins(newBalance)}
      />
    </div>
  );
}