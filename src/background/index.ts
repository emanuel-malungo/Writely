import { DEFAULT_SETTINGS, EXTENSION_NAME, EXTENSION_VERSION, STORAGE_KEYS } from '../shared/constants';
import { ActiveChatInfo, ExtensionMessage, ExtensionSettings, ServiceWorkerStatus, TypingState } from '../shared/types';
import { generateAICompletion } from './aiService';

console.log(`[${EXTENSION_NAME} Service Worker] Inicializando v${EXTENSION_VERSION}...`);

let lastActiveChat: ActiveChatInfo | null = null;
let lastTypingState: TypingState | null = null;

// Register dynamic header rules as backup to static rules.json for WAF bypass (Groq + Gemini)
async function setupWafBypass() {
  if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) {
    try {
      const groqRuleId = 100;
      const geminiRuleId = 101;

      const groqRule: any = {
        id: groqRuleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'remove' },
            { header: 'referer', operation: 'remove' }
          ]
        },
        condition: {
          urlFilter: '||api.groq.com',
          resourceTypes: ['xmlhttprequest', 'other']
        }
      };

      const geminiRule: any = {
        id: geminiRuleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'remove' },
            { header: 'referer', operation: 'remove' }
          ]
        },
        condition: {
          urlFilter: '||generativelanguage.googleapis.com',
          resourceTypes: ['xmlhttprequest', 'other']
        }
      };

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [groqRuleId, geminiRuleId],
        addRules: [groqRule, geminiRule]
      });
      console.log(`[${EXTENSION_NAME}] Regras dinâmicas de WAF bypass configuradas (backup Groq + Gemini).`);
    } catch (err) {
      console.warn(`[${EXTENSION_NAME}] Falha ao configurar regras dinâmicas de bypass:`, err);
    }
  }
}

// Call on load
setupWafBypass();

// Storage setup on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[${EXTENSION_NAME}] Evento de instalação disparado:`, details.reason);
  await setupWafBypass();
  
  try {
    const existing = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    if (!existing[STORAGE_KEYS.SETTINGS]) {
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
      console.log(`[${EXTENSION_NAME}] Configurações padrão inicializadas.`);
    }
    await updateBadge(DEFAULT_SETTINGS.enabled);
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] Erro ao inicializar storage:`, error);
  }
});

// Update Chrome extension badge
async function updateBadge(enabled: boolean) {
  try {
    if (enabled) {
      await chrome.action.setBadgeText({ text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Emerald
    } else {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#64748B' }); // Slate
    }
  } catch (err) {
    console.warn(`[${EXTENSION_NAME}] Erro ao atualizar badge:`, err);
  }
}

// Get helper for current settings
async function getSettings(): Promise<ExtensionSettings> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  const stored = (data[STORAGE_KEYS.SETTINGS] as ExtensionSettings) || DEFAULT_SETTINGS;

  // Ensure provider and keys are populated
  if (!stored.activeProvider) stored.activeProvider = DEFAULT_SETTINGS.activeProvider;
  if (!stored.groqApiKey) stored.groqApiKey = stored.apiKey || DEFAULT_SETTINGS.groqApiKey;
  if (!stored.groqModel) stored.groqModel = stored.model || DEFAULT_SETTINGS.groqModel;
  if (!stored.geminiApiKey) stored.geminiApiKey = DEFAULT_SETTINGS.geminiApiKey;
  if (!stored.geminiModel) stored.geminiModel = DEFAULT_SETTINGS.geminiModel;

  return stored;
}

// Message handler
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  console.log(`[${EXTENSION_NAME} SW] Mensagem recebida:`, message.type);

  (async () => {
    try {
      switch (message.type) {
        case 'GET_STATUS': {
          const settings = await getSettings();
          const whatsappTabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
          const status: ServiceWorkerStatus = {
            active: settings.enabled,
            version: EXTENSION_VERSION,
            whatsappTabConnected: whatsappTabs.length > 0,
            settings,
            activeChat: lastActiveChat,
          };
          if (lastTypingState) {
            console.log(`[${EXTENSION_NAME}] Status de digitação ativo:`, lastTypingState.isTyping);
          }
          sendResponse({ success: true, data: status });
          break;
        }

        case 'TOGGLE_EXTENSION': {
          const settings = await getSettings();
          const updated = { ...settings, enabled: !settings.enabled };
          await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
          await updateBadge(updated.enabled);
          
          const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
          for (const tab of tabs) {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_RESPONSE',
                payload: updated,
                source: 'background',
              }).catch(() => {});
            }
          }

          sendResponse({ success: true, data: updated });
          break;
        }

        case 'GET_SETTINGS': {
          const settings = await getSettings();
          sendResponse({ success: true, data: settings });
          break;
        }

        case 'SAVE_SETTINGS': {
          const newSettings = message.payload as ExtensionSettings;
          await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
          await updateBadge(newSettings.enabled);

          const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
          for (const tab of tabs) {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_RESPONSE',
                payload: newSettings,
                source: 'background',
              }).catch(() => {});
            }
          }

          sendResponse({ success: true, data: newSettings });
          break;
        }

        case 'CHAT_CHANGED': {
          lastActiveChat = message.payload as ActiveChatInfo;
          sendResponse({ success: true });
          break;
        }

        case 'TYPING_STATUS': {
          lastTypingState = message.payload as TypingState;
          sendResponse({ success: true });
          break;
        }

        case 'GENERATE_TEXT_REQUEST': {
          const settings = await getSettings();
          const payload = message.payload as { promptText: string; tone?: any; contextMessage?: string };

          const provider = settings.activeProvider || 'groq';
          const apiKey = provider === 'gemini' 
            ? (settings.geminiApiKey || DEFAULT_SETTINGS.geminiApiKey)
            : (settings.groqApiKey || settings.apiKey || DEFAULT_SETTINGS.groqApiKey);
          const model = provider === 'gemini'
            ? (settings.geminiModel || DEFAULT_SETTINGS.geminiModel)
            : (settings.groqModel || settings.model || DEFAULT_SETTINGS.groqModel);

          console.log(`[${EXTENSION_NAME} SW] === GENERATE_TEXT_REQUEST ===`);
          console.log(`[${EXTENSION_NAME} SW] Provider: ${provider.toUpperCase()}`);
          console.log(`[${EXTENSION_NAME} SW] Texto original: "${payload.promptText}"`);
          console.log(`[${EXTENSION_NAME} SW] Modelo: ${model}`);
          console.log(`[${EXTENSION_NAME} SW] API Key (primeiros 10): ${(apiKey || '').substring(0, 10)}...`);

          const textResult = await generateAICompletion({
            provider,
            apiKey,
            model,
            tone: payload.tone || settings.activeTone,
            promptText: payload.promptText,
            contextMessage: payload.contextMessage,
          });

          console.log(`[${EXTENSION_NAME} SW] Texto gerado pela IA: "${textResult.substring(0, 100)}..."`);
          sendResponse({ success: true, data: textResult });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Message type not recognized' });
      }
    } catch (error: any) {
      console.error(`[${EXTENSION_NAME} SW Error]:`, error);
      sendResponse({ success: false, error: error?.message || String(error) });
    }
  })();

  return true; // Keep channel open for async response
});
