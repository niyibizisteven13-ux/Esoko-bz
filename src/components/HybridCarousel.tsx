import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Heart, ShoppingBag, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const slides = [
  {
    title: 'Scroll a story, not just a page',
    description:
      'Swipe through a cinematic carousel experience built like creator Photo Mode. Each panel feels full-screen, immersive, and swipe-ready.',
    accent: 'from-orange-400 via-orange-500 to-red-500',
    showCard: false,
  },
  {
    title: 'Keep the organic flow alive',
    description:
      'Use content-first storytelling with bold full-screen visuals and progress dots. This is the same feel as photo-mode carousel posts.',
    accent: 'from-violet-500 via-fuchsia-500 to-pink-500',
    showCard: false,
  },
  {
    title: 'Add an interactive display overlay',
    description:
      'One slide becomes a commerce moment with a horizontal catalog card overlay and a strong call-to-action button.',
    accent: 'from-cyan-500 via-sky-500 to-indigo-500',
    showCard: true,
  },
  {
    title: 'Finish with a conversion slide',
    description:
      'End the story with a clear action: shop, learn more, or tap to continue. The swipe experience remains seamless.',
    accent: 'from-emerald-500 via-lime-500 to-yellow-500',
    showCard: false,
  },
];

const productItems = [
  { name: 'QuickPay QR Kit', price: 'RWF 1,500' },
  { name: 'Retail Bundle', price: 'RWF 12,000' },
  { name: 'Daily Reports', price: 'Free Setup' },
  { name: 'Loyalty Boost', price: '10% Off' },
];

export default function HybridCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = () => {
    const slider = sliderRef.current;
    if (!slider) return;
    const slideWidth = slider.offsetWidth;
    const scrollLeft = slider.scrollLeft;
    const index = Math.round(scrollLeft / slideWidth);
    setActiveIndex(Math.min(Math.max(index, 0), slides.length - 1));
  };

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    slider.addEventListener('scroll', handleScroll, { passive: true });
    return () => slider.removeEventListener('scroll', handleScroll);
  }, []);

  const slideClasses = useMemo(
    () =>
      'min-w-full snap-center flex-shrink-0 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl shadow-black/10',
    []
  );

  return (
    <section className="py-24 px-4 bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-orange-300 font-semibold mb-3">
            Hybrid Carousel Experience
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Carousel storytelling with interactive card commerce
          </h2>
          <p className="max-w-2xl mx-auto mt-4 text-neutral-300 leading-8">
            Blend creator-style Photo Mode with a commerce overlay. Users swipe horizontally, then tap a bottom card when they
            want to convert.
          </p>
        </div>

        <div className="relative">
          <div className="flex items-end justify-between mb-6 px-1">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">Slide {activeIndex + 1} of {slides.length}</p>
              <p className="text-lg font-semibold text-white">Swipe left or right to explore</p>
            </div>
            <div className="flex items-center gap-3 text-neutral-400 text-sm">
              <Sparkles size={16} /> Smooth swipe motion
            </div>
          </div>

          <div
            ref={sliderRef}
            className="group flex overflow-x-auto snap-x snap-mandatory gap-6 pb-6 scroll-smooth touch-pan-x scrollbar-hide"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {slides.map((slide, index) => (
              <div key={slide.title} className={slideClasses}>
                <div
                  className={`relative flex min-h-[420px] flex-col justify-between p-8 bg-gradient-to-br ${slide.accent}`}
                >
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/90">
                      <Heart size={16} /> Carousel + Card
                    </div>
                    <h3 className="text-3xl md:text-4xl font-extrabold leading-tight">{slide.title}</h3>
                    <p className="max-w-xl text-neutral-100/90 leading-8">{slide.description}</p>
                  </div>

                  {slide.showCard ? (
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      className="relative mt-8 rounded-[2rem] border border-white/10 bg-slate-900/95 p-5 shadow-2xl shadow-black/30"
                    >
                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-orange-300">Interactive card</p>
                          <p className="text-xl font-bold text-white">Featured product strip</p>
                        </div>
                        <button className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-400 transition">
                          Shop Now <ArrowRight size={16} />
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-3xl bg-white/5 p-4">
                          <p className="text-sm uppercase tracking-[0.3em] text-neutral-400 mb-3">Catalog</p>
                          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                            {productItems.map((product) => (
                              <div
                                key={product.name}
                                className="min-w-[160px] rounded-3xl border border-white/10 bg-slate-950/90 p-4 text-sm"
                              >
                                <p className="font-semibold text-white">{product.name}</p>
                                <p className="mt-2 text-orange-300 font-semibold">{product.price}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-3xl bg-white/5 p-4">
                          <p className="text-sm uppercase tracking-[0.3em] text-neutral-400 mb-3">Why it works</p>
                          <ul className="space-y-3 text-sm text-neutral-200">
                            <li className="rounded-2xl bg-white/5 p-3">Preserves swipe-first content flow.</li>
                            <li className="rounded-2xl bg-white/5 p-3">Offers product discovery without leaving the carousel.</li>
                            <li className="rounded-2xl bg-white/5 p-3">Supports strong CTAs for conversion.</li>
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
                        <p className="text-sm uppercase tracking-[0.3em] text-neutral-200">Tip</p>
                        <p className="mt-3 text-neutral-100 leading-7">
                          Use one or two commerce slides inside a carousel to keep engagement high and conversion easy.
                        </p>
                      </div>
                      <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
                        <p className="text-sm uppercase tracking-[0.3em] text-neutral-200">Best practice</p>
                        <p className="mt-3 text-neutral-100 leading-7">
                          Keep interactions consistent: swipe for content, tap for commerce.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  const slider = sliderRef.current;
                  if (!slider) return;
                  slider.scrollTo({ left: slider.offsetWidth * index, behavior: 'smooth' });
                }}
                className={`h-3 w-3 rounded-full transition ${
                  index === activeIndex ? 'bg-orange-400' : 'bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
