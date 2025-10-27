/**
 * Basic Event Publishing Example
 *
 * Demonstrates:
 * - Service initialization
 * - Key management
 * - Publishing text notes
 * - Error handling
 */

import { RelayPoolManager } from '@/services/nostr/RelayPoolManager';
import { KeyManagementService } from '@/services/nostr/KeyManagementService';
import { EventPublisherService } from '@/services/nostr/EventPublisherService';

async function publishBasicNote() {
  console.log('📡 Initializing NOSTR services...\n');

  // Step 1: Initialize Relay Pool
  const relayPool = RelayPoolManager.getInstance();
  await relayPool.initialize({
    relays: [
      'wss://relay.damus.io',
      'wss://relay.nostr.band',
      'wss://nos.lol',
    ],
  });

  // Connect to all relays
  await relayPool.connectAll();
  console.log('✅ Connected to relays\n');

  // Step 2: Initialize Key Management
  const keyService = KeyManagementService.getInstance();
  await keyService.initialize();

  // Check for browser extension
  const extension = await keyService.detectExtension();

  let publicKey: string;

  if (extension) {
    console.log('🔑 Using browser extension for signing');
    publicKey = await extension.getPublicKey();
  } else {
    console.log('🔑 Generating new key pair');
    const keyPair = await keyService.generateKey({
      saveToStorage: true,
      encrypt: true,
    });
    publicKey = keyPair.publicKey;

    console.log('⚠️ SAVE THIS PRIVATE KEY:');
    console.log(`   nsec: ${keyPair.nsec}\n`);
  }

  console.log(`Public key: ${publicKey.substring(0, 16)}...\n`);

  // Step 3: Initialize Event Publisher
  const publisher = EventPublisherService.getInstance();
  await publisher.initialize();

  // Step 4: Publish a note
  console.log('📝 Publishing note...\n');

  try {
    const result = await publisher.createAndPublish({
      kind: 1,
      content: 'Hello NOSTR! This is my first note from Sovren. #nostr #sovren',
      tags: [
        ['t', 'nostr'],
        ['t', 'sovren'],
      ],
    });

    console.log('✅ Published successfully!\n');
    console.log(`Success rate: ${result.successfulRelays.length}/${result.totalRelays} relays`);
    console.log(`Event ID: ${result.eventId}\n`);

    result.relayResults.forEach((relay) => {
      const status = relay.success ? '✓' : '✗';
      console.log(`  ${status} ${relay.relay}: ${relay.latency}ms`);
    });
  } catch (error) {
    console.error('❌ Failed to publish:', error);
  }

  // Step 5: Cleanup
  await relayPool.disconnectAll();
  console.log('\n🔌 Disconnected from relays');
}

// Run the example
publishBasicNote().catch(console.error);

export { publishBasicNote };
