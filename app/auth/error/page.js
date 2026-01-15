"use client";

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');

  const errorMessages = {
    'Configuration': 'There is a problem with the server configuration. Please contact support.',
    'AccessDenied': 'Access was denied. You may have cancelled the login or don\'t have permission.',
    'Verification': 'The verification link has expired or has already been used.',
    'OAuthSignin': 'Error starting the OAuth sign-in process. Please try again.',
    'OAuthCallback': 'Error completing the OAuth sign-in. Please try again.',
    'OAuthCreateAccount': 'Could not create an account using this provider.',
    'EmailCreateAccount': 'Could not create an account with this email.',
    'Callback': 'There was an error during the authentication callback.',
    'OAuthAccountNotLinked': 'This email is already associated with another account. Please sign in with your original provider.',
    'default': 'An authentication error occurred. Please try again.'
  };

  const message = errorMessages[error] || errorMessages['default'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Authentication Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{message}</p>
          {error && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Error code: {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => router.push('/')} className="flex-1">
              Back to Home
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
