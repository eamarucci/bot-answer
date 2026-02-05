'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'code';

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const formatPhone = (value: string) => {
    // Remove tudo que nao for numero
    const numbers = value.replace(/\D/g, '');
    return numbers;
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar codigo');
      }

      setGeneratedCode(data.code);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const checkConfirmation = useCallback(async () => {
    if (!phone || !generatedCode || checking) return;

    setChecking(true);
    try {
      const res = await fetch('/api/auth/check-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, code: generatedCode }),
      });

      const data = await res.json();

      if (res.ok && data.confirmed) {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      // Ignora erros silenciosamente no polling
    } finally {
      setChecking(false);
    }
  }, [phone, generatedCode, checking, router]);

  // Polling para verificar se o codigo foi confirmado
  useEffect(() => {
    if (step !== 'code' || !generatedCode) return;

    const interval = setInterval(checkConfirmation, 3000);
    return () => clearInterval(interval);
  }, [step, generatedCode, checkConfirmation]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    background: 'var(--background)',
    color: 'var(--foreground)',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '0.5rem',
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
  };

  const codeBoxStyle: React.CSSProperties = {
    padding: '1.5rem',
    background: 'var(--muted)',
    borderRadius: '0.5rem',
    textAlign: 'center',
    marginBottom: '1.5rem',
  };

  if (step === 'code') {
    return (
      <div>
        <div style={codeBoxStyle}>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>
            Seu codigo de verificacao:
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '0.25em', fontFamily: 'monospace' }}>
            {generatedCode}
          </p>
        </div>

        <div style={{ 
          padding: '1rem', 
          background: 'var(--muted)', 
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
        }}>
          <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
            Para confirmar, envie no WhatsApp:
          </p>
          <p style={{ 
            fontFamily: 'monospace', 
            background: 'var(--background)', 
            padding: '0.5rem 0.75rem',
            borderRadius: '0.25rem',
            wordBreak: 'break-all',
          }}>
            /ia -confirmar {generatedCode}
          </p>
          <p style={{ color: 'var(--muted-foreground)', marginTop: '0.75rem', fontSize: '0.75rem' }}>
            Digite este comando em qualquer grupo onde voce seja o relay.
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '0.5rem',
          color: 'var(--muted-foreground)',
          fontSize: '0.875rem',
          marginBottom: '1rem',
        }}>
          {checking ? (
            <>
              <span style={{ 
                width: '0.75rem', 
                height: '0.75rem', 
                borderRadius: '50%',
                border: '2px solid var(--muted-foreground)',
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite',
              }} />
              Verificando...
            </>
          ) : (
            'Aguardando confirmacao...'
          )}
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        {error && (
          <p style={{ color: 'var(--destructive)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={checkConfirmation}
          disabled={checking}
          style={buttonStyle}
        >
          {checking ? 'Verificando...' : 'Ja confirmei'}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setGeneratedCode('');
            setError('');
          }}
          style={{
            width: '100%',
            marginTop: '0.75rem',
            padding: '0.5rem',
            fontSize: '0.875rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
          }}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleRequestCode}>
      <div style={{ marginBottom: '1rem' }}>
        <label
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 500,
            marginBottom: '0.5rem',
          }}
        >
          Numero do WhatsApp (relay)
        </label>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="5512999999999"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          style={inputStyle}
          autoFocus
        />
      </div>

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={loading || phone.length < 10} style={buttonStyle}>
        {loading ? 'Gerando...' : 'Gerar codigo'}
      </button>
    </form>
  );
}
