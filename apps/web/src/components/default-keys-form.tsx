'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  hasApiKey: boolean;
  hasVisionApiKey: boolean;
}

export function DefaultKeysForm({ hasApiKey, hasVisionApiKey }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [visionApiKey, setVisionApiKey] = useState('');
  const [sameKey, setSameKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          visionApiKey: sameKey ? undefined : visionApiKey || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      setEditing(false);
      setApiKey('');
      setVisionApiKey('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    background: 'var(--background)',
    color: 'var(--foreground)',
    fontFamily: 'monospace',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
  };

  if (!editing) {
    return (
      <div>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem' }}>Chave para texto: </span>
          {hasApiKey ? (
            <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>Configurada</span>
          ) : (
            <span style={{ color: 'var(--destructive)', fontSize: '0.875rem' }}>Nao configurada</span>
          )}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.875rem' }}>Chave para vision: </span>
          {hasVisionApiKey ? (
            <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>Configurada (propria)</span>
          ) : hasApiKey ? (
            <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Usando mesma do texto</span>
          ) : (
            <span style={{ color: 'var(--destructive)', fontSize: '0.875rem' }}>Nao configurada</span>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          {hasApiKey ? 'Alterar chaves' : 'Configurar chaves'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
          Chave API para texto
        </label>
        <input
          type="password"
          placeholder="sk-or-v1-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={inputStyle}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
          Deixe em branco para manter a atual
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={sameKey}
            onChange={(e) => setSameKey(e.target.checked)}
          />
          Usar mesma chave para vision
        </label>
      </div>

      {!sameKey && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
            Chave API para vision
          </label>
          <input
            type="password"
            placeholder="sk-or-v1-..."
            value={visionApiKey}
            onChange={(e) => setVisionApiKey(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError('');
          }}
          style={{
            ...buttonStyle,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
