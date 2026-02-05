'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PROVIDER_LIST, type ProviderId, type ModelInfo } from '@botanswer/database';

interface Props {
  // Config de texto
  currentProvider: string | null;
  currentModel: string | null;
  hasApiKey: boolean;
  // Config de vision
  currentVisionProvider: string | null;
  currentVisionModel: string | null;
  hasVisionApiKey: boolean;
  // OAuth status
  hasAnthropicOAuth?: boolean;
  hasOpenaiOAuth?: boolean;
  // OAuth models
  anthropicOAuthModel?: string | null;
  openaiOAuthModel?: string | null;
}

// Estilos compartilhados
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
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  border: 'none',
  borderRadius: '0.375rem',
  cursor: 'pointer',
};

const sectionStyle: React.CSSProperties = {
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  marginBottom: '1rem',
};

// Modelos Claude disponiveis via OAuth
const ANTHROPIC_OAUTH_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Equilibrio entre velocidade e capacidade (Recomendado)' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Mais poderoso, ideal para tarefas complexas' },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', description: 'Mais rapido, ideal para tarefas simples' },
];

// Componente de OAuth Anthropic inline
function AnthropicOAuthSection({ hasOAuth, currentModel }: { hasOAuth: boolean; currentModel?: string }) {
  const router = useRouter();
  const [connecting, setConnecting] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectedModel, setSelectedModel] = useState(currentModel || ANTHROPIC_OAUTH_MODELS[0].id);
  const [savingModel, setSavingModel] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');

    try {
      const res = await fetch('/api/oauth/anthropic/authorize', {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Erro ao iniciar conexao');
        setConnecting(false);
        return;
      }

      // Abre a URL de autorizacao em nova aba
      window.open(data.url, '_blank');
      setShowCodeInput(true);
      setConnecting(false);
    } catch (err) {
      setError('Erro de conexao');
      setConnecting(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) {
      setError('Cole o codigo de autorizacao');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      const res = await fetch('/api/oauth/anthropic/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Erro ao conectar');
        setConnecting(false);
        return;
      }

      setShowCodeInput(false);
      setCode('');
      router.refresh();
    } catch (err) {
      setError('Erro de conexao');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError('');

    try {
      const res = await fetch('/api/oauth/anthropic', {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Erro ao desconectar');
        setDisconnecting(false);
        return;
      }

      router.refresh();
    } catch (err) {
      setError('Erro de conexao');
      setDisconnecting(false);
    }
  };

  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    setSavingModel(true);
    setError('');

    try {
      const res = await fetch('/api/oauth/anthropic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: newModel }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Erro ao salvar modelo');
        return;
      }

      router.refresh();
    } catch (err) {
      setError('Erro de conexao');
    } finally {
      setSavingModel(false);
    }
  };

  const handleCancel = () => {
    setShowCodeInput(false);
    setCode('');
    setError('');
  };

  if (hasOAuth) {
    const currentModelInfo = ANTHROPIC_OAUTH_MODELS.find(m => m.id === selectedModel);
    
    return (
      <div style={{ 
        padding: '0.75rem', 
        background: 'var(--success-background, rgba(34, 197, 94, 0.1))', 
        borderRadius: '0.375rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--success, #22c55e)' }}>
              Claude Pro/Max conectado
            </span>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              Usando sua assinatura Claude Pro/Max (custo zero)
            </p>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              ...buttonStyle,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              opacity: disconnecting ? 0.5 : 1,
            }}
          >
            {disconnecting ? 'Desconectando...' : 'Desconectar'}
          </button>
        </div>

        {/* Seletor de modelo */}
        <div style={{ marginTop: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--foreground)' }}>
            Modelo Claude
          </label>
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={savingModel}
            style={{
              ...selectStyle,
              opacity: savingModel ? 0.7 : 1,
            }}
          >
            {ANTHROPIC_OAUTH_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {currentModelInfo && (
            <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              {currentModelInfo.description}
            </p>
          )}
          {savingModel && (
            <p style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              Salvando...
            </p>
          )}
        </div>

        {error && (
          <p style={{ color: 'var(--destructive)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  if (showCodeInput) {
    return (
      <div style={{ 
        padding: '1rem', 
        background: 'var(--muted-background, rgba(0,0,0,0.05))', 
        borderRadius: '0.375rem',
        marginBottom: '1rem',
      }}>
        <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          1. Faca login no Claude e autorize o acesso
        </p>
        <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          2. Copie o codigo de autorizacao exibido
        </p>
        <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          3. Cole o codigo abaixo:
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            placeholder="Cole o codigo aqui..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }}
          />
          <button
            onClick={handleSubmitCode}
            disabled={connecting}
            style={{
              ...buttonStyle,
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              opacity: connecting ? 0.5 : 1,
            }}
          >
            {connecting ? 'Conectando...' : 'Confirmar'}
          </button>
          <button
            onClick={handleCancel}
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
        {error && (
          <p style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button
        onClick={handleConnect}
        disabled={connecting}
        style={{
          ...buttonStyle,
          background: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
          color: 'white',
          width: '100%',
          padding: '0.75rem 1rem',
          opacity: connecting ? 0.7 : 1,
        }}
      >
        {connecting ? 'Iniciando...' : 'Conectar com Claude Pro/Max'}
      </button>
      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.375rem', textAlign: 'center' }}>
        Use sua assinatura Claude Pro/Max sem custo adicional de API
      </p>
      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: '0.75rem', marginTop: '0.25rem', textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}

// Componente para configurar Texto
function TextConfigSection({
  currentProvider,
  currentModel,
  hasApiKey,
  hasAnthropicOAuth,
  anthropicOAuthModel,
}: {
  currentProvider: string | null;
  currentModel: string | null;
  hasApiKey: boolean;
  hasAnthropicOAuth: boolean;
  anthropicOAuthModel?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  
  const [provider, setProvider] = useState<ProviderId | ''>(
    (currentProvider as ProviderId) || ''
  );
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(currentModel || '');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [keyValidated, setKeyValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadModels = useCallback(async () => {
    if (!provider || !apiKey) {
      setModelsError('Selecione o provedor e insira a chave API');
      return;
    }

    setLoadingModels(true);
    setModelsError('');
    setModels([]);
    setKeyValidated(false);

    try {
      const res = await fetch('/api/providers/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await res.json();

      if (!data.success) {
        setModelsError(data.error || 'Erro ao carregar modelos');
        return;
      }

      setModels(data.models);
      setKeyValidated(true);
    } catch (err) {
      setModelsError('Erro de conexao. Tente novamente.');
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setLoadingModels(false);
    }
  }, [provider, apiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    if (!provider) {
      setError('Selecione um provedor');
      setSaving(false);
      return;
    }

    if (apiKey && !keyValidated) {
      setError('Valide a chave API antes de salvar');
      setSaving(false);
      return;
    }

    if (keyValidated && !selectedModel) {
      setError('Selecione um modelo');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: selectedModel || undefined,
          apiKey: apiKey || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      setEditing(false);
      setApiKey('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

  const providerName = currentProvider 
    ? PROVIDER_LIST.find(p => p.id === currentProvider)?.name || currentProvider
    : null;

  // Se tem OAuth Anthropic conectado, mostra como fonte primaria
  const effectiveSource = hasAnthropicOAuth ? 'oauth_anthropic' : (hasApiKey ? 'api_key' : null);

  if (!editing) {
    return (
      <div>
        {/* Secao de OAuth Anthropic */}
        <AnthropicOAuthSection hasOAuth={hasAnthropicOAuth} currentModel={anthropicOAuthModel || undefined} />

        {/* Divisor */}
        {!hasAnthropicOAuth && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            margin: '1rem 0',
            color: 'var(--muted-foreground)',
            fontSize: '0.75rem',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span>ou use chave API</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
        )}

        {/* Config de chave API */}
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem' }}>Provedor: </span>
          {providerName ? (
            <span style={{ fontWeight: 500 }}>{providerName}</span>
          ) : (
            <span style={{ color: 'var(--muted-foreground)' }}>Nao configurado</span>
          )}
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem' }}>Modelo: </span>
          {currentModel ? (
            <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {currentModel}
            </span>
          ) : (
            <span style={{ color: 'var(--muted-foreground)' }}>Nao configurado</span>
          )}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.875rem' }}>Chave API: </span>
          {hasApiKey ? (
            <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>Configurada</span>
          ) : (
            <span style={{ color: hasAnthropicOAuth ? 'var(--muted-foreground)' : 'var(--destructive)', fontSize: '0.875rem' }}>
              {hasAnthropicOAuth ? 'Nao necessaria (usando OAuth)' : 'Nao configurada'}
            </span>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          style={{
            ...buttonStyle,
            background: hasAnthropicOAuth ? 'var(--secondary)' : 'var(--primary)',
            color: hasAnthropicOAuth ? 'var(--secondary-foreground)' : 'var(--primary-foreground)',
          }}
        >
          {hasApiKey ? 'Alterar chave API' : 'Configurar chave API'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
          Provedor
        </label>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as ProviderId);
            setModels([]);
            setKeyValidated(false);
            setSelectedModel('');
          }}
          style={selectStyle}
        >
          <option value="">Selecione um provedor...</option>
          {PROVIDER_LIST.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
          Chave API
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="password"
            placeholder={hasApiKey ? '(manter atual)' : 'Cole sua chave API aqui...'}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setKeyValidated(false);
              setModels([]);
            }}
            style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }}
          />
          <button
            type="button"
            onClick={loadModels}
            disabled={!provider || !apiKey || loadingModels}
            style={{
              ...buttonStyle,
              background: keyValidated ? 'var(--success)' : 'var(--secondary)',
              color: keyValidated ? 'white' : 'var(--secondary-foreground)',
              opacity: (!provider || !apiKey || loadingModels) ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loadingModels ? 'Validando...' : keyValidated ? 'Validada' : 'Validar'}
          </button>
        </div>
        {modelsError && (
          <p style={{ color: 'var(--destructive)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {modelsError}
          </p>
        )}
        {keyValidated && (
          <p style={{ color: 'var(--success)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Chave valida! {models.length} modelos disponiveis.
          </p>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
          Modelo
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={models.length === 0 && !hasApiKey}
          style={{
            ...selectStyle,
            opacity: (models.length === 0 && !hasApiKey) ? 0.5 : 1,
          }}
        >
          <option value="">
            {models.length === 0 && !hasApiKey
              ? 'Valide a chave para carregar modelos...' 
              : 'Selecione um modelo...'}
          </option>
          {hasApiKey && models.length === 0 && currentModel && (
            <option value={currentModel}>{currentModel} (atual)</option>
          )}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}{m.contextLength ? ` (${Math.round(m.contextLength / 1000)}k ctx)` : ''}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError('');
            setModelsError('');
            setProvider((currentProvider as ProviderId) || '');
            setSelectedModel(currentModel || '');
            setApiKey('');
            setModels([]);
            setKeyValidated(false);
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

// Componente para configurar Vision
function VisionConfigSection({
  currentVisionProvider,
  currentVisionModel,
  hasVisionApiKey,
  textProvider,
  textModel,
  hasTextApiKey,
  hasAnthropicOAuth,
}: {
  currentVisionProvider: string | null;
  currentVisionModel: string | null;
  hasVisionApiKey: boolean;
  textProvider: string | null;
  textModel: string | null;
  hasTextApiKey: boolean;
  hasAnthropicOAuth: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  
  // Se nao tem config de vision, usa do texto
  const isUsingTextConfig = !currentVisionProvider && !hasVisionApiKey;
  const [useSameAsText, setUseSameAsText] = useState(isUsingTextConfig);
  
  const [provider, setProvider] = useState<ProviderId | ''>(
    (currentVisionProvider as ProviderId) || ''
  );
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(currentVisionModel || '');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [keyValidated, setKeyValidated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadModels = useCallback(async () => {
    if (!provider || !apiKey) {
      setModelsError('Selecione o provedor e insira a chave API');
      return;
    }

    setLoadingModels(true);
    setModelsError('');
    setModels([]);
    setKeyValidated(false);

    try {
      const res = await fetch('/api/providers/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await res.json();

      if (!data.success) {
        setModelsError(data.error || 'Erro ao carregar modelos');
        return;
      }

      setModels(data.models);
      setKeyValidated(true);
    } catch (err) {
      setModelsError('Erro de conexao. Tente novamente.');
      console.error('Erro ao carregar modelos:', err);
    } finally {
      setLoadingModels(false);
    }
  }, [provider, apiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let body: Record<string, unknown>;

      if (useSameAsText) {
        // Limpa config de vision para usar do texto
        body = {
          visionProvider: null,
          visionModel: null,
          visionApiKey: null,
        };
      } else {
        if (!provider) {
          setError('Selecione um provedor');
          setSaving(false);
          return;
        }

        if (apiKey && !keyValidated) {
          setError('Valide a chave API antes de salvar');
          setSaving(false);
          return;
        }

        if (keyValidated && !selectedModel) {
          setError('Selecione um modelo');
          setSaving(false);
          return;
        }

        body = {
          visionProvider: provider,
          visionModel: selectedModel || undefined,
          visionApiKey: apiKey || undefined,
        };
      }

      const res = await fetch('/api/admin/keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      setEditing(false);
      setApiKey('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

  const visionProviderName = currentVisionProvider 
    ? PROVIDER_LIST.find(p => p.id === currentVisionProvider)?.name || currentVisionProvider
    : null;

  const textProviderName = textProvider 
    ? PROVIDER_LIST.find(p => p.id === textProvider)?.name || textProvider
    : null;

  // Determina a fonte efetiva de vision
  const getVisionSource = () => {
    if (hasVisionApiKey || currentVisionProvider) {
      return 'proprio';
    }
    if (hasAnthropicOAuth) {
      return 'oauth';
    }
    if (hasTextApiKey) {
      return 'texto';
    }
    return 'nenhum';
  };

  const visionSource = getVisionSource();

  if (!editing) {
    return (
      <div>
        {isUsingTextConfig ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
            {visionSource === 'oauth' 
              ? 'Usando Claude Pro/Max (OAuth)'
              : visionSource === 'texto'
                ? `Usando mesma configuracao do texto ${textProviderName ? `(${textProviderName})` : ''}`
                : 'Nao configurado'
            }
          </p>
        ) : (
          <>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Provedor: </span>
              <span style={{ fontWeight: 500 }}>{visionProviderName}</span>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Modelo: </span>
              <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {currentVisionModel || 'Nao configurado'}
              </span>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Chave API: </span>
              <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>
                {hasVisionApiKey ? 'Propria configurada' : 'Usando do texto'}
              </span>
            </div>
          </>
        )}
        <button
          onClick={() => setEditing(true)}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          {isUsingTextConfig ? 'Configurar separado' : 'Alterar'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={useSameAsText}
            onChange={(e) => setUseSameAsText(e.target.checked)}
          />
          Usar mesma configuracao do texto
          {!hasTextApiKey && !hasAnthropicOAuth && (
            <span style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>(texto nao configurado)</span>
          )}
          {hasAnthropicOAuth && (
            <span style={{ color: 'var(--success)', fontSize: '0.75rem' }}>(OAuth)</span>
          )}
        </label>
      </div>

      {!useSameAsText && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
              Provedor
            </label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as ProviderId);
                setModels([]);
                setKeyValidated(false);
                setSelectedModel('');
              }}
              style={selectStyle}
            >
              <option value="">Selecione um provedor...</option>
              {PROVIDER_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
              Chave API
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="password"
                placeholder={hasVisionApiKey ? '(manter atual)' : 'Cole a chave API...'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setKeyValidated(false);
                  setModels([]);
                }}
                style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }}
              />
              <button
                type="button"
                onClick={loadModels}
                disabled={!provider || !apiKey || loadingModels}
                style={{
                  ...buttonStyle,
                  background: keyValidated ? 'var(--success)' : 'var(--secondary)',
                  color: keyValidated ? 'white' : 'var(--secondary-foreground)',
                  opacity: (!provider || !apiKey || loadingModels) ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {loadingModels ? 'Validando...' : keyValidated ? 'Validada' : 'Validar'}
              </button>
            </div>
            {modelsError && (
              <p style={{ color: 'var(--destructive)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {modelsError}
              </p>
            )}
            {keyValidated && (
              <p style={{ color: 'var(--success)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Chave valida! {models.length} modelos disponiveis.
              </p>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
              Modelo
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={models.length === 0 && !hasVisionApiKey}
              style={{
                ...selectStyle,
                opacity: (models.length === 0 && !hasVisionApiKey) ? 0.5 : 1,
              }}
            >
              <option value="">
                {models.length === 0 && !hasVisionApiKey
                  ? 'Valide a chave para carregar modelos...' 
                  : 'Selecione um modelo...'}
              </option>
              {hasVisionApiKey && models.length === 0 && currentVisionModel && (
                <option value={currentVisionModel}>{currentVisionModel} (atual)</option>
              )}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.contextLength ? ` (${Math.round(m.contextLength / 1000)}k ctx)` : ''}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {error && (
        <p style={{ color: 'var(--destructive)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError('');
            setModelsError('');
            setUseSameAsText(isUsingTextConfig);
            setProvider((currentVisionProvider as ProviderId) || '');
            setSelectedModel(currentVisionModel || '');
            setApiKey('');
            setModels([]);
            setKeyValidated(false);
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

// Componente principal que agrupa as secoes
export function DefaultKeysForm({ 
  currentProvider, 
  currentModel,
  hasApiKey,
  currentVisionProvider,
  currentVisionModel,
  hasVisionApiKey,
  hasAnthropicOAuth = false,
  hasOpenaiOAuth = false,
  anthropicOAuthModel,
  openaiOAuthModel,
}: Props) {
  return (
    <div>
      {/* Secao de Texto */}
      <div style={sectionStyle}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>
          Configuracao para Texto
        </h4>
        <TextConfigSection
          currentProvider={currentProvider}
          currentModel={currentModel}
          hasApiKey={hasApiKey}
          hasAnthropicOAuth={hasAnthropicOAuth}
          anthropicOAuthModel={anthropicOAuthModel}
        />
      </div>

      {/* Secao de Vision */}
      <div style={sectionStyle}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>
          Configuracao para Vision (Imagens/Videos)
        </h4>
        <VisionConfigSection
          currentVisionProvider={currentVisionProvider}
          currentVisionModel={currentVisionModel}
          hasVisionApiKey={hasVisionApiKey}
          textProvider={currentProvider}
          textModel={currentModel}
          hasTextApiKey={hasApiKey}
          hasAnthropicOAuth={hasAnthropicOAuth}
        />
      </div>
    </div>
  );
}
