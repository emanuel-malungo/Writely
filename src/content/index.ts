import { DEFAULT_SETTINGS, EXTENSION_NAME, EXTENSION_VERSION } from '../shared/constants';
import { ExtensionMessage, ExtensionSettings } from '../shared/types';

import { WritelyUIOverlay } from './uiOverlay';
import { WhatsAppObserver } from './whatsappObserver';

console.log(`%c[${EXTENSION_NAME}] Content Script v${EXTENSION_VERSION} inicializando...`, 'color: #10B981; font-weight: bold; font-size: 13px;');

let currentSettings: ExtensionSettings = DEFAULT_SETTINGS;
let observer: WhatsAppObserver | null = null;
let overlay: WritelyUIOverlay | null = null;

// Initialize observer and UI components
function initContentScript() {
  observer = new WhatsAppObserver({
    onAppReady: () => {
      console.log(`[${EXTENSION_NAME}] App WhatsApp Web pronto.`);
    },
    onEditorFound: () => {
      if (overlay) {
        overlay.renderToolbar();
      }
    },
    onEditorLost: () => {
      if (overlay) {
        overlay.removeToolbar();
      }
    },
    onChatChange: (chatInfo) => {
      console.log(`[${EXTENSION_NAME}] Conversa ativa:`, chatInfo.chatTitle);
      if (overlay) {
        overlay.renderStatusBadge(chatInfo);
      }
      chrome.runtime.sendMessage({
        type: 'CHAT_CHANGED',
        payload: chatInfo,
        source: 'content',
      }).catch(() => {});
    },
    onTypingStateChange: (state) => {
      chrome.runtime.sendMessage({
        type: 'TYPING_STATUS',
        payload: state,
        source: 'content',
      }).catch(() => {});
    },
  });

  overlay = new WritelyUIOverlay(observer, currentSettings);
  overlay.renderStatusBadge();

  // Start observing WhatsApp Web DOM
  observer.start();

  // Sync settings from Service Worker
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS', source: 'content' })
    .then((resp) => {
      if (resp && resp.success && resp.data) {
        currentSettings = resp.data;
        if (overlay) {
          overlay.updateSettings(currentSettings);
        }
      }
    })
    .catch((err) => {
      console.warn(`[${EXTENSION_NAME}] Falha ao buscar configurações:`, err);
    });

  // Notify tab connection ready
  chrome.runtime.sendMessage({ type: 'WHATSAPP_READY', source: 'content' }).catch(() => {});
}

// Listen to runtime messages from Background / Popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  console.log(`[${EXTENSION_NAME} Content] Mensagem recebida:`, message.type);

  if (message.type === 'SETTINGS_RESPONSE' && message.payload) {
    currentSettings = message.payload as ExtensionSettings;
    if (overlay) {
      overlay.updateSettings(currentSettings);
    }
  }
});

// Initialize on page ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}
