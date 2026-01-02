'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

export default function LoginPage() {
  const router = useRouter();

  const handleSuccess = async (credentialResponse: any) => {
    try {
      const token = credentialResponse.credential;
      const decoded = jwtDecode<any>(token);

      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">AdultAlly</h1>
          <p className="text-gray-600">AI Companions for Adults (18+)</p>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
          <p className="text-sm text-blue-900">
            Connect with AI personas designed for meaningful conversations. 5 unique companions await.
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <GoogleLogin onSuccess={handleSuccess} onError={() => console.error('Login failed')} />
        </div>

        <div className="text-xs text-gray-500 text-center">
          By signing in, you agree to our Terms of Service and confirm you are 18+
        </div>
      </div>
    </div>
  );
}