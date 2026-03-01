/**
 * User Relationship Service Tests
 * User Story: US-E5-022
 * Comprehensive test suite with 95%+ coverage
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import { UserRelationshipService } from '../UserRelationshipService';
import type { IEventBus } from '../../../interfaces/shared/IEventBus';
import type { ILogger } from '../../../interfaces/shared/ILogger';
import type { ICacheService } from '../../../interfaces/shared/ICacheService';
import {
  RelationshipType,
  RelationshipStatus,
  type UserRelationship,
  type FollowRequest,
  type BlockRequest,
  type MuteRequest,
  type FriendRequest,
  type BulkFollowRequest,
} from '../../../types/user-relationship';

describe('UserRelationshipService', () => {
  let service: UserRelationshipService;
  let mockEventBus: vi.Mocked<IEventBus>;
  let mockLogger: vi.Mocked<ILogger>;
  let mockCache: vi.Mocked<ICacheService>;

  beforeEach(() => {
    // Create mocks
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      publishBatch: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue('sub-id'),
      subscribeToMany: vi.fn().mockReturnValue('sub-id'),
      subscribeToAll: vi.fn().mockReturnValue('sub-id'),
      subscribeWithFilter: vi.fn().mockReturnValue('sub-id'),
      unsubscribe: vi.fn(),
      unsubscribeAll: vi.fn(),
      getEvent: vi.fn().mockResolvedValue(null),
      queryEvents: vi.fn().mockResolvedValue([]),
      replayEvents: vi.fn().mockResolvedValue([]),
      replayEventsToHandler: vi.fn().mockResolvedValue(undefined),
      getActiveSubscriptions: vi.fn().mockReturnValue([]),
      getEventStats: vi.fn().mockResolvedValue({}),
      clearEventStore: vi.fn().mockResolvedValue(undefined),
      isHealthy: vi.fn().mockResolvedValue(true),
      dispose: vi.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      exists: vi.fn().mockResolvedValue(false),
      invalidate: vi.fn().mockResolvedValue(0),
      invalidateByTags: vi.fn().mockResolvedValue(0),
      flush: vi.fn().mockResolvedValue(undefined),
      getTtl: vi.fn().mockResolvedValue(-1),
      setTtl: vi.fn().mockResolvedValue(true),
      getMany: vi.fn().mockResolvedValue(new Map()),
      setMany: vi.fn().mockResolvedValue(undefined),
      remember: vi.fn().mockImplementation(async (key, factory) => factory()),
      healthCheck: vi.fn().mockResolvedValue(true),
      dispose: vi.fn().mockResolvedValue(undefined),
    };

    service = new UserRelationshipService(mockEventBus, mockLogger, mockCache);
  });

  afterEach(async () => {
    await service.dispose();
  });

  describe('Follow Operations', () => {
    describe('follow', () => {
      it('should create a follow relationship successfully', async () => {
        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        const relationship = await service.follow(request);

        expect(relationship).toBeDefined();
        expect(relationship.sourceUserId).toBe('user1');
        expect(relationship.targetUserId).toBe('user2');
        expect(relationship.type).toBe(RelationshipType.FOLLOW);
        expect(relationship.status).toBe(RelationshipStatus.ACTIVE);
        expect(mockEventBus.publish).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith('User followed', expect.any(Object));
      });

      it('should be idempotent - return existing follow if already following', async () => {
        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        const first = await service.follow(request);
        const second = await service.follow(request);

        expect(first.id).toBe(second.id);
        expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      });

      it('should throw error if trying to follow self', async () => {
        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user1',
        };

        await expect(service.follow(request)).rejects.toThrow(
          'Cannot create relationship with self'
        );
      });

      it('should throw error if blocked by target user', async () => {
        await service.block({
          userId: 'user2',
          targetUserId: 'user1',
        });

        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        await expect(service.follow(request)).rejects.toThrow(
          'Cannot follow: you are blocked by this user'
        );
      });

      it('should throw error if user has blocked target', async () => {
        await service.block({
          userId: 'user1',
          targetUserId: 'user2',
        });

        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        await expect(service.follow(request)).rejects.toThrow(
          'Cannot follow: you have blocked this user'
        );
      });

      it('should allow follow with force flag even if blocked', async () => {
        await service.block({
          userId: 'user1',
          targetUserId: 'user2',
        });

        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user2',
          force: true,
        };

        const relationship = await service.follow(request);
        expect(relationship).toBeDefined();
        expect(relationship.status).toBe(RelationshipStatus.ACTIVE);
      });

      it('should create pending follow if target requires approval', async () => {
        await service.updatePrivacySettings('user2', {
          requireApprovalForFollows: true,
        });

        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        const relationship = await service.follow(request);
        expect(relationship.status).toBe(RelationshipStatus.PENDING);
      });

      it('should invalidate caches after follow', async () => {
        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        await service.follow(request);

        expect(mockCache.invalidate).toHaveBeenCalledWith(expect.stringContaining('relationship:'));
      });

      it('should include metadata in relationship', async () => {
        const request: FollowRequest = {
          userId: 'user1',
          targetUserId: 'user2',
          metadata: { source: 'web', campaign: 'summer2024' },
        };

        const relationship = await service.follow(request);
        expect(relationship.metadata).toEqual({
          source: 'web',
          campaign: 'summer2024',
        });
      });
    });

    describe('unfollow', () => {
      it('should remove follow relationship successfully', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });

        const result = await service.unfollow({
          userId: 'user1',
          targetUserId: 'user2',
        });

        expect(result).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith('User unfollowed', expect.any(Object));
      });

      it('should return false if not following', async () => {
        const result = await service.unfollow({
          userId: 'user1',
          targetUserId: 'user2',
        });

        expect(result).toBe(false);
      });

      it('should emit unfollow event', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        mockEventBus.publish.mockClear();

        await service.unfollow({ userId: 'user1', targetUserId: 'user2' });

        expect(mockEventBus.publish).toHaveBeenCalled();
      });

      it('should be idempotent - can unfollow multiple times', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });

        const first = await service.unfollow({ userId: 'user1', targetUserId: 'user2' });
        const second = await service.unfollow({ userId: 'user1', targetUserId: 'user2' });

        expect(first).toBe(true);
        expect(second).toBe(false);
      });
    });

    describe('isFollowing', () => {
      it('should return true if following', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });

        const result = await service.isFollowing('user1', 'user2');
        expect(result).toBe(true);
      });

      it('should return false if not following', async () => {
        const result = await service.isFollowing('user1', 'user2');
        expect(result).toBe(false);
      });

      it('should cache result', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });

        await service.isFollowing('user1', 'user2');

        expect(mockCache.set).toHaveBeenCalledWith(
          expect.stringContaining('relationship:following:user1:user2'),
          true,
          3600
        );
      });

      it('should return cached result if available', async () => {
        mockCache.get.mockResolvedValueOnce(true);

        const result = await service.isFollowing('user1', 'user2');

        expect(result).toBe(true);
        expect(mockCache.get).toHaveBeenCalled();
      });
    });
  });

  describe('Block Operations', () => {
    describe('block', () => {
      it('should create a block relationship successfully', async () => {
        const request: BlockRequest = {
          userId: 'user1',
          targetUserId: 'user2',
          reason: 'spam',
        };

        const relationship = await service.block(request);

        expect(relationship).toBeDefined();
        expect(relationship.type).toBe(RelationshipType.BLOCK);
        expect(relationship.status).toBe(RelationshipStatus.ACTIVE);
        expect(relationship.metadata?.reason).toBe('spam');
      });

      it('should be idempotent', async () => {
        const request: BlockRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        const first = await service.block(request);
        const second = await service.block(request);

        expect(first.id).toBe(second.id);
      });

      it('should cascade - remove bidirectional follows on block', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user2', targetUserId: 'user1' });

        await service.block({ userId: 'user1', targetUserId: 'user2' });

        const isFollowing1 = await service.isFollowing('user1', 'user2');
        const isFollowing2 = await service.isFollowing('user2', 'user1');

        expect(isFollowing1).toBe(false);
        expect(isFollowing2).toBe(false);
      });

      it('should emit block event', async () => {
        await service.block({ userId: 'user1', targetUserId: 'user2' });

        expect(mockEventBus.publish).toHaveBeenCalled();
      });
    });

    describe('unblock', () => {
      it('should remove block relationship successfully', async () => {
        await service.block({ userId: 'user1', targetUserId: 'user2' });

        const result = await service.unblock({
          userId: 'user1',
          targetUserId: 'user2',
        });

        expect(result).toBe(true);
      });

      it('should return false if not blocking', async () => {
        const result = await service.unblock({
          userId: 'user1',
          targetUserId: 'user2',
        });

        expect(result).toBe(false);
      });
    });

    describe('isBlocking', () => {
      it('should return true if blocking', async () => {
        await service.block({ userId: 'user1', targetUserId: 'user2' });

        const result = await service.isBlocking('user1', 'user2');
        expect(result).toBe(true);
      });

      it('should return false if not blocking', async () => {
        const result = await service.isBlocking('user1', 'user2');
        expect(result).toBe(false);
      });
    });

    describe('isBlockedBy', () => {
      it('should return true if blocked by user', async () => {
        await service.block({ userId: 'user2', targetUserId: 'user1' });

        const result = await service.isBlockedBy('user1', 'user2');
        expect(result).toBe(true);
      });

      it('should return false if not blocked', async () => {
        const result = await service.isBlockedBy('user1', 'user2');
        expect(result).toBe(false);
      });
    });
  });

  describe('Mute Operations', () => {
    describe('mute', () => {
      it('should create a mute relationship successfully', async () => {
        const request: MuteRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        const relationship = await service.mute(request);

        expect(relationship).toBeDefined();
        expect(relationship.type).toBe(RelationshipType.MUTE);
        expect(relationship.status).toBe(RelationshipStatus.ACTIVE);
      });

      it('should create temporary mute with expiration', async () => {
        const request: MuteRequest = {
          userId: 'user1',
          targetUserId: 'user2',
          duration: 3600, // 1 hour
        };

        const relationship = await service.mute(request);

        expect(relationship.expiresAt).toBeDefined();
        expect(relationship.expiresAt!.getTime()).toBeGreaterThan(Date.now());
      });

      it('should be idempotent', async () => {
        const request: MuteRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        const first = await service.mute(request);
        const second = await service.mute(request);

        expect(first.id).toBe(second.id);
      });

      it('should not remove follow relationship on mute', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.mute({ userId: 'user1', targetUserId: 'user2' });

        const isFollowing = await service.isFollowing('user1', 'user2');
        expect(isFollowing).toBe(true);
      });
    });

    describe('unmute', () => {
      it('should remove mute relationship successfully', async () => {
        await service.mute({ userId: 'user1', targetUserId: 'user2' });

        const result = await service.unmute({
          userId: 'user1',
          targetUserId: 'user2',
        });

        expect(result).toBe(true);
      });

      it('should return false if not muting', async () => {
        const result = await service.unmute({
          userId: 'user1',
          targetUserId: 'user2',
        });

        expect(result).toBe(false);
      });
    });

    describe('isMuting', () => {
      it('should return true if muting', async () => {
        await service.mute({ userId: 'user1', targetUserId: 'user2' });

        const result = await service.isMuting('user1', 'user2');
        expect(result).toBe(true);
      });

      it('should return false if not muting', async () => {
        const result = await service.isMuting('user1', 'user2');
        expect(result).toBe(false);
      });
    });
  });

  describe('Friend Request Operations', () => {
    describe('sendFriendRequest', () => {
      it('should create friend request successfully', async () => {
        const request: FriendRequest = {
          userId: 'user1',
          targetUserId: 'user2',
          message: 'Hello!',
        };

        const relationship = await service.sendFriendRequest(request);

        expect(relationship).toBeDefined();
        expect(relationship.type).toBe(RelationshipType.FRIEND_REQUEST);
        expect(relationship.status).toBe(RelationshipStatus.PENDING);
        expect(relationship.metadata?.message).toBe('Hello!');
      });

      it('should throw error if friend requests not allowed', async () => {
        await service.updatePrivacySettings('user2', {
          allowFriendRequests: false,
        });

        const request: FriendRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        await expect(service.sendFriendRequest(request)).rejects.toThrow(
          'User does not accept friend requests'
        );
      });

      it('should be idempotent', async () => {
        const request: FriendRequest = {
          userId: 'user1',
          targetUserId: 'user2',
        };

        const first = await service.sendFriendRequest(request);
        const second = await service.sendFriendRequest(request);

        expect(first.id).toBe(second.id);
      });
    });

    describe('respondToFriendRequest', () => {
      it('should accept friend request and create mutual follows', async () => {
        const friendRequest = await service.sendFriendRequest({
          userId: 'user1',
          targetUserId: 'user2',
        });

        const response = await service.respondToFriendRequest({
          requestId: friendRequest.id,
          userId: 'user2',
          accepted: true,
        });

        expect(response.status).toBe(RelationshipStatus.ACTIVE);

        const isFollowing1 = await service.isFollowing('user1', 'user2');
        const isFollowing2 = await service.isFollowing('user2', 'user1');

        expect(isFollowing1).toBe(true);
        expect(isFollowing2).toBe(true);
      });

      it('should reject friend request', async () => {
        const friendRequest = await service.sendFriendRequest({
          userId: 'user1',
          targetUserId: 'user2',
        });

        const response = await service.respondToFriendRequest({
          requestId: friendRequest.id,
          userId: 'user2',
          accepted: false,
        });

        expect(response.status).toBe(RelationshipStatus.REJECTED);
      });

      it('should throw error if not target user', async () => {
        const friendRequest = await service.sendFriendRequest({
          userId: 'user1',
          targetUserId: 'user2',
        });

        await expect(
          service.respondToFriendRequest({
            requestId: friendRequest.id,
            userId: 'user3',
            accepted: true,
          })
        ).rejects.toThrow('Unauthorized to respond to this request');
      });

      it('should throw error if already processed', async () => {
        const friendRequest = await service.sendFriendRequest({
          userId: 'user1',
          targetUserId: 'user2',
        });

        await service.respondToFriendRequest({
          requestId: friendRequest.id,
          userId: 'user2',
          accepted: true,
        });

        await expect(
          service.respondToFriendRequest({
            requestId: friendRequest.id,
            userId: 'user2',
            accepted: true,
          })
        ).rejects.toThrow('Request already processed');
      });
    });

    describe('cancelFriendRequest', () => {
      it('should cancel friend request successfully', async () => {
        const friendRequest = await service.sendFriendRequest({
          userId: 'user1',
          targetUserId: 'user2',
        });

        const result = await service.cancelFriendRequest(friendRequest.id, 'user1');

        expect(result).toBe(true);
      });

      it('should return false if not sender', async () => {
        const friendRequest = await service.sendFriendRequest({
          userId: 'user1',
          targetUserId: 'user2',
        });

        const result = await service.cancelFriendRequest(friendRequest.id, 'user3');

        expect(result).toBe(false);
      });
    });

    describe('getPendingFriendRequests', () => {
      it('should return pending friend requests for user', async () => {
        await service.sendFriendRequest({
          userId: 'user1',
          targetUserId: 'user2',
        });
        await service.sendFriendRequest({
          userId: 'user3',
          targetUserId: 'user2',
        });

        const requests = await service.getPendingFriendRequests('user2');

        expect(requests).toHaveLength(2);
        expect(requests[0].type).toBe(RelationshipType.FRIEND_REQUEST);
        expect(requests[0].status).toBe(RelationshipStatus.PENDING);
      });

      it('should support pagination', async () => {
        for (let i = 0; i < 10; i++) {
          await service.sendFriendRequest({
            userId: `user${i}`,
            targetUserId: 'target',
          });
        }

        const requests = await service.getPendingFriendRequests('target', {
          limit: 5,
          offset: 0,
        });

        expect(requests).toHaveLength(5);
      });
    });
  });

  describe('List Operations', () => {
    describe('getFollowers', () => {
      it('should return followers list', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'target' });
        await service.follow({ userId: 'user2', targetUserId: 'target' });
        await service.follow({ userId: 'user3', targetUserId: 'target' });

        const response = await service.getFollowers('target');

        expect(response.followers).toHaveLength(3);
        expect(response.total).toBe(3);
        expect(response.hasMore).toBe(false);
      });

      it('should support pagination', async () => {
        for (let i = 0; i < 100; i++) {
          await service.follow({ userId: `user${i}`, targetUserId: 'target' });
        }

        const response = await service.getFollowers('target', {
          limit: 10,
          offset: 0,
        });

        expect(response.followers).toHaveLength(10);
        expect(response.total).toBe(100);
        expect(response.hasMore).toBe(true);
        expect(response.nextCursor).toBeDefined();
      });

      it('should indicate mutual follows', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'target' });
        await service.follow({ userId: 'target', targetUserId: 'user1' });

        const response = await service.getFollowers('target');

        expect(response.followers[0].isMutual).toBe(true);
      });

      it('should cache results', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'target' });

        await service.getFollowers('target');

        expect(mockCache.set).toHaveBeenCalledWith(
          expect.stringContaining('relationship:followers:target'),
          expect.any(Object),
          300
        );
      });
    });

    describe('getFollowing', () => {
      it('should return following list', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'target1' });
        await service.follow({ userId: 'user1', targetUserId: 'target2' });
        await service.follow({ userId: 'user1', targetUserId: 'target3' });

        const response = await service.getFollowing('user1');

        expect(response.following).toHaveLength(3);
        expect(response.total).toBe(3);
      });

      it('should support pagination', async () => {
        for (let i = 0; i < 100; i++) {
          await service.follow({ userId: 'user1', targetUserId: `target${i}` });
        }

        const response = await service.getFollowing('user1', {
          limit: 10,
          offset: 0,
        });

        expect(response.following).toHaveLength(10);
        expect(response.hasMore).toBe(true);
      });
    });

    describe('getMutualFollows', () => {
      it('should return mutual follows only', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user2', targetUserId: 'user1' });
        await service.follow({ userId: 'user1', targetUserId: 'user3' });

        const mutuals = await service.getMutualFollows('user1');

        expect(mutuals).toHaveLength(1);
        expect(mutuals[0].targetUserId).toBe('user2');
      });
    });

    describe('getBlockedUsers', () => {
      it('should return blocked users list', async () => {
        await service.block({ userId: 'user1', targetUserId: 'user2' });
        await service.block({ userId: 'user1', targetUserId: 'user3' });

        const blocked = await service.getBlockedUsers('user1');

        expect(blocked).toHaveLength(2);
      });
    });

    describe('getMutedUsers', () => {
      it('should return muted users list', async () => {
        await service.mute({ userId: 'user1', targetUserId: 'user2' });
        await service.mute({ userId: 'user1', targetUserId: 'user3' });

        const muted = await service.getMutedUsers('user1');

        expect(muted).toHaveLength(2);
      });

      it('should exclude expired mutes', async () => {
        await service.mute({
          userId: 'user1',
          targetUserId: 'user2',
          duration: -1, // Already expired
        });

        const muted = await service.getMutedUsers('user1');

        expect(muted).toHaveLength(0);
      });
    });
  });

  describe('Statistics', () => {
    describe('getRelationshipStats', () => {
      it('should return accurate statistics', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user1', targetUserId: 'user3' });
        await service.follow({ userId: 'user2', targetUserId: 'user1' });
        await service.block({ userId: 'user1', targetUserId: 'user4' });
        await service.mute({ userId: 'user1', targetUserId: 'user5' });

        const stats = await service.getRelationshipStats('user1');

        expect(stats.followerCount).toBe(1);
        expect(stats.followingCount).toBe(2);
        expect(stats.mutualFollowCount).toBe(1);
        expect(stats.blockedCount).toBe(1);
        expect(stats.mutedCount).toBe(1);
      });

      it('should cache statistics', async () => {
        await service.getRelationshipStats('user1');

        expect(mockCache.set).toHaveBeenCalledWith(
          'relationship:stats:user1',
          expect.any(Object),
          300
        );
      });
    });

    describe('checkMutualRelationship', () => {
      it('should return true for mutual follows', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user2', targetUserId: 'user1' });

        const result = await service.checkMutualRelationship('user1', 'user2');

        expect(result.isMutual).toBe(true);
        expect(result.sourceRelationship).toBeDefined();
        expect(result.targetRelationship).toBeDefined();
      });

      it('should return false for one-way follows', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });

        const result = await service.checkMutualRelationship('user1', 'user2');

        expect(result.isMutual).toBe(false);
      });
    });
  });

  describe('Recommendations', () => {
    describe('getRecommendations', () => {
      it('should recommend users followed by connections', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user2', targetUserId: 'user3' });
        await service.follow({ userId: 'user2', targetUserId: 'user4' });

        const recommendations = await service.getRecommendations('user1', 10);

        expect(recommendations.length).toBeGreaterThan(0);
        expect(recommendations[0].userId).toMatch(/user3|user4/);
        expect(recommendations[0].score).toBeGreaterThan(0);
      });

      it('should not recommend users already followed', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user1', targetUserId: 'user3' });
        await service.follow({ userId: 'user2', targetUserId: 'user3' });

        const recommendations = await service.getRecommendations('user1', 10);

        const recommendedIds = recommendations.map((r) => r.userId);
        expect(recommendedIds).not.toContain('user3');
      });

      it('should not recommend blocked users', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user2', targetUserId: 'user3' });
        await service.block({ userId: 'user1', targetUserId: 'user3' });

        const recommendations = await service.getRecommendations('user1', 10);

        const recommendedIds = recommendations.map((r) => r.userId);
        expect(recommendedIds).not.toContain('user3');
      });

      it('should cache recommendations', async () => {
        await service.getRecommendations('user1', 10);

        expect(mockCache.set).toHaveBeenCalledWith(
          'relationship:recommendations:user1',
          expect.any(Array),
          1800
        );
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('bulkFollow', () => {
      it('should follow multiple users successfully', async () => {
        const request: BulkFollowRequest = {
          userId: 'user1',
          targetUserIds: ['user2', 'user3', 'user4'],
        };

        const result = await service.bulkFollow(request);

        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
        expect(result.successful).toHaveLength(3);
      });

      it('should handle partial failures', async () => {
        await service.block({ userId: 'user3', targetUserId: 'user1' });

        const request: BulkFollowRequest = {
          userId: 'user1',
          targetUserIds: ['user2', 'user3', 'user4'],
        };

        const result = await service.bulkFollow(request);

        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
        expect(result.failed).toHaveLength(1);
        expect(result.failed[0].userId).toBe('user3');
      });

      it('should respect batch size and delay', async () => {
        const request: BulkFollowRequest = {
          userId: 'user1',
          targetUserIds: Array.from({ length: 25 }, (_, i) => `user${i}`),
          batchSize: 10,
          delayMs: 10,
        };

        const startTime = Date.now();
        await service.bulkFollow(request);
        const duration = Date.now() - startTime;

        // Should have 3 batches with delays
        expect(duration).toBeGreaterThanOrEqual(20);
      });
    });

    describe('bulkUnfollow', () => {
      it('should unfollow multiple users successfully', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user1', targetUserId: 'user3' });
        await service.follow({ userId: 'user1', targetUserId: 'user4' });

        const request = {
          userId: 'user1',
          targetUserIds: ['user2', 'user3', 'user4'],
        };

        const result = await service.bulkUnfollow(request);

        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
      });
    });
  });

  describe('Privacy Settings', () => {
    describe('getPrivacySettings', () => {
      it('should return default privacy settings', async () => {
        const settings = await service.getPrivacySettings('user1');

        expect(settings).toBeDefined();
        expect(settings.userId).toBe('user1');
        expect(settings.hideFollowers).toBe(false);
        expect(settings.allowFriendRequests).toBe(true);
      });

      it('should cache privacy settings', async () => {
        await service.getPrivacySettings('user1');

        expect(mockCache.set).toHaveBeenCalledWith(
          'relationship:privacy:user1',
          expect.any(Object),
          3600
        );
      });
    });

    describe('updatePrivacySettings', () => {
      it('should update privacy settings', async () => {
        const updated = await service.updatePrivacySettings('user1', {
          hideFollowers: true,
          requireApprovalForFollows: true,
        });

        expect(updated.hideFollowers).toBe(true);
        expect(updated.requireApprovalForFollows).toBe(true);
      });

      it('should emit event on update', async () => {
        await service.updatePrivacySettings('user1', {
          hideFollowers: true,
        });

        expect(mockEventBus.publish).toHaveBeenCalled();
      });
    });
  });

  describe('Validation', () => {
    describe('validateRelationship', () => {
      it('should return complete validation result', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });

        const validation = await service.validateRelationship('user1', 'user2');

        expect(validation.valid).toBe(true);
        expect(validation.canFollow).toBe(true);
        expect(validation.isFollowing).toBe(true);
        expect(validation.isBlocked).toBe(false);
      });

      it('should detect blocks', async () => {
        await service.block({ userId: 'user1', targetUserId: 'user2' });

        const validation = await service.validateRelationship('user1', 'user2');

        expect(validation.valid).toBe(false);
        expect(validation.isBlocked).toBe(true);
        expect(validation.canFollow).toBe(false);
      });

      it('should detect mutual relationships', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user2', targetUserId: 'user1' });

        const validation = await service.validateRelationship('user1', 'user2');

        expect(validation.isFollowing).toBe(true);
        expect(validation.isFollowedBy).toBe(true);
      });
    });
  });

  describe('Import/Export', () => {
    describe('importFollows', () => {
      it('should import follows from external source', async () => {
        const result = await service.importFollows({
          userId: 'user1',
          userIds: ['user2', 'user3', 'user4'],
          source: 'twitter',
          metadata: { importDate: new Date().toISOString() },
        });

        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
      });
    });

    describe('exportRelationships', () => {
      it('should export all relationship data', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user3', targetUserId: 'user1' });
        await service.block({ userId: 'user1', targetUserId: 'user4' });
        await service.mute({ userId: 'user1', targetUserId: 'user5' });

        const exported = await service.exportRelationships('user1');

        expect(exported.userId).toBe('user1');
        expect(exported.followers).toContain('user3');
        expect(exported.following).toContain('user2');
        expect(exported.blocked).toContain('user4');
        expect(exported.muted).toContain('user5');
        expect(exported.exportedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Query', () => {
    describe('queryRelationships', () => {
      it('should query relationships with filters', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.block({ userId: 'user1', targetUserId: 'user3' });

        const results = await service.queryRelationships({
          userId: 'user1',
          type: RelationshipType.FOLLOW,
        });

        expect(results).toHaveLength(1);
        expect(results[0].type).toBe(RelationshipType.FOLLOW);
      });

      it('should support pagination', async () => {
        for (let i = 0; i < 100; i++) {
          await service.follow({ userId: 'user1', targetUserId: `target${i}` });
        }

        const results = await service.queryRelationships({
          userId: 'user1',
          pagination: { limit: 10, offset: 0 },
        });

        expect(results).toHaveLength(10);
      });

      it('should filter by status', async () => {
        await service.sendFriendRequest({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user1', targetUserId: 'user3' });

        const results = await service.queryRelationships({
          userId: 'user1',
          status: RelationshipStatus.PENDING,
        });

        expect(results).toHaveLength(1);
        expect(results[0].status).toBe(RelationshipStatus.PENDING);
      });
    });
  });

  describe('Metrics', () => {
    describe('getMetrics', () => {
      it('should return system-wide metrics', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.follow({ userId: 'user2', targetUserId: 'user1' });
        await service.block({ userId: 'user3', targetUserId: 'user4' });

        const metrics = await service.getMetrics();

        expect(metrics.totalRelationships).toBeGreaterThan(0);
        expect(metrics.activeFollows).toBe(2);
        expect(metrics.activeBlocks).toBe(1);
      });
    });
  });

  describe('Health & Maintenance', () => {
    describe('cleanupExpiredRelationships', () => {
      it('should remove expired mutes', async () => {
        await service.mute({
          userId: 'user1',
          targetUserId: 'user2',
          duration: -1, // Already expired
        });

        const cleanedCount = await service.cleanupExpiredRelationships();

        expect(cleanedCount).toBe(1);
      });

      it('should not remove non-expired relationships', async () => {
        await service.mute({
          userId: 'user1',
          targetUserId: 'user2',
          duration: 3600, // 1 hour from now
        });

        const cleanedCount = await service.cleanupExpiredRelationships();

        expect(cleanedCount).toBe(0);
      });
    });

    describe('rebuildCache', () => {
      it('should invalidate all caches', async () => {
        const result = await service.rebuildCache();

        expect(result).toBe(true);
        expect(mockCache.invalidate).toHaveBeenCalledWith('relationship:*');
      });

      it('should return true if no cache', async () => {
        const serviceWithoutCache = new UserRelationshipService(mockEventBus, mockLogger);

        const result = await serviceWithoutCache.rebuildCache();

        expect(result).toBe(true);
      });
    });

    describe('healthCheck', () => {
      it('should return true if healthy', async () => {
        const result = await service.healthCheck();

        expect(result).toBe(true);
      });

      it('should check cache health if available', async () => {
        await service.healthCheck();

        expect(mockCache.healthCheck).toHaveBeenCalled();
      });

      it('should return false if cache unhealthy', async () => {
        mockCache.healthCheck.mockResolvedValueOnce(false);

        const result = await service.healthCheck();

        expect(result).toBe(false);
      });
    });

    describe('dispose', () => {
      it('should clear all data structures', async () => {
        await service.follow({ userId: 'user1', targetUserId: 'user2' });
        await service.dispose();

        const stats = await service.getRelationshipStats('user1');

        expect(stats.followerCount).toBe(0);
        expect(stats.followingCount).toBe(0);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on follow operations', async () => {
      // Run sequentially so rate limit counter increments properly
      const results: (UserRelationship | Error)[] = [];
      for (let i = 0; i < 101; i++) {
        try {
          const result = await service.follow({
            userId: 'ratelimit_user',
            targetUserId: `target_rl_${i}`,
          });
          results.push(result);
        } catch (e) {
          results.push(e as Error);
        }
      }

      const rateLimitErrors = results.filter(
        (r) => r instanceof Error && r.message.includes('Rate limit exceeded')
      );

      expect(rateLimitErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user IDs', async () => {
      await expect(service.follow({ userId: '', targetUserId: 'user2' })).rejects.toThrow(
        'User IDs are required'
      );
    });

    it('should handle invalid relationship IDs', async () => {
      await expect(
        service.respondToFriendRequest({
          requestId: 'invalid-id',
          userId: 'user1',
          accepted: true,
        })
      ).rejects.toThrow('Friend request not found');
    });

    it('should log errors appropriately', async () => {
      try {
        await service.follow({ userId: 'user1', targetUserId: 'user1' });
      } catch {
        // Expected error
      }

      // Logger should have been called for debug/error
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});
