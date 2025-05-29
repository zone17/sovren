import React from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '../store';
import Layout from '../components/Layout';
import Button from '../components/Button';

const Post: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAppSelector((state) => state.user);
  const post = useAppSelector((state) => state.post.posts.find((p) => p.id === id));

  if (!post) {
    return (
      <Layout>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Post not found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <article className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{post.title}</h1>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>By {post.author_id}</span>
            <span className="mx-2">•</span>
            <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString()}</time>
          </div>
        </header>

        <div className="prose prose-blue max-w-none">
          <p>{post.content}</p>
        </div>

        {currentUser && (
          <div className="mt-8 flex justify-end space-x-4">
            <Button
              variant="primary"
              onClick={() => {
                // TODO: Implement payment
              }}
            >
              Support Creator
            </Button>
          </div>
        )}

        <div className="mt-12 border-t border-gray-200 pt-8">
          <h2 className="text-2xl font-bold text-gray-900">Comments</h2>
          <div className="mt-6 space-y-6">
            {/* TODO: Implement comments */}
            <p className="text-gray-500">Comments coming soon...</p>
          </div>
        </div>
      </article>
    </Layout>
  );
};

export default Post;
