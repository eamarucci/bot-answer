'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PROVIDER_LIST, type ProviderId, type ModelInfo } from '@botanswer/database';

interface Props {
  groupId: string;
  // Config atual do grupo - texto
  currentProvider: string | null;
  currentModel: string;
  hasApiKey: boolean;
  // Config atual do grupo - vision
  currentVisionProvider: string | null;
  currentVisionModel: string | null;
  hasVisionApiKey: boolean;
  // Outros
  systemPrompt: string;
  allowAll: boolean;
  // Config do admin (para mostrar quando herda)
  adminProvider: string | null;
  adminModel: string | null;
  adminVisionProvider: string | null;
  adminVisionModel: string | null;
  hasAdminKey: boolean;
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

// Componente para configurar Texto do grupo
function TextConfigSection({
  groupId,
  currentProvider,
  currentModel,
  hasApiKey,
  adminProvider,
  adminModel,
  hasAdminKey,
}: {
  groupId: string;
  currentProvider: string | null;
  currentModel: string;
  hasApiKey: boolean;
  adminProvider: string | null;
  adminModel: string | null;
  hasAdminKey: boolean;
}) {
  const router = useRouter();
  const hasOwnConfig = !!currentProvider || hasApiKey;
  const [editing, setEditing] = useState(false);
  const [useOwnConfig, setUseOwnConfig] = useState(hasOwnConfig);
  
  const [provider, setProvider] = useState<ProviderId | ''>(
    (currentProvider as ProviderId) || ''
  );
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(currentModel);
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

      if (!useOwnConfig) {
        // Usar config do admin (limpa config propria de texto)
        body = {
          provider: null,
          model: 'auto',
          apiKey: null,
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
          provider,
          model: selectedModel || currentModel,
          apiKey: apiKey || undefined,
        };
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

      setEditing(false);
      setApiKey('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

  const adminProviderName = adminProvider 
    ? PROVIDER_LIST.find(p => p.id === adminProvider)?.name || adminProvider
    : null;

  const currentProviderName = currentProvider 
    ? PROVIDER_LIST.find(p => p.id === currentProvider)?.name || currentProvider
    : null;

  if (!editing) {
    return (
      <div>
        {hasOwnConfig ? (
          <>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Provedor: </span>
              <span style={{ fontWeight: 500 }}>{currentProviderName}</span>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Modelo: </span>
              <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {currentModel}
              </span>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Chave API: </span>
              <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>Configurada</span>
            </div>
          </>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
            Usando configuracao padrao do admin
            {adminProviderName && ` (${adminProviderName} / ${adminModel || 'auto'})`}
            {!hasAdminKey && (
              <span style={{ color: 'var(--destructive)', display: 'block', marginTop: '0.25rem' }}>
                Atencao: Admin nao tem configuracao definida
              </span>
            )}
          </p>
        )}
        <button
          onClick={() => setEditing(true)}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          {hasOwnConfig ? 'Alterar' : 'Configurar proprio'}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Escolha: usar do admin ou proprio */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '0.5rem', 
          fontSize: '0.875rem', 
          cursor: 'pointer', 
          marginBottom: '0.75rem',
          padding: '0.75rem',
          border: !useOwnConfig ? '2px solid var(--primary)' : '1px solid var(--border)',
          borderRadius: '0.5rem',
          background: !useOwnConfig ? 'var(--primary-background)' : 'transparent',
        }}>
          <input
            type="radio"
            name="textConfigType"
            checked={!useOwnConfig}
            onChange={() => setUseOwnConfig(false)}
            style={{ marginTop: '0.2rem' }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>Usar configuracao padrao</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              {hasAdminKey ? (
                `${adminProviderName} / ${adminModel || 'auto'}`
              ) : (
                <span style={{ color: 'var(--destructive)' }}>
                  Nenhuma configuracao padrao definida
                </span>
              )}
            </div>
          </div>
        </label>

        <label style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '0.5rem', 
          fontSize: '0.875rem', 
          cursor: 'pointer',
          padding: '0.75rem',
          border: useOwnConfig ? '2px solid var(--primary)' : '1px solid var(--border)',
          borderRadius: '0.5rem',
          background: useOwnConfig ? 'var(--primary-background)' : 'transparent',
        }}>
          <input
            type="radio"
            name="textConfigType"
            checked={useOwnConfig}
            onChange={() => setUseOwnConfig(true)}
            style={{ marginTop: '0.2rem' }}
          />
          <div>
            <div style={{ fontWeight: 500 }}>Usar configuracao propria</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
              Provedor, modelo e chave API especificos
            </div>
          </div>
        </label>
      </div>

      {useOwnConfig && (
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
              {hasApiKey && models.length === 0 && currentModel && currentModel !== 'auto' && (
                <option value={currentModel}>{currentModel} (atual)</option>
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
            setUseOwnConfig(hasOwnConfig);
            setProvider((currentProvider as ProviderId) || '');
            setSelectedModel(currentModel);
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

// Componente para configurar Vision do grupo
function VisionConfigSection({
  groupId,
  currentVisionProvider,
  currentVisionModel,
  hasVisionApiKey,
  // Contexto para mostrar quando herda
  textProvider,
  textModel,
  hasTextApiKey,
  adminVisionProvider,
  adminVisionModel,
  adminProvider,
  adminModel,
  hasAdminKey,
}: {
  groupId: string;
  currentVisionProvider: string | null;
  currentVisionModel: string | null;
  hasVisionApiKey: boolean;
  textProvider: string | null;
  textModel: string;
  hasTextApiKey: boolean;
  adminVisionProvider: string | null;
  adminVisionModel: string | null;
  adminProvider: string | null;
  adminModel: string | null;
  hasAdminKey: boolean;
}) {
  const router = useRouter();
  const hasOwnVisionConfig = !!currentVisionProvider || hasVisionApiKey;
  const [editing, setEditing] = useState(false);
  const [useSameAsText, setUseSameAsText] = useState(!hasOwnVisionConfig);
  
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
        // Usar mesma config do texto (limpa config vision)
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

      const res = await fetch(`/api/groups/${groupId}`, {
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

  // Determina o que esta sendo usado para vision
  const getVisionSource = () => {
    if (hasOwnVisionConfig) {
      const providerName = PROVIDER_LIST.find(p => p.id === currentVisionProvider)?.name || currentVisionProvider;
      return { type: 'proprio', label: `${providerName} / ${currentVisionModel}` };
    }
    if (hasTextApiKey && textProvider) {
      const providerName = PROVIDER_LIST.find(p => p.id === textProvider)?.name || textProvider;
      return { type: 'texto', label: `${providerName} / ${textModel} (do texto)` };
    }
    if (adminVisionProvider) {
      const providerName = PROVIDER_LIST.find(p => p.id === adminVisionProvider)?.name || adminVisionProvider;
      return { type: 'admin_vision', label: `${providerName} / ${adminVisionModel} (padrao)` };
    }
    if (hasAdminKey && adminProvider) {
      const providerName = PROVIDER_LIST.find(p => p.id === adminProvider)?.name || adminProvider;
      return { type: 'admin_texto', label: `${providerName} / ${adminModel} (padrao)` };
    }
    return { type: 'none', label: 'Nao configurado' };
  };

  const visionSource = getVisionSource();

  if (!editing) {
    return (
      <div>
        {hasOwnVisionConfig ? (
          <>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Provedor: </span>
              <span style={{ fontWeight: 500 }}>
                {PROVIDER_LIST.find(p => p.id === currentVisionProvider)?.name || currentVisionProvider}
              </span>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Modelo: </span>
              <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {currentVisionModel}
              </span>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.875rem' }}>Chave API: </span>
              <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>
                {hasVisionApiKey ? 'Propria configurada' : 'Usando do texto'}
              </span>
            </div>
          </>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
            {visionSource.type === 'texto' 
              ? 'Usando mesma configuracao do texto'
              : visionSource.type === 'none'
                ? <span style={{ color: 'var(--destructive)' }}>Nenhuma configuracao disponivel</span>
                : `Usando configuracao padrao: ${visionSource.label}`
            }
          </p>
        )}
        <button
          onClick={() => setEditing(true)}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          {hasOwnVisionConfig ? 'Alterar' : 'Configurar separado'}
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
          {!hasTextApiKey && !hasAdminKey && (
            <span style={{ color: 'var(--destructive)', fontSize: '0.75rem' }}>(texto nao configurado)</span>
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
            setUseSameAsText(!hasOwnVisionConfig);
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

// Componente para System Prompt e Controle de Acesso
function GeneralConfigSection({
  groupId,
  systemPrompt: initialPrompt,
  allowAll: initialAllowAll,
}: {
  groupId: string;
  systemPrompt: string;
  allowAll: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(initialPrompt);
  const [allowAll, setAllowAll] = useState(initialAllowAll);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: systemPrompt || null,
          allowAll,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar');
      }

      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div>
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>System Prompt: </span>
          {initialPrompt ? (
            <span style={{ 
              fontSize: '0.8rem', 
              color: 'var(--muted-foreground)',
              display: 'block',
              marginTop: '0.25rem',
              fontStyle: 'italic',
            }}>
              &quot;{initialPrompt.length > 100 ? initialPrompt.substring(0, 100) + '...' : initialPrompt}&quot;
            </span>
          ) : (
            <span style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>Nao definido</span>
          )}
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Acesso: </span>
          <span style={{ fontSize: '0.875rem' }}>
            {initialAllowAll ? 'Todos podem usar' : 'Apenas usuarios habilitados'}
          </span>
        </div>
        <button
          onClick={() => setEditing(true)}
          style={{
            ...buttonStyle,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          Alterar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
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

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
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
            setSystemPrompt(initialPrompt);
            setAllowAll(initialAllowAll);
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

// Componente principal
export function GroupConfigForm({
  groupId,
  currentProvider,
  currentModel,
  hasApiKey,
  currentVisionProvider,
  currentVisionModel,
  hasVisionApiKey,
  systemPrompt,
  allowAll,
  adminProvider,
  adminModel,
  adminVisionProvider,
  adminVisionModel,
  hasAdminKey,
}: Props) {
  return (
    <div>
      {/* Secao de Texto */}
      <div style={sectionStyle}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>
          Configuracao para Texto
        </h4>
        <TextConfigSection
          groupId={groupId}
          currentProvider={currentProvider}
          currentModel={currentModel}
          hasApiKey={hasApiKey}
          adminProvider={adminProvider}
          adminModel={adminModel}
          hasAdminKey={hasAdminKey}
        />
      </div>

      {/* Secao de Vision */}
      <div style={sectionStyle}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>
          Configuracao para Vision (Imagens/Videos)
        </h4>
        <VisionConfigSection
          groupId={groupId}
          currentVisionProvider={currentVisionProvider}
          currentVisionModel={currentVisionModel}
          hasVisionApiKey={hasVisionApiKey}
          textProvider={currentProvider}
          textModel={currentModel}
          hasTextApiKey={hasApiKey}
          adminVisionProvider={adminVisionProvider}
          adminVisionModel={adminVisionModel}
          adminProvider={adminProvider}
          adminModel={adminModel}
          hasAdminKey={hasAdminKey}
        />
      </div>

      {/* Secao de Configuracoes Gerais */}
      <div style={sectionStyle}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>
          Configuracoes Gerais
        </h4>
        <GeneralConfigSection
          groupId={groupId}
          systemPrompt={systemPrompt}
          allowAll={allowAll}
        />
      </div>
    </div>
  );
}
