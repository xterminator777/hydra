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
  // Create an array of 9 slots
  const seats = Array.from({ length: TOTAL_SEATS }, (_, index) => {
    return participants[index] || null;
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
      <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-950/80 aspect-square w-full max-w-md mx-auto z-10">
        {seats.map((participant, index) => {
          const isHost = index === 0;

          return (
            <div
              key={index}
              className="relative aspect-square bg-slate-800/80 rounded-lg overflow-hidden border border-white/10 flex flex-col items-center justify-center shadow-inner group"
            >
              {participant ? (
                /* ACTIVE SEAT WITH PARTICIPANT */
                <ParticipantContext.Provider value={participant}>
                  <SeatTile participant={participant} index={index} isHost={isHost} />
                </ParticipantContext.Provider>
              ) : (
                /* EMPTY SEAT SLOT */
                <div className="flex flex-col items-center justify-center text-slate-500 hover:text-white transition cursor-pointer w-full h-full">
                  <span className="absolute top-1 left-1.5 text-[10px] font-mono text-slate-600">
                    {index}
                  </span>
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-600 group-hover:border-white flex items-center justify-center text-sm font-bold">
                    +
                  </div>
                  <span className="text-[10px] mt-1 font-medium">Join</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. FLOATING LIVE CHAT OVERLAY */}
      <div className="flex-1 p-4 flex flex-col justify-end overflow-hidden z-10 pointer-events-none">
        <div className="space-y-1.5 max-h-48 overflow-y-auto pointer-events-auto text-xs scrollbar-none">
          {chatMessages.map((msg) => (
            <div key={msg.timestamp} className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-xl w-fit max-w-[85%] border border-white/5">
              <span className="text-cyan-400 font-bold mr-1.5">
                {msg.from?.identity || 'Anonymous'}:
              </span>
              <span>{msg.message}</span>
            </div>
          ))}
          <div className="bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full w-fit text-[11px] font-semibold border border-amber-500/30">
            👑 AMUN-RA joined the stage
          </div>
          <div className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-xl w-fit max-w-[85%] border border-white/5">
            <span className="text-cyan-400 font-bold mr-1.5">User_92:</span>
            <span>Welcome to the stream everyone! 🎉</span>
          </div>
          <div className="bg-black/40 backdrop-blur px-3 py-1.5 rounded-xl w-fit max-w-[85%] border border-white/5">
            <span className="text-pink-400 font-bold mr-1.5">Isa:</span>
            <span>Drop a gift if you want slot 3!</span>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM ACTION TOOLBAR */}
      <footer className="px-3 py-3 bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-2 z-10 border-t border-white/10">
        <form onSubmit={handleSendMessage} className="flex-1">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Say Hi..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-full px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </form>

        <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full text-xs">
          ✋ Join
        </button>
        <button className="bg-slate-800 hover:bg-slate-700 p-2 rounded-full text-xs">
          😊
        </button>
        <button className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg">
          🎁 Gift
        </button>
      </footer>
    </div>
  );
}

// Sub-component to render video feed & track status for an active seat
function SeatTile({ participant, index, isHost }: { participant: any; index: number; isHost: boolean }) {
  // Fetch camera track specifically for this participant
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  }).filter((trackRef) => trackRef.participant.identity === participant.identity);

  const cameraTrack = cameraTracks[0];
  const isMuted = !participant.isMicrophoneEnabled;

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-slate-950">
      {cameraTrack ? (
        <VideoTrack
          trackRef={cameraTrack}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-300">
          {participant.identity?.charAt(0).toUpperCase() || 'U'}
        </div>
      )}

      {/* Level / Beans Badge */}
      <div className="absolute top-1 left-1 bg-yellow-500/90 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full shadow">
        🪙 42
      </div>

      {/* Mic Mute Indicator */}
      {isMuted && (
        <div className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-[9px]">
          🔇
        </div>
      )}

      {/* Bottom Name Tag */}
      <div className="absolute bottom-1 left-1 right-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center justify-between text-[10px]">
        <span className="font-semibold truncate max-w-[60px]">
          {participant.identity || `Guest ${index}`}
        </span>
        {isHost && <span className="text-cyan-400 font-bold text-[9px]">HOST</span>}
      </div>
    </div>
  );
}