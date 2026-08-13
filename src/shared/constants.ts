import { ExtensionSettings } from './types';

export const EXTENSION_VERSION = '1.0.0';
export const EXTENSION_NAME = 'Writely AI';

export const STORAGE_KEYS = {
  SETTINGS: 'writely_settings',
  ANALYTICS: 'writely_analytics',
} as const;

// Read API Keys securely from environment variables
const ENV_GROQ_KEY = import.meta.env?.VITE_GROQ_API_KEY || '';
const ENV_GROQ_MODEL = import.meta.env?.VITE_GROQ_DEFAULT_MODEL || 'llama-3.3-70b-versatile';
const ENV_GEMINI_KEY = import.meta.env?.VITE_GEMINI_API_KEY || '';
const ENV_GEMINI_MODEL = import.meta.env?.VITE_GEMINI_DEFAULT_MODEL || 'gemini-3.6-flash';
const ENV_DEFAULT_PROVIDER = import.meta.env?.VITE_DEFAULT_PROVIDER || 'groq';

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Recomendado)', description: 'Alta precisão e velocidade' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Resposta ultrarrápida' },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', description: 'Equilibrado e eficiente' },
];

export const GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Recomendado)', description: 'Fronteira com custo baixo' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', description: 'Otimizado para alta velocidade' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', description: 'Máxima inteligência' },
];

export const AI_PROVIDERS = [
  { id: 'groq', name: 'Groq', description: 'LPU ultrarrápida para Llama', icon: '⚡' },
  { id: 'gemini', name: 'Google Gemini', description: 'IA de última geração da Google', icon: '✦' },
] as const;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  activeTone: 'professional',
  autoSuggest: true,
  activeProvider: ENV_DEFAULT_PROVIDER as 'groq' | 'gemini',
  groqApiKey: ENV_GROQ_KEY,
  groqModel: ENV_GROQ_MODEL,
  geminiApiKey: ENV_GEMINI_KEY,
  geminiModel: ENV_GEMINI_MODEL,
  // Legacy compatibility — points to active provider
  apiKey: ENV_DEFAULT_PROVIDER === 'gemini' ? ENV_GEMINI_KEY : ENV_GROQ_KEY,
  model: ENV_DEFAULT_PROVIDER === 'gemini' ? ENV_GEMINI_MODEL : ENV_GROQ_MODEL,
  theme: 'dark',
  customPrompts: [
    {
      id: '1',
      name: 'Resumo Executivo',
      prompt: 'Resuma os pontos principais em no máximo 2 frases objetivas.',
    },
    {
      id: '2',
      name: 'Resposta Cortês',
      prompt: 'Elabore uma resposta amável e profissional agradecendo a mensagem.',
    },
  ],
};

export const TONE_OPTIONS: { id: string; label: string; description: string; icon: string }[] = [
  { id: 'professional', label: 'Profissional', description: 'Comunicação formal, clara e executiva.', icon: 'Briefcase' },
  { id: 'natural', label: 'Natural', description: 'Comunicação humana, fluida e clara.', icon: 'Smile' },
  { id: 'friendly', label: 'Amigável', description: 'Comunicação cordial, próxima e atenciosa.', icon: 'Heart' },
];
