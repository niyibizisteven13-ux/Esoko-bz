import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  Trash2,
  Star,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { uploadProductMedia } from '../../services/productService';

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  duration?: number;
  isMain?: boolean;
  createdAt?: string;
}

interface MediaUploadProps {
  mediaItems: MediaItem[];
  onMediaAdd: (items: MediaItem[]) => void;
  onMediaRemove: (id: string) => void;
  onMediaSetMain: (id: string) => void;
  maxItems?: number;
  maxSize?: number; // in bytes
}

export default function MediaUpload({
  mediaItems,
  onMediaAdd,
  onMediaRemove,
  onMediaSetMain,
  maxItems = 5,
  maxSize = 50 * 1024 * 1024, // 50MB default
}: MediaUploadProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mediaItems.length >= maxItems) {
      setError(`Maximum ${maxItems} media items allowed`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, GIF, WebP)');
      return;
    }

    if (file.size > maxSize) {
      setError(`Image size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const response = await uploadProductMedia(file);
      const fileUrl = response.url;
      const newItem: MediaItem = {
        id: `media-${Date.now()}`,
        type: 'image',
        url: fileUrl,
        isMain: mediaItems.length === 0,
        createdAt: new Date().toISOString(),
      };

      onMediaAdd([...mediaItems, newItem]);
      setUploadProgress(100);
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image. Please try again.');
      setUploading(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mediaItems.length >= maxItems) {
      setError(`Maximum ${maxItems} media items allowed`);
      return;
    }

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file (MP4, WebM, OGG)');
      return;
    }

    if (file.size > maxSize) {
      setError(`Video size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const objectUrl = URL.createObjectURL(file);

    const loadVideoMeta = () =>
      new Promise<{ duration: number; width: number; height: number; video: HTMLVideoElement }>(
        (resolve, reject) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.muted = true;
          video.playsInline = true;
          video.onloadedmetadata = () => {
            if (video.videoWidth === 0 || video.videoHeight === 0) {
              reject(new Error('Unable to read video dimensions'));
              return;
            }
            resolve({
              duration: Math.floor(video.duration),
              width: video.videoWidth,
              height: video.videoHeight,
              video,
            });
          };
          video.onerror = () => reject(new Error('Failed to load video metadata'));
          video.src = objectUrl;
          video.load();
        }
      );

    try {
      const response = await uploadProductMedia(file);
      const fileUrl = response.url;

      let duration: number | undefined;
      let thumbnail: string | undefined;

      try {
        const meta = await loadVideoMeta();
        const { width, height, video } = meta;
        duration = meta.duration;

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (ctx) {
          await new Promise<void>((resolve, reject) => {
            const drawFrame = () => {
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve();
              } catch (error) {
                reject(error);
              }
            };

            if (video.readyState >= 2) {
              drawFrame();
            } else {
              video.oncanplay = drawFrame;
              video.onerror = () => reject(new Error('Failed to load video frame'));
            }
          });
          thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        }
      } catch (metaError) {
        console.warn('Video metadata extraction failed, uploading without thumbnail:', metaError);
      }

      const newItem: MediaItem = {
        id: `media-${Date.now()}`,
        type: 'video',
        url: fileUrl,
        thumbnail,
        duration,
        isMain: mediaItems.length === 0,
        createdAt: new Date().toISOString(),
      };

      onMediaAdd([...mediaItems, newItem]);
      setUploadProgress(100);
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to upload video. ${message}`);
      setUploading(false);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 leading-none">
            Product Media ({mediaItems.length}/{maxItems})
          </label>
          <p className="text-[9px] text-neutral-500 mb-3">
            Upload attractive images or short videos to showcase your products to customers.
            Supports files up to 50MB.
          </p>
        </div>

        {/* Upload Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading || mediaItems.length >= maxItems}
            className={cn(
              'flex items-center justify-center gap-3 px-4 py-6 rounded-2xl border-2 border-dashed transition-all font-bold text-center',
              uploading || mediaItems.length >= maxItems
                ? 'opacity-50 cursor-not-allowed border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800'
                : 'border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/5 hover:bg-blue-100 dark:hover:bg-blue-500/10 text-blue-600 dark:text-blue-400'
            )}
          >
            <ImageIcon size={20} />
            <div className="text-left">
              <div className="text-[10px] font-black uppercase tracking-wider">Upload Image</div>
              <div className="text-[8px] text-neutral-500 dark:text-neutral-400">
                JPG, PNG, GIF, WebP
              </div>
            </div>
          </button>

          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading || mediaItems.length >= maxItems}
            className={cn(
              'flex items-center justify-center gap-3 px-4 py-6 rounded-2xl border-2 border-dashed transition-all font-bold text-center',
              uploading || mediaItems.length >= maxItems
                ? 'opacity-50 cursor-not-allowed border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800'
                : 'border-purple-300 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/5 hover:bg-purple-100 dark:hover:bg-purple-500/10 text-purple-600 dark:text-purple-400'
            )}
          >
            <VideoIcon size={20} />
            <div className="text-left">
              <div className="text-[10px] font-black uppercase tracking-wider">Upload Video</div>
              <div className="text-[8px] text-neutral-500 dark:text-neutral-400">
                MP4, WebM, OGG
              </div>
            </div>
          </button>
        </div>

        {/* Hidden Inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={uploading}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          disabled={uploading}
          className="hidden"
        />

        {/* Upload Progress */}
        {uploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-xl space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-widest">
                Uploading...
              </span>
              <span className="text-[10px] font-bold text-orange-600">
                {Math.round(uploadProgress)}%
              </span>
            </div>
            <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-orange-500"
              />
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 p-4 rounded-xl border border-red-200 dark:border-red-500/20"
          >
            <AlertCircle size={16} className="text-red-600 dark:text-red-500 flex-shrink-0" />
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{error}</span>
          </motion.div>
        )}
      </div>

      {/* Media Items Display */}
      {mediaItems.length > 0 && (
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest">
            Uploaded Media
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {mediaItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative group rounded-xl overflow-hidden border-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center relative overflow-hidden">
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt="preview"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <>
                      <img
                        src={item.thumbnail || item.url}
                        alt="video-thumbnail"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Play size={32} className="text-white fill-white opacity-70" />
                      </div>
                      {item.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-[8px] font-bold text-white">
                          {formatDuration(item.duration)}
                        </div>
                      )}
                    </>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {/* Main Badge */}
                    <button
                      onClick={() => onMediaSetMain(item.id)}
                      className={cn(
                        'p-2 rounded-lg transition-all',
                        item.isMain
                          ? 'bg-orange-500 text-white shadow-lg'
                          : 'bg-white/20 text-white hover:bg-orange-500'
                      )}
                      title={item.isMain ? 'Featured media' : 'Set as featured'}
                    >
                      {item.isMain ? (
                        <Star size={16} className="fill-current" />
                      ) : (
                        <Star size={16} />
                      )}
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => onMediaRemove(item.id)}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-lg"
                      title="Delete media"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Type Badge */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded-lg text-[8px] font-black uppercase tracking-widest text-white flex items-center gap-1">
                  {item.type === 'image' ? (
                    <>
                      <ImageIcon size={12} /> Image
                    </>
                  ) : (
                    <>
                      <VideoIcon size={12} /> Video
                    </>
                  )}
                </div>

                {/* Main Indicator */}
                {item.isMain && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-orange-500 rounded-lg text-[8px] font-black uppercase tracking-widest text-white flex items-center gap-1">
                    <Star size={10} className="fill-current" /> Featured
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Info Message */}
      {mediaItems.length === 0 && !uploading && (
        <div className="text-center py-6 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-dashed border-neutral-200 dark:border-neutral-700">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
            No media uploaded yet
          </p>
          <p className="text-[9px] text-neutral-400 mt-1">
            Upload images or videos to make your products stand out!
          </p>
        </div>
      )}
    </div>
  );
}
