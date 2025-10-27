/**
 * Event Subscription Example
 *
 * Demonstrates:
 * - Subscribing to events
 * - Filtering by kind, author, tags
 * - EOSE handling
 * - Subscription cleanup
 */

import { RelayPoolManager } from '@/services/nostr/RelayPoolManager';
import { SubscriptionManagerService } from '@/services/nostr/SubscriptionManagerService';
import type { NostrEvent, NostrFilter } from '@shared/types/nostr';

async function subscribeToEvents() {
  console.log('🎯 Setting up event subscriptions...\n');

  // Initialize services
  const relayPool = RelayPoolManager.getInstance();
  await relayPool.initialize();
  await relayPool.connectAll();

  const subManager = SubscriptionManagerService.getInstance();

  // Example 1: Subscribe to recent text notes
  console.log('📰 Subscribing to recent text notes...\n');

  const textNotesSubId = subManager.subscribe(
    [
      {
        kinds: [1], // Text notes
        limit: 20,  // Latest 20
      },
    ],
    (event: NostrEvent, relay: string) => {
      console.log(`\n📝 New note from ${relay}:`);
      console.log(`   Author: ${event.pubkey.substring(0, 16)}...`);
      console.log(`   Content: ${event.content.substring(0, 80)}...`);
      console.log(`   Time: ${new Date(event.created_at * 1000).toLocaleTimeString()}`);
    },
    {
      onEOSE: (relay: string) => {
        console.log(`\n✓ Loaded stored events from ${relay}`);
      },
      onError: (relay: string, error: Error) => {
        console.error(`\n✗ Error from ${relay}:`, error.message);
      },
    }
  );

  // Example 2: Subscribe to specific author
  const authorPubkey = '3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d';

  console.log(`\n👤 Subscribing to author: ${authorPubkey.substring(0, 16)}...\n`);

  const authorSubId = subManager.subscribe(
    [
      {
        authors: [authorPubkey],
        kinds: [1],
        limit: 10,
      },
    ],
    (event: NostrEvent) => {
      console.log(`\n📣 Post from author: ${event.content.substring(0, 80)}...`);
    }
  );

  // Example 3: Subscribe to hashtag
  console.log('\n🏷️ Subscribing to #nostr hashtag...\n');

  const hashtagSubId = subManager.subscribe(
    [
      {
        kinds: [1],
        '#t': ['nostr'], // Events tagged with 'nostr'
        limit: 15,
      },
    ],
    (event: NostrEvent) => {
      const tags = event.tags.filter((t) => t[0] === 't').map((t) => `#${t[1]}`);
      console.log(`\n#️⃣ Tagged post: ${event.content.substring(0, 60)}...`);
      console.log(`   Tags: ${tags.join(', ')}`);
    }
  );

  // Example 4: Subscribe with time filter
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

  const recentSubId = subManager.subscribe(
    [
      {
        kinds: [1],
        since: oneDayAgo, // Events from last 24 hours
        limit: 30,
      },
    ],
    (event: NostrEvent) => {
      const hoursAgo = Math.floor((Date.now() / 1000 - event.created_at) / 3600);
      console.log(`\n⏰ ${hoursAgo}h ago: ${event.content.substring(0, 60)}...`);
    }
  );

  // Run for 30 seconds then cleanup
  console.log('\n⏳ Listening for 30 seconds...\n');

  await new Promise((resolve) => setTimeout(resolve, 30000));

  // Cleanup: Unsubscribe from all
  console.log('\n🧹 Cleaning up subscriptions...');
  subManager.unsubscribe(textNotesSubId);
  subManager.unsubscribe(authorSubId);
  subManager.unsubscribe(hashtagSubId);
  subManager.unsubscribe(recentSubId);

  await relayPool.disconnectAll();
  console.log('✅ Done!\n');
}

// Advanced: Real-time feed with React hook
export function useNostrFeed(filters: NostrFilter[], options = { enabled: true }) {
  const [events, setEvents] = useState<NostrEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const subManagerRef = useRef(SubscriptionManagerService.getInstance());
  const [subId, setSubId] = useState<string | null>(null);

  useEffect(() => {
    if (!options.enabled) return;

    const newSubId = subManagerRef.current.subscribe(
      filters,
      (event: NostrEvent) => {
        setEvents((prev) => {
          // Deduplicate
          if (prev.some((e) => e.id === event.id)) {
            return prev;
          }
          // Add new event and keep sorted by time (newest first)
          return [event, ...prev]
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, 100); // Keep max 100 events
        });
      },
      {
        onEOSE: () => {
          setLoading(false);
        },
      }
    );

    setSubId(newSubId);

    // Cleanup on unmount
    return () => {
      if (newSubId) {
        subManagerRef.current.unsubscribe(newSubId);
      }
    };
  }, [JSON.stringify(filters), options.enabled]);

  return { events, loading };
}

// Example usage of the hook
export function FeedComponent() {
  const { events, loading } = useNostrFeed([{ kinds: [1], limit: 50 }]);

  if (loading) {
    return <div>Loading feed...</div>;
  }

  return (
    <div className="feed">
      {events.map((event) => (
        <div key={event.id} className="note">
          <p>{event.content}</p>
          <small>{new Date(event.created_at * 1000).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}

// Run the standalone example
if (require.main === module) {
  subscribeToEvents().catch(console.error);
}

export { subscribeToEvents };
