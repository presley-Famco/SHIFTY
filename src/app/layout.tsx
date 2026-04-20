import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Driver Ops MVP',
  description: 'Shift availability and daily inspection log for drivers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
