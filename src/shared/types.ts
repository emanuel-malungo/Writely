export type ToneType = 'professional' | 'natural' | 'friendly' | 'persuasive' | 'empathetic' | 'concise';

export type ActionStatus = 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR';

export type AIProvider = 'groq' | 'gemini';

export interface CustomPrompt {
  id: string;
  name: string;
  prompt: string;
}

export interface ExtensionSettings {
  enabled: boolean;
  activeTone: ToneType;
  autoSuggest: boolean;
  // Multi-provider support
  activeProvider: AIProvider;
  groqApiKey: string;
  groqModel: string;
  geminiApiKey: string;
  geminiModel: string;
  // Legacy compatibility fields
  apiKey: string;
  model: string;
  theme: 'dark' | 'light' | 'system';
  customPrompts: CustomPrompt[];
}

export type MessageType =
  | 'GET_STATUS'
  | 'STATUS_RESPONSE'
  | 'TOGGLE_EXTENSION'
  | 'GET_SETTINGS'
  | 'SETTINGS_RESPONSE'
  | 'SAVE_SETTINGS'
  | 'WHATSAPP_READY'
  | 'CHAT_CHANGED'
  | 'TYPING_STATUS'
  | 'GENERATE_TEXT_REQUEST'
  | 'GENERATE_TEXT_RESPONSE'
  | 'TRIGGER_IMPROVE_COMMAND';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  source?: 'popup' | 'options' | 'content' | 'background';
}

export interface ServiceWorkerStatus {
  active: boolean;
  version: string;
  whatsappTabConnected: boolean;
  settings: ExtensionSettings;
  activeChat?: ActiveChatInfo | null;
}

export interface ActiveChatInfo {
  chatTitle: string;
  isGroup: boolean;
  lastActiveTimestamp: number;
}

export interface TypingState {
  isTyping: boolean;
  currentText: string;
  charCount: number;
  chatTitle: string;
}

export interface GenerateTextPayload {
  promptText: string;
  tone: ToneType;
  contextMessage?: string;
  customInstruction?: string;
}
