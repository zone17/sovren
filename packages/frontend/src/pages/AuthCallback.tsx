/**
 * Auth Callback — handles Supabase email confirmation redirects.
 *
 * Supabase appends tokens as URL hash fragments after email confirmation.
 * This page extracts the session and redirects to /profile on success.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Spinner } from '../components/ui/spinner';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async (): Promise<void> => {
      try {
        // Supabase JS client automatically picks up the token from the URL hash
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (data.session) {
          // Email confirmed and session active — redirect to profile
          navigate('/profile', { replace: true });
        } else {
          setError(
            'Email confirmation failed. Please try again or request a new confirmation link.'
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication callback failed');
      }
    };

    void handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='glass p-8 rounded-lg shadow-lg max-w-md text-center'>
          <h2 className='text-xl font-bold text-red-400 mb-4'>Confirmation Failed</h2>
          <p className='text-sm text-muted-foreground mb-6'>{error}</p>
          <a
            href='/login'
            className='text-purple-400 hover:text-purple-300 font-medium transition-colors duration-150'
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background flex items-center justify-center'>
      <div className='text-center'>
        <Spinner size='lg' className='mb-4' />
        <p className='text-sm text-muted-foreground'>Confirming your email...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
