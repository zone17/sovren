/**
 * Encrypted Direct Messages Example (NIP-04)
 *
 * Demonstrates:
 * - Sending encrypted DMs
 * - Receiving and decrypting DMs
 * - Conversation threading
 */

import { NIP04Service } from '@/services/nostr/NIP04Service';
import { KeyManagementService } from '@/services/nostr/KeyManagementService';
import { EventPublisherService } from '@/services/nostr/EventPublisherService';
import { SubscriptionManagerService } from '@/services/nostr/SubscriptionManagerService';
import type { NostrEvent } from '@shared/types/nostr';

async function sendEncryptedDM() {
  console.log('🔐 Encrypted Direct Messages Example\n');

  // Initialize services
  const keyService = KeyManagementService.getInstance();
  await keyService.initialize();

  const nip04 = NIP04Service.getInstance();
  await nip04.initialize();

  const publisher = EventPublisherService.getInstance();
  await publisher.initialize();

  // Get our key
  const extension = await keyService.detectExtension();
  let myPubkey: string;

  if (extension) {
    myPubkey = await extension.getPublicKey();
  } else {
    const keyPair = await keyService.generateKey();
    myPubkey = keyPair.publicKey;
  }

  console.log(`My pubkey: ${myPubkey.substring(0, 16)}...\n`);

  // Recipient's public key (example)
  const recipientPubkey = 'recipient-pubkey-here...';

  // Step 1: Encrypt and send a DM
  console.log('📤 Sending encrypted DM...\n');

  try {
    const message = 'Hello! This is a private message. 🔒';

    const encryptedContent = await nip04.encryptMessage(recipientPubkey, message);

    const dmEvent = await publisher.createAndPublish({
      kind: 4, // Encrypted DM
      content: encryptedContent,
      tags: [
        ['p', recipientPubkey], // Recipient
      ],
    });

    console.log('✅ DM sent successfully!');
    console.log(`Event ID: ${dmEvent.eventId}\n`);
  } catch (error) {
    console.error('❌ Failed to send DM:', error);
  }

  // Step 2: Subscribe to incoming DMs
  console.log('📥 Listening for incoming DMs...\n');

  const subManager = SubscriptionManagerService.getInstance();

  const dmSubId = subManager.subscribe(
    [
      {
        kinds: [4], // Encrypted DMs
        '#p': [myPubkey], // DMs sent to me
      },
    ],
    async (event: NostrEvent) => {
      try {
        // Decrypt the message
        const sender = event.pubkey;
        const decrypted = await nip04.decryptMessage(sender, event.content);

        console.log('\n📨 New DM received:');
        console.log(`   From: ${sender.substring(0, 16)}...`);
        console.log(`   Message: ${decrypted}`);
        console.log(`   Time: ${new Date(event.created_at * 1000).toLocaleString()}`);
      } catch (error) {
        console.error('Failed to decrypt DM:', error);
      }
    }
  );

  // Run for 60 seconds
  await new Promise((resolve) => setTimeout(resolve, 60000));

  // Cleanup
  subManager.unsubscribe(dmSubId);
  console.log('\n✅ Done!');
}

// Advanced: DM Conversation Component
export function useDMConversation(otherPubkey: string) {
  const [messages, setMessages] = useState<Array<{
    id: string;
    from: string;
    content: string;
    timestamp: number;
    isFromMe: boolean;
  }>>([]);
  const [sending, setSending] = useState(false);

  const keyServiceRef = useRef(KeyManagementService.getInstance());
  const nip04Ref = useRef(NIP04Service.getInstance());
  const publisherRef = useRef(EventPublisherService.getInstance());
  const subManagerRef = useRef(SubscriptionManagerService.getInstance());

  const [myPubkey, setMyPubkey] = useState<string | null>(null);

  // Initialize and load conversation
  useEffect(() => {
    async function init() {
      await keyServiceRef.current.initialize();
      await nip04Ref.current.initialize();
      await publisherRef.current.initialize();

      const extension = await keyServiceRef.current.detectExtension();
      const pubkey = extension
        ? await extension.getPublicKey()
        : (await keyServiceRef.current.generateKey()).publicKey;

      setMyPubkey(pubkey);

      // Subscribe to DMs with this person
      const subId = subManagerRef.current.subscribe(
        [
          {
            kinds: [4],
            '#p': [pubkey, otherPubkey],
          },
        ],
        async (event: NostrEvent) => {
          try {
            const isFromMe = event.pubkey === pubkey;
            const decryptKey = isFromMe ? otherPubkey : event.pubkey;
            const decrypted = await nip04Ref.current.decryptMessage(
              decryptKey,
              event.content
            );

            setMessages((prev) => {
              if (prev.some((m) => m.id === event.id)) {
                return prev; // Already have this message
              }

              return [
                ...prev,
                {
                  id: event.id,
                  from: event.pubkey,
                  content: decrypted,
                  timestamp: event.created_at,
                  isFromMe,
                },
              ].sort((a, b) => a.timestamp - b.timestamp);
            });
          } catch (error) {
            console.error('Failed to decrypt message:', error);
          }
        }
      );

      return () => {
        subManagerRef.current.unsubscribe(subId);
      };
    }

    init();
  }, [otherPubkey]);

  const sendMessage = async (content: string) => {
    if (!myPubkey || !content.trim()) return;

    setSending(true);

    try {
      const encrypted = await nip04Ref.current.encryptMessage(otherPubkey, content);

      await publisherRef.current.createAndPublish({
        kind: 4,
        content: encrypted,
        tags: [['p', otherPubkey]],
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    } finally {
      setSending(false);
    }
  };

  return { messages, sendMessage, sending };
}

// Example DM Component
export function DMConversation({ recipientPubkey }: { recipientPubkey: string }) {
  const { messages, sendMessage, sending } = useDMConversation(recipientPubkey);
  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    try {
      await sendMessage(input);
      setInput('');
    } catch (error) {
      alert('Failed to send message');
    }
  };

  return (
    <div className="dm-conversation">
      <div className="messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.isFromMe ? 'sent' : 'received'}`}
          >
            <p>{msg.content}</p>
            <small>{new Date(msg.timestamp * 1000).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !input.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// Run standalone example
if (require.main === module) {
  sendEncryptedDM().catch(console.error);
}

export { sendEncryptedDM };
