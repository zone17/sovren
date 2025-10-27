/**
 * User API Controller
 *
 * Handles HTTP requests for user-related operations
 * Integrates with User Services via DI container
 */

import { Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../container/types';
import {
  UserProfileService,
  UserPreferencesService,
  UserActivityService,
  UserRelationshipService,
  UserAnalyticsService,
} from '../../services/user';
import { asyncHandler, NotFoundError } from '../../middleware/error-handler-middleware';
import * as DTOs from '../../dtos/user';

@injectable()
export class UserController {
  constructor(
    @inject(TYPES.UserProfileService) private profileService: UserProfileService,
    @inject(TYPES.UserPreferencesService) private preferencesService: UserPreferencesService,
    @inject(TYPES.UserActivityService) private activityService: UserActivityService,
    @inject(TYPES.UserRelationshipService) private relationshipService: UserRelationshipService,
    @inject(TYPES.UserAnalyticsService) private analyticsService: UserAnalyticsService
  ) {}

  public getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;
    const profile = await this.profileService.getProfile(userId);

    res.status(200).json({ success: true, data: profile });
  });

  public updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;
    const updates = req.body.profile;

    const updated = await this.profileService.updateProfile(userId, updates);
    res.status(200).json({ success: true, data: updated });
  });

  public getPreferences = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;
    const preferences = await this.preferencesService.getPreferences(userId);

    res.status(200).json({ success: true, data: preferences });
  });

  public updatePreferences = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;
    const updates = req.body.preferences;

    const updated = await this.preferencesService.updatePreferences(userId, updates);
    res.status(200).json({ success: true, data: updated });
  });

  public getActivity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;
    const activity = await this.activityService.getUserActivity(userId, {
      limit: parseInt(req.query.limit as string) || 20,
      offset: parseInt(req.query.offset as string) || 0,
    });

    res.status(200).json({ success: true, data: activity });
  });

  public followUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { followerId, followingId } = req.body;

    const result = await this.relationshipService.followUser(followerId, followingId);
    res.status(201).json({ success: true, data: result });
  });

  public unfollowUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { followerId, followingId } = req.body;

    const result = await this.relationshipService.unfollowUser(followerId, followingId);
    res.status(200).json({ success: true, data: result });
  });

  public getUserAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.id;
    const analytics = await this.analyticsService.getUserAnalytics(userId, {
      startDate: req.query.start ? new Date(req.query.start as string) : undefined,
      endDate: req.query.end ? new Date(req.query.end as string) : undefined,
    });

    res.status(200).json({ success: true, data: analytics });
  });
}
