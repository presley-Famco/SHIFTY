import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import TopNav from '@/components/TopNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/driver');
  return (
    <>
      <TopNav user={user} />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}
