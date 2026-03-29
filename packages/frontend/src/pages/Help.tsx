import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'What is NOSTR?',
    answer:
      'NOSTR is a simple, open protocol that enables a truly censorship-resistant social network. Think of it like email -- anyone can run a server (called a "relay"), and your identity is a pair of cryptographic keys that you own. No company controls your account, and you can use the same identity across any app that supports NOSTR.',
  },
  {
    question: 'Do I need Bitcoin to use Sovren?',
    answer:
      'No, you do not need Bitcoin to browse content or create an account. Bitcoin (via the Lightning Network) is used for payments -- tipping creators, purchasing premium content, or receiving earnings as a creator. You can explore the platform without any Bitcoin.',
  },
  {
    question: 'What are sats?',
    answer:
      'Sats (short for "satoshis") are the smallest unit of Bitcoin. 1 Bitcoin = 100,000,000 sats. Think of sats like cents to dollars. On Sovren, payments are denominated in sats because they allow for small, affordable transactions -- like tipping a creator 100 sats (a fraction of a cent).',
  },
  {
    question: 'What if I lose my NOSTR keys?',
    answer:
      'Your NOSTR private key (nsec) is the only way to access your account. If you lose it, there is no password reset or account recovery -- this is the trade-off of true ownership. That is why we strongly recommend downloading a backup during onboarding and storing it in a safe place like a password manager.',
  },
  {
    question: 'How do payments work on Sovren?',
    answer:
      'Payments use the Bitcoin Lightning Network, which enables instant, low-cost transactions. When you tip or subscribe to a creator, the payment goes directly to their Lightning wallet. There are no bank intermediaries, no 30-day payment holds, and payments settle in seconds.',
  },
  {
    question: 'What are the fees?',
    answer:
      'Sovren charges 0% platform fees on creator earnings. The only costs are Lightning Network routing fees, which are typically less than 1 sat (a fraction of a cent) per transaction. Compare this to Patreon (5-12%), YouTube (30%), or Substack (10%).',
  },
  {
    question: 'What is a Lightning wallet?',
    answer:
      'A Lightning wallet is an app that lets you send and receive Bitcoin payments instantly. Popular options include Wallet of Satoshi (easiest for beginners), Alby (browser extension, great for web creators), and Phoenix (for users who want full self-custody). You can set one up in under a minute.',
  },
  {
    question: 'Is my content censorship-resistant?',
    answer:
      'Yes. When you publish on Sovren, your content is distributed across multiple NOSTR relays -- independent servers run by different people and organizations. No single entity can remove your content from the entire network. Even if Sovren went offline, your content would still be accessible through other NOSTR clients.',
  },
  {
    question: 'Can I use my NOSTR identity on other platforms?',
    answer:
      'Absolutely. Your NOSTR keys work across any NOSTR-compatible application -- Damus, Primal, Snort, Amethyst, and many more. Your followers, profile, and content are portable. This is one of the biggest advantages over traditional platforms where your audience is locked in.',
  },
  {
    question: 'How is Sovren different from Patreon or Substack?',
    answer:
      'Three key differences: (1) Ownership -- you own your identity, audience, and content. No platform can ban you or hold your earnings. (2) Fees -- 0% platform fee vs 5-30% on traditional platforms. (3) Freedom -- no content policy surprises, no algorithmic suppression, no terms of service changes that affect your livelihood.',
  },
  {
    question: 'Is Sovren free to use?',
    answer:
      'Yes, creating an account, publishing content, and discovering creators is completely free. Sovren only facilitates Lightning payments between creators and supporters -- and takes no cut.',
  },
  {
    question: 'What kind of content can I publish?',
    answer:
      'You can publish articles, images, and other text-based content. Audio and video support is planned. All content must comply with applicable laws -- while the NOSTR protocol is censorship-resistant, illegal content is not tolerated on Sovren-operated relays.',
  },
  {
    question: 'How do I get started as a creator?',
    answer:
      'Sign up, choose "Creator" during onboarding, generate your NOSTR keys, and optionally set up a Lightning wallet. Then start publishing! You can create your first post immediately after onboarding.',
  },
];

const FAQAccordion: React.FC<{ item: FAQItem; index: number }> = ({ item, index }) => {
  const [isOpen, setIsOpen] = useState(false);
  const headingId = `faq-heading-${index}`;
  const panelId = `faq-panel-${index}`;

  return (
    <div className='border-b border-white/5 last:border-b-0'>
      <h3>
        <button
          id={headingId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen(!isOpen)}
          className='flex w-full items-center justify-between py-5 px-1 text-left text-foreground hover:text-purple-300 transition-colors duration-150'
        >
          <span className='text-base font-medium pr-4'>{item.question}</span>
          <svg
            className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth={1.5}
            aria-hidden='true'
          >
            <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
          </svg>
        </button>
      </h3>
      <div
        id={panelId}
        role='region'
        aria-labelledby={headingId}
        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}
      >
        <p className='text-sm text-white/70 leading-relaxed px-1'>{item.answer}</p>
      </div>
    </div>
  );
};

const Help: React.FC = () => {
  useDocumentTitle('Help & FAQ');

  return (
    <div className='min-h-screen bg-background'>
      <div className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
        <nav className='mb-8'>
          <Link to='/' className='text-sm text-purple-400 hover:text-purple-300 transition-colors'>
            &larr; Back to Home
          </Link>
        </nav>

        <h1 className='text-3xl font-bold text-foreground font-display mb-2'>Help & FAQ</h1>
        <p className='text-muted-foreground mb-10'>
          Find answers to common questions about Sovren, NOSTR, Bitcoin Lightning, and getting
          started.
        </p>

        <div className='glass-dark rounded-2xl border border-white/5 p-6 sm:p-8'>
          {faqItems.map((item, index) => (
            <FAQAccordion key={index} item={item} index={index} />
          ))}
        </div>

        <div className='mt-10 text-center'>
          <p className='text-sm text-muted-foreground mb-4'>
            Still have questions? Reach out to us on NOSTR.
          </p>
          <div className='flex justify-center gap-4 text-sm'>
            <Link to='/terms' className='text-purple-400 hover:text-purple-300 transition-colors'>
              Terms of Service
            </Link>
            <Link to='/privacy' className='text-purple-400 hover:text-purple-300 transition-colors'>
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
