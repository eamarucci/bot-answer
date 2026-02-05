import { redirect } from 'next/navigation';
import { getSession, clearSession } from '@/lib/auth';

async function logout() {
  'use server';
  await clearSession();
  redirect('/');
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <header
        style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>BotAnswer</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {session.phoneNumber}
          </span>
          <form action={logout}>
            <button
              type="submit"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {children}
      </main>
    </div>
  );
}
