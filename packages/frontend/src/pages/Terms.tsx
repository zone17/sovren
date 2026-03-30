import React from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const Terms: React.FC = () => {
  useDocumentTitle('Terms of Service');

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
          <h1 className='text-3xl font-bold text-foreground font-display mb-2'>Terms of Service</h1>
          <p className='text-sm text-muted-foreground mb-8'>Last updated: March 2026</p>

          <section className='space-y-8 text-white/80 leading-relaxed'>
            {/* 1. Acceptance of Terms */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>1. Acceptance of Terms</h2>
              <p>
                By accessing or using the Sovren platform (&quot;Platform&quot;), operated by Sovren
                (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you
                (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) agree to be bound by these
                Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms in their
                entirety, you must not access or use the Platform.
              </p>
              <p className='mt-2'>
                These Terms constitute a legally binding agreement between you and the Company.
                Please read them carefully before using the Platform.
              </p>
            </div>

            {/* 2. Description of Service */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                2. Description of Service
              </h2>
              <p>
                Sovren is a decentralized creator monetization platform built on the NOSTR protocol
                and Bitcoin Lightning Network. The Platform enables creators to publish content,
                receive payments in Bitcoin, and maintain ownership of their audience relationships
                through cryptographic key pairs.
              </p>
              <p className='mt-2'>
                The Platform facilitates peer-to-peer transactions using the Bitcoin Lightning
                Network. The Company is not a financial institution, bank, money transmitter,
                custodian, or fiduciary. The Company does not hold, control, or have access to User
                funds at any time.
              </p>
            </div>

            {/* 3. Eligibility and Age Restrictions */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                3. Eligibility and Age Restrictions
              </h2>
              <p>
                <strong>Minimum Age for Browsing:</strong> You must be at least thirteen (13) years
                of age to access or use the Platform in any capacity. If you are under 13, you are
                prohibited from using the Platform.
              </p>
              <p className='mt-2'>
                <strong>Minimum Age for Payment Features:</strong> You must be at least eighteen
                (18) years of age to use any payment, tipping, subscription, or Lightning Network
                features of the Platform. By initiating or receiving any payment through the
                Platform, you represent and warrant that you are at least 18 years old.
              </p>
              <p className='mt-2'>
                <strong>COPPA Compliance:</strong> The Platform does not knowingly collect, use, or
                disclose personal information from children under thirteen (13) years of age, in
                compliance with the Children&apos;s Online Privacy Protection Act (15 U.S.C. &sect;
                6501 et seq.). If we become aware that we have collected personal information from a
                child under 13, we will promptly delete such information from our systems.
              </p>
              <p className='mt-2'>
                By using the Platform, you represent and warrant that you meet the applicable
                minimum age requirement for the features you access.
              </p>
            </div>

            {/* 4. User Accounts and Identity */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                4. User Accounts and Identity
              </h2>
              <p>
                Your identity on the Platform is managed through NOSTR cryptographic key pairs. You
                are solely responsible for maintaining the security of your private keys. The
                Company does not store your private keys and cannot recover them if lost.
              </p>
              <p className='mt-2'>
                You are responsible for all activity that occurs under your NOSTR identity. You
                agree to notify us immediately at{' '}
                <a
                  href='mailto:support@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  support@sovren.app
                </a>{' '}
                if you believe your account has been compromised.
              </p>
            </div>

            {/* 5. Content Ownership and Licensing */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                5. Content Ownership and Licensing
              </h2>
              <p>
                <strong>Ownership:</strong> You retain all ownership rights in and to the content
                you create and publish through the Platform (&quot;User Content&quot;). The Company
                does not claim ownership of any User Content.
              </p>
              <p className='mt-2'>
                <strong>License Grant:</strong> By publishing User Content on the Platform, you
                grant the Company a non-exclusive, royalty-free, worldwide license to host, store,
                display, reproduce, and distribute your User Content solely as necessary to operate
                the Platform and distribute content through NOSTR relays. This license includes the
                right to sublicense to third-party NOSTR relays to the extent necessary for
                protocol-level content distribution.
              </p>
              <p className='mt-2'>
                <strong>License Termination:</strong> The license granted above terminates when you
                delete your User Content from the Platform. However, you acknowledge and agree that,
                due to the decentralized nature of the NOSTR protocol, content that has been
                propagated to third-party relays may remain accessible on those relays and cannot be
                recalled or deleted by the Company.
              </p>
              <p className='mt-2'>
                <strong>Representations:</strong> You represent and warrant that you have all
                necessary rights and permissions to publish your User Content and to grant the
                license described above.
              </p>
            </div>

            {/* 6. Payments and Fees */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>6. Payments and Fees</h2>
              <p>
                <strong>Lightning Network Payments:</strong> All payments on the Platform are
                processed through the Bitcoin Lightning Network. Payments are peer-to-peer and
                settle directly between Users.
              </p>
              <p className='mt-2'>
                <strong>Platform Fees:</strong> The Company currently charges zero percent (0%)
                platform fees on creator earnings. This fee structure may change with thirty (30)
                days&apos; prior notice.
              </p>
              <p className='mt-2'>
                <strong>Network Fees:</strong> Standard Lightning Network routing fees apply to all
                transactions and are determined by the network, not the Company. These fees are
                typically minimal but are the sole responsibility of the User.
              </p>
              <p className='mt-2'>
                <strong>Finality:</strong> All Lightning Network payments are final and
                non-refundable due to the irreversible nature of Bitcoin transactions. Users
                acknowledge that the Company cannot reverse, cancel, or refund any payment once
                broadcast to the Lightning Network.
              </p>
              <p className='mt-2'>
                <strong>Non-Custodial:</strong> The Company is not a custodian and does not hold
                User funds at any time. Users are solely responsible for the security of their
                Lightning wallets and private keys.
              </p>
              <p className='mt-2'>
                <strong>Dispute Reporting:</strong> If you believe a payment was initiated
                fraudulently or in error, you may report the transaction to{' '}
                <a
                  href='mailto:support@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  support@sovren.app
                </a>
                . The Company will investigate and take appropriate action, which may include
                account suspension, but cannot guarantee recovery of funds due to the nature of
                Lightning Network transactions.
              </p>
              <p className='mt-2'>
                <strong>Tax Obligations:</strong> Bitcoin and Lightning Network payments are treated
                as property transactions by the IRS (Notice 2014-21). Each Lightning payment may
                constitute a taxable disposition of Bitcoin, potentially triggering capital gains or
                losses for US taxpayers. Users are solely responsible for tracking cost basis,
                reporting capital gains, and complying with all applicable tax laws. The Company may
                be required to issue IRS Form 1099-K for Users exceeding applicable reporting
                thresholds. The Company recommends that Users consult a qualified tax professional
                regarding their obligations.
              </p>
            </div>

            {/* 7. Prohibited Content and Conduct */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                7. Prohibited Content and Conduct
              </h2>
              <p>
                You agree not to use the Platform to create, upload, publish, distribute, or
                facilitate any of the following:
              </p>
              <ul className='list-disc pl-6 mt-3 space-y-2'>
                <li>
                  <strong>Child Sexual Abuse Material (CSAM):</strong> Any content that depicts,
                  promotes, or facilitates the sexual exploitation or abuse of minors. The Company
                  maintains a <strong>zero-tolerance policy</strong> for CSAM. All suspected CSAM
                  will be immediately reported to the National Center for Missing &amp; Exploited
                  Children (NCMEC) CyberTipline in accordance with 18 U.S.C. &sect; 2258A. Accounts
                  involved will be immediately terminated and referred to law enforcement. See also
                  18 U.S.C. &sect; 2252A.
                </li>
                <li>
                  <strong>Non-Consensual Intimate Imagery (NCII):</strong> Intimate or sexual images
                  or videos of any person distributed without their consent, commonly known as
                  &quot;revenge porn.&quot; See the SHIELD Act (NY) and applicable state laws.
                </li>
                <li>
                  <strong>Doxxing:</strong> Publishing or threatening to publish another
                  person&apos;s private, personally identifiable information (such as home address,
                  phone number, workplace, or financial information) without their consent.
                </li>
                <li>
                  <strong>Swatting:</strong> Making false reports to emergency services with the
                  intent of directing an armed response to another person&apos;s location.
                </li>
                <li>
                  <strong>Coordinated Inauthentic Behavior:</strong> Operating networks of fake
                  accounts, bot accounts, or sock puppet accounts for the purpose of manipulation,
                  deception, or artificial amplification.
                </li>
                <li>
                  <strong>Terrorism and Violent Extremism:</strong> Content that promotes, supports,
                  or incites terrorism, violent extremism, or acts of mass violence. This includes
                  recruitment materials, propaganda, and glorification of terrorist organizations or
                  acts.
                </li>
                <li>
                  <strong>Fraud and Scams:</strong> Content or conduct designed to defraud, deceive,
                  or scam other Users, including phishing, impersonation of the Platform, pyramid
                  schemes, and pump-and-dump schemes.
                </li>
                <li>
                  <strong>Malware and Security Exploits:</strong> Distribution of malware, viruses,
                  ransomware, spyware, or any code designed to compromise the security or
                  functionality of the Platform or Users&apos; devices.
                </li>
                <li>
                  <strong>Impersonation:</strong> Falsely representing yourself as another
                  individual, entity, or organization with the intent to deceive.
                </li>
                <li>
                  <strong>Harassment and Threats:</strong> Targeted harassment, bullying, threats of
                  violence, or intimidation directed at any individual or group.
                </li>
              </ul>
              <p className='mt-3'>
                Violation of this Section 7 may result in immediate content removal, account
                suspension, permanent account termination, and referral to law enforcement as
                appropriate. For the full content policy, including the appeal process, see our{' '}
                <Link
                  to='/content-policy'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Content Policy
                </Link>
                .
              </p>
            </div>

            {/* 8. DMCA and Copyright */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                8. Digital Millennium Copyright Act (DMCA)
              </h2>
              <p>
                The Company respects the intellectual property rights of others and expects Users to
                do the same. We respond to notices of alleged copyright infringement that comply
                with the Digital Millennium Copyright Act (17 U.S.C. &sect; 512).
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                8.1 Designated DMCA Agent
              </h3>
              <p>Our designated agent for receiving DMCA takedown notices is:</p>
              <p className='mt-2 pl-4 border-l-2 border-purple-500/30'>
                DMCA Agent, Sovren
                <br />
                Email:{' '}
                <a
                  href='mailto:dmca@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  dmca@sovren.app
                </a>
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                8.2 Takedown Notice Requirements
              </h3>
              <p>
                A valid DMCA takedown notice must include the following elements, as required by 17
                U.S.C. &sect; 512(c)(3):
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>
                  A physical or electronic signature of the copyright owner or authorized agent.
                </li>
                <li>Identification of the copyrighted work claimed to have been infringed.</li>
                <li>
                  Identification of the material to be removed, with sufficient information to
                  locate it on the Platform.
                </li>
                <li>
                  Contact information for the complaining party (address, phone number, email).
                </li>
                <li>
                  A statement that the complaining party has a good-faith belief that the use is not
                  authorized by the copyright owner, its agent, or the law.
                </li>
                <li>
                  A statement, under penalty of perjury, that the information in the notice is
                  accurate and that the complaining party is authorized to act on behalf of the
                  copyright owner.
                </li>
              </ul>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                8.3 Counter-Notification
              </h3>
              <p>
                If you believe your content was removed in error, you may submit a
                counter-notification to{' '}
                <a
                  href='mailto:dmca@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  dmca@sovren.app
                </a>{' '}
                containing:
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>Your physical or electronic signature.</li>
                <li>
                  Identification of the material that was removed and its prior location on the
                  Platform.
                </li>
                <li>
                  A statement under penalty of perjury that you have a good-faith belief that the
                  material was removed as a result of mistake or misidentification.
                </li>
                <li>
                  Your name, address, and telephone number, and a statement consenting to the
                  jurisdiction of the federal court in your district (or, if outside the US, the
                  District of Delaware).
                </li>
              </ul>
              <p className='mt-2'>
                Upon receipt of a valid counter-notification, we will forward it to the original
                complainant. If the complainant does not file a court action within ten (10) to
                fourteen (14) business days, we will restore the removed material.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                8.4 Repeat Infringer Policy
              </h3>
              <p>
                The Company will terminate, in appropriate circumstances, the accounts of Users who
                are repeat infringers of copyright. A User who receives three (3) valid DMCA
                takedown notices will have their account permanently terminated.
              </p>
            </div>

            {/* 9. Account Termination */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>9. Account Termination</h2>
              <p>
                <strong>Termination by the Company:</strong> The Company may suspend or terminate
                your access to the Platform at any time, with or without notice, for conduct that
                the Company believes violates these Terms, is harmful to other Users, or is
                otherwise objectionable. The Company may also terminate accounts for prolonged
                inactivity.
              </p>
              <p className='mt-2'>
                <strong>Termination by User:</strong> You may delete your account at any time by
                contacting{' '}
                <a
                  href='mailto:support@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  support@sovren.app
                </a>
                . Upon receipt of a deletion request, your account will enter a thirty (30) day
                grace period during which your data is retained but your account is deactivated.
                After the grace period, your data will be permanently deleted from our systems,
                subject to any legal retention obligations.
              </p>
              <p className='mt-2'>
                <strong>NOSTR Identity:</strong> Your NOSTR cryptographic keys remain your property
                at all times. The Company cannot revoke, invalidate, or seize your NOSTR keys.
                Account termination on the Platform does not affect your ability to use your NOSTR
                identity on other NOSTR-compatible applications.
              </p>
              <p className='mt-2'>
                <strong>Effect of Termination:</strong> Upon termination, the licenses granted by
                you under Section 5 will terminate with respect to content stored on the Platform,
                subject to the NOSTR propagation limitations described therein.
              </p>
            </div>

            {/* 10. Disclaimer of Warranties */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                10. Disclaimer of Warranties
              </h2>
              <p>
                THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT
                WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING
                BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
                PURPOSE, TITLE, AND NON-INFRINGEMENT. THE COMPANY DOES NOT WARRANT THAT THE PLATFORM
                WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY DEFECTS WILL BE CORRECTED.
              </p>
              <p className='mt-2'>
                THE COMPANY MAKES NO WARRANTIES REGARDING THE AVAILABILITY, RELIABILITY, OR
                PERFORMANCE OF THE NOSTR NETWORK, BITCOIN LIGHTNING NETWORK, OR ANY THIRD-PARTY
                RELAY OR SERVICE.
              </p>
            </div>

            {/* 11. Limitation of Liability */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                11. Limitation of Liability
              </h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE COMPANY,
                ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
                LIMITED TO LOSS OF PROFITS, DATA, GOODWILL, CRYPTOCURRENCY, OR OTHER INTANGIBLE
                LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE
                PLATFORM.
              </p>
              <p className='mt-2'>
                THE COMPANY&apos;S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR
                RELATING TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE GREATER OF
                (A) ONE HUNDRED US DOLLARS ($100) OR (B) THE TOTAL FEES PAID BY YOU TO THE COMPANY
                IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
              </p>
              <p className='mt-2'>
                <strong>Carve-Out:</strong> Nothing in this Section 11 shall limit or exclude
                liability for (a) gross negligence, (b) willful misconduct, (c) fraud, or (d) any
                liability that cannot be limited or excluded under applicable law.
              </p>
              <p className='mt-2'>
                SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF
                THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE EXCLUSIONS OR LIMITATIONS MAY NOT
                APPLY, AND YOU MAY HAVE ADDITIONAL RIGHTS.
              </p>
            </div>

            {/* 12. Indemnification */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>12. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless the Company and its officers,
                directors, employees, agents, and affiliates from and against any and all claims,
                liabilities, damages, losses, costs, and expenses (including reasonable
                attorneys&apos; fees) arising out of or in any way related to:
              </p>
              <ul className='list-disc pl-6 mt-2 space-y-1'>
                <li>
                  Your User Content or any content you publish, distribute, or transmit through the
                  Platform.
                </li>
                <li>Your use of the Platform, including any payments you initiate or receive.</li>
                <li>
                  Your violation of these Terms or any applicable law, regulation, or third-party
                  right.
                </li>
                <li>Any dispute between you and another User.</li>
              </ul>
            </div>

            {/* 13. Dispute Resolution */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>13. Dispute Resolution</h2>
              <p>
                <strong>Governing Law:</strong> These Terms and any disputes arising out of or
                related to them or the Platform shall be governed by and construed in accordance
                with the laws of the State of Delaware, United States, without regard to its
                conflict of laws principles.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                13.1 Informal Resolution
              </h3>
              <p>
                Before initiating any formal dispute resolution proceeding, you agree to first
                contact the Company at{' '}
                <a
                  href='mailto:legal@sovren.app'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  legal@sovren.app
                </a>{' '}
                and attempt to resolve the dispute informally for a period of at least thirty (30)
                days. Most disputes can be resolved through good-faith negotiation.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                13.2 Binding Arbitration
              </h3>
              <p>
                If the dispute cannot be resolved informally within thirty (30) days, any
                controversy or claim arising out of or relating to these Terms or the Platform shall
                be settled by binding arbitration administered by the American Arbitration
                Association (&quot;AAA&quot;) in accordance with its Commercial Arbitration Rules
                then in effect. The arbitration shall be conducted by a single arbitrator in
                Wilmington, Delaware, or at another mutually agreed location.
              </p>
              <p className='mt-2'>
                The arbitrator&apos;s decision shall be final and binding, and judgment upon the
                award may be entered in any court having jurisdiction thereof. Each party shall bear
                its own costs and attorneys&apos; fees, unless the arbitrator determines otherwise.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                13.3 Class Action Waiver
              </h3>
              <p>
                YOU AND THE COMPANY AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR
                OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED
                CLASS, COLLECTIVE, CONSOLIDATED, OR REPRESENTATIVE ACTION. THE ARBITRATOR MAY NOT
                CONSOLIDATE MORE THAN ONE PERSON&apos;S CLAIMS AND MAY NOT PRESIDE OVER ANY FORM OF
                CLASS OR REPRESENTATIVE PROCEEDING.
              </p>
              <h3 className='text-lg font-semibold text-foreground mt-4 mb-2'>
                13.4 Small Claims Court Exception
              </h3>
              <p>
                Notwithstanding the foregoing, either party may bring an individual action in small
                claims court for disputes within the jurisdiction of such court.
              </p>
            </div>

            {/* 14. Modifications to Terms */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>
                14. Modifications to Terms
              </h2>
              <p>
                The Company reserves the right to modify these Terms at any time. For material
                changes, we will provide at least thirty (30) days&apos; prior notice by posting the
                updated Terms on the Platform and updating the &quot;Last updated&quot; date. Your
                continued use of the Platform after the effective date of any modifications
                constitutes your acceptance of the updated Terms.
              </p>
              <p className='mt-2'>
                If you do not agree with the modified Terms, you must discontinue use of the
                Platform before the effective date of the changes.
              </p>
            </div>

            {/* 15. General Provisions */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>15. General Provisions</h2>
              <p>
                <strong>Severability:</strong> If any provision of these Terms is held to be
                invalid, illegal, or unenforceable by a court of competent jurisdiction, the
                remaining provisions shall remain in full force and effect. The invalid provision
                shall be modified to the minimum extent necessary to make it valid and enforceable.
              </p>
              <p className='mt-2'>
                <strong>Entire Agreement:</strong> These Terms, together with the{' '}
                <Link
                  to='/privacy'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link
                  to='/content-policy'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Content Policy
                </Link>
                , constitute the entire agreement between you and the Company regarding the Platform
                and supersede all prior and contemporaneous agreements, proposals, or
                representations, whether written or oral.
              </p>
              <p className='mt-2'>
                <strong>No Waiver:</strong> The failure of the Company to enforce any right or
                provision of these Terms shall not constitute a waiver of such right or provision. A
                waiver of any default shall not constitute a waiver of any subsequent default.
              </p>
              <p className='mt-2'>
                <strong>Assignment:</strong> You may not assign or transfer these Terms or your
                rights hereunder without the prior written consent of the Company. The Company may
                assign these Terms without restriction.
              </p>
            </div>

            {/* 16. Contact */}
            <div>
              <h2 className='text-xl font-semibold text-foreground mb-3'>16. Contact</h2>
              <p>For questions about these Terms, please contact us:</p>
              <ul className='list-none mt-2 space-y-1'>
                <li>
                  General inquiries:{' '}
                  <a
                    href='mailto:support@sovren.app'
                    className='text-purple-400 hover:text-purple-300 transition-colors'
                  >
                    support@sovren.app
                  </a>
                </li>
                <li>
                  Legal matters:{' '}
                  <a
                    href='mailto:legal@sovren.app'
                    className='text-purple-400 hover:text-purple-300 transition-colors'
                  >
                    legal@sovren.app
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
                  Content reports:{' '}
                  <a
                    href='mailto:abuse@sovren.app'
                    className='text-purple-400 hover:text-purple-300 transition-colors'
                  >
                    abuse@sovren.app
                  </a>
                </li>
              </ul>
              <p className='mt-4'>
                See also:{' '}
                <Link
                  to='/privacy'
                  className='text-purple-400 hover:text-purple-300 transition-colors'
                >
                  Privacy Policy
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

export default Terms;
