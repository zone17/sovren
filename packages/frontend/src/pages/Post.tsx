import React from 'react';
import { useParams } from 'react-router-dom';
import { Button, Layout } from '../components';
import { useAppSelector } from '../store';

const Post: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAppSelector((state) => state.user);
  const post = useAppSelector((state) => (state as any).post.posts.find((p: any) => p.id === id));

  if (!post) {
    return (
      <Layout>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground font-display">Post not found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <article className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl font-display">
            {post.title}
          </h1>
          <div className="mt-4 flex items-center text-sm text-muted-foreground">
            <span>By {post.author_id}</span>
            <span className="mx-2">•</span>
            <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString()}</time>
          </div>
        </header>

        <div className="prose prose-purple max-w-none">
          <p>{post.content}</p>
        </div>

        {currentUser && (
          <div className="mt-8 flex justify-end space-x-4">
            <Button
              variant="default"
              className="bg-gradient-to-r from-violet-600 to-purple-600 shadow-[0_4px_16px_rgba(139,92,246,0.3)] text-white transition-all duration-150"
              onClick={() => {
                // TODO: Implement payment
              }}
            >
              Support Creator
            </Button>
          </div>
        )}

        <div className="mt-12 border-t border-border pt-8">
          <h2 className="text-2xl font-bold text-foreground font-display">Comments</h2>
          <div className="mt-6 space-y-6">
            {/* TODO: Implement comments */}
            <p className="text-muted-foreground">Comments coming soon...</p>
          </div>
        </div>
      </article>
    </Layout>
  );
};

export default Post;
