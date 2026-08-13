import { EXTENSION_NAME, TONE_OPTIONS } from '../shared/constants';
import { ActionStatus, ActiveChatInfo, ExtensionSettings, ToneType } from '../shared/types';
import { WhatsAppObserver } from './whatsappObserver';

export class WritelyUIOverlay {
  private observer: WhatsAppObserver;
  private settings: ExtensionSettings;
  private toolbarContainer: HTMLDivElement | null = null;
  private statusBadge: HTMLDivElement | null = null;
  private toastNotificationEl: HTMLDivElement | null = null;

  // EPIC 08 — Action States: IDLE | PROCESSING | SUCCESS | ERROR
  private statusState: ActionStatus = 'IDLE';
  private statusMessage = '';

  constructor(observer: WhatsAppObserver, settings: ExtensionSettings) {
    this.observer = observer;
    this.settings = settings;
    this.setupKeyboardShortcut();
  }

  public updateSettings(newSettings: ExtensionSettings) {
    this.settings = newSettings;
    this.renderStatusBadge();
    this.renderToolbar();
  }

  /**
   * EPIC 13 — Listen for keyboard shortcuts (Ctrl+Shift+G, Alt+W, Alt+Shift+G)
   * Uses capturing phase (true) to prevent Chrome's native Find Search box
   */
  private setupKeyboardShortcut() {
    const handleShortcut = (e: KeyboardEvent) => {
      const isCtrlShiftG = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'G' || e.key === 'g' || e.code === 'KeyG');
      const isAltW = e.altKey && (e.key === 'W' || e.key === 'w' || e.code === 'KeyW');
      const isAltShiftG = e.altKey && e.shiftKey && (e.key === 'G' || e.key === 'g' || e.code === 'KeyG');

      if ((isCtrlShiftG || isAltW || isAltShiftG) && this.settings.enabled) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('[Writely] Atalho de teclado acionado!');
        this.triggerImprovement();
        return false;
      }
    };

    // Use capturing phase (true) so content script intercepts shortcut before Chrome native handlers
    window.addEventListener('keydown', handleShortcut, true);
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      const isCtrlShiftG = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'G' || e.key === 'g' || e.code === 'KeyG');
      if (isCtrlShiftG) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }, true);
  }

  /**
   * Render floating status badge in bottom corner
   */
  public renderStatusBadge(chatInfo?: ActiveChatInfo | null) {
    if (!this.statusBadge) {
      this.statusBadge = document.createElement('div');
      this.statusBadge.id = 'writely-status-badge';
      document.body.appendChild(this.statusBadge);
    }

    const enabled = this.settings.enabled;
    const chatTitle = chatInfo?.chatTitle || this.observer.getActiveChat()?.chatTitle;
    const toneObj = TONE_OPTIONS.find((t) => t.id === this.settings.activeTone);

    this.statusBadge.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 20px;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #FFFFFF;
      background: ${enabled ? 'linear-gradient(135deg, #4F46E5 0%, #0D9488 100%)' : '#475569'};
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
      cursor: pointer;
      user-select: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    this.statusBadge.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${enabled ? '#34D399' : '#94A3B8'}; box-shadow: 0 0 8px ${enabled ? '#34D399' : 'transparent'};"></span>
      <span>${EXTENSION_NAME} ${enabled ? 'Ativo' : 'Pausado'}</span>
      ${enabled && toneObj ? `<span style="opacity:0.8; font-size:11px;">• ${toneObj.label}</span>` : ''}
      ${enabled && chatTitle ? `<span style="opacity:0.75; font-size:10px; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:4px;">💬 ${chatTitle}</span>` : ''}
    `;

    this.statusBadge.onclick = () => {
      chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION', source: 'content' });
    };
  }

  /**
   * EPIC 04 & EPIC 12 — Render AI Action Toolbar attached directly to WhatsApp message editor
   */
  public renderToolbar() {
    const editorEl = this.observer.getEditorElement();
    if (!editorEl || !this.settings.enabled) {
      if (this.toolbarContainer) {
        this.toolbarContainer.style.display = 'none';
      }
      return;
    }

    const parentFooter = editorEl.closest('footer') || editorEl.parentElement;
    if (!parentFooter) return;

    if (!this.toolbarContainer) {
      this.toolbarContainer = document.createElement('div');
      this.toolbarContainer.id = 'writely-editor-toolbar';
      parentFooter.prepend(this.toolbarContainer);
    } else if (this.toolbarContainer.parentElement !== parentFooter) {
      parentFooter.prepend(this.toolbarContainer);
    }

    const editorText = this.observer.getEditorText();
    const hasText = editorText.length > 0;

    this.toolbarContainer.style.display = 'flex';
    this.toolbarContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: #1E293B;
      border-bottom: 1px solid #334155;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      color: #F8FAFC;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
      user-select: none;
      z-index: 999;
      transition: opacity 0.2s ease;
      opacity: ${hasText || this.statusState !== 'IDLE' ? '1' : '0.85'};
    `;

    // Build button label according to EPIC 04 & EPIC 08 states
    let buttonLabel = '✨ Melhorar com IA';
    let buttonBg = 'linear-gradient(135deg, #4F46E5 0%, #0D9488 100%)';
    let buttonDisabled = !hasText || this.statusState === 'PROCESSING';

    if (this.statusState === 'PROCESSING') {
      buttonLabel = '⏳ Melhorando...';
      buttonBg = '#475569';
    } else if (this.statusState === 'SUCCESS') {
      buttonLabel = '✓ Melhorado';
      buttonBg = '#10B981';
      buttonDisabled = false;
    } else if (this.statusState === 'ERROR') {
      buttonLabel = '⚠️ Tentar novamente';
      buttonBg = '#EF4444';
      buttonDisabled = false;
    }

    this.toolbarContainer.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#818CF8;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        <span>Writely</span>
      </div>

      <div style="height:14px; width:1px; background:#475569; margin:0 4px;"></div>

      <button id="writely-btn-generate" ${buttonDisabled ? 'disabled' : ''} style="
        display: flex;
        align-items: center;
        gap: 6px;
        background: ${buttonBg};
        color: #FFFFFF;
        border: none;
        padding: 5px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 11px;
        cursor: ${buttonDisabled ? 'not-allowed' : 'pointer'};
        opacity: ${buttonDisabled && this.statusState === 'IDLE' ? '0.5' : '1'};
        transition: all 0.2s ease;
      ">
        <span>${buttonLabel}</span>
      </button>

      <span style="font-size:10px; color:#94A3B8; margin-left:4px;">(Alt+W)</span>

      <div style="display:flex; align-items:center; gap:4px; margin-left:auto;">
        ${TONE_OPTIONS.map(
          (t) => `
          <button data-tone="${t.id}" class="writely-tone-btn" style="
            background: ${t.id === this.settings.activeTone ? 'rgba(99, 102, 241, 0.3)' : 'transparent'};
            border: 1px solid ${t.id === this.settings.activeTone ? '#6366F1' : 'transparent'};
            color: ${t.id === this.settings.activeTone ? '#A5B4FC' : '#94A3B8'};
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
          ">${t.label}</button>
        `
        ).join('')}
      </div>
    `;

    // Attach button click listener
    const generateBtn = this.toolbarContainer.querySelector('#writely-btn-generate') as HTMLElement | null;
    if (generateBtn && !buttonDisabled) {
      generateBtn.onclick = () => this.triggerImprovement();
    }

    const toneBtns = this.toolbarContainer.querySelectorAll('.writely-tone-btn');
    toneBtns.forEach((btn) => {
      (btn as HTMLElement).onclick = (e) => {
        const tone = (e.currentTarget as HTMLElement).getAttribute('data-tone') as ToneType;
        if (tone) {
          const updatedSettings = { ...this.settings, activeTone: tone };
          this.updateSettings(updatedSettings);
          chrome.runtime.sendMessage({
            type: 'SAVE_SETTINGS',
            payload: updatedSettings,
            source: 'content',
          });
        }
      };
    });
  }

  /**
   * EPIC 04, 05, 08, 09 — Trigger Improvement Action with Error Safety & Preservation
   */
  public async triggerImprovement() {
    if (this.statusState === 'PROCESSING') {
      console.log('[Writely UI] triggerImprovement chamado mas já está PROCESSING. Ignorado.');
      return;
    }

    console.log('[Writely UI] === TRIGGER IMPROVEMENT INICIADO ===');

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.error('[Writely UI] Contexto da extensão inválido! Recarregue a página (F5).');
      this.showToast('⚠️ Extensão desconectada. Recarregue a página com F5.', 'error');
      return;
    }

    // EPIC 03 — Extract current original message
    const originalText = this.observer.getEditorText();
    console.log('[Writely UI] Texto extraído do editor:', JSON.stringify(originalText));
    console.log('[Writely UI] Comprimento do texto:', originalText.length);

    if (!originalText || originalText.trim() === '') {
      console.log('[Writely UI] Texto vazio. Mostrando aviso.');
      this.showToast('Digite uma mensagem no WhatsApp para a IA melhorar!', 'warning');
      return;
    }

    // Set state to PROCESSING (EPIC 08)
    this.statusState = 'PROCESSING';
    this.renderToolbar();
    console.log('[Writely UI] Estado alterado para PROCESSING.');

    try {
      // Send request to Background Service Worker
      console.log('[Writely UI] Enviando GENERATE_TEXT_REQUEST ao Service Worker...');
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_TEXT_REQUEST',
        payload: {
          promptText: originalText,
          tone: this.settings.activeTone,
          contextMessage: this.observer.getActiveChat()?.chatTitle,
        },
        source: 'content',
      });

      console.log('[Writely UI] Resposta recebida do Service Worker:', JSON.stringify(response));

      if (response && response.success && response.data) {
        console.log('[Writely UI] Texto gerado pela IA:', JSON.stringify(response.data));
        console.log('[Writely UI] Iniciando substituição no editor...');

        // EPIC 06 & 07 — Mutate Lexical content with AI result
        const replaced = await this.observer.setEditorText(response.data);
        console.log('[Writely UI] Resultado da substituição:', replaced);

        if (replaced) {
          this.statusState = 'SUCCESS';
          this.renderToolbar();
          console.log('[Writely UI] === SUCESSO COMPLETO ===');
          setTimeout(() => {
            this.statusState = 'IDLE';
            this.renderToolbar();
          }, 2500);
        } else {
          throw new Error('Não foi possível substituir o conteúdo no editor do WhatsApp.');
        }
      } else {
        console.error('[Writely UI] Resposta sem sucesso:', response);
        throw new Error(response?.error || 'Ocorreu um erro ao comunicar com a IA.');
      }
    } catch (err: any) {
      console.error('[Writely UI] === ERRO NO FLUXO ===');
      console.error('[Writely UI] Error name:', err?.name);
      console.error('[Writely UI] Error message:', err?.message);
      console.error('[Writely UI] Error completo:', err);
      
      // EPIC 09 — CRITICAL RULE: Original message is preserved intact!
      const currentText = this.observer.getEditorText();
      console.log('[Writely UI] Texto atual no editor após erro:', JSON.stringify(currentText));
      if (currentText !== originalText) {
        console.log('[Writely UI] Restaurando texto original...');
        await this.observer.setEditorText(originalText);
      }

      this.statusState = 'ERROR';
      this.statusMessage = err?.message || 'Erro na requisição.';
      this.renderToolbar();
      this.showToast(`⚠️ ${this.statusMessage} (Sua mensagem original foi mantida intacta).`, 'error');

      setTimeout(() => {
        this.statusState = 'IDLE';
        this.renderToolbar();
      }, 4000);
    }
  }

  /**
   * Display toast message to user
   */
  private showToast(msg: string, type: 'info' | 'error' | 'warning' = 'info') {
    if (!this.toastNotificationEl) {
      this.toastNotificationEl = document.createElement('div');
      this.toastNotificationEl.id = 'writely-toast';
      document.body.appendChild(this.toastNotificationEl);
    }

    const bg = type === 'error' ? '#EF4444' : type === 'warning' ? '#F59E0B' : '#10B981';

    this.toastNotificationEl.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 999999;
      background: ${bg};
      color: #FFFFFF;
      padding: 10px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      max-width: 380px;
      animation: fadeIn 0.3s ease;
    `;

    this.toastNotificationEl.textContent = msg;

    setTimeout(() => {
      if (this.toastNotificationEl) {
        this.toastNotificationEl.remove();
        this.toastNotificationEl = null;
      }
    }, 4500);
  }

  public removeToolbar() {
    if (this.toolbarContainer) {
      this.toolbarContainer.remove();
      this.toolbarContainer = null;
    }
  }
}
