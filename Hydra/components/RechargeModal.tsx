'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onBalanceUpdated: (newBalance: number) => void;
}

const PACKAGES = [
  { coins: 100, price: '$0.99', popular: false },
  { coins: 500, price: '$4.99', popular: true },
  { coins: 1200, price: '$9.99', popular: false },
  { coins: 3000, price: '$24.99', popular: false },
];

export function RechargeModal({ isOpen, onClose, userId, onBalanceUpdated }: RechargeModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Demo purchase handler (Simulates buying coins)
  const handleBuyCoins = async (coinsToAdd: number) => {
    setLoading(true);
  try {
    // 🟢 Call our server API route to bypass client-side RLS restriction
    const response = await fetch('/api/coins/recharge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        coinsToAdd,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(`Recharge failed: ${data.error}`);
      return;
    }

    // Update parent state with the confirmed database balance
    onBalanceUpdated(data.newBalance);
    alert(`🎉 Success! Added ${coinsToAdd} coins to your balance.`);
    onClose();
  } catch (err) {
    console.error('Error adding coins:', err);
    alert('Failed to complete purchase.');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-white shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🪙 Top Up Coins
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          Get coins to send gifts to your favorite hosts during live streams.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {PACKAGES.map((pkg) => (
            <button
              key={pkg.coins}
              disabled={loading}
              onClick={() => handleBuyCoins(pkg.coins)}
              className="relative bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-[#03fcad] rounded-xl p-3 flex flex-col items-center justify-center gap-1 transition group cursor-pointer"
            >
              {pkg.popular && (
                <span className="absolute -top-2 bg-[#03fcad] text-slate-950 font-black text-[8px] uppercase px-1.5 py-0.5 rounded-full">
                  BEST VALUE
                </span>
              )}
              <span className="text-lg font-bold text-yellow-400 font-mono">
                {pkg.coins} 🪙
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {pkg.price}
              </span>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 text-center font-mono">
          🔒 Test Mode Active: Purchases are instant and free.
        </p>
      </div>
    </div>
  );
}