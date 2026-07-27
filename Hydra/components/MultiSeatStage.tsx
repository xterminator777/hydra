'use client';

import React from 'react';
import {
  useParticipants,
  VideoTrack,
  ParticipantContext,
  useTracks,
  useChat,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

const TOTAL_SEATS = 9;

export function MultiSeatStage() {
  const participants = useParticipants();
  const { chatMessages, send } = useChat();
  const [messageText, setMessageText] = React.useState('');

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    await send(messageText);
    setMessageText('');
  };

  // 1. Separate the true Host from Guests/Viewers
  // Prioritize host identity, fallback to first publisher, fallback to participant 0
  const hostParticipant =
    participants.find((p) => p.identity.toLowerCase().includes('host')) ||
    participants.find((p) => p.permissions?.canPublish) ||
    participants[0];

  const guestParticipants = participants.filter((p) => p !== hostParticipant);

  const stageGuests = participants.filter((p) => {
    if (p === hostParticipant) return false;

    // Check if participant is publishing or enabled camera/mic
    const isPublishingVideo = p.isCameraEnabled;
    const isPublishingAudio = p.isMicrophoneEnabled;

    return isPublishingVideo || isPublishingAudio;
  });


  // 2. Create fixed 9-seat array (Seat 0 = Host, Seats 1-8 = Guests)
  const seats = Array.from({ length: TOTAL_SEATS }, (_, index) => {
    if (index === 0) return hostParticipant;
    return stageGuests[index - 1] || null;    // Seats 1-8 are ONLY active guests!
  });

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden relative font-sans">
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
            <div
              key={`empty-seat-${index}`}
              onClick={() => {
                // Here we can trigger a "Request to Join Stage" modal or toggle permissions
                alert(`Requesting to join Seat ${index}...`);
              }}
              className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50 border border-slate-800/80 rounded-lg text-slate-500 hover:bg-slate-800/50 transition cursor-pointer"
            >
              <span className="text-lg font-light text-slate-400">+</span>
              <span className="text-[10px] font-mono text-slate-500">Seat {index}</span>
            </div>
          );
        })}
      </div>

      {/* 3. CHAT OVERLAY & INPUT */}
      <div className="p-3 bg-slate-950/60 backdrop-blur-md border-t border-white/10 z-10 mt-auto">
        <div className="h-28 overflow-y-auto mb-2 flex flex-col gap-1 text-xs">
          {chatMessages.map((msg, idx) => (
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