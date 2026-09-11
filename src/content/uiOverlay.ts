import { EXTENSION_NAME, TONE_OPTIONS } from '../shared/constants';
import { ActionStatus, ActiveChatInfo, ExtensionSettings, ToneType } from '../shared/types';
import { WhatsAppObserver } from './whatsappObserver';

export class WritelyUIOverlay {
  private observer: WhatsAppObserver;
  private settings: ExtensionSettings;
  private toolbarContainer: HTMLDivElement | null = null;
  private toolbarFooterEl: HTMLElement | null = null;
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
      top: 70px;
      right: 12px;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      border-radius: 9999px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #EDEDED;
      background: #000000;
      border: 1px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
    `;

    this.statusBadge.innerHTML = `
      <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:${enabled ? '#FFFFFF' : '#4a4a4a'}; box-shadow: ${enabled ? '0 0 8px rgba(255,255,255,0.6)' : 'none'};"></span>
      <span>${EXTENSION_NAME} ${enabled ? 'Ativo' : 'Pausado'}</span>
      ${enabled && toneObj ? `<span style="opacity:0.75; font-size:11px; color:#a0a0a0;">• ${toneObj.label}</span>` : ''}
      ${enabled && chatTitle ? `<span style="opacity:0.85; font-size:10px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.15); padding:2px 6px; border-radius:5px;">${chatTitle}</span>` : ''}
    `;

    this.statusBadge.onclick = () => {
      chrome.runtime.sendMessage({ type: 'TOGGLE_EXTENSION', source: 'content' });
    };
  }

  /**
   * EPIC 04 & EPIC 12 — Render AI Action Toolbar floating above WhatsApp message editor.
   * Positioned absolutely so it never interferes with the WhatsApp layout — the text box
   * and the send button remain fully visible and clickable.
   */
  public renderToolbar() {
    const editorEl = this.observer.getEditorElement();
    const parentFooter = editorEl
      ? (editorEl.closest('footer') as HTMLElement | null) || editorEl.parentElement
      : null;

    if (!parentFooter || !this.settings.enabled) {
      this.removeToolbar();
      return;
    }

    // Anchor the toolbar to the compose footer without altering its internal layout.
    parentFooter.style.position = 'relative';

    if (!this.toolbarContainer || !this.toolbarContainer.isConnected) {
      this.toolbarContainer = document.createElement('div');
      this.toolbarContainer.id = 'writely-editor-toolbar';
      parentFooter.appendChild(this.toolbarContainer);
    }
    this.toolbarFooterEl = parentFooter;

    const editorText = this.observer.getEditorText();
    const hasText = editorText.length > 0;
    const visible = hasText || this.statusState !== 'IDLE';

    this.toolbarContainer.style.cssText = `
      position: absolute;
      left: 50%;
      bottom: calc(100% + 8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      max-width: calc(100% - 24px);
      padding: 6px 10px;
      background: #000000;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 10px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #EDEDED;
      user-select: none;
      opacity: ${visible ? '1' : '0'};
      pointer-events: ${visible ? 'auto' : 'none'};
      transform: translate(-50%, ${visible ? '0' : '4px'});
      transition: opacity 0.18s ease, transform 0.18s ease;
    `;

    // Build button label according to EPIC 04 & EPIC 08 states
    let buttonLabel = '✨ Melhorar com IA';
    let buttonDisabled = !hasText || this.statusState === 'PROCESSING';

    if (this.statusState === 'PROCESSING') {
      buttonLabel = '⏳ Melhorando...';
    } else if (this.statusState === 'SUCCESS') {
      buttonLabel = '✓ Melhorado';
      buttonDisabled = false;
    } else if (this.statusState === 'ERROR') {
      buttonLabel = '⚠️ Tentar novamente';
      buttonDisabled = false;
    }

    this.toolbarContainer.innerHTML = `
      <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#FFFFFF; white-space:nowrap;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
        <span>Writely</span>
      </div>

      <div style="height:14px; width:1px; background:rgba(255,255,255,0.2); margin:0 4px;"></div>

      <button id="writely-btn-generate" ${buttonDisabled ? 'disabled' : ''} style="
        display: flex;
        align-items: center;
        gap: 6px;
        background: #EDEDED;
        color: #000000;
        border: none;
        padding: 5px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 11px;
        font-family: inherit;
        cursor: ${buttonDisabled ? 'not-allowed' : 'pointer'};
        opacity: ${buttonDisabled && this.statusState === 'IDLE' ? '0.5' : '1'};
        transition: all 0.2s ease;
      ">
        <span>${buttonLabel}</span>
      </button>

      <span style="font-size:10px; color:#888888; margin-left:2px; white-space:nowrap;">(Alt+W)</span>

      <div style="display:flex; align-items:center; gap:4px; margin-left:auto;">
        ${TONE_OPTIONS.map(
          (t) => `
          <button data-tone="${t.id}" class="writely-tone-btn" style="
            background: ${t.id === this.settings.activeTone ? '#EDEDED' : 'transparent'};
            border: 1px solid ${t.id === this.settings.activeTone ? '#EDEDED' : 'rgba(255,255,255,0.2)'};
            color: ${t.id === this.settings.activeTone ? '#000000' : '#a0a0a0'};
            padding: 3px 8px;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.15s ease;
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
    if (this.toolbarFooterEl) {
      this.toolbarFooterEl.style.position = '';
      this.toolbarFooterEl = null;
    }
  }
}
