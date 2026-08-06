'use client';

import React, { useState, useEffect } from 'react';
import {
    LiveKitRoom,
    RoomAudioRenderer,
    useTracks,
    VideoTrack,
    useRemoteParticipants,
    useLocalParticipant,
    useRoomContext,
} from '@livekit/components-react';
import { Track, RoomEvent, ConnectionState } from 'livekit-client';
import SoloStreamSetupModal from '@/components/SoloStreamSetupModal';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface SoloWatchRoomProps {
    roomName: string;
    token: string;
    hostName: string;
    currentUserId?: string;
    isHost?: boolean;
}

export function SoloWatchRoom({
    roomName,
    token,
    hostName,
    currentUserId,
    isHost = false,
}: SoloWatchRoomProps) {
    return (
        <LiveKitRoom
            serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_WS_URL}
            token={token}
            connect={true}
            video={false}
            audio={false}
            data-lk-theme="default"
            className="relative w-screen h-screen bg-black overflow-hidden font-sans select-none flex items-center justify-center"
        >
            <SoloStreamStage
                hostName={hostName}
                currentUserId={currentUserId}
                roomName={roomName}
                isHost={isHost}
            />
            <RoomAudioRenderer />
        </LiveKitRoom>
    );
}

function SoloStreamStage({
    hostName,
    currentUserId,
    roomName,
    isHost = false,
}: {
    hostName: string;
    currentUserId?: string;
    roomName: string;
    isHost?: boolean;
}) {
    const room = useRoomContext();
    const router = useRouter();

    const tracks = useTracks([
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
    ]);

    const participants = useRemoteParticipants();
    const { localParticipant, isCameraEnabled } = useLocalParticipant();

    const [setupModalOpen, setSetupModalOpen] = useState(isHost);
    const [chatMessages, setChatMessages] = useState<{ id: string; user: string; text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [sessionCoins, setSessionCoins] = useState(0);
    const [showGiftModal, setShowGiftModal] = useState(false);
    const [floatingGifts, setFloatingGifts] = useState<{ id: string; icon: string }[]>([]);
    const [publishing, setPublishing] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!isHost) return;

        const handleUnload = () => {
            navigator.sendBeacon(
                `/api/end-stream`,
                JSON.stringify({ roomName })
            );
        };

        window.addEventListener('beforeunload', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [isHost, roomName]);

    // End Stream handler
    const handleEndStream = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault();

        if (isHost) {
            try {
                console.log(`Ending stream for room: ${roomName}...`);
                const { data, error } = await supabase
                    .from('streams')
                    .update({ is_live: false })
                    .eq('livekit_room_name', roomName)
                    .select();

                if (error) {
                    console.error('Supabase update error:', error.message);
                } else {
                    console.log('Stream successfully marked inactive in DB:', data);
                }
            } catch (err) {
                console.error('Failed to end stream in database:', err);
            }
        }

        // Leave LiveKit session
        if (room) {
            await room.disconnect();
        }

        // Navigate back to Homepage
        router.push('/');
    };

    // Auto-publish ONLY if verified host
    useEffect(() => {
        if (isHost && isConnected && localParticipant && !isCameraEnabled && !setupModalOpen) {
            handleEnableMedia();
        }
    }, [isConnected, localParticipant, setupModalOpen, isHost]);

    // Track engine connection state
    useEffect(() => {
        if (!room) return;

        const updateConnectionState = () => {
            setIsConnected(room.state === ConnectionState.Connected);
        };

        updateConnectionState();

        room.on(RoomEvent.Connected, updateConnectionState);
        room.on(RoomEvent.Disconnected, updateConnectionState);
        room.on(RoomEvent.Reconnecting, updateConnectionState);

        return () => {
            room.off(RoomEvent.Connected, updateConnectionState);
            room.off(RoomEvent.Disconnected, updateConnectionState);
            room.off(RoomEvent.Reconnecting, updateConnectionState);
        };
    }, [room]);

    const cameraTrack = tracks.find(
        (t) => t.source === Track.Source.Camera && (!t.participant.isLocal || isHost)
    ) || tracks[0];

    const handleEnableMedia = async () => {
        if (!localParticipant || !room || room.state !== ConnectionState.Connected) {
            console.warn('Cannot publish: LiveKit engine is not connected yet.');
            return;
        }

        try {
            setPublishing(true);
            await localParticipant.setCameraEnabled(true);
            await localParticipant.setMicrophoneEnabled(true);
        } catch (err: any) {
            console.error('Error enabling camera/mic:', err);
        } finally {
            setPublishing(false);
        }
    };

    const handleSendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const newMsg = {
            id: Math.random().toString(),
            user: localParticipant?.identity || 'Viewer',
            text: chatInput.trim(),
        };

        setChatMessages((prev) => [...prev.slice(-20), newMsg]);
        setChatInput('');
    };

    const handleSendGift = (icon: string, coinCost: number) => {
        setSessionCoins((prev) => prev + coinCost);

        const giftId = Math.random().toString();
        setFloatingGifts((prev) => [...prev, { id: giftId, icon }]);

        setTimeout(() => {
            setFloatingGifts((prev) => prev.filter((g) => g.id !== giftId));
        }, 2000);

        setChatMessages((prev) => [
            ...prev.slice(-20),
            {
                id: giftId,
                user: '🎁 GIFT ALERT',
                text: `${localParticipant?.identity || 'Someone'} sent ${icon} (${coinCost} Coins)!`,
            },
        ]);

        setShowGiftModal(false);
    };

    const hasVideoTrack = cameraTrack && cameraTrack.publication && !cameraTrack.publication.isMuted;

    return (
        /* 📱 DESKTOP MOBILE FRAME CONTAINER */
        <div className="relative w-full max-w-[420px] h-full sm:h-[90vh] bg-black sm:rounded-3xl border border-zinc-800/80 shadow-2xl overflow-hidden flex flex-col justify-between mx-auto">
            {/* 1. VIDEO BACKGROUND */}
            <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
                {hasVideoTrack ? (
                    <VideoTrack
                        trackRef={cameraTrack}
                        /* 🟢 object-contain ensures full 9:16 mobile frame fits without zooming/cropping */
                        className="w-full h-full object-contain max-h-full max-w-full"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-center max-w-xs z-10 my-auto bg-slate-900/90 border border-white/10 p-5 rounded-2xl backdrop-blur-md shadow-2xl">
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-2xl animate-pulse">
                            📹
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">
                                {!isConnected ? 'Connecting to Stream...' : 'Camera Access Required'}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {!isConnected
                                    ? 'Establishing secure WebRTC media engine connection...'
                                    : 'Tap below to publish your camera and microphone feed.'}
                            </p>
                        </div>

                        <button
                            onClick={handleEnableMedia}
                            disabled={publishing || !isConnected}
                            className="w-full py-2.5 bg-[#03fcad] hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                            {!isConnected
                                ? 'Connecting Engine...'
                                : publishing
                                    ? 'Publishing...'
                                    : '⚡ Go Live / Start Camera'}
                        </button>
                    </div>
                )}
            </div>

            {/* 2. TOP FLOATING HEADER OVERLAY */}
            <div className="relative z-10 p-3 pt-4 sm:p-4 sm:pt-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md p-1 pr-3 rounded-full border border-white/10">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#03fcad] text-slate-950 font-black flex items-center justify-center text-xs sm:text-sm">
                        {hostName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-xs font-bold text-white leading-none">{hostName}</p>
                        <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                            🪙 {sessionCoins}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[10px] sm:text-[11px] font-mono font-bold text-slate-300 flex items-center gap-1.5">
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-amber-400'
                                }`}
                        />
                        {isConnected ? `${participants.length + 1} live` : 'Connecting'}
                    </div>

                    <button
                        type="button"
                        onClick={handleEndStream}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white text-xs hover:bg-red-600 transition cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* 3. FLOATING GIFT ANIMATIONS */}
            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                {floatingGifts.map((gift) => (
                    <div
                        key={gift.id}
                        className="animate-bounce text-6xl sm:text-7xl filter drop-shadow-[0_0_20px_rgba(3,252,173,0.8)]"
                    >
                        {gift.icon}
                    </div>
                ))}
            </div>

            {/* 4. BOTTOM CHAT & GIFT CONTROLS */}
            <div className="relative z-10 p-3 pb-4 sm:p-4 sm:pb-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col gap-3">
                <div className="h-[130px] overflow-y-auto flex flex-col-reverse gap-1.5 pr-2 no-scrollbar">
                    <div className="flex flex-col items-start gap-1.5">
                        {chatMessages.map((msg) => (
                            <div
                                key={msg.id}
                                className="bg-black/50 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1 text-xs text-left max-w-[85%] break-words shadow-sm"
                            >
                                <span className="font-bold text-[#03fcad] mr-1.5">
                                    {msg.user}:
                                </span>
                                <span className="text-white font-medium">{msg.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <form onSubmit={handleSendChat} className="flex-1">
                        <input
                            type="text"
                            placeholder="Send message..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            className="w-full bg-black/60 border border-white/20 rounded-full px-3.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#03fcad] backdrop-blur-md"
                        />
                    </form>

                    <button
                        type="button"
                        onClick={() => setShowGiftModal(true)}
                        className="bg-gradient-to-r from-pink-500 to-amber-500 hover:scale-105 active:scale-95 text-white w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg shadow-lg transition cursor-pointer shrink-0"
                    >
                        🎁
                    </button>
                </div>
            </div>

            {/* 5. GIFT MODAL SHEET */}
            {showGiftModal && (
                <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-end justify-center p-2 sm:p-0">
                    <div className="bg-slate-900 border-t border-slate-800 rounded-2xl sm:rounded-t-3xl p-4 sm:p-5 w-full max-w-md text-white space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                                <span>🎁</span> Send Gift to {hostName}
                            </h3>
                            <button
                                onClick={() => setShowGiftModal(false)}
                                className="text-slate-400 text-xs hover:text-white cursor-pointer px-2"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-4 gap-2 sm:gap-3">
                            {[
                                { name: 'Rose', icon: '🌹', coins: 10 },
                                { name: 'Fire', icon: '🔥', coins: 50 },
                                { name: 'Crown', icon: '👑', coins: 200 },
                                { name: 'Rocket', icon: '🚀', coins: 500 },
                            ].map((gift) => (
                                <button
                                    key={gift.name}
                                    onClick={() => handleSendGift(gift.icon, gift.coins)}
                                    className="bg-slate-950 border border-slate-800 hover:border-[#03fcad] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                                >
                                    <span className="text-xl sm:text-2xl">{gift.icon}</span>
                                    <span className="text-[10px] font-bold text-slate-300">{gift.name}</span>
                                    <span className="text-[9px] font-mono font-bold text-amber-400">
                                        {gift.coins} 🪙
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 6. SETUP MODAL */}
            <SoloStreamSetupModal
                isOpen={setupModalOpen}
                onClose={() => setSetupModalOpen(false)}
                roomName={roomName}
                userId={currentUserId || 'guest_host'}
                username={hostName}
                onStreamStarted={() => {
                    setSetupModalOpen(false);
                    handleEnableMedia();
                }}
            />
        </div>
    );
}