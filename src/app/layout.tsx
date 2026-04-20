import './globals.css';
import type { Metadata } from 'next';
import { SITE_URL } from '@/config/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'SHIFTY',
  description: 'Shift availability and daily inspection log for drivers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
