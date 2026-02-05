import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from '@/components/login-form';

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            BotAnswer Admin
          </h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
            Gerencie suas chaves API e usuarios
          </p>
        </div>

        <LoginForm />

        <p
          style={{
            marginTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'var(--muted-foreground)',
            textAlign: 'center',
          }}
        >
          Voce precisa ser o relay de pelo menos um grupo para acessar.
        </p>
      </div>
    </main>
  );
}
