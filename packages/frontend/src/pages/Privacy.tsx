import React from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const Privacy: React.FC = () => {
  useDocumentTitle('Privacy Policy');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="mb-8">
          <Link to="/" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
            &larr; Back to Home
          </Link>
        </nav>

        <article className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground font-display mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

          <section className="space-y-6 text-white/80 leading-relaxed">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Our Commitment to Privacy</h2>
              <p>
                Sovren is built on the principle of user sovereignty. We collect the minimum amount
                of data necessary to operate the Platform and give you full control over your
                digital identity through NOSTR cryptographic keys.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Data We Collect</h2>
              <p><strong>Data we store:</strong></p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Your NOSTR public key (used as your account identifier)</li>
                <li>Profile information you voluntarily provide (display name, bio)</li>
                <li>Lightning payment transaction records (amounts, timestamps)</li>
                <li>Content you publish through the Platform</li>
              </ul>
              <p className="mt-3"><strong>Data we do NOT collect or store:</strong></p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Your NOSTR private key (nsec) -- this never leaves your device</li>
                <li>Your email address (unless you voluntarily provide one)</li>
                <li>Your real name or physical address</li>
                <li>Tracking cookies or advertising identifiers</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Data</h2>
              <p>We use collected data solely to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Provide and improve the Platform's functionality</li>
                <li>Process Lightning Network payments</li>
                <li>Display your profile and content to other users</li>
                <li>Prevent abuse and enforce our Terms of Service</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. NOSTR Protocol and Decentralization</h2>
              <p>
                Content published via NOSTR is distributed across multiple relays and cannot be
                fully removed from the network once published. This is a fundamental property of
                the NOSTR protocol and is by design. Please consider this before publishing content.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Sharing</h2>
              <p>
                We do not sell your data to third parties. We do not share your data with
                advertisers. Content you publish is distributed through the NOSTR protocol as
                intended by its design.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Security</h2>
              <p>
                We employ industry-standard security measures to protect data stored on our servers.
                Your private key security is your responsibility -- we recommend using a password
                manager and keeping offline backups.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Access your stored data at any time</li>
                <li>Request deletion of your account data from our servers</li>
                <li>Export your content and profile information</li>
                <li>Use your NOSTR keys on any compatible platform</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify users of
                significant changes through the Platform.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Contact</h2>
              <p>
                For privacy-related questions, please reach out via the NOSTR protocol or through
                our{' '}
                <Link to="/help" className="text-purple-400 hover:text-purple-300 transition-colors">
                  Help page
                </Link>.
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
};

export default Privacy;
