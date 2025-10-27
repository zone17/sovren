import React from 'react';
import { useNavigate } from 'react-router-dom';
import SovrenIconPNG from '../assets/icons/Sovren-icon.png';
import { Button } from '../components';
import type { IconProps } from '../components/ui/icons';
import { Globe, Shield, Zap } from '../components/ui/icons';

// Define the exact type for our benefit items
type BenefitItem = {
  icon: React.FC<IconProps>;
  title: string;
  description: string;
};

const Home: React.FC = () => {
  const navigate = useNavigate();

  // Explicitly type the benefits array with proper type safety
  const benefits: readonly BenefitItem[] = [
    {
      icon: Shield,
      title: 'True Ownership',
      description:
        'You control your audience, your content, and your revenue. Sovren is built for freedom, not algorithms.',
    },
    {
      icon: Zap,
      title: 'Bitcoin Monetization',
      description:
        'Get paid instantly, anywhere in the world. No banks, no delays, no platform fees.',
    },
    {
      icon: Globe,
      title: 'Elite Community',
      description:
        "Connect with the world's most innovative creators and supporters. Discover, tip, and collaborate.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* HERO SECTION */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 pt-16 pb-8">
        <div className="flex flex-col items-center w-full max-w-3xl mx-auto">
          <div className="mb-8 flex flex-col items-center">
            <div className="flex items-center justify-center">
              <div className="p-1 transition-transform duration-500 transform shadow-xl bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 rounded-2xl shadow-amber-500/40">
                <div className="flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32 overflow-visible">
                  <img
                    src={SovrenIconPNG}
                    alt="Sovren Logo"
                    className="object-contain w-full h-full scale-125 drop-shadow-lg"
                  />
                </div>
              </div>
            </div>
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black bg-gradient-to-r from-white via-amber-200 to-orange-400 bg-clip-text text-transparent leading-[1.1] mb-4 text-center pb-2">
            Unleash Your Creative Sovereignty
          </h1>
          <h2 className="text-lg sm:text-2xl font-semibold text-white mb-6 text-center">
            Monetize your audience. Own your platform. Get paid in real time, globally, with
            Bitcoin.
          </h2>
          <ul className="mb-8 space-y-2 text-base sm:text-lg text-amber-200 font-medium text-center">
            <li>No deplatforming. No middlemen.</li>
            <li>Instant Bitcoin payouts.</li>
            <li>Discover and support elite creators.</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center items-center mb-8">
            <Button
              onClick={() => navigate('/onboarding')}
              className="w-full sm:w-auto px-8 py-4 text-lg font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl shadow-hero hover:shadow-xl transition-all duration-300 border-0"
            >
              Start Your Sovren Journey
            </Button>
            <Button
              onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
              variant="outline"
              className="w-full sm:w-auto px-8 py-4 text-lg font-bold border-2 border-white/30 text-white bg-slate-800/80 hover:border-amber-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl backdrop-blur-sm transition-all duration-300 visible"
            >
              See How Sovren Works
            </Button>
          </div>
          <div className="text-slate-400 text-sm font-medium mb-2 text-center">
            Built by creators, for creators. 100% open, censorship-resistant, and Bitcoin-native.
          </div>
        </div>
      </div>
      {/* BENEFITS SECTION */}
      <div className="py-16 sm:py-20 md:py-24 bg-gradient-to-b from-slate-950 to-slate-900 w-full">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-12 text-center">
            Why Sovren?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {benefits.map((benefit, idx) => (
              <div
                key={idx}
                className="flex flex-col items-center text-center p-8 bg-card/40 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300"
              >
                <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 shadow-lg">
                  <benefit.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{benefit.title}</h3>
                <p className="text-base text-slate-200 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* FOOTER */}
      <footer className="w-full py-6 text-center text-slate-500 text-sm border-t border-slate-800 mt-auto">
        <div className="flex flex-col items-center gap-2">
          <span>Sovren &copy; {new Date().getFullYear()} &mdash; All rights reserved.</span>
          <span className="text-xs text-slate-600">Powered by NOSTR & Lightning Network</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
