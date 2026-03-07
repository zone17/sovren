/**
 * FollowButton component
 * Slice 8: Creator Network + Notifications
 *
 * Optimistic toggle with double-submit prevention and error rollback.
 */

import { useRef, type FC } from 'react';
import { useIsFollowing, useFollowMutation, useUnfollowMutation } from '../hooks/useFollow';

interface FollowButtonProps {
  userId: string;
  className?: string;
}

const FollowButton: FC<FollowButtonProps> = ({ userId, className = '' }) => {
  const { data: isFollowing, isLoading: isCheckingFollow } = useIsFollowing(userId);
  const followMutation = useFollowMutation(userId);
  const unfollowMutation = useUnfollowMutation(userId);
  const inFlightRef = useRef(false);

  const isMutating = followMutation.isPending || unfollowMutation.isPending;
  const isDisabled = isCheckingFollow || isMutating;

  const handleClick = () => {
    if (inFlightRef.current || isMutating) return;
    inFlightRef.current = true;

    if (isFollowing) {
      unfollowMutation.mutate(undefined, {
        onSettled: () => {
          inFlightRef.current = false;
        },
      });
    } else {
      followMutation.mutate(undefined, {
        onError: (err: Error) => {
          // 409 duplicate follow: toast, not crash
          if ('status' in err && (err as { status: number }).status === 409) {
            return;
          }
        },
        onSettled: () => {
          inFlightRef.current = false;
        },
      });
    }
  };

  const label = isFollowing ? 'Unfollow' : 'Follow';

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={isMutating}
      aria-label={label}
      className={[
        'rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
        isFollowing
          ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          : 'bg-indigo-600 text-white hover:bg-indigo-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
    >
      {isMutating ? (isFollowing ? 'Unfollowing...' : 'Following...') : label}
    </button>
  );
};

export default FollowButton;
