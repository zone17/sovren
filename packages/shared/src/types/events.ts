/**
 * Community event payload types for domain event bus (Slice 8)
 */

export type CommunityEventPayload =
  | { type: 'new_follower'; followerId: string; followingId: string }
  | { type: 'new_comment'; contentId: string; authorId: string; commentId: string }
  | {
      type: 'mentorship_request';
      mentorId: string;
      menteeId: string;
      mentorshipId: string;
    }
  | {
      type: 'mentorship_accepted';
      mentorId: string;
      menteeId: string;
      mentorshipId: string;
    }
  | {
      type: 'mentorship_declined';
      mentorId: string;
      menteeId: string;
      mentorshipId: string;
    }
  | { type: 'circle_join'; circleId: string; memberId: string; adminId: string }
  | {
      type: 'circle_post';
      circleId: string;
      authorId: string;
      memberIds: string[];
      postId: string;
    };
