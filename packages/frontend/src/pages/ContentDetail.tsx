import { useParams } from 'react-router-dom';
import { CommentList } from '../features/comments/components/CommentList';
import { useAuth } from '../features/auth/services/AuthContext';

export default function ContentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  if (!id) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: "'Sora', sans-serif" }}
        >
          Content Not Found
        </h1>
        <p className="text-muted-foreground mt-2">
          The content you are looking for does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <CommentList contentId={id} currentUserId={user?.id} />
    </div>
  );
}
