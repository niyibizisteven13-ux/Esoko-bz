// src/components/shared/PostStudioModal.tsx
//
// A full-screen, multi-media creator studio shared by traders ("Create a
// post") and customers ("Share your purchase"). Live phone-frame preview,
// multi-photo/video carousel with reordering + cover selection, text
// overlays, a soundtrack picker (preset vibes + optional real audio upload),
// templates, and hashtag tooling — all built on the app's existing
// black/orange design language and only the libraries already in this repo
// (lucide-react, framer-motion).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flame,
  Hash,
  Loader2,
  Megaphone,
  MessageCircle,
  Music2,
  Package,
  Pause,
  Play,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Type as TypeIcon,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { uploadProductMedia } from '../../services/productService';
import { createMarketplacePost } from '../../services/postService';
import {
  MAX_MEDIA_ITEMS,
  MAX_OVERLAYS,
  MusicTrack,
  OverlayTone,
  OverlayZone,
  StudioAudio,
  StudioItem,
  StudioMedia,
  StudioVariant,
  buildCaption,
  canAddMoreMedia,
  createOverlay,
  normalizeHashtagInput,
  reorder,
  suggestHashtags,
  suggestMusic,
  templatesFor,
  TextOverlay,
} from '../../lib/postStudio';

const TEMPLATE_ICONS = {
  sparkles: Sparkles,
  flame: Flame,
  'book-open': BookOpen,
  'message-circle': MessageCircle,
  megaphone: Megaphone,
  package: Package,
} as const;

type PostStudioModalProps = {
  /** Who is posting. Drives copy, templates, and which fields are required. */
  variant: StudioVariant;
  /** uid of the person publishing this post. */
  authorId: string;
  /**
   * Things this post can be about — trader's products, or customer's past
   * purchases. Map your own data into StudioItem[] before passing it in.
   */
  items: StudioItem[];
  /** Trader id to attach the post to. Required for variant="trader". */
  defaultTraderId?: string;
  onClose: () => void;
  onCreated?: () => void;
};

let mediaIdCounter = 0;
const nextMediaId = () => `media-${Date.now()}-${mediaIdCounter++}`;

