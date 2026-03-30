import React from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const ContentPolicy: React.FC = () => {
  useDocumentTitle('Content Policy');

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
          <h1 className='text-3xl font-bold text-foreground font-display mb-2'>Content Policy</h1>
          <p className='text-sm text-muted-foreground mb-8'>Last updated: March 2026</p>

          <section className='space-y-8 text-white/80 leading-relaxed'>
            {/* 1. Overview */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>1. Overview</h2>
              <p>
                This Content Policy describes what content is prohibited on the Sovren platform
                (&quot;Platform&quot;), how we enforce these rules, and how you can report
                violations or appeal enforcement actions. This policy supplements the{' '}
                <Link
                  to='/terms'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Terms of Service
                </Link>{' '}
                and applies to all content published, uploaded, or distributed through the Platform.
              </p>
              <p className='mt-2'>
                While the NOSTR protocol is censorship-resistant by design, the Platform maintains
                and enforces content standards on relays and infrastructure operated by Sovren.
                Content that violates this policy will be removed from Sovren-operated relays and
                may result in account termination.
              </p>
            </div>

            {/* 2. Zero-Tolerance: CSAM */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                2. Zero-Tolerance Policy: Child Sexual Abuse Material (CSAM)
              </h2>
              <p>
                The Platform maintains an <strong>absolute zero-tolerance policy</strong> for child
                sexual abuse material (CSAM) in any form, including but not limited to images,
                videos, text, illustrations, or AI-generated content that depicts, promotes, or
                facilitates the sexual exploitation or abuse of minors.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                2.1 Mandatory Reporting
              </h3>
              <p>
                In accordance with 18 U.S.C. &sect; 2258A, the Company is legally obligated to
                report all known or suspected CSAM to the National Center for Missing &amp;
                Exploited Children (NCMEC) CyberTipline. The Company fulfills this obligation
                without exception.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>2.2 Enforcement</h3>
              <p>Upon detection or report of suspected CSAM:</p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>
                  The content is immediately removed from all Sovren-operated relays and systems.
                </li>
                <li>The account is immediately and permanently terminated.</li>
                <li>A report is filed with the NCMEC CyberTipline.</li>
                <li>All relevant information is preserved and referred to law enforcement.</li>
                <li>No appeal is available for CSAM-related terminations.</li>
              </ul>
            </div>

            {/* 3. Prohibited Content */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>3. Prohibited Content</h2>
              <p>
                The following content is prohibited on the Platform. This list aligns with and
                supplements Section 7 of the{' '}
                <Link
                  to='/terms'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Terms of Service
                </Link>
                .
              </p>
              <ul className='list-disc pl-6 mt-3 space-y-2'>
                <li>
                  <strong>Child Sexual Abuse Material (CSAM)</strong> &mdash; Any content depicting
                  the sexual exploitation or abuse of minors. See Section 2 above. (18 U.S.C. &sect;
                  2252A)
                </li>
                <li>
                  <strong>Non-Consensual Intimate Imagery (NCII)</strong> &mdash; Intimate or sexual
                  images or videos distributed without the consent of the person depicted, including
                  &quot;revenge porn&quot; and AI-generated deepfakes of real persons. (SHIELD Act,
                  applicable state laws)
                </li>
                <li>
                  <strong>Doxxing</strong> &mdash; Publishing or threatening to publish another
                  person&apos;s private, personally identifiable information without their consent,
                  with the intent to harass, threaten, or endanger.
                </li>
                <li>
                  <strong>Swatting</strong> &mdash; Making false reports to emergency services with
                  the intent of directing an armed law enforcement response to another person&apos;s
                  location.
                </li>
                <li>
                  <strong>Coordinated Inauthentic Behavior</strong> &mdash; Operating networks of
                  fake, bot, or sock puppet accounts for manipulation, deception, or artificial
                  amplification.
                </li>
                <li>
                  <strong>Terrorism and Violent Extremism</strong> &mdash; Content that promotes,
                  supports, recruits for, or incites terrorism, violent extremism, or acts of mass
                  violence. Includes propaganda and glorification of terrorist organizations or
                  acts.
                </li>
                <li>
                  <strong>Fraud and Scams</strong> &mdash; Content or conduct designed to defraud or
                  deceive other Users, including phishing, impersonation of the Platform, pyramid
                  schemes, and pump-and-dump schemes.
                </li>
                <li>
                  <strong>Malware and Security Exploits</strong> &mdash; Distribution of malware,
                  viruses, ransomware, spyware, or code designed to compromise Platform security or
                  User devices.
                </li>
                <li>
                  <strong>Impersonation</strong> &mdash; Falsely representing yourself as another
                  individual, entity, or organization with the intent to deceive.
                </li>
                <li>
                  <strong>Harassment and Threats</strong> &mdash; Targeted harassment, bullying,
                  threats of violence, or intimidation directed at any individual or group.
                </li>
              </ul>
            </div>

            {/* 4. Enforcement Actions */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>4. Enforcement Actions</h2>
              <p>
                When a violation is confirmed, the Company may take one or more of the following
                actions, depending on the severity and nature of the violation:
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-2'>
                <li>
                  <strong>Content Removal:</strong> Removal of the violating content from
                  Sovren-operated relays and systems.
                </li>
                <li>
                  <strong>Warning:</strong> A formal warning notifying the User of the violation and
                  the applicable policy.
                </li>
                <li>
                  <strong>Temporary Suspension:</strong> Temporary suspension of the User&apos;s
                  account for a defined period (typically 7-30 days).
                </li>
                <li>
                  <strong>Permanent Termination:</strong> Permanent termination of the User&apos;s
                  account. This action is immediate and irreversible for CSAM violations.
                </li>
                <li>
                  <strong>Law Enforcement Referral:</strong> Referral of the matter to appropriate
                  law enforcement authorities where required by law or in the Company&apos;s
                  discretion.
                </li>
              </ul>
              <p className='mt-2'>
                The Company reserves the right to escalate enforcement actions for repeat offenders.
                Multiple violations will result in increasingly severe consequences.
              </p>
            </div>

            {/* 5. Reporting Content Violations */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                5. Reporting Content Violations
              </h2>
              <p>
                If you encounter content that you believe violates this Content Policy, please
                report it using one of the following methods:
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-2'>
                <li>
                  <strong>Email:</strong> Send a report to{' '}
                  <a
                    href='mailto:abuse@sovren.app'
                    className='text-purple-400 hover:text-purple-300 transition-colors'
                  >
                    abuse@sovren.app
                  </a>{' '}
                  with a description of the violation, a link to the content, and any supporting
                  information.
                </li>
                <li>
                  <strong>In-App Reporting:</strong> Use the &quot;Report&quot; function available
                  on content items within the Platform.
                </li>
              </ul>
              <p className='mt-2'>
                We review all reports and aim to respond within forty-eight (48) hours for standard
                reports and immediately for reports of CSAM or imminent threats to safety.
              </p>
            </div>

            {/* 6. DMCA Takedown and Counter-Notice */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                6. DMCA Takedown and Counter-Notice Procedure
              </h2>
              <p>
                For copyright infringement claims, the Platform follows the procedures set forth in
                the Digital Millennium Copyright Act (17 U.S.C. &sect; 512). For complete details,
                see Section 8 of the{' '}
                <Link
                  to='/terms'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Terms of Service
                </Link>
                .
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                6.1 Filing a Takedown Notice
              </h3>
              <p>
                Send DMCA takedown notices to our designated agent at{' '}
                <a
                  href='mailto:dmca@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  dmca@sovren.app
                </a>
                . Your notice must include all elements required by 17 U.S.C. &sect; 512(c)(3), as
                detailed in our Terms of Service.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                6.2 Counter-Notice
              </h3>
              <p>
                If you believe your content was removed in error, you may submit a
                counter-notification to{' '}
                <a
                  href='mailto:dmca@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  dmca@sovren.app
                </a>
                . Valid counter-notices must include all elements specified in 17 U.S.C. &sect;
                512(g). Content will be restored within ten (10) to fourteen (14) business days
                unless the original complainant files a court action.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                6.3 Repeat Infringer Policy
              </h3>
              <p>
                The Company will permanently terminate the accounts of Users who are repeat
                infringers of copyright. An account that receives three (3) valid DMCA takedown
                notices will be permanently terminated.
              </p>
            </div>

            {/* 7. Appeal Process */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>7. Appeal Process</h2>
              <p>
                If you believe an enforcement action was taken in error (other than CSAM-related
                terminations, which are not subject to appeal), you may submit an appeal:
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>
                  <strong>How to appeal:</strong> Email{' '}
                  <a
                    href='mailto:appeals@sovren.app'
                    className='text-purple-400 hover:text-purple-300 transition-colors'
                  >
                    appeals@sovren.app
                  </a>{' '}
                  with your NOSTR public key (npub), a description of the enforcement action, and
                  your explanation of why you believe it was made in error.
                </li>
                <li>
                  <strong>Response time:</strong> We will acknowledge receipt of your appeal within
                  five (5) business days and provide a final decision within fifteen (15) business
                  days.
                </li>
                <li>
                  <strong>Review process:</strong> Appeals are reviewed by a member of the team who
                  was not involved in the original enforcement decision.
                </li>
                <li>
                  <strong>Final decision:</strong> The appeal decision is final. If the enforcement
                  action is reversed, your content and/or account will be restored.
                </li>
              </ul>
            </div>

            {/* 8. Transparency */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>8. Transparency</h2>
              <p>
                The Company is committed to transparency in content moderation. We intend to publish
                periodic transparency reports detailing the volume and categories of content reports
                received, enforcement actions taken, and appeals resolved.
              </p>
            </div>

            {/* 9. Contact */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>9. Contact</h2>
              <p>For content-related inquiries:</p>
              <ul className='list-none mt-2 space-y-1'>
                <li>
                  Content reports:{' '}
                  <a
                    href='mailto:abuse@sovren.app'
                    className='text-purple-400 hover:text-purple-300 transition-colors'
                  >
                    abuse@sovren.app
                  </a>
                </li>
                <li>
                  DMCA notices:{' '}
                  <a
                    href='mailto:dmca@sovren.app'
                    className='text-purple-400 hover:text-purple-300 transition-colors'
                  >
                    dmca@sovren.app
                  </a>
                </li>
                <li>
                  Appeals:{' '}
                  <a
                    href='mailto:appeals@sovren.app'
                    className='text-purple-400 hover:text-purple-300 transition-colors'
                  >
                    appeals@sovren.app
                  </a>
                </li>
              </ul>
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
                  to='/privacy'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Privacy Policy
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

export default ContentPolicy;
