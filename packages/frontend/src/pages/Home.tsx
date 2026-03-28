import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SovrenIconPNG from '../assets/icons/Sovren-icon.png';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

/* ────────────────────────────────────────────────────────
   SOVREN LANDING PAGE
   Aesthetic: Crystalline Depth — dark space with purple nebula,
   glass panels floating, cinematic scroll-driven narrative.
   ──────────────────────────────────────────────────────── */

// ─── Extracted SVG Icons ───────────────────────────────
const OwnershipIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
    />
  </svg>
);

const LightningIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
    />
  </svg>
);

// Intersection Observer hook for scroll-triggered reveals
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(entry.target); // Once revealed, stop observing to prevent stale re-triggers on fast scroll
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// Animated counter for stats
const AnimatedNumber = React.memo(function AnimatedNumber({
  value,
  suffix = '',
}: {
  value: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const { ref, inView } = useInView(0.3);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView, value]);
  return (
    <span ref={ref}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
});

const Home: React.FC = () => {
  useDocumentTitle('Home');
  const navigate = useNavigate();
  const heroSection = useInView(0.1);
  const featuresSection = useInView(0.1);
  const howSection = useInView(0.1);
  const statsSection = useInView(0.1);
  const ctaSection = useInView(0.1);

  return (
    <main
      id="main-content"
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 80% 60% at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 60%, rgba(59,130,246,0.08) 0%, transparent 50%),
          radial-gradient(ellipse 50% 50% at 20% 80%, rgba(168,85,247,0.06) 0%, transparent 50%),
          hsl(240 20% 4%)
        `,
      }}
    >
      {/* Floating nav */}
      <nav aria-label="Main navigation" className="fixed top-0 inset-x-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="glass-dark rounded-2xl px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={SovrenIconPNG} alt="Sovren" className="w-8 h-8 rounded-lg" />
              <span
                className="text-lg font-bold text-white"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                Sovren
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-white/60 hover:text-white transition-colors no-underline"
              >
                Features
              </a>
              <a
                href="#how"
                className="text-sm text-white/60 hover:text-white transition-colors no-underline"
              >
                How It Works
              </a>
              <a
                href="/discover"
                className="text-sm text-white/60 hover:text-white transition-colors no-underline"
              >
                Discover
              </a>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-white/70 hover:text-white transition-colors px-4 py-2"
              >
                Log in
              </button>
              <button
                onClick={() => navigate('/onboarding')}
                className="text-sm font-medium text-white px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all duration-200 shadow-[0_4px_16px_rgba(139,92,246,0.3)] hover:shadow-[0_8px_24px_rgba(139,92,246,0.4)]"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section
        ref={heroSection.ref}
        className="min-h-screen flex flex-col items-center justify-center px-4 pt-32 pb-20 relative"
      >
        {/* Floating purple orb accent — reduced on mobile to save GPU memory */}
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] md:w-[600px] md:h-[600px] rounded-full opacity-20 blur-[60px] md:blur-[120px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)',
          }}
        />

        <div
          className={`relative z-10 max-w-4xl mx-auto text-center transition-all duration-1000 ${heroSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-dark text-sm text-purple-300 mb-8">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Decentralized Creator Platform
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[0.95] mb-6 text-gradient-hero"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Own Your
            <br />
            Creative Empire
          </h1>

          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Monetize your audience with Bitcoin. Publish to a censorship-resistant network powered
            by{' '}
            <span className="text-purple-300 font-medium" title="NOSTR is a new way to publish online where no company can delete your content or ban your account.">
              NOSTR
            </span>
            . No middlemen. No deplatforming. Just you and your audience.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => navigate('/onboarding')}
              className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all duration-300 shadow-[0_8px_32px_rgba(139,92,246,0.35)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.5)] hover:-translate-y-0.5"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Start Creating
            </button>
            <button
              onClick={() =>
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="w-full sm:w-auto px-8 py-4 text-base font-medium rounded-2xl glass-dark text-white/80 hover:text-white hover:bg-white/[0.06] transition-all duration-300"
            >
              See How It Works
            </button>
          </div>

          {/* Dashboard preview mockup — glass card */}
          <div className="relative max-w-3xl mx-auto">
            <div className="glass-dark rounded-3xl p-1 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <div className="rounded-[1.25rem] bg-[hsl(240,18%,8%)] p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  <span className="ml-4 text-xs text-white/50 font-mono">sovren.dev/dashboard</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    {
                      label: 'Earnings',
                      value: '21,450',
                      unit: 'sats',
                      color: 'from-amber-500/20 to-amber-500/5',
                    },
                    {
                      label: 'Subscribers',
                      value: '1,247',
                      unit: '',
                      color: 'from-purple-500/20 to-purple-500/5',
                    },
                    {
                      label: 'Views',
                      value: '45.2K',
                      unit: '',
                      color: 'from-blue-500/20 to-blue-500/5',
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`rounded-xl bg-gradient-to-b ${stat.color} border border-white/5 p-4`}
                    >
                      <p className="text-xs text-white/60 mb-1">{stat.label}</p>
                      <p className="text-xl font-bold text-white">{stat.value}</p>
                      {stat.unit && (
                      <p className="text-xs text-amber-400/60">
                        {stat.unit}
                        {stat.unit === 'sats' && (
                          <span className="ml-1 text-white/40" title="Sats (satoshis) are the smallest unit of Bitcoin. 100,000 sats is roughly $1 USD.">(~$0.21 USD)</span>
                        )}
                      </p>
                    )}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {[
                    'How I Built My First App',
                    'The Future of Creator Economy',
                    'Bitcoin for Beginners',
                  ].map((title, i) => (
                    <div
                      key={title}
                      className="flex items-center gap-4 rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-green-400' : i === 1 ? 'bg-purple-400' : 'bg-amber-400'}`}
                      />
                      <span className="text-sm text-white/70 flex-1">{title}</span>
                      <span className="text-xs text-white/50">
                        {i === 0 ? '2.4K views' : i === 1 ? '1.8K views' : 'Draft'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Glow under dashboard */}
            <div className="absolute -bottom-8 inset-x-8 h-16 bg-purple-500/10 blur-3xl rounded-full" />
          </div>
        </div>
      </section>

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section id="features" ref={featuresSection.ref} className="py-24 sm:py-32 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div
            className={`text-center mb-16 transition-all duration-700 ${featuresSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Built for <span className="text-gradient-sovereign">sovereign creators</span>
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Everything you need to build, grow, and monetize — without giving up control.
            </p>
          </div>

          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${featuresSection.inView ? 'reveal-stagger' : ''}`}
          >
            {[
              {
                icon: <OwnershipIcon />,
                title: 'True Ownership',
                description:
                  'Your content lives on NOSTR — a protocol no one controls. Your audience, your keys, your rules.',
                gradient: 'from-purple-500/20 to-violet-500/5',
              },
              {
                icon: <LightningIcon />,
                title: 'Instant Bitcoin Payments',
                description:
                  'Get paid via Lightning Network. No banks, no 30-day payouts, no 30% platform cuts. Just sats.',
                gradient: 'from-amber-500/20 to-orange-500/5',
              },
              {
                icon: <ShieldIcon />,
                title: 'Censorship Resistant',
                description:
                  'No algorithms deciding who sees your work. No terms of service surprises. Publish freely, forever.',
                gradient: 'from-emerald-500/20 to-green-500/5',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className={`glass-dark-hover rounded-2xl p-8 group cursor-default`}
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-b ${feature.gradient} border border-white/10 flex items-center justify-center text-white/80 mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  {feature.icon}
                </div>
                <h3
                  className="text-xl font-semibold text-white mb-3"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {feature.title}
                </h3>
                <p className="text-white/60 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
      <section id="how" ref={howSection.ref} className="py-24 sm:py-32 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div
            className={`text-center mb-16 transition-all duration-700 ${howSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Three steps to <span className="text-gradient-lightning">freedom</span>
            </h2>
          </div>

          <div className={`space-y-8 ${howSection.inView ? 'reveal-stagger' : ''}`}>
            {[
              {
                step: '01',
                title: 'Connect your identity',
                description:
                  'Sign in with your NOSTR keys. No email, no password, no data harvesting. Your cryptographic identity is your passport.',
                accent: 'text-purple-400',
                border: 'border-purple-500/20',
              },
              {
                step: '02',
                title: 'Create and publish',
                description:
                  'Write articles, share images, upload audio/video. Set your price in sats or offer it free. One click to publish to the NOSTR network.',
                accent: 'text-blue-400',
                border: 'border-blue-500/20',
              },
              {
                step: '03',
                title: 'Earn Bitcoin instantly',
                description:
                  'Supporters tip you via Lightning. Payments arrive in seconds, not weeks. No minimum payout. No platform fees.',
                accent: 'text-amber-400',
                border: 'border-amber-500/20',
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`glass-dark rounded-2xl p-8 flex items-start gap-6 border ${item.border}`}
              >
                <span
                  className={`text-4xl font-bold ${item.accent} opacity-40 shrink-0`}
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {item.step}
                </span>
                <div>
                  <h3
                    className="text-xl font-semibold text-white mb-2"
                    style={{ fontFamily: "'Sora', sans-serif" }}
                  >
                    {item.title}
                  </h3>
                  <p className="text-white/60 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ STATS ═══════════════════ */}
      <section ref={statsSection.ref} className="py-24 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div
            className={`grid grid-cols-2 md:grid-cols-4 gap-6 ${statsSection.inView ? 'reveal-stagger' : ''}`}
          >
            {[
              { value: 0, suffix: '%', label: 'Platform Fees', display: '0%' },
              { value: 100, suffix: '%', label: 'Content Ownership' },
              { value: 0, suffix: '', label: 'Middlemen', display: 'Zero' },
              { value: 1, suffix: '', label: 'Identity, Yours', display: 'Yours' },
            ].map((stat) => (
              <div key={stat.label} className="glass-dark rounded-2xl p-6 text-center">
                <p
                  className="text-3xl sm:text-4xl font-bold text-white mb-1"
                  style={{ fontFamily: "'Sora', sans-serif" }}
                >
                  {stat.display ?? <AnimatedNumber value={stat.value} suffix={stat.suffix} />}
                </p>
                <p className="text-sm text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ WHY SOVREN ═══════════════════ */}
      <section className="py-24 sm:py-32 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Why <span className="text-gradient-sovereign">Sovren</span>?
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              See how Sovren compares to traditional creator platforms.
            </p>
          </div>

          <div className="glass-dark rounded-2xl overflow-hidden border border-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-4 px-6 text-white/60 font-medium" />
                  <th className="text-center py-4 px-4 text-purple-300 font-semibold">Sovren</th>
                  <th className="text-center py-4 px-4 text-white/40 font-medium">Patreon</th>
                  <th className="text-center py-4 px-4 text-white/40 font-medium">YouTube</th>
                  <th className="text-center py-4 px-4 text-white/40 font-medium hidden sm:table-cell">Substack</th>
                </tr>
              </thead>
              <tbody className="text-white/70">
                <tr className="border-b border-white/5">
                  <td className="py-3 px-6 font-medium text-white/80">Platform fee</td>
                  <td className="py-3 px-4 text-center text-green-400 font-semibold">0%</td>
                  <td className="py-3 px-4 text-center">5-12%</td>
                  <td className="py-3 px-4 text-center">30%</td>
                  <td className="py-3 px-4 text-center hidden sm:table-cell">10%</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-6 font-medium text-white/80">Payout speed</td>
                  <td className="py-3 px-4 text-center text-green-400 font-semibold">Instant</td>
                  <td className="py-3 px-4 text-center">30 days</td>
                  <td className="py-3 px-4 text-center">30 days</td>
                  <td className="py-3 px-4 text-center hidden sm:table-cell">30 days</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-6 font-medium text-white/80">Content ownership</td>
                  <td className="py-3 px-4 text-center text-green-400 font-semibold">You</td>
                  <td className="py-3 px-4 text-center">Platform</td>
                  <td className="py-3 px-4 text-center">Platform</td>
                  <td className="py-3 px-4 text-center hidden sm:table-cell">Platform</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-3 px-6 font-medium text-white/80">Can be deplatformed</td>
                  <td className="py-3 px-4 text-center text-green-400 font-semibold">No</td>
                  <td className="py-3 px-4 text-center">Yes</td>
                  <td className="py-3 px-4 text-center">Yes</td>
                  <td className="py-3 px-4 text-center hidden sm:table-cell">Yes</td>
                </tr>
                <tr>
                  <td className="py-3 px-6 font-medium text-white/80">Audience portability</td>
                  <td className="py-3 px-4 text-center text-green-400 font-semibold">Full</td>
                  <td className="py-3 px-4 text-center">None</td>
                  <td className="py-3 px-4 text-center">None</td>
                  <td className="py-3 px-4 text-center hidden sm:table-cell">Email only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section ref={ctaSection.ref} className="py-24 sm:py-32 relative">
        <div
          className={`max-w-3xl mx-auto px-4 sm:px-6 text-center transition-all duration-700 ${ctaSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Purple glow — reduced on mobile to save GPU memory */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] md:w-[400px] md:h-[400px] rounded-full bg-purple-500/10 blur-[50px] md:blur-[100px] pointer-events-none" />

          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 relative"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Ready to own your future?
          </h2>
          <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto relative">
            Join creators building on a platform that can never be taken away.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
            <button
              onClick={() => navigate('/onboarding')}
              className="w-full sm:w-auto px-10 py-5 text-lg font-semibold text-white rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 transition-all duration-300 shadow-[0_8px_32px_rgba(139,92,246,0.35)] hover:shadow-[0_16px_48px_rgba(139,92,246,0.5)] hover:-translate-y-1"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Start Creating
            </button>
            <button
              onClick={() => navigate('/discover')}
              className="w-full sm:w-auto px-10 py-5 text-lg font-medium rounded-2xl glass-dark text-white/80 hover:text-white hover:bg-white/[0.06] transition-all duration-300"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Browse Creators
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={SovrenIconPNG} alt="" className="w-5 h-5 rounded opacity-60" loading="lazy" />
            <span className="text-sm text-white/50">Sovren &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/60">
            <a href="/terms" className="hover:text-white/80 transition-colors no-underline">Terms</a>
            <a href="/privacy" className="hover:text-white/80 transition-colors no-underline">Privacy</a>
            <a href="/help" className="hover:text-white/80 transition-colors no-underline">Help</a>
          </div>
        </div>
      </footer>
    </main>
  );
};

export default Home;
