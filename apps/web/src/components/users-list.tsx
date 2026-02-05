'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  phoneNumber: string;
  displayName: string | null;
  isEnabled: boolean;
}

interface Props {
  groupId: string;
  users: User[];
}

export function UsersList({ groupId, users }: Props) {
  const router = useRouter();
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: newPhone.replace(/\D/g, '') }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao adicionar');
      }

      setNewPhone('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (userId: string, enable: boolean) => {
    setActionLoading(userId);

    try {
      const res = await fetch(`/api/groups/${groupId}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: enable }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao atualizar');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remover este usuario?')) return;

    setActionLoading(userId);

    try {
      const res = await fetch(`/api/groups/${groupId}/users/${userId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao remover');
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setActionLoading(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    background: 'var(--background)',
    color: 'var(--foreground)',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
  };

  return (
    <div>
      {/* Lista de usuarios */}
      {users.length === 0 ? (
        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Nenhum usuario habilitado. Adicione usuarios abaixo.
        </p>
      ) : (
        <div style={{ marginBottom: '1.5rem' }}>
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>
                  {user.phoneNumber}
                </span>
                {user.displayName && (
                  <span style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginLeft: '0.5rem' }}>
                    ({user.displayName})
                  </span>
                )}
                {!user.isEnabled && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--destructive)', marginLeft: '0.5rem' }}>
                    Desativado
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {user.isEnabled ? (
                  <button
                    onClick={() => handleToggle(user.id, false)}
                    disabled={actionLoading === user.id}
                    style={{
                      ...buttonStyle,
                      background: 'var(--muted)',
                      color: 'var(--foreground)',
                    }}
                  >
                    Desativar
                  </button>
                ) : (
                  <button
                    onClick={() => handleToggle(user.id, true)}
                    disabled={actionLoading === user.id}
                    style={{
                      ...buttonStyle,
                      background: 'var(--success)',
                      color: 'white',
                    }}
                  >
                    Ativar
                  </button>
                )}
                <button
                  onClick={() => handleRemove(user.id)}
                  disabled={actionLoading === user.id}
                  style={{
                    ...buttonStyle,
                    background: 'var(--destructive)',
                    color: 'white',
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar usuario */}
      <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '0.75rem' }}>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="5512999999999"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={loading || !newPhone.trim()}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '...' : 'Adicionar'}
        </button>
      </form>

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: '0.875rem', marginTop: '0.75rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}
