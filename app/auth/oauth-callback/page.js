"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Processing your login...');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function handleOAuthCallback() {
      try {
        // Step 1: Get the NextAuth session
        console.log('[OAuth Callback] Fetching NextAuth session...');
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        
        console.log('[OAuth Callback] Session:', session);

        if (session && session.user && session.user.email) {
          setStatus('Creating your session...');
          
          // Step 2: Sync the NextAuth session with our custom JWT system
          console.log('[OAuth Callback] Syncing to custom JWT...');
          const syncRes = await fetch('/api/credentials/oauth-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: session.user.email,
              name: session.user.name || '',
              provider: session.provider || 'oauth'
            })
          });
          
          const syncData = await syncRes.json();
          console.log('[OAuth Callback] Sync response:', syncData);
          
          if (syncData.ok && syncData.token) {
            // Step 3: Store the JWT token in localStorage
            localStorage.setItem('book8_token', syncData.token);
            localStorage.setItem('book8_user', JSON.stringify(syncData.user));
            
            setStatus('Success! Redirecting to dashboard...');
            
            // Step 4: Redirect to dashboard
            setTimeout(() => {
              router.replace('/dashboard');
            }, 500);
          } else {
            throw new Error(syncData.error || 'Failed to sync OAuth session');
          }
        } else {
          // No session found - redirect back to home with error
          console.error('[OAuth Callback] No session found');
          setError('No session found. Please try signing in again.');
          setTimeout(() => {
            router.replace('/?error=oauth_no_session');
          }, 2000);
        }
      } catch (err) {
        console.error('[OAuth Callback] Error:', err);
        setError(err.message || 'An error occurred during login');
        setTimeout(() => {
          router.replace('/?error=oauth_failed');
        }, 2000);
      }
    }

    handleOAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center p-8 max-w-md">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Login Failed</h2>
            <p className="text-zinc-400">{error}</p>
            <p className="text-sm text-zinc-500 mt-4">Redirecting you back...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Signing you in</h2>
            <p className="text-zinc-400">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}
