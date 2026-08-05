'use client';

import React from 'react';

interface Gift {
  type: string;
  icon: string;
  cost: number;
}

interface TargetedGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUsername: string;
  userCoins: number;
  availableGifts: readonly Gift[];
  onSendGift: (gift: Gift, recipientUsername: string) => void;
  onOpenRecharge: () => void;
}

export function TargetedGiftModal({
  isOpen,
  onClose,
  targetUsername,
  userCoins,
  availableGifts,
  onSendGift,
  onOpenRecharge,
}: TargetedGiftModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-xs w-full text-white shadow-2xl">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Send Gift To</span>
            <h2 className="text-sm font-bold text-[#03fcad]">@{targetUsername}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs">
            ✕
          </button>
        </div>

        {/* Current Balance Display */}
        <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 mb-4 text-xs font-mono">
          <span className="text-slate-400">Balance:</span>
          <span className="text-yellow-400 font-bold">{userCoins} 🪙</span>
        </div>

        {/* Gift Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {availableGifts.map((gift) => (
            <button
              key={gift.type}
              onClick={() => {
                if (userCoins < gift.cost) {
                  onClose();
                  onOpenRecharge();
                  return;
                }
                onSendGift(gift, targetUsername);
                onClose();
              }}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-pink-500 rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition group cursor-pointer"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">
                {gift.icon}
              </span>
              <span className="text-[10px] font-bold text-slate-200 capitalize">
                {gift.type}
              </span>
              <span className="text-[9px] text-yellow-400 font-mono">
                {gift.cost} 🪙
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            onClose();
            onOpenRecharge();
          }}
          className="w-full bg-slate-800 hover:bg-slate-700 text-yellow-400 font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>🪙 Top Up Coins</span>
        </button>
      </div>
    </div>
  );
}
