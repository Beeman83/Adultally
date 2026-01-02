import type { Metadata } from 'next';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './globals.css';

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;

export const metadata: Metadata = {
  title: 'AdultAlly - AI Companions for 18+',
  description: 'Professional AI companion chat for adults. 5 unique personas, multi-language support.',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#007bff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#007bff" />
        <meta name="description" content="AdultAlly - Professional AI Companion Chat" />
      </head>
      <body className="bg-gray-50">
        <GoogleOAuthProvider clientId={clientId}>
          {children}
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
