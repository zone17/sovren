import { LightningService } from '../../../services/lightning/lightningService';
import { CreateInvoiceRequest } from '../../../types/lightning';

describe('LightningService', () => {
  let lightningService: LightningService;

  beforeEach(() => {
    // Create a new instance for each test with mock dependencies
    lightningService = new LightningService(null, null);
  });

  describe('getNodeInfo', () => {
    it('should return node information', async () => {
      const nodeInfo = await lightningService.getNodeInfo();

      expect(nodeInfo).toBeDefined();
      expect(nodeInfo.pubkey).toBeDefined();
      expect(nodeInfo.alias).toBeDefined();
      expect(nodeInfo.numActiveChannels).toBeGreaterThanOrEqual(0);
      expect(nodeInfo.syncedToChain).toBeDefined();
    });
  });

  describe('createInvoice', () => {
    it('should create a valid invoice', async () => {
      const request: CreateInvoiceRequest = {
        amount: 10000,
        description: 'Test invoice',
        expirySeconds: 3600,
      };

      const invoice = await lightningService.createInvoice(request);

      expect(invoice).toBeDefined();
      expect(invoice.paymentRequest).toBeDefined();
      expect(invoice.paymentHash).toBeDefined();
      expect(invoice.amount).toBe(request.amount);
      expect(invoice.description).toBe(request.description);
      expect(invoice.settled).toBe(false);

      // Check that expiry is set correctly
      const now = Math.floor(Date.now() / 1000);
      expect(invoice.expiresAt).toBeGreaterThan(now);
      expect(invoice.expiresAt).toBeLessThanOrEqual(now + request.expirySeconds + 5); // Add small buffer for test execution time
    });

    it('should use default description if not provided', async () => {
      const request: CreateInvoiceRequest = {
        amount: 10000,
        expirySeconds: 3600,
      };

      const invoice = await lightningService.createInvoice(request);

      expect(invoice.description).toBeDefined();
    });
  });

  describe('checkInvoiceStatus', () => {
    it('should return invoice status', async () => {
      const paymentHash = '9dabd85596c3222f3d8a42e8895378d4473c0c79e7598dd3a2f5318b8a8e9b29';

      const invoice = await lightningService.checkInvoiceStatus(paymentHash);

      expect(invoice).toBeDefined();
      expect(invoice.paymentHash).toBe(paymentHash);
      expect(typeof invoice.settled).toBe('boolean');

      // If settled, should have settledAt and preimage
      if (invoice.settled) {
        expect(invoice.settledAt).toBeDefined();
        expect(invoice.preimage).toBeDefined();
      } else {
        expect(invoice.settledAt).toBeUndefined();
        expect(invoice.preimage).toBeUndefined();
      }
    });
  });

  describe('makePayment', () => {
    it('should process payment and return result', async () => {
      const paymentRequest =
        'lnbc1500n1pj4d0fzpp5v3j8jj4fs8sd80lllcz7hd0mwsw6m5ew63u4aqj9nkw64xus8t6sdqqcqzpgxqyz5vqsp5usw0d4djmqdj0xd4jcfj7z8dz3t6g3h0eg6f3x0lkucm3jl5aq4q9qyyssqn2k3lx86m3245lj2qkwmq8975g58h8l4pzjd8gkmuwmwvx9nrj9wt0f3d73xz0lwtj7fuhk5khf4r2a9ykht3kx8edlj8hdnvgvgpf5hz75';

      const result = await lightningService.makePayment(paymentRequest);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        expect(result.paymentHash).toBeDefined();
        expect(result.preimage).toBeDefined();
        expect(result.fee).toBeGreaterThanOrEqual(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('createSubscription', () => {
    it('should create a valid subscription', async () => {
      const userId = 'user123';
      const creatorId = 'creator456';
      const tier = 'premium';
      const amount = 15000;
      const interval = 'monthly' as const;

      const subscription = await lightningService.createSubscription(
        userId,
        creatorId,
        tier,
        amount,
        interval
      );

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(subscription.userId).toBe(userId);
      expect(subscription.creatorId).toBe(creatorId);
      expect(subscription.tier).toBe(tier);
      expect(subscription.amount).toBe(amount);
      expect(subscription.interval).toBe(interval);
      expect(subscription.status).toBe('active');

      // Check that dates are set correctly
      const now = Math.floor(Date.now() / 1000);
      expect(subscription.startDate).toBeGreaterThanOrEqual(now - 5); // Allow for test execution time

      // Monthly interval should add ~30 days
      expect(subscription.nextPaymentDate).toBeGreaterThanOrEqual(now + 2592000 - 5);
    });

    it('should calculate next payment date based on interval', async () => {
      const tests = [
        { interval: 'daily' as const, expectedOffset: 86400 },
        { interval: 'weekly' as const, expectedOffset: 604800 },
        { interval: 'monthly' as const, expectedOffset: 2592000 },
        { interval: 'yearly' as const, expectedOffset: 31536000 },
      ];

      for (const test of tests) {
        const now = Math.floor(Date.now() / 1000);
        const subscription = await lightningService.createSubscription(
          'user123',
          'creator456',
          'standard',
          10000,
          test.interval
        );

        expect(subscription.nextPaymentDate).toBeGreaterThanOrEqual(now + test.expectedOffset - 5);
        expect(subscription.nextPaymentDate).toBeLessThanOrEqual(now + test.expectedOffset + 5);
      }
    });
  });

  describe('processSubscriptionPayment', () => {
    it('should process subscription payment and return result', async () => {
      const subscriptionId = 'sub123';

      const result = await lightningService.processSubscriptionPayment(subscriptionId);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        expect(result.paymentHash).toBeDefined();
        expect(result.fee).toBeGreaterThanOrEqual(0);
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription and update status', async () => {
      const subscriptionId = 'sub123';

      const subscription = await lightningService.cancelSubscription(subscriptionId);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBe(subscriptionId);
      expect(subscription.status).toBe('inactive');
      expect(subscription.canceledAt).toBeDefined();
    });
  });

  describe('processPayout', () => {
    it('should process creator payout', async () => {
      const creatorId = 'creator123';
      const amount = 100000;
      const destination = '03e5b39e7494f3741103652d74276c4218efc5497642b86f2d9e2bc1c5e0d0d758';

      const payout = await lightningService.processPayout(creatorId, amount, destination);

      expect(payout).toBeDefined();
      expect(payout.id).toBeDefined();
      expect(payout.creatorId).toBe(creatorId);
      expect(payout.amount).toBe(amount);
      expect(payout.destination).toBe(destination);
      expect(payout.status).toBe('completed');
      expect(payout.paymentHash).toBeDefined();
      expect(payout.fee).toBeGreaterThanOrEqual(0);
      expect(payout.createdAt).toBeDefined();
      expect(payout.processedAt).toBeDefined();
    });
  });

  describe('getUserPaymentHistory', () => {
    it('should return payment history for user', async () => {
      const userId = 'user123';

      const history = await lightningService.getUserPaymentHistory(userId);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      // Check structure of first payment
      const payment = history[0];
      expect(payment.id).toBeDefined();
      expect(payment.userId).toBe(userId);
      expect(payment.paymentHash).toBeDefined();
      expect(payment.paymentRequest).toBeDefined();
      expect(payment.amount).toBeGreaterThan(0);
      expect(payment.status).toBeDefined();
      expect(payment.createdAt).toBeDefined();
    });
  });

  describe('getCreatorPayoutHistory', () => {
    it('should return payout history for creator', async () => {
      const creatorId = 'creator123';

      const history = await lightningService.getCreatorPayoutHistory(creatorId);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      // Check structure of first payout
      const payout = history[0];
      expect(payout.id).toBeDefined();
      expect(payout.creatorId).toBe(creatorId);
      expect(payout.amount).toBeGreaterThan(0);
      expect(payout.destination).toBeDefined();
      expect(payout.status).toBeDefined();
      expect(payout.createdAt).toBeDefined();
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return active subscriptions for user', async () => {
      const userId = 'user123';

      const subscriptions = await lightningService.getUserSubscriptions(userId);

      expect(Array.isArray(subscriptions)).toBe(true);
      expect(subscriptions.length).toBeGreaterThan(0);

      // Check structure of first subscription
      const subscription = subscriptions[0];
      expect(subscription.id).toBeDefined();
      expect(subscription.userId).toBe(userId);
      expect(subscription.creatorId).toBeDefined();
      expect(subscription.status).toBeDefined();
      expect(subscription.tier).toBeDefined();
      expect(subscription.amount).toBeGreaterThan(0);
      expect(subscription.interval).toBeDefined();
      expect(subscription.startDate).toBeDefined();
      expect(subscription.nextPaymentDate).toBeDefined();
    });
  });

  describe('getCreatorSubscribers', () => {
    it('should return subscribers for creator', async () => {
      const creatorId = 'creator123';

      const subscribers = await lightningService.getCreatorSubscribers(creatorId);

      expect(Array.isArray(subscribers)).toBe(true);
      expect(subscribers.length).toBeGreaterThan(0);

      // Check structure of first subscription
      const subscription = subscribers[0];
      expect(subscription.id).toBeDefined();
      expect(subscription.userId).toBeDefined();
      expect(subscription.creatorId).toBe(creatorId);
      expect(subscription.status).toBeDefined();
      expect(subscription.tier).toBeDefined();
      expect(subscription.amount).toBeGreaterThan(0);
      expect(subscription.interval).toBeDefined();
      expect(subscription.startDate).toBeDefined();
      expect(subscription.nextPaymentDate).toBeDefined();
    });
  });
});
