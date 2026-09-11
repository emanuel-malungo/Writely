import { useEffect, useState } from 'react';
import {
  CheckCircle,
  Cpu,
  Key,
  Plus,
  Save,
  Sliders,
  Sparkles,
  Trash2,
  Tv,
  Zap,
} from 'lucide-react';
import { DEFAULT_SETTINGS, GROQ_MODELS, TONE_OPTIONS } from '../shared/constants';
import { ExtensionSettings, ToneType } from '../shared/types';

export default function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'overview' | 'tones' | 'api' | 'preferences'>('overview');
  const [savedNotice, setSavedNotice] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');

  // Live test AI states
  const [testPrompt, setTestPrompt] = useState('Por favor, confirme se nossa reunião de amanhã está mantida.');
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS', source: 'options' }, (res) => {
        if (res && res.success && res.data) {
          setSettings(res.data);
        }
      });
    }
  }, []);

  const handleSave = async () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      const res = await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: settings,
        source: 'options',
      });
      if (res && res.success) {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 3000);
      }
    } else {
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    }
  };

  const addCustomPrompt = () => {
    if (!newPromptName.trim() || !newPromptText.trim()) return;
    const newPrompt = {
      id: Date.now().toString(),
      name: newPromptName.trim(),
      prompt: newPromptText.trim(),
    };
    setSettings((prev) => ({
      ...prev,
      customPrompts: [...prev.customPrompts, newPrompt],
    }));
    setNewPromptName('');
    setNewPromptText('');
  };

  const removeCustomPrompt = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      customPrompts: prev.customPrompts.filter((p) => p.id !== id),
    }));
  };

  const runTestCompletion = async () => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestError(null);
    setTestResult('');

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res = await chrome.runtime.sendMessage({
          type: 'GENERATE_TEXT_REQUEST',
          payload: {
            promptText: testPrompt,
            tone: settings.activeTone,
          },
          source: 'options',
        });
        if (res && res.success && res.data) {
          setTestResult(res.data);
        } else {
          setTestError(res?.error || 'Erro ao gerar conclusão com Groq SDK.');
        }
      } else {
        setTimeout(() => {
          setTestResult(`[Modo Simulação]: Olá! Gostaria de confirmar nossa reunião agendada para amanhã. Permanecemos confirmados?`);
          setTesting(false);
        }, 1000);
        return;
      }
    } catch (err: any) {
      setTestError(err?.message || 'Falha ao executar teste.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="options-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="brand-name">Writely</h2>
            <span className="brand-tag">Motor IA GroqCloud</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Tv size={18} />
            <span>Visão Geral</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'tones' ? 'active' : ''}`}
            onClick={() => setActiveTab('tones')}
          >
            <Sparkles size={18} />
            <span>Tons & Prompts</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            <Key size={18} />
            <span>Groq API & Modelos</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <Sliders size={18} />
            <span>Preferências</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="save-btn" onClick={handleSave}>
            <Save size={16} />
            <span>Salvar Alterações</span>
          </button>
          {savedNotice && (
            <div className="toast">
              <CheckCircle size={14} /> Configurações salvas!
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Visão Geral da Extensão</h1>
              <p>EPIC 02 — Integração de Leitura e Observador DOM do WhatsApp Web.</p>
            </header>

            <div className="grid-cards">
              <div className="card">
                <div className="card-header">
                  <Cpu size={20} className="text-emerald" />
                  <h3>Observador DOM WhatsApp</h3>
                </div>
                <p>Estratégia multi-heurística resiliente ativada (sem dependência exclusiva de CSS obfuscado).</p>
                <div className="badge-pill active">Ativo</div>
              </div>

              <div className="card">
                <div className="card-header">
                  <Zap size={20} className="text-indigo" />
                  <h3>Groq SDK Engine</h3>
                </div>
                <p>Modelo configurado: {settings.model || 'openai/gpt-oss-20b'}</p>
                <div className="badge-pill tone">Groq Cloud OK</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tones' && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Tons de Redação & Prompts Personalizados</h1>
              <p>Configure os estilos de escrita da IA ou crie atalhos customizados.</p>
            </header>

            <section className="section">
              <h2>Tom Padrão Selecionado</h2>
              <div className="tone-selection-list">
                {TONE_OPTIONS.map((t) => (
                  <label key={t.id} className={`tone-radio-card ${settings.activeTone === t.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="activeTone"
                      value={t.id}
                      checked={settings.activeTone === t.id}
                      onChange={() => setSettings({ ...settings, activeTone: t.id as ToneType })}
                    />
                    <div>
                      <strong>{t.label}</strong>
                      <p>{t.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="section">
              <h2>Prompts Personalizados</h2>
              <div className="prompt-builder">
                <input
                  type="text"
                  placeholder="Nome do Prompt (ex: Resumo Executivo)"
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  className="input-field"
                />
                <textarea
                  placeholder="Instrução para a IA (ex: Resuma os pontos em tópicos curtos)"
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  className="textarea-field"
                  rows={2}
                />
                <button className="btn-add" onClick={addCustomPrompt}>
                  <Plus size={16} /> Adicionar Prompt
                </button>
              </div>

              <div className="prompts-list">
                {settings.customPrompts.map((p) => (
                  <div key={p.id} className="prompt-item">
                    <div>
                      <strong>{p.name}</strong>
                      <p>{p.prompt}</p>
                    </div>
                    <button className="btn-icon-danger" onClick={() => removeCustomPrompt(p.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Configuração de API da Groq</h1>
              <p>Gerencie sua chave de API Groq (SDK official) e selecione os modelos de LLM.</p>
            </header>

            <section className="section">
              <label className="input-label">Modelo Groq Ativo</label>
              <select
                className="select-field"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              >
                {GROQ_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            </section>

            <section className="section">
              <label className="input-label">Chave de API do Groq (`GROQ_API_KEY` / `.env`)</label>
              <input
                type="password"
                placeholder="gsk_..."
                value={settings.apiKey || ''}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                className="input-field"
              />
              <span className="input-hint">Armazenada de forma segura na storage isolada da extensão.</span>
            </section>

            {/* Test Runner */}
            <section className="section">
              <h2>Testar Geração em Tempo Real com Groq</h2>
              <div className="prompt-builder">
                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  className="textarea-field"
                  rows={2}
                />
                <button className="btn-add" onClick={runTestCompletion} disabled={testing}>
                  <Zap size={16} /> {testing ? 'Gerando com Groq...' : 'Executar Teste Groq'}
                </button>
                {testError && <div className="alert alert-error">{testError}</div>}
                {testResult && (
                  <div className="prompt-item test-result">
                    <div>
                      <strong>Resultado Gerado:</strong>
                      <p style={{ marginTop: '4px' }}>{testResult}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="tab-pane">
            <header className="pane-header">
              <h1>Preferências do Usuário</h1>
              <p>Ajuste o comportamento geral da extensão no seu navegador.</p>
            </header>

            <section className="section">
              <label className="toggle-row">
                <div>
                  <strong>Toolbar Flutuante no Editor do WhatsApp</strong>
                  <p>Exibe a barra rápida do Writely acima do campo de texto do WhatsApp Web.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSuggest}
                  onChange={(e) => setSettings({ ...settings, autoSuggest: e.target.checked })}
                  className="checkbox-field"
                />
              </label>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
