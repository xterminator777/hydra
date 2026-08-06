'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { RechargeModal } from '@/components/RechargeModal';

interface Transaction {
  id: string;
  amount: number;
  type: 'purchase' | 'gift_send' | 'gift_receive' | 'bonus';
  description: string;
  created_at: string;
}

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState<boolean>(false);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // 1. Fetch Current Wallet Balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (wallet) {
        setBalance(wallet.balance);
      }

      // 2. Fetch All User Transactions
      const { data: txList, error: txError } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!txError && txList) {
        setTransactions(txList as Transaction[]);

        // 🟢 Calculate Total Lifetime Earnings (Gift Receipts)
        const earned = txList
          .filter((tx) => tx.type === 'gift_receive')
          .reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);
        setTotalEarned(earned);

        // 🔴 Calculate Total Spent on Gifts
        const spent = txList
          .filter((tx) => tx.type === 'gift_send')
          .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
        setTotalSpent(spent);
      }
    } catch (err) {
      console.error('Error loading wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white font-sans">
        <div className="w-8 h-8 border-2 border-[#03fcad] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-mono">Loading wallet stats...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-4 font-sans">
        <p className="text-slate-400 text-sm mb-4">Please log in to check your earnings and wallet.</p>
        <Link
          href="/"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700"
        >
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-[#03fcad]">My Creator Wallet</h1>
          <p className="text-xs text-slate-400">Track your total virtual coin earnings and balance.</p>
        </div>
        <Link
          href="/"
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition"
        >
          ← Back to Live
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 🏆 TOTAL EARNINGS CARD */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emerald-400 font-mono font-bold uppercase tracking-wider">
              Total Stream Earnings
            </span>
            <span className="text-lg">💎</span>
          </div>
          <div className="text-3xl font-black text-emerald-400 font-mono">
            {totalEarned} <span className="text-xs text-slate-400 font-sans font-normal">Coins</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Cumulative total earned from live stream gifts received across all sessions.
          </p>
        </div>

        {/* 🪙 CURRENT SPENDING BALANCE CARD */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-yellow-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-yellow-400 font-mono font-bold uppercase tracking-wider">
              Available Balance
            </span>
            <span className="text-lg">🪙</span>
          </div>
          <div className="text-3xl font-black text-yellow-400 font-mono">
            {balance} <span className="text-xs text-slate-400 font-sans font-normal">Coins</span>
          </div>
          <button
            onClick={() => setRechargeOpen(true)}
            className="mt-3 w-full bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-[11px] font-bold py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
          >
            + Recharge Coins
          </button>
        </div>

        {/* 🎁 GIFTS SENT STAT CARD */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-pink-950/40 border border-pink-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-pink-400 font-mono font-bold uppercase tracking-wider">
              Total Gifts Sent
            </span>
            <span className="text-lg">🎁</span>
          </div>
          <div className="text-3xl font-black text-pink-400 font-mono">
            {totalSpent} <span className="text-xs text-slate-400 font-sans font-normal">Coins</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Total coins used to support other creators on stage.
          </p>
        </div>
      </div>

      {/* Transaction Audit History */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h2 className="text-sm font-bold text-slate-200">Full Transaction Log</h2>
          <span className="text-[10px] font-mono text-slate-500">{transactions.length} records</span>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-mono">
            No coin activity recorded yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {transactions.map((tx) => {
              const isEarning = tx.type === 'gift_receive' || tx.type === 'bonus';
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800/60 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isEarning
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : 'bg-pink-950 text-pink-400 border border-pink-500/30'
                      }`}
                    >
                      {isEarning ? '🎁' : '↗'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">{tx.description}</p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(tx.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`font-mono font-bold text-sm ${
                      isEarning ? 'text-emerald-400' : 'text-pink-400'
                    }`}
                  >
                    {isEarning ? `+${tx.amount}` : `${tx.amount}`} 🪙
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recharge Modal */}
      <RechargeModal
        isOpen={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        userId={userId}
        onBalanceUpdated={(newBalance) => {
          setBalance(newBalance);
          fetchWalletData();
        }}
      />
    </div>
  );
}