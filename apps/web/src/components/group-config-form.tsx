'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  groupId: string;
  hasApiKey: boolean;
  hasVisionApiKey: boolean;
  model: string;
  systemPrompt: string;
  allowAll: boolean;
  hasDefaultKey: boolean;
}

const MODELS = [
  { value: 'auto', label: 'Auto (recomendado)' },
  { value: 'deepseek', label: 'DeepSeek R1' },
  { value: 'llama', label: 'Llama 3.3 70B' },
  { value: 'vision', label: 'Vision (imagens)' },
];

export function GroupConfigForm({
  groupId,
  hasApiKey,
  hasVisionApiKey,
  model: initialModel,
  systemPrompt: initialPrompt,
  allowAll: initialAllowAll,
  hasDefaultKey,
}: Props) {
  const router = useRouter();
  const [useCustomKey, setUseCustomKey] = useState(hasApiKey);
  const [apiKey, setApiKey] = useState('');
  const [visionApiKey, setVisionApiKey] = useState('');
  const [sameKey, setSameKey] = useState(!hasVisionApiKey);
  const [model, setModel] = useState(initialModel);
  const [systemPrompt, setSystemPrompt] = useState(initialPrompt);
  const [allowAll, setAllowAll] = useState(initialAllowAll);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        model,
        systemPrompt: systemPrompt || null,
        allowAll,
      };

      if (useCustomKey) {
        if (apiKey) {
          body.apiKey = apiKey;
        }
        if (!sameKey && visionApiKey) {
          body.visionApiKey = visionApiKey;
        } else if (sameKey) {
          body.visionApiKey = null;
        }
      } else {
        // Usar chaves padrao do admin
        body.apiKey = null;
        body.visionApiKey = null;
      }

      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      setSuccess(true);
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
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Chaves API */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          Chaves API OpenRouter
        </h3>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
            <input
              type="radio"
              name="keyType"
              checked={!useCustomKey}
              onChange={() => setUseCustomKey(false)}
            />
            Usar minhas chaves padrao
            {!hasDefaultKey && (
              <span style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>(nao configurada)</span>
            )}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="keyType"
              checked={useCustomKey}
              onChange={() => setUseCustomKey(true)}
            />
            Usar chaves especificas para este grupo
            {hasApiKey && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>(configurada)</span>}
          </label>
        </div>

        {useCustomKey && (
          <div style={{ paddingLeft: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                Chave para texto
              </label>
              <input
                type="password"
                placeholder={hasApiKey ? '(manter atual)' : 'sk-or-v1-...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
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
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                  Chave para vision
                </label>
                <input
                  type="password"
                  placeholder={hasVisionApiKey ? '(manter atual)' : 'sk-or-v1-...'}
                  value={visionApiKey}
                  onChange={(e) => setVisionApiKey(e.target.value)}
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modelo */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Modelo Padrao
        </label>
        <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle}>
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* System Prompt */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          System Prompt (opcional)
        </label>
        <textarea
          placeholder="Voce é um especialista em..."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
          Contexto adicional para o modelo. Tambem pode ser alterado via /ia -prompt no grupo.
        </p>
      </div>

      {/* Controle de Acesso */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Controle de Acesso
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
          <input
            type="radio"
            name="access"
            checked={allowAll}
            onChange={() => setAllowAll(true)}
          />
          Todos podem usar
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input
            type="radio"
            name="access"
            checked={!allowAll}
            onChange={() => setAllowAll(false)}
          />
          Apenas usuarios habilitados
        </label>
      </div>

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      {success && (
        <p style={{ color: 'var(--success)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Configuracoes salvas com sucesso!
        </p>
      )}

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
        {loading ? 'Salvando...' : 'Salvar configuracoes'}
      </button>
    </form>
  );
}
