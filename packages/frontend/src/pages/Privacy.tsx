import React from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const Privacy: React.FC = () => {
  useDocumentTitle('Privacy Policy');

  return (
    <div className='min-h-screen bg-background'>
      <div className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
        <nav className='mb-8'>
          <Link
            to='/'
            className='text-sm text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center py-3 min-h-[44px]'
          >
            &larr; Back to Home
          </Link>
        </nav>

        <article className='prose prose-invert max-w-none'>
          <h1 className='text-3xl font-bold text-foreground font-display mb-2'>Privacy Policy</h1>
          <p className='text-sm text-muted-foreground mb-8'>Last updated: March 2026</p>

          <section className='space-y-8 text-white/80 leading-relaxed'>
            {/* 1. Data Controller */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>1. Data Controller</h2>
              <p>
                Sovren (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is
                the data controller responsible for the processing of your personal data as
                described in this Privacy Policy. For all privacy-related inquiries, contact us at:
              </p>
              <p className='mt-2 pl-4 border-l-2 border-purple-500/30'>
                Data Protection Contact
                <br />
                Email:{' '}
                <a
                  href='mailto:privacy@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  privacy@sovren.app
                </a>
              </p>
            </div>

            {/* 2. Our Commitment to Privacy */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                2. Our Commitment to Privacy
              </h2>
              <p>
                Sovren is built on the principle of user sovereignty. We collect the minimum amount
                of data necessary to operate the Platform and give you full control over your
                digital identity through NOSTR cryptographic keys. This Privacy Policy explains what
                data we collect, why we collect it, and your rights regarding that data.
              </p>
            </div>

            {/* 3. Data We Collect */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                3. Data We Collect and Lawful Basis
              </h2>
              <p>
                In compliance with GDPR Article 6, we identify the lawful basis for processing each
                category of personal data:
              </p>

              <div className='mt-4 overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b border-white/10'>
                      <th className='text-left py-2 pr-4 text-foreground font-semibold'>
                        Data Category
                      </th>
                      <th className='text-left py-2 pr-4 text-foreground font-semibold'>Purpose</th>
                      <th className='text-left py-2 text-foreground font-semibold'>
                        Lawful Basis (GDPR Art. 6)
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-white/5'>
                    <tr>
                      <td className='py-3 pr-4'>NOSTR public key (npub)</td>
                      <td className='py-3 pr-4'>Account identification</td>
                      <td className='py-3'>Contract performance (Art. 6(1)(b))</td>
                    </tr>
                    <tr>
                      <td className='py-3 pr-4'>Display name, bio, avatar</td>
                      <td className='py-3 pr-4'>Profile display</td>
                      <td className='py-3'>Contract performance (Art. 6(1)(b))</td>
                    </tr>
                    <tr>
                      <td className='py-3 pr-4'>
                        Lightning payment records (amounts, timestamps, invoice data)
                      </td>
                      <td className='py-3 pr-4'>Transaction processing, tax compliance</td>
                      <td className='py-3'>
                        Contract performance (Art. 6(1)(b)) and Legal obligation (Art. 6(1)(c))
                      </td>
                    </tr>
                    <tr>
                      <td className='py-3 pr-4'>Content published through the Platform</td>
                      <td className='py-3 pr-4'>Content hosting, NOSTR relay distribution</td>
                      <td className='py-3'>Contract performance (Art. 6(1)(b))</td>
                    </tr>
                    <tr>
                      <td className='py-3 pr-4'>Usage analytics (page views, feature usage)</td>
                      <td className='py-3 pr-4'>Platform improvement, performance monitoring</td>
                      <td className='py-3'>Legitimate interests (Art. 6(1)(f))</td>
                    </tr>
                    <tr>
                      <td className='py-3 pr-4'>Session cookies</td>
                      <td className='py-3 pr-4'>Authentication, session management</td>
                      <td className='py-3'>
                        Contract performance (Art. 6(1)(b)) &mdash; strictly necessary
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Data We Do NOT Collect */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                4. Data We Do NOT Collect
              </h2>
              <p>The Company does not collect or store the following:</p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>Your NOSTR private key (nsec) &mdash; this never leaves your device.</li>
                <li>Your email address (unless you voluntarily provide one).</li>
                <li>Your real name or physical address.</li>
                <li>Your phone number.</li>
                <li>Your geographic location.</li>
                <li>Tracking cookies or third-party cookies.</li>
                <li>Advertising identifiers or advertising data.</li>
              </ul>
            </div>

            {/* 5. Cookie Policy */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>5. Cookie Policy</h2>
              <p>
                The Platform uses <strong>HttpOnly session cookies</strong> strictly necessary for
                authentication and session management. These cookies:
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>
                  <strong>Purpose:</strong> Maintain your authenticated session after login.
                </li>
                <li>
                  <strong>Duration:</strong> Twenty-four (24) hours, after which you must
                  re-authenticate.
                </li>
                <li>
                  <strong>Type:</strong> HttpOnly, Secure, SameSite=Strict &mdash; not accessible to
                  JavaScript and not transmitted cross-site.
                </li>
              </ul>
              <p className='mt-3'>
                <strong>No Third-Party Cookies:</strong> The Platform does not use third-party
                cookies, tracking cookies, advertising cookies, or analytics cookies from external
                providers. We do not participate in any cookie-based advertising or cross-site
                tracking.
              </p>
            </div>

            {/* 6. How We Use Your Data */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                6. How We Use Your Data
              </h2>
              <p>We process your personal data solely for the following purposes:</p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>Providing, operating, and improving the Platform&apos;s functionality.</li>
                <li>Processing Lightning Network payments between Users.</li>
                <li>Displaying your profile and content to other Users.</li>
                <li>Distributing content through NOSTR relays.</li>
                <li>Preventing abuse and enforcing our Terms of Service and Content Policy.</li>
                <li>Complying with legal obligations, including tax reporting requirements.</li>
              </ul>
            </div>

            {/* 7. Data Sharing */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                7. Data Sharing and Third Parties
              </h2>
              <p>
                <strong>We do not sell your personal data.</strong> We do not share your data with
                advertisers. We do not participate in data brokerage of any kind.
              </p>
              <p className='mt-2'>
                Data is shared only with the following categories of recipients, each of which has a
                Data Processing Agreement (DPA) in place where applicable:
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-2'>
                <li>
                  <strong>Supabase</strong> (database hosting) &mdash; stores account data and
                  transaction records on our behalf.
                </li>
                <li>
                  <strong>Vercel</strong> (frontend hosting) &mdash; serves the Platform&apos;s web
                  application.
                </li>
                <li>
                  <strong>NOSTR Relays</strong> (by protocol design) &mdash; content you publish is
                  distributed to NOSTR relays as a fundamental feature of the protocol. Content
                  published to NOSTR relays is public by design.
                </li>
              </ul>
              <p className='mt-2'>
                We may also disclose personal data when required to do so by law, regulation, legal
                process, or enforceable governmental request, or when we believe disclosure is
                necessary to protect our rights, your safety, or the safety of others.
              </p>
            </div>

            {/* 8. Data Retention */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>8. Data Retention</h2>
              <ul className='list-disc pl-6 space-y-2'>
                <li>
                  <strong>Account data</strong> (public key, profile information, content): Retained
                  while your account is active.
                </li>
                <li>
                  <strong>After deletion request:</strong> Your account enters a thirty (30) day
                  grace period during which data is retained but your account is deactivated. After
                  the grace period, all account data is permanently purged from our systems.
                </li>
                <li>
                  <strong>Payment records:</strong> Retained for seven (7) years after the
                  transaction date to comply with tax law and financial record-keeping obligations.
                </li>
                <li>
                  <strong>NOSTR content:</strong> Content that has been propagated to third-party
                  NOSTR relays cannot be recalled or deleted by the Company after publication. This
                  is an inherent property of the NOSTR protocol.
                </li>
              </ul>
            </div>

            {/* 9. NOSTR Protocol and Decentralization */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                9. NOSTR Protocol and Decentralization
              </h2>
              <p>
                Content published via NOSTR is distributed across multiple independently operated
                relays and cannot be fully removed from the network once published. This is a
                fundamental and intentional property of the NOSTR protocol. You should consider this
                permanent nature before publishing any content. The Company&apos;s ability to delete
                content is limited to relays operated by the Company.
              </p>
            </div>

            {/* 10. Data Security */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>10. Data Security</h2>
              <p>
                We employ industry-standard technical and organizational security measures to
                protect data stored on our systems, including encryption in transit (TLS),
                encryption at rest, access controls, and regular security audits. However, no system
                is completely secure, and we cannot guarantee absolute security.
              </p>
              <p className='mt-2'>
                Your private key security is your responsibility. We strongly recommend using a
                password manager and keeping offline backups of your NOSTR keys.
              </p>
            </div>

            {/* 11. International Data Transfers */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                11. International Data Transfers
              </h2>
              <p>
                Your personal data is processed and stored in the United States. If you are located
                in the European Economic Area (EEA), United Kingdom, or Switzerland, your data is
                transferred to the US under appropriate safeguards, including the EU-US Data Privacy
                Framework, Standard Contractual Clauses (SCCs), or other legally recognized transfer
                mechanisms.
              </p>
              <p className='mt-2'>
                By using the Platform, you acknowledge and consent to the transfer and processing of
                your personal data in the United States.
              </p>
            </div>

            {/* 12. Your Rights Under GDPR */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                12. Your Rights Under GDPR (EEA Residents)
              </h2>
              <p>
                If you are located in the European Economic Area, you have the following rights
                under the General Data Protection Regulation (GDPR):
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>
                  <strong>Right of Access</strong> (Art. 15) &mdash; Request a copy of the personal
                  data we hold about you.
                </li>
                <li>
                  <strong>Right to Rectification</strong> (Art. 16) &mdash; Request correction of
                  inaccurate personal data.
                </li>
                <li>
                  <strong>Right to Erasure</strong> (Art. 17) &mdash; Request deletion of your
                  personal data, subject to legal retention obligations and the limitations of the
                  NOSTR protocol.
                </li>
                <li>
                  <strong>Right to Restriction of Processing</strong> (Art. 18) &mdash; Request that
                  we limit processing of your personal data in certain circumstances.
                </li>
                <li>
                  <strong>Right to Data Portability</strong> (Art. 20) &mdash; Receive your personal
                  data in a structured, commonly used, machine-readable format.
                </li>
                <li>
                  <strong>Right to Object</strong> (Art. 21) &mdash; Object to processing of your
                  personal data based on legitimate interests.
                </li>
              </ul>
              <p className='mt-3'>
                <strong>Response Time:</strong> We will respond to all GDPR requests within thirty
                (30) days of receipt. If additional time is required due to the complexity of the
                request, we will notify you within the initial 30-day period.
              </p>
              <p className='mt-2'>
                <strong>Data Protection Contact:</strong> For all GDPR-related requests, contact{' '}
                <a
                  href='mailto:privacy@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  privacy@sovren.app
                </a>
                .
              </p>
              <p className='mt-2'>
                <strong>Right to Complain:</strong> You have the right to lodge a complaint with a
                supervisory authority in the EU/EEA member state of your habitual residence, place
                of work, or place of the alleged infringement.
              </p>
            </div>

            {/* 13. Your Rights Under CCPA */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                13. Your Rights Under CCPA/CPRA (California Residents)
              </h2>
              <p>
                If you are a California resident, the California Consumer Privacy Act (CCPA) and
                California Privacy Rights Act (CPRA) provide you with the following rights:
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>
                  <strong>Right to Know</strong> &mdash; Request disclosure of the categories and
                  specific pieces of personal information we have collected about you, the purposes
                  for collection, and the categories of third parties with whom we share it.
                </li>
                <li>
                  <strong>Right to Delete</strong> &mdash; Request deletion of personal information
                  we have collected, subject to certain exceptions (e.g., legal retention
                  obligations, fraud prevention).
                </li>
                <li>
                  <strong>Right to Correct</strong> &mdash; Request correction of inaccurate
                  personal information.
                </li>
                <li>
                  <strong>Right to Opt-Out of Sale or Sharing</strong> &mdash; You have the right to
                  opt out of the &quot;sale&quot; or &quot;sharing&quot; of your personal
                  information. <strong>We do not sell or share your personal information</strong> as
                  defined by the CCPA/CPRA.
                </li>
                <li>
                  <strong>Right to Non-Discrimination</strong> &mdash; We will not discriminate
                  against you for exercising any of your CCPA/CPRA rights.
                </li>
              </ul>
              <p className='mt-3'>
                <strong>Do Not Sell or Share My Personal Information:</strong> The Company does not
                sell or share personal information as defined by the CCPA/CPRA. We do not use
                personal information for targeted advertising. No opt-out mechanism is necessary
                because no sale or sharing occurs, but you may contact us at{' '}
                <a
                  href='mailto:privacy@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  privacy@sovren.app
                </a>{' '}
                with any concerns.
              </p>
              <p className='mt-2'>
                To exercise any CCPA/CPRA right, contact{' '}
                <a
                  href='mailto:privacy@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  privacy@sovren.app
                </a>
                . We will verify your identity before processing your request and respond within
                forty-five (45) days.
              </p>
            </div>

            {/* 14. Children's Privacy */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                14. Children&apos;s Privacy (COPPA)
              </h2>
              <p>
                The Platform does not knowingly collect, use, or disclose personal information from
                children under thirteen (13) years of age, in compliance with the Children&apos;s
                Online Privacy Protection Act (15 U.S.C. &sect; 6501 et seq.).
              </p>
              <p className='mt-2'>
                If we become aware that we have collected personal information from a child under
                13, we will immediately delete such information from our systems. If you believe a
                child under 13 has provided personal information to the Platform, please contact us
                at{' '}
                <a
                  href='mailto:privacy@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  privacy@sovren.app
                </a>
                .
              </p>
            </div>

            {/* 15. Changes to This Policy */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                15. Changes to This Privacy Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. For material changes, we will
                provide at least thirty (30) days&apos; prior notice by posting the updated policy
                on the Platform and updating the &quot;Last updated&quot; date. Your continued use
                of the Platform after the effective date of any changes constitutes your acceptance
                of the updated Privacy Policy.
              </p>
            </div>

            {/* 16. Contact */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>16. Contact</h2>
              <p>For all privacy-related inquiries, requests, or complaints:</p>
              <p className='mt-2 pl-4 border-l-2 border-purple-500/30'>
                Email:{' '}
                <a
                  href='mailto:privacy@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  privacy@sovren.app
                </a>
              </p>
              <p className='mt-4'>
                See also:{' '}
                <Link
                  to='/terms'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Terms of Service
                </Link>{' '}
                &middot;{' '}
                <Link
                  to='/content-policy'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Content Policy
                </Link>{' '}
                &middot;{' '}
                <Link
                  to='/help'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Help &amp; FAQ
                </Link>
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
};

export default Privacy;
