'use client';

import React from 'react';
import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import { supabase } from '@/lib/supabaseClient';
import { EntranceBanner } from '@/components/EntranceBanner';
import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomContext,
  VideoConference,
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
  TrackPublishDefaults,
  VideoCaptureOptions,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { MultiSeatStage } from '../../components/MultiSeatStage';

const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true';


const captureAndSaveThumbnail = async (videoElement: HTMLVideoElement, roomName: string) => {
  if (!videoElement || videoElement.readyState < 2) return;

  // 1. Scale down to 640x360 for minimal file size (~30-50 KB)
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // 2. Compress frame to JPEG
  canvas.toBlob(async (blob) => {
    if (!blob) return;

    const filePath = `thumbnails/${roomName}.jpg`;

    // 3. Upload ONCE to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('stream-thumbnails')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Thumbnail upload failed:', uploadError.message);
      return;
    }

    // 4. Get public image URL
    const { data: { publicUrl } } = supabase.storage
      .from('stream-thumbnails')
      .getPublicUrl(filePath);

    // 5. Update database row ONCE
    const { error: dbError } = await supabase
      .from('streams')
      .update({ thumbnail_url: publicUrl })
      .eq('room_name', roomName);

    if (dbError) {
      console.error('Failed to update stream thumbnail URL:', dbError.message);
    } else {
      console.log('Stream thumbnail successfully captured and saved!');
    }
  }, 'image/jpeg', 0.7);
};



export function StreamStudioPage(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
  singlePeerConnection: boolean;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const [streamTitle, setStreamTitle] = React.useState('My Live Stream');
  const [categorySlug, setCategorySlug] = React.useState('tech');
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  // User & Profile State
  const [hostUsername, setHostUsername] = React.useState<string>('Host');
  const [userId, setUserId] = React.useState<string | null>(null);

  // Fetch authenticated host details on mount
  React.useEffect(() => {
    async function loadHostDetails() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.username) {
        setHostUsername(profile.username);
      }
    }

    loadHostDetails();
  }, []);

  const preJoinDefaults = React.useMemo(() => {
    return {
      username: hostUsername,
      videoEnabled: true,
      audioEnabled: true,
    };
  }, [hostUsername]);

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    setIsSubmitting(true);
    setApiError(null);

    if (!userId) {
      setApiError('You must be logged in with a valid account to host a live stream.');
      return;
    }

    try {
      const activeName = values.username || hostUsername || 'Host';

      const response = await fetch('/api/streams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categorySlug,
          title: streamTitle,
          userId: userId || undefined,
          participantName: activeName,
          isHost: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize backend stream session');
      }

      const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

      if (!livekitUrl) {
        throw new Error('NEXT_PUBLIC_LIVEKIT_URL is missing from .env.local');
      }

      setConnectionDetails({
        serverUrl: livekitUrl,
        roomName: data.roomName,
        participantToken: data.token,
        participantName: activeName,
      });
    } catch (err: any) {
      console.error('Error creating stream:', err);
      setApiError(err.message || 'Stream creation failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [categorySlug, streamTitle, userId, hostUsername]);

  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: '1rem' }}>
          <div className="w-full max-w-md bg-slate-900 text-white rounded-2xl p-6 border border-slate-700/80 shadow-2xl">
            <h2 className="text-xl font-bold mb-1 text-white">Host Studio Setup</h2>
            <p className="text-slate-400 text-xs mb-5">Set your stream details before joining the stage</p>

            {apiError && (
              <div className="mb-4 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-400 text-xs">
                {apiError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Stream Title
                </label>
                <input
                  type="text"
                  required
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="e.g. Building WebRTC Chat Apps"
                  className="w-full bg-slate-950 text-white placeholder-slate-400 border-2 border-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  className="w-full bg-slate-950 text-white border-2 border-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition cursor-pointer"
                >
                  <option value="tech">Tech</option>
                  <option value="music">Music</option>
                  <option value="gaming">Gaming</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            <div className="lk-prejoin-wrapper mt-4">
              <PreJoin
                defaults={preJoinDefaults}
                onSubmit={handlePreJoinSubmit}
                onError={handlePreJoinError}
              />
            </div>
            {isSubmitting && (
              <p className="text-center text-xs text-cyan-400 mt-3 font-semibold animate-pulse">
                Provisioning stage & LiveKit token...
              </p>
            )}
          </div>
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{
            codec: props.codec,
            hq: props.hq,
            singlePeerConnection: props.singlePeerConnection,
          }}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
    singlePeerConnection: boolean;
  };
}) {
  const keyProvider = new ExternalE2EEKeyProvider();
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp8';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    const videoCaptureDefaults: VideoCaptureOptions = {
      deviceId: props.userChoices.videoDeviceId ?? undefined,
      resolution: VideoPresets.h720,
    };
    const publishDefaults: TrackPublishDefaults = {
      dtx: true,
      // Enable simulcast layers so LiveKit can scale down quality when seats are small
      videoSimulcastLayers: [VideoPresets.h720, VideoPresets.h360, VideoPresets.h180],
      red: !e2eeEnabled,
      videoCodec,
    };
    return {
      videoCaptureDefaults: videoCaptureDefaults,
      publishDefaults: publishDefaults,
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        // Prevents browser WebRTC engine from pausing video frames on audio activity
        channelCount: 1,
      },
      // 🟢 RE-ENABLED: Dynamic quality & bandwidth optimization      
      adaptiveStream: true,
      dynacast: true,
      e2ee: keyProvider && worker && e2eeEnabled ? { keyProvider, worker } : undefined,
      singlePeerConnection: props.options.singlePeerConnection,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);

    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices]);

  const lowPowerMode = useLowCPUOptimizer(room);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);

  React.useEffect(() => {
    if (lowPowerMode) {
      console.warn('Low power mode enabled');
    }
  }, [lowPowerMode]);

  // ---------------------------------------------------------------------------
  // 📸 ONE-TIME THUMBNAIL CAPTURE (15s after connection)
  // ---------------------------------------------------------------------------
  const hasCapturedThumbnail = React.useRef(false);

  React.useEffect(() => {
    const roomName = props.connectionDetails?.roomName;
    if (!roomName || hasCapturedThumbnail.current) return;

    // Wait 15 seconds into the stream before capturing a single frame
    const timer = setTimeout(() => {
      const videoElement = document.querySelector('.lk-room-container video, video') as HTMLVideoElement;

      if (videoElement && !hasCapturedThumbnail.current) {
        captureAndSaveThumbnail(videoElement, roomName);
        hasCapturedThumbnail.current = true; // Prevents any re-captures / extra DB requests
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [props.connectionDetails?.roomName]);
  // ---------------------------------------------------------------------------

  return (
    <div className="lk-room-container">
      <RoomContext.Provider value={room}>
        <EntranceBanner />
        <KeyboardShortcuts />
        <MultiSeatStage />
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );


}

// Default export required by Next.js App Router
export default function BroadcastPage() {
  return (
    <StreamStudioPage
      roomName="studio-stage"
      hq={true}
      codec="vp8"
      singlePeerConnection={false}
    />
  );
}