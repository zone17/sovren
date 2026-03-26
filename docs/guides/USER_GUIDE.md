# Sovren User Guide

**Welcome to Sovren** — the creator monetization platform where you own everything: your identity, your audience, and your revenue. No algorithms cutting your reach. No platforms taking a 30% fee. No risk of losing your account overnight.

This guide covers everything you need to know to get started and make the most of Sovren, whether you are a creator building a sustainable income or a supporter discovering and funding the work you love.

---

## Table of Contents

1. [What is Sovren?](#1-what-is-sovren)
2. [Quick Start Guide](#2-quick-start-guide)
   - [For Creators](#for-creators)
   - [For Supporters](#for-supporters)
3. [Features Guide](#3-features-guide)
   - [Content Creation](#content-creation)
   - [Monetization](#monetization)
   - [Creator Tools](#creator-tools)
   - [Community Features](#community-features)
   - [Multi-Platform Distribution](#multi-platform-distribution)
   - [Discovery](#discovery)
   - [Account and Settings](#account-and-settings)
4. [NOSTR Basics for New Users](#4-nostr-basics-for-new-users)
5. [Lightning Payments Basics](#5-lightning-payments-basics)
6. [FAQ](#6-faq)

---

## 1. What is Sovren?

Sovren is a creator monetization platform built on two open protocols: **NOSTR** for identity and content, and the **Bitcoin Lightning Network** for payments.

Most creator platforms work like landlords. They let you build an audience on their property, then they can change the rules, cut your reach, demonetize you, or ban your account at any time. Your followers, your content history, and your income stream are all tied to a platform you do not control.

Sovren is different. Here is how:

**You own your identity.** Your Sovren account is based on a cryptographic key pair, not a username and password registered with a company. Your identity exists on an open protocol (NOSTR) and goes with you everywhere. No one can take it away.

**You own your audience.** Your followers follow your public key on the NOSTR network. If Sovren disappeared tomorrow, you could still reach your audience through any other NOSTR-compatible application.

**You own your revenue stream.** Payments are made directly from supporters to creators over the Bitcoin Lightning Network. There is no centralized payment processor that can freeze your funds or reverse transactions. Payouts are instant.

**No intermediaries.** Sovren does not sit between you and your supporters charging rent. The platform provides the tools; you keep what you earn.

### Who is Sovren for?

- **Creators** in any niche: writers, musicians, podcasters, artists, photographers, developers, educators, and anyone producing valuable content
- **Supporters** who want to fund creators they believe in and get access to exclusive content and communities
- **Independent professionals** who want to manage contracts, invoices, and business finances alongside their creative work

---

## 2. Quick Start Guide

### For Creators

Getting from zero to earning on Sovren takes about 10 minutes.

**Step 1: Create your account**

Go to the Sovren home page and click **Sign Up**. You have two options:

- **Use a browser extension (recommended):** If you already have Alby or nos2x installed, Sovren can read your NOSTR public key automatically. Click "Connect with Extension" and approve the connection.
- **Generate new keys:** Sovren will generate a fresh NOSTR key pair for you. This is the easiest path if you are new to NOSTR.

**Step 2: Complete the onboarding flow**

The onboarding wizard walks you through four stages:

1. **Choose your path** — select Creator or Supporter. This sets up the right features for you.
2. **Create your NOSTR identity** — generate or import your cryptographic key pair. Your public key is your permanent identity on the network.
3. **Secure your keys** — write down or download your private key (nsec). This is the only way to recover your account if you lose access. Sovren will ask you to confirm you have backed it up before continuing.
4. **Set up a Lightning wallet** — connect a wallet to receive payments. See the recommended wallets below.

**Step 3: Set up your profile**

After onboarding, go to your profile. Fill in:
- Display name
- Username (this becomes your public handle)
- Bio (tell supporters what you create)
- Avatar image

**Step 4: Create your first content**

Click **Create** in the navigation or go to `/create`. Give your piece a title, write your content, add tags, and choose whether it is free or paid (priced in satoshis). Hit Publish.

**Step 5: Set up subscription tiers**

Go to **Dashboard > Subscriptions** to create subscription plans. Give each tier a name, set a monthly price in satoshis, and list the benefits. Common examples:
- Free tier — public posts and updates
- Supporter tier — early access and exclusive posts
- Premium tier — full content library, direct messages, and community access

**Step 6: Share your content**

Your profile page is public at `/creator/[your-username]`. Share this link on social media, in your bio, anywhere. Anyone can discover you and subscribe.

---

### For Supporters

**Step 1: Create your account**

Go to the Sovren home page and click **Sign Up**. Choose **Supporter** when asked to select your path. The onboarding flow will set up your NOSTR identity and connect a Lightning wallet for making payments.

**Step 2: Discover creators**

Go to **Discover** (`/discover`). Browse creators by category — Art, Writing, Music, Podcast, Education, Photography, Development, or Bitcoin — or search by name, topic, or tag. Each creator card shows their bio, follower count, and content count.

**Step 3: Visit a creator's profile**

Click any creator card to visit their full profile. You will see:
- Their published posts and articles
- Available subscription tiers and prices
- A Lightning address for direct tips

**Step 4: Tip a creator**

On a creator's profile or on any individual piece of content, click the tip button (the lightning bolt icon). Enter the amount in satoshis and confirm in your Lightning wallet. The payment goes directly to the creator with no platform cut.

**Step 5: Subscribe to a tier**

On a creator's profile, scroll to the subscription tiers section. Click **Subscribe** on the tier that suits you. The Lightning invoice is generated automatically — approve it in your wallet. Your subscription is active immediately.

**Step 6: Engage with content**

Leave comments on posts, react to content, and participate in Creator Circles (private community groups) if your tier includes access. Go to the full content view at `/content/[id]` to see comment threads.

---

## 3. Features Guide

### Content Creation

**Creating posts and articles**

Navigate to `/create` to open the content editor. Sovren supports several content types:

- **Article** — long-form written content with rich formatting
- **Post** — shorter updates, similar to a blog post
- **Image** — photo or graphic with a caption
- **Video** — video content with a title and description
- **Audio** — podcast episodes, music, or spoken word

Fill in the title, description, and tags. Tags help supporters find your content through search and discovery.

**Content status**

Each piece of content has a status:

- **Draft** — saved but not visible to anyone
- **Published** — live and visible to your audience
- **Scheduled** — set a future publish date and time
- **Archived** — hidden from public view but preserved

**Premium and paywalled content**

When creating or editing content, toggle the monetization switch and set a price in satoshis. Supporters must pay the one-time price or have an active subscription tier that includes access to this content.

**Managing your content**

Your Creator Dashboard at `/dashboard` lists all your content with status badges, view counts, like counts, and earnings. Click any item to view or edit it. Hover over an item to reveal quick actions including delete.

---

### Monetization

**Lightning tips**

Any visitor to your profile or content can send you a one-time tip via Lightning. Tips are instant, irreversible, and go directly to your wallet. There is no minimum tip amount beyond what your wallet supports (typically 1 satoshi).

**Subscription tiers**

Go to **Dashboard > Subscriptions** (`/dashboard/subscriptions`) to manage your subscription plans. The Subscription Manager lets you:

- Create new tiers with a name, description, and monthly price
- List the features and benefits of each tier
- Activate or deactivate tiers
- View current subscribers per tier

Each tier generates Lightning invoices automatically when supporters subscribe. Recurring billing is handled through the Lightning Network.

**Revenue analytics**

Go to **Dashboard > Revenue** (`/dashboard/revenue`) to see your financial metrics:

- Total revenue (in satoshis)
- Monthly recurring revenue (MRR)
- Total subscriber count
- Average payment size
- Churn rate
- Average subscriber lifetime value
- Revenue broken down by tier
- Day-by-day revenue chart with a 7-day, 30-day, or 90-day view

**Invoice management**

The **Business Manager** (`/business`) includes a full invoice system for freelance and professional work:

- Create professional invoices from templates
- Track invoice status (draft, sent, paid, overdue)
- Store a library of contract templates
- Edit and customize contracts for individual clients

**Tax reporting and export**

Under **Business Manager > Tax**, you can view a tax summary of your earnings and use the Expense Tracker to log deductible expenses. Export data for use with your accountant or tax software.

---

### Creator Tools

**Creator Dashboard**

Your main hub at `/dashboard`. At a glance you see:

- Number of published pieces
- Total views and likes across all content
- Total earnings in satoshis
- NOSTR identity connection status

Below the stats panel, a full list of your content items shows each piece with its type icon, status badge, creation date, views, likes, and price.

**Analytics Dashboard**

Go to **Dashboard > Analytics** (`/dashboard/analytics`) for deeper metrics on your content performance, audience growth, and engagement trends.

**Business Manager**

The Business Manager at `/business` is a creator-only tool with four sections:

- **Revenue** — Revenue mix breakdown and diversification goals. See what percentage of your income comes from tips, subscriptions, and one-time purchases.
- **Contracts** — A library of contract templates for collaborations, commissioned work, and service agreements. Edit templates for specific clients.
- **Invoices** — Create, send, and track professional invoices.
- **Tax** — Tax summary and expense tracker for year-end reporting.

**Content Shield**

The Content Shield at `/shield` protects your intellectual property with:

- **Cryptographic provenance** — every piece of content is fingerprinted at the time of creation, establishing proof of authorship tied to your NOSTR public key
- **Fingerprint coverage** — see what percentage of your content catalog has provenance coverage
- **Copy detection alerts** — the Alerts Feed notifies you when copies or unauthorized reposts of your content are detected across the network
- **DMCA tools** — generate DMCA takedown notices and track their status
- **Authenticity badges** — display a verified authenticity badge on your content to signal to supporters that it is the original

**Wellness Dashboard**

The Wellness Dashboard at `/wellness` helps creators avoid burnout and maintain sustainable work habits:

- **Burnout Risk Gauge** — tracks work intensity signals and gives you a risk score
- **Work Pattern Heatmap** — visualizes when you work across the week, helping you spot unhealthy patterns
- **Rest Day Tracker** — logs your days off to make sure you are getting adequate recovery time
- **Sustainable Scheduler** — helps you plan your content calendar at a pace you can maintain
- **Wellness Trend** — shows your wellness score over time
- **Boundary Settings** — set your availability hours and rest day preferences so the platform can give you appropriate reminders
- **Pulse Check-In** — a quick daily mood and energy check-in to track your wellbeing over time
- **Wellness Resources** — curated resources on creator mental health, sustainable productivity, and burnout recovery

---

### Community Features

**Creator Circles**

Creator Circles are private community groups. Find them under **Community > Circles** (`/community`). As a creator, you can create a Circle and restrict membership to subscribers on specific tiers. As a supporter, you can browse and join Circles you have access to through your active subscriptions.

Inside a Circle, members can post updates, have discussions, and share resources in a private feed.

**Mentorship**

The Mentorship section under **Community > Mentorship** connects experienced creators with those who are just starting out.

- **Find a mentor** — browse the Mentor Directory, which lists creators who have opened mentorship slots. Filter by niche or experience level.
- **Become a mentor** — open mentorship slots on your profile and set session terms through the Mentorship Dashboard.

**Marketplace**

**Community > Marketplace** is where creators list and discover services and collaboration opportunities. You can:

- List a service you offer (design work, editing, promotion, technical help)
- Browse services from other creators
- Commission work and track order status through the Order Tracker

**Collaborations and Revenue Splits**

Under **Community > Collaborations**, you can manage co-created content. Select a piece of content and use the Revenue Split Editor to define how earnings are divided among collaborators. Escrow status is tracked to ensure all parties are paid correctly.

**Comments and Reactions**

Every piece of content has a public comment section, visible at `/content/[id]`. Comments are broadcast to NOSTR relays, making them part of the decentralized record. Supporters can also react to content with quick responses.

---

### Multi-Platform Distribution

Sovren includes tools to manage your presence across multiple social platforms from one place.

**Platform Connector**

Connect your accounts from other platforms (Twitter/X, Mastodon, and others) through the Multi-Platform Dashboard. You control which platforms receive your content.

**Cross-posting**

When publishing content on Sovren, you can choose to distribute it to your connected platforms simultaneously. The Distribution Panel lets you customize the format for each platform before posting.

**Content Repurposing**

The Repurpose Preview tool shows you how a piece of content will look when adapted for different platforms, so you can make adjustments before publishing.

**Template Manager**

Save reusable templates for cross-platform posts. Useful if you have a consistent format for your weekly roundup, announcements, or promotional posts.

**Unified Inbox**

The Unified Inbox aggregates messages and replies from all your connected platforms into a single feed. Reply to comments from any platform without switching apps. Use the Inbox Filter Bar to sort by platform, message type, or date.

**Cross-Platform Analytics**

The Cross-Platform Analytics section shows you audience size, engagement, and growth across all connected platforms side by side. The Platform Comparison tool ranks your platforms by reach and engagement so you know where to focus your energy. Platform ROI tracks the return on effort for each platform.

**Audience Overlap**

The Audience Overlap tool shows how much your audiences on different platforms overlap. This helps you understand whether you are reaching new people or mostly duplicating reach.

---

### Discovery

**Browse and search**

The Discover page at `/discover` is publicly accessible — anyone can browse it without an account.

Search for creators by name, topic, or tag using the search bar. Filter by category:

- Art
- Writing
- Music
- Podcast
- Education
- Photography
- Development
- Bitcoin

Sort results by relevance, follower count, or newest.

**Creator profiles**

Each creator has a public profile page at `/creator/[username]`. The profile shows their bio, content, subscription tiers, and Lightning address. NIP-05 verified creators display a verification badge.

**Personalized recommendations**

As you interact with creators and content, Sovren surfaces recommendations tailored to your interests.

---

### Account and Settings

**Profile management**

Go to `/profile` to edit your display name, username, bio, and avatar. You can also update your NOSTR public key connection and Lightning address here.

**Profile Dashboard**

After completing onboarding, your Profile Dashboard at `/profile-dashboard` gives you an overview of your setup status: NOSTR identity, Lightning wallet, and profile completeness.

**Privacy settings**

Control who can see your content, who can send you messages, and what information appears on your public profile.

**Notification preferences**

Manage which events trigger notifications (new subscribers, tips received, comments, Circle activity, Shield alerts, and Wellness reminders).

**Data export (GDPR)**

You have the right to export all of your data from Sovren at any time. Go to account settings and request a full data export. You will receive a downloadable archive of your content, subscriber data, and payment history.

**Account deletion**

You can delete your Sovren account at any time from account settings. Note: because your identity and content exist on the NOSTR protocol, content that has already been broadcast to NOSTR relays may persist on the decentralized network even after your Sovren account is deleted.

---

## 4. NOSTR Basics for New Users

NOSTR stands for **Notes and Other Stuff Transmitted by Relays**. It is an open protocol, meaning anyone can build applications on top of it and anyone can participate without asking permission from a central authority.

### How NOSTR identity works

Traditional social media platforms store your account in their database. If the platform bans you or shuts down, your account and followers are gone.

NOSTR works differently. Your identity is defined by a **key pair**:

- **Public key (npub):** This is your public identifier. It looks like `npub1abc123...`. Anyone can see it. Think of it like your username across every NOSTR application.
- **Private key (nsec):** This is your secret. It looks like `nsec1xyz789...`. It proves you are the owner of your public key. Never share it with anyone.

When you create a post or update your profile on NOSTR, you sign the action with your private key. Anyone can verify that the action came from you by checking the signature against your public key. This works without trusting any company.

### Relays

Relays are servers that store and distribute NOSTR events (posts, profile updates, and so on). When you publish content on Sovren, it is broadcast to multiple relays for redundancy. If one relay goes offline, your content is still available on the others.

### NIP-05 verification

NIP-05 is a standard that lets you link your NOSTR public key to a human-readable identifier like `yourname@yourdomain.com`. This makes it easier for others to find you and verifies that you control both the NOSTR key and the domain. Verified creators display a badge on their profile.

### Browser extensions for key management

Rather than typing your private key into every application, you can use a browser extension that stores your key securely and signs requests on your behalf:

- **Alby** (getalby.com) — combines NOSTR key management with a built-in Lightning wallet. Recommended for web creators.
- **nos2x** — a lightweight NOSTR signing extension with no built-in wallet.

With an extension installed, you can log in to Sovren and any other NOSTR application by simply approving a signature request — no password required.

### Keeping your keys safe

Your private key is the only way to prove you own your identity. There is no "forgot my password" option and no company that can reset it for you.

- Write down your nsec (private key) on paper and store it somewhere safe, like a fire-resistant document safe
- Alternatively, store it in a password manager
- Download the key backup file during onboarding and store it in a secure location
- Never paste your private key into any website, chat, or email
- Never share your nsec with anyone claiming to be from Sovren support

---

## 5. Lightning Payments Basics

The Bitcoin Lightning Network is a payment protocol built on top of Bitcoin. It enables instant, near-zero-fee payments without waiting for blockchain confirmations.

### Why Lightning?

Traditional payment processors like Stripe or PayPal take 2.9% plus fees, have chargeback risk, can freeze accounts, and take days to settle. The Lightning Network settles payments in seconds, fees are fractions of a cent, there are no chargebacks, and no company can freeze your funds.

On Sovren, all creator payments — tips, subscriptions, and content purchases — flow through the Lightning Network.

### Setting up a Lightning wallet

You need a Lightning wallet before you can send or receive payments on Sovren. The onboarding wizard presents these options:

**Wallet of Satoshi** (Beginner, ~30 seconds to set up)
A custodial mobile wallet. The company holds your bitcoin on your behalf. Zero friction to get started. Good choice if you just want to try the platform quickly.
Download: walletofsatoshi.com

**Alby** (Beginner, ~2 minutes to set up)
A browser extension that doubles as a Lightning wallet and NOSTR key manager. Great for web creators since it works directly in the browser. Recommended if you plan to use NOSTR regularly.
Download: getalby.com

**Phoenix** (Intermediate, ~5 minutes to set up)
A self-custodial mobile wallet. You hold your own keys and it manages Lightning channels automatically. Better for creators receiving significant income who want full control.
Download: phoenix.acinq.co

**Strike** (Beginner, ~3 minutes to set up)
A custodial app with fiat on/off ramps. Requires identity verification (KYC). Good if you need to convert bitcoin earnings to your local currency easily.
Download: strike.me

### Receiving your first payment

Once your wallet is set up and connected to Sovren, supporters can pay you immediately. Payments arrive in your wallet in seconds. You will see a notification when a tip or subscription payment comes in.

For subscriptions, Sovren generates a Lightning invoice automatically each billing period. Supporters approve the invoice in their wallet to renew.

### Understanding invoices (BOLT11)

BOLT11 is the standard format for Lightning invoices. An invoice looks like a long string starting with `lnbc...`. It encodes the amount, a description, and an expiry time. Invoices are single-use — once paid, they cannot be paid again.

When you receive a tip or sell content, Sovren creates a BOLT11 invoice tied to your Lightning address. The supporter scans or pastes the invoice into their wallet and approves the payment.

### Satoshis and bitcoin units

Lightning amounts are usually expressed in **satoshis** (sats). One bitcoin equals 100 million satoshis. At typical bitcoin prices, one satoshi is worth a tiny fraction of a cent. For creator economy purposes, common amounts are:

- Small tip: 100–1,000 sats
- Medium tip: 1,000–10,000 sats
- Monthly subscription: 10,000–100,000 sats depending on tier

### Transaction history

Your Lightning wallet app keeps a record of all your transactions. Sovren also displays your earnings in the Revenue Analytics dashboard, where you can see totals, trends, and breakdowns by tier.

---

## 6. FAQ

### Account and Identity

**Can I use my existing NOSTR keys from another app?**
Yes. During onboarding, choose "Connect with Extension" if you have Alby or nos2x, or choose "Import Keys" and enter your existing nsec. Your entire Sovren profile and content will be tied to your existing public key.

**What happens to my account if Sovren shuts down?**
Your NOSTR identity and the content you have published to relays will persist on the decentralized network. Your subscribers follow your public key, not a Sovren-specific account. You can continue to reach them through other NOSTR applications. Your Lightning wallet is fully portable regardless.

**I lost my private key. Can Sovren recover my account?**
No. The nature of cryptographic key-based identity means there is no central authority that can reset your key. This is why securing your nsec during onboarding is so important. If you lose your private key and have no backup, you would need to create a new identity.

**Can I have both a creator and supporter account?**
Your NOSTR key is your identity. You can act as both a creator and a supporter with the same account. You can publish your own content and also subscribe to other creators.

### NOSTR and Keys

**What is the difference between npub and nsec?**
Your npub (public key) is your public identifier — share it freely so others can find you. Your nsec (private key) is your secret — it proves account ownership. Never share your nsec.

**What is NIP-05 and do I need it?**
NIP-05 links your NOSTR public key to a domain you own (for example, `alice@alice.com`). It is optional but adds a verification badge to your profile and makes you easier to find. To set it up, you need to add a `.well-known/nostr.json` file to a domain you control, or use an identity service that handles this for you.

**Do I need a browser extension?**
No, but it is strongly recommended. Without an extension, you would need to enter your private key manually to sign in, which is less secure. Extensions like Alby and nos2x store your key securely and sign requests on your behalf.

### Payments and Lightning

**How long do payments take?**
Lightning payments are typically confirmed in under one second. You will receive a notification almost immediately after a supporter sends a tip or pays a subscription invoice.

**Are there fees?**
Sovren does not take a platform fee on payments. The Lightning Network itself charges tiny routing fees — usually less than 1 satoshi on small payments. These are paid by the sender.

**Can supporters pay with regular credit cards or PayPal?**
Currently, Sovren is Lightning-native. Supporters need a Lightning wallet to make payments. Some wallets like Strike support purchasing bitcoin with a debit card to fund payments.

**What if a subscriber's payment fails?**
Lightning invoices expire after a set time. If a subscriber does not complete payment before the invoice expires, they will need to re-subscribe. Expired invoices cannot be completed.

**How do I convert bitcoin to my local currency?**
This happens outside of Sovren in your Lightning wallet or on a bitcoin exchange. Wallets like Strike and Wallet of Satoshi support bank withdrawals in many countries. Phoenix allows you to move funds to an on-chain bitcoin address for use on exchanges.

### Content

**Who owns my content?**
You do. Sovren does not claim any rights over your content. Content published to NOSTR relays is associated with your cryptographic key and signed by you — the authorship record is permanent and verifiable.

**Can I delete content?**
Yes, you can delete content from your Sovren Creator Dashboard. Deletion removes it from Sovren's servers. However, content that was previously broadcast to NOSTR relays may persist on those relays, as the NOSTR protocol does not guarantee deletion from third-party servers.

**What content types are supported?**
Articles, posts, images, video, and audio. All types can be set as free or paid.

**How does Content Shield protect my work?**
Content Shield creates a cryptographic fingerprint of your content at the time of creation, tied to your NOSTR public key. This establishes verifiable proof of authorship and timestamp. The system monitors the network for unauthorized copies and alerts you to potential infringement.

### Subscriptions

**Can I change the price of a subscription tier?**
Yes. Changes apply to new subscribers at their next billing cycle. Existing subscriber pricing may vary — check the subscription management screen for details.

**What happens when I cancel a tier?**
Active subscribers retain access until the end of their current billing period. Sovren notifies subscribers of tier cancellations in advance.

**Can I offer free tiers?**
Yes. A free tier lets you grow your audience without requiring payment. Supporters can follow your public posts for free and upgrade to a paid tier for exclusive content.

### Troubleshooting

**I cannot connect my Lightning wallet.**
Make sure your wallet supports WebLN (the browser standard for Lightning payments). Alby is the most reliable option for browser-based wallet connections. If you are using a mobile wallet, you may need to scan a QR code instead of connecting automatically.

**My content is not showing up on my profile.**
Check the content status in your Creator Dashboard. Only **Published** content appears publicly. If a piece shows as Draft or Scheduled, it will not be visible to supporters yet.

**I am not receiving notifications for new subscribers.**
Check your notification preferences in account settings. Make sure browser notifications are enabled if you are using the web app.

**My NOSTR identity shows as "Not connected" in the dashboard.**
Go to your profile settings and reconnect your NOSTR public key. If you are using a browser extension, make sure it is unlocked and that you have granted Sovren permission to read your public key.

**I forgot my username.**
Your username is separate from your NOSTR key. Go to the login page and try signing in with your browser extension — this bypasses the username and uses your cryptographic identity directly.

---

*For additional support, visit the Sovren community or contact us through the platform. For technical issues, the in-app error messages include reference codes that help the support team diagnose problems quickly.*
