'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface SoloStreamSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  userId: string;
  username: string;
  onStreamStarted: () => void;
}

export default function SoloStreamSetupModal({
  isOpen,
  onClose,
  roomName,
  userId,
  username,
  onStreamStarted,
}: SoloStreamSetupModalProps) {
  const [title, setTitle] = useState(`${username}'s Solo Stream`);
  
  // 🟢 Store actual file & local URL for preview (No Base64)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidUuid =
    typeof userId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  if (!isOpen) return null;

  // Handle local image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Please choose an image under 5MB.');
      return;
    }

    setThumbnailFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleRemoveImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setThumbnailFile(null);
    setPreviewUrl(null);
  };

  const handleStartStream = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🔒 Guard: Block guest users right at form submission
    if (!isValidUuid) {
      setError('You must be logged in to launch a live stream.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalPublicUrl: string | null = null;

      // 🟢 1. Upload File directly to Supabase Storage if selected
      if (thumbnailFile) {
        const fileExt = thumbnailFile.name.split('.').pop() || 'jpg';
        const fileName = `thumb_${roomName}_${Date.now()}.${fileExt}`;
        const filePath = `solo/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('stream-thumbnails') // Replace with your exact bucket name if different
          .upload(filePath, thumbnailFile, {
            contentType: thumbnailFile.type,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Thumbnail upload failed: ${uploadError.message}`);
        }

        // Get public HTTPS URL
        const { data: publicUrlData } = supabase.storage
          .from('stream-thumbnails')
          .getPublicUrl(filePath);

        finalPublicUrl = publicUrlData.publicUrl;
      }

      // 🟢 2. Fetch Category ID
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .maybeSingle();

      // 🟢 3. Save stream record with clean public HTTPS URL
      const { error: insertError } = await supabase
        .from('streams')
        .upsert(
          {
            user_id: userId,
            title: title.trim() || `${username}'s Live`,
            livekit_room_name: roomName,
            thumbnail_url: finalPublicUrl,
            category_id: categoryData?.id || null,
            is_live: true,
          },
          { onConflict: 'livekit_room_name' }
        );

      if (insertError) throw insertError;

      onStreamStarted();
    } catch (err: any) {
      console.error('Error starting solo stream:', err);
      setError(err.message || 'Failed to publish stream broadcast.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md text-white space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold flex items-center gap-2">
            <span>📱</span> Solo Live Broadcast Setup
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleStartStream} className="space-y-4 text-xs">
          {/* Stream Title */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">
              Stream Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Late night chat & chill..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#03fcad]"
            />
          </div>

          {/* Native Device File Picker */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">
              Choose Thumbnail Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-[#03fcad] hover:file:bg-slate-700 cursor-pointer bg-slate-950 rounded-xl p-1 border border-slate-800"
            />
          </div>

          {/* Device Image Preview */}
          {previewUrl && (
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold">Preview:</span>
              <div className="w-full h-36 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden relative">
                <img
                  src={previewUrl}
                  alt="Thumbnail Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center hover:bg-red-600 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Category Dropdown */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#03fcad]"
            >
              <option value="general">General</option>
              <option value="tech">Tech</option>
              <option value="music">Music</option>
              <option value="gaming">Gaming</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#03fcad] hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg transition cursor-pointer active:scale-95 disabled:opacity-50 mt-2 text-sm"
          >
            {loading ? 'Publishing Stream...' : '⚡ Go Live on Homepage'}
          </button>
        </form>
      </div>
    </div>
  );
}