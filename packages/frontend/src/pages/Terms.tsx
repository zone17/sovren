import React from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const Terms: React.FC = () => {
  useDocumentTitle('Terms of Service');

  return (
    <div className='min-h-screen bg-background'>
      <div className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
        <nav className='mb-8'>
          <Link to='/' className='text-sm text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center py-3 min-h-[44px]'>
            &larr; Back to Home
          </Link>
        </nav>

        <article className='prose prose-invert max-w-none'>
          <h1 className='text-3xl font-bold text-foreground font-display mb-2'>Terms of Service</h1>
          <p className='text-sm text-muted-foreground mb-8'>Last updated: March 2026</p>

          <section className='space-y-6 text-white/80 leading-relaxed'>
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>1. Acceptance of Terms</h2>
              <p>
                By accessing or using Sovren ("the Platform"), you agree to be bound by these Terms
                of Service. If you do not agree to these terms, please do not use the Platform.
              </p>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                2. Description of Service
              </h2>
              <p>
                Sovren is a decentralized creator monetization platform built on the NOSTR protocol
                and Bitcoin Lightning Network. The Platform enables creators to publish content,
                receive payments in Bitcoin, and maintain ownership of their audience relationships.
              </p>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                3. User Accounts and Identity
              </h2>
              <p>
                Your identity on Sovren is managed through NOSTR cryptographic keys. You are solely
                responsible for maintaining the security of your private keys. Sovren does not store
                your private keys and cannot recover them if lost.
              </p>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>4. Content Ownership</h2>
              <p>
                You retain full ownership of all content you create and publish through Sovren. By
                publishing content on the NOSTR network via our Platform, you grant other users of
                the NOSTR protocol the ability to view and interact with your content as permitted
                by the protocol.
              </p>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>5. Payments and Fees</h2>
              <p>
                Payments on Sovren are processed through the Bitcoin Lightning Network. Sovren does
                not charge platform fees on creator earnings. Standard Lightning Network transaction
                fees apply. All payments are final and non-refundable due to the nature of Bitcoin
                transactions.
              </p>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>6. Prohibited Conduct</h2>
              <p>You agree not to use the Platform to:</p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>Publish illegal content or content that violates applicable laws</li>
                <li>Harass, threaten, or harm other users</li>
                <li>Distribute malware or attempt to compromise the Platform's security</li>
                <li>Impersonate other individuals or entities</li>
                <li>Engage in fraudulent payment activities</li>
              </ul>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                7. Disclaimer of Warranties
              </h2>
              <p>
                The Platform is provided "as is" without warranties of any kind. Sovren does not
                guarantee uninterrupted access, data accuracy, or the availability of the NOSTR
                network or Lightning Network.
              </p>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                8. Limitation of Liability
              </h2>
              <p>
                Sovren shall not be liable for any indirect, incidental, or consequential damages
                arising from your use of the Platform, including but not limited to loss of
                cryptocurrency, data loss, or loss of profits.
              </p>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>9. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. Continued use of the
                Platform after changes constitutes acceptance of the modified Terms.
              </p>
            </div>

            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>10. Contact</h2>
              <p>
                For questions about these Terms, please reach out via the NOSTR protocol or through
                our{' '}
                <Link
                  to='/help'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Help page
                </Link>
                .
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
};

export default Terms;
