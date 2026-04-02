/**
 * User API Controller
 *
 * Handles HTTP requests for user-related operations
 * Integrates with User Services via DI container
 */

import { Request, Response } from 'express';
import {
  UserProfileService,
  UserPreferencesService,
  UserActivityService,
  UserRelationshipService,
  UserAnalyticsService,
} from '../../services/user';
import { asyncHandler } from '../../middleware/error-handler-middleware';
import { createApiResponse } from '../../utils/api-response';
import { getAuthUser } from '../../middleware/auth';

export class UserController {
  constructor(
    private profileService: UserProfileService,
    private preferencesService: UserPreferencesService,
    private activityService: UserActivityService,
    private relationshipService: UserRelationshipService,
    private analyticsService: UserAnalyticsService
  ) {}

  public getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;
    const profile = await this.profileService.getProfile(userId);

    res.status(200).json(createApiResponse(req, profile, startTime));
  });

  public updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;
    const updates = req.body.profile;

    const updated = await this.profileService.updateProfile(userId, updates);
    res.status(200).json(createApiResponse(req, updated, startTime));
  });

  public getPreferences = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;
    const preferences = await this.preferencesService.getPreferences(userId);

    res.status(200).json(createApiResponse(req, preferences, startTime));
  });

  public updatePreferences = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;
    const updates = req.body.preferences;

    const updated = await this.preferencesService.updatePreferences({ userId, ...updates });
    res.status(200).json(createApiResponse(req, updated, startTime));
  });

  public getActivity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;
    const activity = await this.activityService.getActivityFeed({
      userId,
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
    });

    res.status(200).json(createApiResponse(req, activity, startTime));
  });

  public followUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const { followerId, followingId } = req.body;

    const result = await this.relationshipService.follow({
      userId: followerId,
      targetUserId: followingId,
    });
    res.status(201).json(createApiResponse(req, result, startTime));
  });

  public unfollowUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const { followerId, followingId } = req.body;

    const result = await this.relationshipService.unfollow({
      userId: followerId,
      targetUserId: followingId,
    });
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public getUserAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const analytics = await this.analyticsService.queryAnalytics({
      timeRange: {
        startDate: req.query.start
          ? new Date(req.query.start as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: req.query.end ? new Date(req.query.end as string) : new Date(),
      },
    });

    res.status(200).json(createApiResponse(req, analytics, startTime));
  });

  // === User Relationship API (Todo 119) ===

  public blockUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const targetId = req.params.id;
    const userId = getAuthUser(req).nostr_pubkey;

    const result = await this.relationshipService.block({ userId, targetUserId: targetId });
    res.status(201).json(createApiResponse(req, result, startTime));
  });

  public unblockUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const targetId = req.params.id;
    const userId = getAuthUser(req).nostr_pubkey;

    const result = await this.relationshipService.unblock({ userId, targetUserId: targetId });
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public muteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const targetId = req.params.id;
    const userId = getAuthUser(req).nostr_pubkey;

    const result = await this.relationshipService.mute({ userId, targetUserId: targetId });
    res.status(201).json(createApiResponse(req, result, startTime));
  });

  public unmuteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const targetId = req.params.id;
    const userId = getAuthUser(req).nostr_pubkey;

    const result = await this.relationshipService.unmute({ userId, targetUserId: targetId });
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public getFollowers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const result = await this.relationshipService.getFollowers(userId, { offset, limit });
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public getFollowing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const result = await this.relationshipService.getFollowing(userId, { offset, limit });
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public getBlockedUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;

    const result = await this.relationshipService.getBlockedUsers(userId);
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public getRelationshipStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;

    const result = await this.relationshipService.getRelationshipStats(userId);
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public sendFriendRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const targetId = req.params.id;
    const userId = getAuthUser(req).nostr_pubkey;

    const result = await this.relationshipService.sendFriendRequest({
      userId,
      targetId,
      ...req.body,
    });
    res.status(201).json(createApiResponse(req, result, startTime));
  });

  public respondToFriendRequest = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const startTime = Date.now();
      const targetId = req.params.id;
      const userId = getAuthUser(req).nostr_pubkey;

      const result = await this.relationshipService.respondToFriendRequest({
        userId,
        targetId,
        ...req.body,
      });
      res.status(200).json(createApiResponse(req, result, startTime));
    }
  );

  public getRecommendations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;

    const result = await this.relationshipService.getRecommendations(userId);
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public exportRelationships = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;

    const result = await this.relationshipService.exportRelationships(userId);
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public importFollows = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const userId = req.params.id;

    const result = await this.relationshipService.importFollows({ userId, ...req.body });
    res.status(200).json(createApiResponse(req, result, startTime));
  });

  public updatePrivacySettings = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const startTime = Date.now();
      const userId = req.params.id;

      const result = await this.relationshipService.updatePrivacySettings(userId, req.body);
      res.status(200).json(createApiResponse(req, result, startTime));
    }
  );
}
