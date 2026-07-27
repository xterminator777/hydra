'use client';

import React, { useState } from 'react';
import {
  useParticipants,
  VideoTrack,
  ParticipantContext,
  useTracks,
  useChat,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { GiftOverlay, GiftEvent } from './GiftOverlay';
import { EndStreamButton } from './EndStreamButton';
const TOTAL_SEATS = 9;

const AVAILABLE_GIFTS = [
  { type: 'rose', icon: '🌹', cost: 1 },
  { type: 'diamond', icon: '💎', cost: 10 },
  { type: 'rocket', icon: '🚀', cost: 100 },
  { type: 'crown', icon: '👑', cost: 500 },
] as const;

export function MultiSeatStage() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { chatMessages, send } = useChat();
  const [messageText, setMessageText] = React.useState('');
  const [activeGifts, setActiveGifts] = useState<GiftEvent[]>([]);

  // Send a gift over LiveKit data channel
  const handleSendGift = async (gift: (typeof AVAILABLE_GIFTS)[number]) => {
    const giftPayload = JSON.stringify({
      isGift: true,
      giftType: gift.type,
      icon: gift.icon,
      senderName: localParticipant.identity || 'Anonymous',
    });

    // Send payload using LiveKit chat stream
    await send(giftPayload);

    // Trigger locally for instant feedback
    triggerGiftAnimation(
      localParticipant.identity || 'You',
      gift.type,
      gift.icon
    );
  };

  // Helper to append a new floating gift to state
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

  // Handle incoming data/chat messages for gift animations
  React.useEffect(() => {
    if (chatMessages.length === 0) return;
    const latestMsg = chatMessages[chatMessages.length - 1];

    try {
      const parsed = JSON.parse(latestMsg.message);
      if (parsed.isGift) {
        triggerGiftAnimation(
          latestMsg.from?.identity || 'Viewer',
          parsed.giftType,
          parsed.icon
        );
      }
    } catch (e) {
      // Regular text message, ignore JSON parse error
    }
  }, [chatMessages]);

  const handleRemoveGift = (id: string) => {
    setActiveGifts((prev) => prev.filter((g) => g.id !== id));
  };

  // Function to handle joining the stage
  const handleJoinStage = async (seatIndex: number) => {
    try {
      await localParticipant.setCameraEnabled(true);
      await localParticipant.setMicrophoneEnabled(true);
    } catch (error) {
      console.error('Failed to enable camera/mic:', error);
      alert('Could not access camera/microphone to join the stage.');
    }
  };

  // 1. ANCHOR SEAT 0 (Host is identified by identity starting with 'host_')
  const hostParticipant =
    participants.find((p) => p.identity.toLowerCase().startsWith('host_')) ||
    participants.find((p) => p.identity.toLowerCase().includes('host')) ||
    participants[0];



  // 2. FILTER GUEST SEATS 1-8
  const stageGuests = participants.filter((p) => {
    // Host stays in Seat 0
    if (p === hostParticipant) return false;

    // Check if participant is actively publishing media tracks
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

  // 2. Create fixed 9-seat array (Seat 0 = Host, Seats 1-8 = Guests)
  const seats = Array.from({ length: TOTAL_SEATS }, (_, index) => {
    if (index === 0) return hostParticipant;
    return stageGuests[index - 1] || null;
  });

  // Filter out raw gift JSON payloads from the chat message display
  const textChatMessages = chatMessages.filter((msg) => {
    try {
      const parsed = JSON.parse(msg.message);
      return !parsed.isGift;
    } catch {
      return true;
    }
  });

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden relative font-sans">
      {/* GIFT ANIMATION OVERLAY */}
      <GiftOverlay
        activeGifts={activeGifts}
        onAnimationEnd={handleRemoveGift}
      />

      {/* 1. TOP HEADER BAR */}
      <header className="px-4 py-3 bg-slate-950/40 backdrop-blur-md flex items-center justify-between z-10 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center font-bold text-xs border border-white/20">
            H
          </div>
          <div>
            <h1 className="text-xs font-bold leading-none">Zodiac Room - Live</h1>
            <span className="text-[10px] text-slate-400 font-mono">ID: stream_stage</span>
          </div>
          <button className="ml-1 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs px-2 py-0.5 rounded-full">
            +
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-1 overflow-hidden">
            <div className="inline-block h-5 w-5 rounded-full ring-1 ring-white/20 bg-slate-700" />
            <div className="inline-block h-5 w-5 rounded-full ring-1 ring-white/20 bg-slate-600" />
          </div>
          <span className="bg-black/40 px-2 py-0.5 rounded-full text-[10px] text-slate-300 font-semibold border border-white/10">
            👥 {participants.length}
          </span>
        </div>
        {/* 🔴 END STREAM BUTTON HERE */}
        <EndStreamButton streamId="stream_stage" />
        <div/>
      </header>

      {/* 2. 3x3 MULTI-GUEST SEAT GRID */}
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 p-2 bg-slate-950/80 aspect-square w-full max-w-md mx-auto z-10 rounded-xl my-auto">
        {seats.map((participant, index) => {
          if (participant) {
            return (
              <ParticipantContext.Provider key={participant.identity} value={participant}>
                <SeatTile
                  participant={participant}
                  index={index}
                  isHost={index === 0}
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

      {/* QUICK GIFTING BAR */}
      <div className="px-3 py-2 bg-slate-950/90 border-t border-white/10 flex items-center justify-around z-20">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Send Gift:
        </span>
        {AVAILABLE_GIFTS.map((gift) => (
          <button
            key={gift.type}
            onClick={() => handleSendGift(gift)}
            className="flex items-center gap-1 bg-slate-800/80 hover:bg-pink-600/80 border border-white/10 hover:border-pink-400 px-2.5 py-1 rounded-full text-xs font-bold transition transform active:scale-95 shadow"
          >
            <span>{gift.icon}</span>
            <span className="text-[9px] text-yellow-400 font-mono">
              {gift.cost}🪙
            </span>
          </button>
        ))}
      </div>

      {/* 3. CHAT OVERLAY & INPUT */}
      <div className="p-3 bg-slate-950/60 backdrop-blur-md border-t border-white/10 z-10 mt-auto">
        <div className="h-28 overflow-y-auto mb-2 flex flex-col gap-1 text-xs">
          {textChatMessages.map((msg, idx) => (
            <div key={idx} className="bg-slate-800/50 px-2 py-1 rounded">
              <span className="font-bold text-cyan-400">{msg.from?.identity}: </span>
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
    </div>
  );
}

{/* SUB-COMPONENT: INDIVIDUAL SEAT TILE */ }
function SeatTile({
  participant,
  index,
  isHost,
}: {
  participant: any;
  index: number;
  isHost?: boolean;
}) {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  }).filter((trackRef) => trackRef.participant.identity === participant.identity);

  const cameraTrack = cameraTracks[0];
  const isMuted = !participant.isMicrophoneEnabled;

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-slate-950 overflow-hidden rounded-lg border border-slate-800">
      {cameraTrack ? (
        <VideoTrack
          trackRef={cameraTrack}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
          {participant.identity?.charAt(0).toUpperCase() || 'U'}
        </div>
      )}

      {/* Mic Status */}
      {isMuted && (
        <div className="absolute top-1 right-1 bg-black/60 p-0.5 rounded-full text-[8px] z-10">
          🔇
        </div>
      )}

      {/* Bottom Label Tag */}
      <div className="absolute bottom-1 left-1 right-1 bg-black/60 backdrop-blur-sm px-1 py-0.5 rounded flex items-center justify-between text-[9px] z-10">
        <span className="font-semibold truncate max-w-[50px] text-white">
          {participant.identity || `Guest ${index}`}
        </span>
        {isHost && <span className="text-cyan-400 font-bold text-[8px]">HOST</span>}
      </div>
    </div>
  );
}