'use client';

import React, { useEffect, useState } from 'react';

export interface GiftEvent {
  id: string;
  senderName: string;
  giftType: 'rose' | 'diamond' | 'rocket' | 'crown';
  icon: string;
}

interface GiftOverlayProps {
  activeGifts: GiftEvent[];
  onAnimationEnd: (id: string) => void;
}

export function GiftOverlay({ activeGifts, onAnimationEnd }: GiftOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden flex flex-col items-center justify-center">
      {activeGifts.map((gift) => (
        <GiftAnimation
          key={gift.id}
          gift={gift}
          onComplete={() => onAnimationEnd(gift.id)}
        />
      ))}
    </div>
  );
}

function GiftAnimation({
  gift,
  onComplete,
}: {
  gift: GiftEvent;
  onComplete: () => void;
}) {
  useEffect(() => {
    // Auto-remove gift after 2.5 seconds when animation finishes
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="absolute flex flex-col items-center animate-bounce-float transition-all duration-500">
      {/* Banner Pill */}
      <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2 border border-white/30 backdrop-blur-md">
        <span className="text-2xl animate-pulse">{gift.icon}</span>
        <div>
          <p className="text-xs font-black text-white leading-none">
            {gift.senderName}
          </p>
          <p className="text-[10px] text-yellow-300 font-bold uppercase tracking-wider">
            Sent a {gift.giftType}!
          </p>
        </div>
      </div>

      {/* Floating Center Icon */}
      <div className="text-6xl mt-3 filter drop-shadow-[0_0_20px_rgba(236,72,153,0.8)] animate-spin-slow">
        {gift.icon}
      </div>
    </div>
  );
}