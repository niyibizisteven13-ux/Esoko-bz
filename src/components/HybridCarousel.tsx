import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Heart, ShoppingBag, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const slides = [
  {
    title: '70% of SMEs Fail in 3 Years',
    description:
      'Cash flow mismanagement, no mentorship, 16–25% bank interest rates, and telecom fees of 10% per withdrawal are silently destroying African merchants.',
    accent: 'from-orange-400 via-orange-500 to-red-500',
    showCard: false,
  },
  {
    title: 'One Platform. Three Advantages.',
    description:
      'Esoko Nexus combines a Mentorship Hub, a Commerce Platform, and CBDC E-Money — solving SME failure and telecom monopoly in one ecosystem.',
    accent: 'from-violet-500 via-fuchsia-500 to-pink-500',
    showCard: false,
  },
  {
    title: 'Free Business Guidance, Built to Scale',
    description:
      'Through partnerships with Inkomoko and the University of Rwanda, trained mentors give merchants real-time business support — funded sustainably through app fees.',
    accent: 'from-cyan-500 via-sky-500 to-indigo-500',
    showCard: false,
  },
  {
    title: 'Replace 10% Fees With Under 1%',
    description:
      'Using Bank of Rwanda CBDC e-money, merchants save up to RWF 45,000 per month. MTN and Airtel charge RWF 100 per 1K withdrawn. We charge less than RWF 10.',
    accent: 'from-emerald-500 via-lime-500 to-yellow-500',
    showCard: true,
  },
  {
    title: 'Already Built. Already Tested.',
    description:
      'Full-stack commerce platform with integrated wallet, mobile money, inventory management, financial dashboards, loan access, RRA tax compliance — works on 3G and basic browsers.',
    accent: 'from-sky-500 via-blue-500 to-indigo-500',
    showCard: false,
  },
  {
    title: 'Every Merchant Deserves a Mentor and Fair Fees',
    description:
      'We are not just building a platform. We are building the alternative to telecom monopolies — using government-backed digital money to make Rwandan merchants richer.',
    accent: 'from-slate-700 via-slate-800 to-slate-950',
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
  const autoplayRef = useRef<number | null>(null);

  const clearAutoplay = () => {
    if (autoplayRef.current !== null) {
      window.clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  };

  const resetAutoplay = () => {
    clearAutoplay();
    autoplayRef.current = window.setInterval(() => {
      setActiveIndex((currentIndex) => {
        const nextIndex = (currentIndex + 1) % slides.length;
        const slider = sliderRef.current;
        if (slider) {
          slider.scrollTo({ left: slider.offsetWidth * nextIndex, behavior: 'smooth' });
        }
        return nextIndex;
      });
    }, 4000);
  };

  const handleScroll = () => {
    const slider = sliderRef.current;
    if (!slider) return;
    const slideWidth = slider.offsetWidth;
    const scrollLeft = slider.scrollLeft;
    const index = Math.round(scrollLeft / slideWidth);
    setActiveIndex((prevIndex) => {
      const nextIndex = Math.min(Math.max(index, 0), slides.length - 1);
      if (nextIndex !== prevIndex) {
        resetAutoplay();
      }
      return nextIndex;
    });
  };

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    slider.addEventListener('scroll', handleScroll, { passive: true });
    resetAutoplay();
    return () => {
      slider.removeEventListener('scroll', handleScroll);
      clearAutoplay();
    };
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
            ESOKO NEXUS · BUILT FOR RWANDA'S MERCHANTS
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Mentorship. Commerce. Digital Money. One Platform.
          </h2>
          <p className="max-w-2xl mx-auto mt-4 text-neutral-300 leading-8">
            From SME failure to telecom monopoly fees — swipe through the real problems we solve and how Esoko Nexus fights back.
          </p>
        </div>

        <div className="relative">
          <div className="flex items-end justify-between mb-6 px-1">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-neutral-400">Slide {activeIndex + 1} of {slides.length}</p>
              <p className="text-lg font-semibold text-white">Swipe to explore our story</p>
            </div>
            <div className="flex items-center gap-3 text-neutral-400 text-sm">
              <Sparkles size={16} /> Built for Rwanda · Expanding across East Africa
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
                  className={`relative flex min-h-[420px] flex-col justify-between p-8 bg-gradient-to-br ${slide.accent} shadow-2xl backdrop-blur-sm`}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)',
                      animation: 'shimmer 3s infinite linear',
                      borderRadius: 'inherit',
                      pointerEvents: 'none',
                    }}
                  />
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/90">
                      <Heart size={16} /> ESOKO NEXUS · SOLUTION
                    </div>
                    <h3
                      key={index}
                      className="text-3xl md:text-4xl font-extrabold leading-tight"
                      style={{
                        animation: 'fadeInUp 0.6s ease forwards',
                        opacity: 0,
                      }}
                    >
                      {slide.title}
                    </h3>
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
                        <p className="text-sm uppercase tracking-[0.3em] text-neutral-200">DID YOU KNOW</p>
                        <p className="mt-3 text-neutral-100 leading-7">
                          70% of Rwandan SMEs fail in 3 years due to lack of guidance and predatory transaction fees.
                        </p>
                      </div>
                      <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm">
                        <p className="text-sm uppercase tracking-[0.3em] text-neutral-200">OUR IMPACT</p>
                        <p className="mt-3 text-neutral-100 leading-7">
                          Merchants save up to RWF 45,000/month by switching from telecom fees to Esoko Nexus CBDC payments.
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