export default function PostStudioModal({
  variant,
  authorId,
  items,
  defaultTraderId,
  onClose,
  onCreated,
}: PostStudioModalProps) {
  const [itemId, setItemId] = useState(String(items[0]?.id || ''));
  const [media, setMedia] = useState<StudioMedia[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [coverIndex, setCoverIndex] = useState(0);
  const [templateId, setTemplateId] = useState('');
  const [caption, setCaption] = useState('');
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [overlayDraft, setOverlayDraft] = useState('');
  const [overlayZone, setOverlayZone] = useState<OverlayZone>('bottom');
  const [overlayTone, setOverlayTone] = useState<OverlayTone>('dark');
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  const [customAudio, setCustomAudio] = useState<StudioAudio | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedItem = items.find((item) => String(item.id) === itemId);
  const templates = useMemo(() => templatesFor(variant), [variant]);
  const musicOptions = useMemo(() => suggestMusic(variant), [variant]);

  const suggestedTags = useMemo(
    () =>
      suggestHashtags({
        category: selectedItem?.category,
        keywords: (selectedItem?.label || '').split(/\s+/),
        variant,
      }),
    [selectedItem, variant]
  );

  // Revoke object URLs on unmount / whenever a media item is dropped, so we
  // don't leak blob URLs while the studio is used for several posts in a row.
  useEffect(() => {
    return () => {
      media.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (customAudio) URL.revokeObjectURL(customAudio.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy =
    variant === 'trader'
      ? {
          eyebrow: 'Marketplace Studio',
          title: 'Create a post',
          itemLabel: 'Product',
          itemEmpty: 'General marketplace post',
          placeholder: "Tell customers what makes this worth stopping for...",
          submitLabel: 'Publish to marketplace',
          emptyItemsHint: 'Add a product first to tag it in your post.',
        }
      : {
          eyebrow: 'Marketplace Studio',
          title: 'Share your purchase',
          itemLabel: 'Which purchase?',
          itemEmpty: '',
          placeholder: "Tell everyone what you think, how it arrived, how you're using it...",
          submitLabel: 'Share with the community',
          emptyItemsHint: 'Make a purchase to unlock sharing.',
        };

  // ---------- Media handling ----------
  const handleAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError('');
    const incoming: StudioMedia[] = [];
    Array.from(fileList).forEach((file) => {
      if (!canAddMoreMedia(media.length + incoming.length)) return;
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
      incoming.push({
        id: nextMediaId(),
        kind: file.type.startsWith('video/') ? 'video' : 'image',
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });
    if (incoming.length === 0) return;
    setMedia((current) => {
      const next = [...current, ...incoming];
      return next.slice(0, MAX_MEDIA_ITEMS);
    });
  };

  const removeMedia = (id: string) => {
    setMedia((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index === -1) return current;
      const target = current[index];
      URL.revokeObjectURL(target.previewUrl);
      const next = current.filter((item) => item.id !== id);
      setActiveSlide((slide) => Math.min(slide, Math.max(next.length - 1, 0)));
      setCoverIndex((cover) => (cover >= next.length ? 0 : cover));
      return next;
    });
  };

  const moveMedia = (index: number, direction: -1 | 1) => {
    setMedia((current) => reorder(current, index, index + direction));
    setCoverIndex((cover) => {
      if (cover === index) return index + direction;
      if (cover === index + direction) return index;
      return cover;
    });
    setActiveSlide((slide) => {
      if (slide === index) return index + direction;
      if (slide === index + direction) return index;
      return slide;
    });
  };

  // ---------- Overlay handling ----------
  const addOverlay = () => {
    if (!overlayDraft.trim() || overlays.length >= MAX_OVERLAYS) return;
    setOverlays((current) => [...current, createOverlay(overlayDraft.trim(), overlayZone, overlayTone)]);
    setOverlayDraft('');
  };

  const removeOverlay = (id: string) => {
    setOverlays((current) => current.filter((overlay) => overlay.id !== id));
  };

  // ---------- Music / audio handling ----------
  const handleAudioUpload = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('Please choose an audio file for your custom track.');
      return;
    }
    if (customAudio) URL.revokeObjectURL(customAudio.previewUrl);
    setCustomAudio({ file, previewUrl: URL.createObjectURL(file) });
    setSelectedMusicId(null);
    setAudioPlaying(false);
  };

  const toggleAudioPreview = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setAudioPlaying(true)).catch(() => setAudioPlaying(false));
    } else {
      el.pause();
      setAudioPlaying(false);
    }
  };

  // ---------- Hashtags ----------
  const toggleHashtag = (tag: string) => {
    setHashtags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  };

  const addCustomTag = () => {
    if (!customTag.trim()) return;
    setHashtags((current) => Array.from(new Set([...current, ...normalizeHashtagInput(customTag)])));
    setCustomTag('');
  };

  const applyTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id);
    setTemplateId(id);
    if (template) {
      setCaption(template.captionTemplate({ product: selectedItem?.label, trader: selectedItem?.traderName }));
    }
  };

  // ---------- Submit ----------
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (media.length === 0) {
      setError('Add at least one photo or video before publishing.');
      return;
    }

    const traderId = variant === 'trader' ? defaultTraderId : selectedItem?.traderId || defaultTraderId;
    if (!traderId) {
      setError(
        variant === 'trader'
          ? 'Your trader account is not fully set up yet.'
          : 'Pick which purchase this post is about so we can tag the right shop.'
      );
      return;
    }

    setSaving(true);
    setError('');
    try {
      const uploadedMedia = await Promise.all(
        media.map(async (item) => {
          const uploaded = await uploadProductMedia(item.file);
          return { ...item, uploadedUrl: uploaded.url };
        })
      );

      let audioUrl: string | undefined;
      if (customAudio) {
        const uploadedAudio = await uploadProductMedia(customAudio.file);
        audioUrl = uploadedAudio.url;
      }

      const cover = uploadedMedia[coverIndex] || uploadedMedia[0];
      const template = templates.find((item) => item.id === templateId);
      const finalCaption = buildCaption(
        template,
        { product: selectedItem?.label, trader: selectedItem?.traderName },
        caption,
        hashtags
      );
      const musicTrack: MusicTrack | undefined = selectedMusicId
        ? musicOptions.find((track) => track.id === selectedMusicId)
        : undefined;

      // NOTE: mediaItems / overlays / musicTrack / audioUrl / authorType /
      // purchaseId are new fields — see the postService.ts patch notes for
      // what to add to CreateMarketplacePostInput (and the backend handler)
      // so a multi-slide, scored, soundtracked post persists correctly.
      await createMarketplacePost({
        traderId,
        authorType: variant,
        authorId,
        productId: variant === 'trader' ? selectedItem?.id : undefined,
        purchaseId: variant === 'customer' ? selectedItem?.id : undefined,
        mediaType: cover.kind,
        mediaUrl: cover.uploadedUrl,
        mediaItems: uploadedMedia.map((item) => ({ type: item.kind, url: item.uploadedUrl })),
        overlays,
        musicTrack,
        audioUrl,
        caption: finalCaption,
        hashtags,
        price: variant === 'trader' ? Number(selectedItem?.price || 0) : undefined,
        stock: variant === 'trader' ? Number(selectedItem?.stock || 0) : undefined,
        category: selectedItem?.category,
      } as any);

      onCreated?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to publish this post.');
    } finally {
      setSaving(false);
    }
  };

  const activeMedia = media[activeSlide];
  const trackTitle = customAudio ? customAudio.file.name : musicOptions.find((t) => t.id === selectedMusicId)?.title;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm md:p-6">
      <form
        onSubmit={submit}
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0a0a0a] text-white shadow-2xl md:h-[92vh] md:rounded-[2rem]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">{copy.eyebrow}</p>
            <h2 className="mt-1 text-xl font-black md:text-2xl">{copy.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[340px_1fr]">
          {/* Left: live preview + media strip */}
          <aside className="flex flex-col gap-4 overflow-y-auto border-b border-white/10 p-5 md:border-b-0 md:border-r">
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
              {activeMedia ? (
                activeMedia.kind === 'image' ? (
                  <img src={activeMedia.previewUrl} alt="Preview" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <video
                    src={activeMedia.previewUrl}
                    className="absolute inset-0 h-full w-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                )
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/25">
                  <Upload size={28} />
                  <p className="px-6 text-center text-[10px] font-black uppercase tracking-widest">
                    Add photos or videos to start
                  </p>
                </div>
              )}

              {/* Text overlays */}
              {overlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className={
                    'pointer-events-none absolute left-3 right-3 flex justify-center ' +
                    (overlay.zone === 'top' ? 'top-4' : 'bottom-14')
                  }
                >
                  <span
                    className={
                      'max-w-full truncate rounded-full px-3 py-1.5 text-[11px] font-black ' +
                      (overlay.tone === 'dark' ? 'bg-black/60 text-white' : 'text-white drop-shadow-lg')
                    }
                  >
                    {overlay.text}
                  </span>
                </div>
              ))}

              {/* Slide dots */}
              {media.length > 1 && (
                <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 gap-1">
                  {media.map((item, index) => (
                    <span
                      key={item.id}
                      className={
                        'h-1 w-5 rounded-full transition-colors ' +
                        (index === activeSlide ? 'bg-orange-500' : 'bg-white/25')
                      }
                    />
                  ))}
                </div>
              )}

              {/* Slide nav */}
              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveSlide((slide) => (slide - 1 + media.length) % media.length)}
                    className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSlide((slide) => (slide + 1) % media.length)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white"
                    aria-label="Next slide"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}

              {/* Music indicator */}
              {trackTitle && (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="shrink-0 text-orange-400"
                  >
                    <Music2 size={12} />
                  </motion.span>
                  <span className="truncate text-[10px] font-black text-white">{trackTitle}</span>
                </div>
              )}
            </div>

            {/* Media thumbnail strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  Media ({media.length}/{MAX_MEDIA_ITEMS})
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canAddMoreMedia(media.length)}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/70 hover:bg-white/20 disabled:opacity-40"
                >
                  <Plus size={12} /> Add
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    handleAddFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
              </div>

              {media.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-xs font-bold text-white/60 hover:border-orange-500/60"
                >
                  <Upload size={16} className="text-orange-400" /> Choose photos or videos
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {media.map((item, index) => (
                    <div
                      key={item.id}
                      className={
                        'group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ' +
                        (index === activeSlide ? 'border-orange-500' : 'border-white/10')
                      }
                    >
                      <button type="button" onClick={() => setActiveSlide(index)} className="absolute inset-0">
                        {item.kind === 'image' ? (
                          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-black/60">
                            <Video size={18} className="text-white/70" />
                          </div>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverIndex(index)}
                        className={
                          'absolute left-1 top-1 rounded-full p-0.5 ' +
                          (coverIndex === index ? 'bg-orange-500 text-black' : 'bg-black/50 text-white/70 opacity-0 group-hover:opacity-100')
                        }
                        aria-label="Set as cover"
                        title="Set as cover"
                      >
                        <Star size={10} fill={coverIndex === index ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMedia(item.id)}
                        className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white/70 opacity-0 group-hover:opacity-100"
                        aria-label="Remove media"
                      >
                        <Trash2 size={10} />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 flex justify-between px-0.5 pb-0.5 opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => moveMedia(index, -1)}
                          disabled={index === 0}
                          className="rounded bg-black/50 px-1 text-[8px] text-white/70 disabled:opacity-30"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMedia(index, 1)}
                          disabled={index === media.length - 1}
                          className="rounded bg-black/50 px-1 text-[8px] text-white/70 disabled:opacity-30"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Right: composer sections */}
          <main className="min-h-0 space-y-6 overflow-y-auto p-5">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{copy.itemLabel}</span>
              <select
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none"
              >
                {variant === 'trader' && <option value="">{copy.itemEmpty}</option>}
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.traderName ? ` — ${item.traderName}` : ''}
                  </option>
                ))}
              </select>
              {items.length === 0 && <p className="text-[11px] font-bold text-white/40">{copy.emptyItemsHint}</p>}
            </label>

            {templates.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Templates</span>
                <div className="flex flex-wrap gap-2">
                  {templates.map((template) => {
                    const Icon = TEMPLATE_ICONS[template.icon];
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template.id)}
                        title={template.promptHint}
                        className={
                          'flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ' +
                          (templateId === template.id
                            ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10')
                        }
                      >
                        <Icon size={12} /> {template.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Caption</span>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder={copy.placeholder}
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none placeholder:text-white/30"
              />
            </label>

            {/* Text overlays */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                Text on media ({overlays.length}/{MAX_OVERLAYS})
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[140px]">
                  <TypeIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    value={overlayDraft}
                    onChange={(event) => setOverlayDraft(event.target.value)}
                    placeholder="e.g. 20% OFF today"
                    disabled={overlays.length >= MAX_OVERLAYS}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-8 pr-3 text-xs font-bold outline-none placeholder:text-white/30 disabled:opacity-40"
                  />
                </div>
                <select
                  value={overlayZone}
                  onChange={(event) => setOverlayZone(event.target.value as OverlayZone)}
                  className="rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-[10px] font-black uppercase text-white/70 outline-none"
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
                <select
                  value={overlayTone}
                  onChange={(event) => setOverlayTone(event.target.value as OverlayTone)}
                  className="rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-[10px] font-black uppercase text-white/70 outline-none"
                >
                  <option value="dark">Pill</option>
                  <option value="light">Bare</option>
                </select>
                <button
                  type="button"
                  onClick={addOverlay}
                  disabled={overlays.length >= MAX_OVERLAYS || !overlayDraft.trim()}
                  className="rounded-xl bg-white/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/20 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              {overlays.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {overlays.map((overlay) => (
                    <span
                      key={overlay.id}
                      className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-white/70"
                    >
                      {overlay.text}
                      <button type="button" onClick={() => removeOverlay(overlay.id)} aria-label="Remove overlay">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Music / soundtrack */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Soundtrack</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedMusicId(null)}
                  className={
                    'shrink-0 rounded-2xl border px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest transition ' +
                    (!selectedMusicId && !customAudio
                      ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                      : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10')
                  }
                >
                  No vibe
                </button>
                {musicOptions.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => {
                      setSelectedMusicId(track.id);
                      if (customAudio) {
                        URL.revokeObjectURL(customAudio.previewUrl);
                        setCustomAudio(null);
                      }
                    }}
                    className={
                      'w-32 shrink-0 rounded-2xl border p-3 text-left transition ' +
                      (selectedMusicId === track.id
                        ? 'border-orange-500 bg-orange-500/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10')
                    }
                  >
                    <Music2 size={14} className="text-orange-400" />
                    <p className="mt-2 truncate text-[11px] font-black text-white">{track.title}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{track.mood}</p>
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-medium text-white/30">
                Presets tag the vibe of your post — they're not playable licensed songs. Have your own audio? Attach
                it below.
              </p>

              <div className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/60 hover:border-orange-500/60">
                  <Upload size={14} className="text-orange-400" />
                  {customAudio ? customAudio.file.name : 'Upload your own track'}
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(event) => handleAudioUpload(event.target.files?.[0] || null)}
                  />
                </label>
                {customAudio && (
                  <>
                    <button
                      type="button"
                      onClick={toggleAudioPreview}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70 hover:bg-white/20"
                      aria-label={audioPlaying ? 'Pause preview' : 'Play preview'}
                    >
                      {audioPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <audio
                      ref={audioElRef}
                      src={customAudio.previewUrl}
                      onEnded={() => setAudioPlaying(false)}
                      className="hidden"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Hashtags */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Hashtags</span>
              <div className="flex flex-wrap gap-2">
                {suggestedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleHashtag(tag)}
                    className={
                      'rounded-full border px-3 py-1.5 text-[10px] font-black transition ' +
                      (hashtags.includes(tag)
                        ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10')
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    value={customTag}
                    onChange={(event) => setCustomTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder="Add your own tag"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-8 pr-3 text-xs font-bold outline-none placeholder:text-white/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={addCustomTag}
                  className="rounded-xl bg-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/20"
                >
                  Add
                </button>
              </div>
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 rounded-full bg-orange-500/10 px-3 py-1 text-[10px] font-black text-orange-300"
                    >
                      {tag}
                      <button type="button" onClick={() => toggleHashtag(tag)} aria-label={`Remove ${tag}`}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-white/10 p-4 md:flex-row md:items-center md:justify-between">
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-black text-black transition hover:bg-orange-500 disabled:opacity-50 md:ml-auto md:w-auto"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Publishing...' : copy.submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
