import { useEffect, useState } from 'react';
import {
  Check,
  Command,
  ExternalLink,
  Key,
  Power,
  Settings,
  Sparkles,
} from 'lucide-react';
import { TONE_OPTIONS, AI_PROVIDERS, GROQ_MODELS, GEMINI_MODELS } from '../shared/constants';
import { AIProvider, ServiceWorkerStatus, ToneType } from '../shared/types';

export default function PopupApp() {
  const [status, setStatus] = useState<ServiceWorkerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  const activeProvider = status?.settings?.activeProvider || 'groq';
  const activeModels = activeProvider === 'gemini' ? GEMINI_MODELS : GROQ_MODELS;
  const activeApiKey = activeProvider === 'gemini' 
    ? status?.settings?.geminiApiKey 
    : (status?.settings?.groqApiKey || status?.settings?.apiKey);
  const activeModel = activeProvider === 'gemini'
    ? status?.settings?.geminiModel
    : (status?.settings?.groqModel || status?.settings?.model);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res = await chrome.runtime.sendMessage({ type: 'GET_STATUS', source: 'popup' });
        if (res && res.success) {
          setStatus(res.data);
          const provider = res.data.settings?.activeProvider || 'groq';
          setInputKey(
            provider === 'gemini' 
              ? (res.data.settings?.geminiApiKey || '')
              : (res.data.settings?.groqApiKey || res.data.settings?.apiKey || '')
          );
          setError(null);
        } else {
          setError(res?.error || 'Não foi possível obter o status.');
        }
      } else {
        // Fallback for standalone preview
        setStatus({
          active: true,
          version: '1.0.0',
          whatsappTabConnected: true,
          settings: {
            enabled: true,
            activeTone: 'professional',
            autoSuggest: true,
            activeProvider: 'groq',
            groqApiKey: '',
            groqModel: 'llama-3.3-70b-versatile',
            geminiApiKey: '',
            geminiModel: 'gemini-3.6-flash',
            apiKey: '',
            model: 'llama-3.3-70b-versatile',
            theme: 'dark',
            customPrompts: [],
          },
        });
      }
    } catch (err) {
      console.error('Erro ao conectar com Service Worker:', err);
      setError('Service Worker offline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const saveSettings = async (updates: Partial<import('../shared/types').ExtensionSettings>) => {
    if (!status || !status.settings) return;
    const updated = { ...status.settings, ...updates };
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res = await chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          payload: updated,
          source: 'popup',
        });
        if (res && res.success) {
          setStatus((prev) => (prev ? { ...prev, settings: res.data } : null));
        }
      } else {
        setStatus((prev) => (prev ? { ...prev, settings: updated } : null));
      }
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
    }
  };

  const toggleExtension = async () => {
    if (!status) return;
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res = await chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION', source: 'popup' });
        if (res && res.success) {
          setStatus((prev) => (prev ? { ...prev, active: res.data.enabled, settings: res.data } : null));
        }
      } else {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                active: !prev.active,
                settings: { ...prev.settings, enabled: !prev.settings.enabled },
              }
            : null
        );
      }
    } catch (err) {
      console.error('Erro ao alternar extensão:', err);
    }
  };

  const handleProviderChange = (provider: AIProvider) => {
    const keyForProvider = provider === 'gemini'
      ? (status?.settings?.geminiApiKey || '')
      : (status?.settings?.groqApiKey || status?.settings?.apiKey || '');
    setInputKey(keyForProvider);
    setEditingKey(false);
    saveSettings({ activeProvider: provider });
  };

  const handleModelChange = (modelId: string) => {
    if (activeProvider === 'gemini') {
      saveSettings({ geminiModel: modelId });
    } else {
      saveSettings({ groqModel: modelId });
    }
  };

  const handleToneSelect = (tone: ToneType) => {
    saveSettings({ activeTone: tone });
  };

  const saveApiKey = async () => {
    const trimmedKey = inputKey.trim();
    if (activeProvider === 'gemini') {
      await saveSettings({ geminiApiKey: trimmedKey });
    } else {
      await saveSettings({ groqApiKey: trimmedKey, apiKey: trimmedKey });
    }
    setEditingKey(false);
    setSavedNotice('Chave salva com sucesso!');
    setTimeout(() => setSavedNotice(''), 2500);
  };

  const openOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../options/index.html', '_blank');
    }
  };

  const openWhatsApp = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'https://web.whatsapp.com' });
    } else {
      window.open('https://web.whatsapp.com', '_blank');
    }
  };

  if (loading) {
    return (
      <div className="popup-container loading-container">
        <Sparkles className="spin-icon" size={28} />
        <p>Carregando...</p>
      </div>
    );
  }

  const isEnabled = status?.active ?? false;
  const hasKey = !!(activeApiKey && activeApiKey.trim().length > 5);
  const providerInfo = AI_PROVIDERS.find(p => p.id === activeProvider);

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="logo-badge">
            <Sparkles size={14} />
          </div>
          <h1 className="title">Writely<span className="title-tag">AI</span></h1>
        </div>
        <button className="icon-button" onClick={openOptions} title="Abrir Opções Avançadas" aria-label="Abrir Opções Avançadas">
          <Settings size={15} />
        </button>
      </header>

      {/* Status section */}
      <div className="section-block">
        <span className="field-label">Status</span>
        <div className="status-row">
          <div className="status-indicator">
            <span className={`pulse-dot ${isEnabled ? 'green' : 'gray'}`}></span>
            <span className="status-text">{isEnabled ? 'Ativo' : 'Inativo'}</span>
          </div>
          <button
            className={`power-toggle ${isEnabled ? 'on' : 'off'}`}
            onClick={toggleExtension}
            title={isEnabled ? 'Pausar' : 'Ativar'}
          >
            <Power size={14} />
          </button>
        </div>
      </div>

      {/* Provider selection */}
      <div className="section-block">
        <span className="field-label">Provedor de IA</span>
        <div className="provider-toggle">
          {AI_PROVIDERS.map((p) => (
            <button
              key={p.id}
              className={`provider-btn ${activeProvider === p.id ? 'active' : ''}`}
              onClick={() => handleProviderChange(p.id as AIProvider)}
              title={p.description}
            >
              <span>{p.icon}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Model selection */}
      <div className="section-block">
        <span className="field-label">Modelo ({providerInfo?.name || 'AI'})</span>
        <select
          className="select-field"
          value={activeModel || activeModels[0]?.id}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={!isEnabled}
        >
          {activeModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* API Key section */}
      <div className="section-block">
        <span className="field-label">API Key ({providerInfo?.name || 'AI'})</span>
        {editingKey ? (
          <div className="key-edit-row">
            <input
              type="password"
              className="key-input"
              placeholder={activeProvider === 'gemini' ? 'AQ.Ab8R...' : 'gsk_...'}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
            />
            <button className="btn-save-key" onClick={saveApiKey}>
              <Check size={14} />
            </button>
          </div>
        ) : (
          <div className="key-status-row" onClick={() => setEditingKey(true)}>
            <div className="key-badge">
              <Key size={12} />
              <span>{hasKey ? 'Configurada ✓' : 'Não configurada ⚠️'}</span>
            </div>
            <button className="btn-text-small">Alterar</button>
          </div>
        )}
        {savedNotice && <span className="notice-text">{savedNotice}</span>}
      </div>

      {/* Tom padrão section */}
      <div className="section-block">
        <span className="field-label">Tom padrão</span>
        <select
          className="select-field"
          value={status?.settings.activeTone || 'professional'}
          onChange={(e) => handleToneSelect(e.target.value as ToneType)}
          disabled={!isEnabled}
        >
          {TONE_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.description.split('.')[0]})
            </option>
          ))}
        </select>
      </div>

      {/* Atalho section */}
      <div className="section-block">
        <span className="field-label">Atalho Teclado</span>
        <div className="shortcut-badge">
          <Command size={12} />
          <span className="kbd-item">
            <kbd>Alt</kbd><span>+</span><kbd>W</kbd>
          </span>
          <span className="kbd-sep">ou</span>
          <span className="kbd-item">
            <kbd>Ctrl</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>G</kbd>
          </span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Footer */}
      <footer className="footer">
        <span>v{status?.version || '1.0.0'}</span>
        <button className="link-button" onClick={openWhatsApp}>
          Abrir WhatsApp <ExternalLink size={10} />
        </button>
      </footer>
    </div>
  );
}
