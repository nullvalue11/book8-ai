"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import jwt from 'jsonwebtoken';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing your login...');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        // Fetch the session from NextAuth
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        
        console.log('[OAuth Callback] Session:', session);

        if (session && session.user) {
          // Session exists, now generate our custom JWT token
          setStatus('Creating your session...');
          
          // Fetch user from our API to get the proper user object
          const userRes = await fetch('/api/auth/oauth-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: session.user.email,
              name: session.user.name,
              provider: session.provider
            })
          });
          
          const userData = await userRes.json();
          
          if (userData.ok && userData.token) {
            // Store our custom JWT token (same as regular login)
            localStorage.setItem('book8_token', userData.token);
            localStorage.setItem('book8_user', JSON.stringify(userData.user));
            
            setStatus('Success! Redirecting to dashboard...');
            
            // Redirect to dashboard
            setTimeout(() => {
              router.push('/dashboard');
            }, 500);
          } else {
            throw new Error(userData.error || 'Failed to sync OAuth user');
          }
        } else {
          // No session, redirect back to login
          setError('No session found. Please try again.');
          setTimeout(() => {
            router.push('/');
          }, 2000);
        }
      } catch (err) {
        console.error('[OAuth Callback] Error:', err);
        setError(err.message || 'An error occurred during login');
        setTimeout(() => {
          router.push('/?error=oauth_failed');
        }, 2000);
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 max-w-md">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Login Failed</h2>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-sm text-muted-foreground mt-4">Redirecting you back...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Signing you in</h2>
            <p className="text-muted-foreground">{status}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
