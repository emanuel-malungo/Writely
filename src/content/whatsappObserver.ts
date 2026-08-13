import { ActiveChatInfo, TypingState } from '../shared/types';
import { LexicalMutator } from './lexicalMutator';

export interface WhatsAppObserverCallbacks {
  onAppReady?: () => void;
  onEditorFound?: (editorEl: HTMLElement) => void;
  onEditorLost?: () => void;
  onChatChange?: (chatInfo: ActiveChatInfo) => void;
  onTypingStateChange?: (state: TypingState) => void;
}

export class WhatsAppObserver {
  private isReady = false;
  private currentEditorEl: HTMLElement | null = null;
  private currentChatInfo: ActiveChatInfo | null = null;
  private mutationObserver: MutationObserver | null = null;
  private typingTimeout: number | null = null;
  private callbacks: WhatsAppObserverCallbacks;

  private isTyping = false;
  private lastText = '';

  constructor(callbacks: WhatsAppObserverCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Start observing WhatsApp Web DOM
   */
  public start() {
    console.log('[Writely Observer] Iniciando observador resiliente do WhatsApp Web...');
    this.checkAppReady();
    this.setupMutationObserver();
    
    setInterval(() => {
      this.resilientFindEditor();
      this.resilientDetectActiveChat();
    }, 2000);
  }

  /**
   * Stop observer and clean up event listeners
   */
  public stop() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.detachEditorEvents();
  }

  /**
   * Check if WhatsApp Web container `#app` is loaded
   */
  private checkAppReady(): boolean {
    const appEl = document.getElementById('app') || document.querySelector('._a7-g') || document.querySelector('[role="application"]');
    if (appEl && !this.isReady) {
      this.isReady = true;
      console.log('[Writely Observer] WhatsApp Web carregado com sucesso!');
      if (this.callbacks.onAppReady) {
        this.callbacks.onAppReady();
      }
    }
    return this.isReady;
  }

  /**
   * Resilient multi-tiered editor locator strategy
   * Does NOT rely exclusively on volatile class names like .xkrh14z
   */
  public resilientFindEditor(): HTMLElement | null {
    let editor: HTMLElement | null = document.querySelector('#main footer div[contenteditable="true"]');

    if (!editor) {
      editor = document.querySelector('footer div[contenteditable="true"][role="textbox"]');
    }

    if (!editor) {
      editor = document.querySelector('footer div[contenteditable="true"][data-tab]') ||
               document.querySelector('footer div[contenteditable="true"][spellcheck]');
    }

    if (!editor) {
      editor = document.querySelector('#main div[contenteditable="true"]');
    }

    if (!editor) {
      editor = document.querySelector('div[contenteditable="true"]');
    }

    if (editor !== this.currentEditorEl) {
      if (editor) {
        console.log('[Writely Observer] Editor de mensagem identificado!');
        this.currentEditorEl = editor;
        this.attachEditorEvents(editor);
        if (this.callbacks.onEditorFound) {
          this.callbacks.onEditorFound(editor);
        }
      } else if (this.currentEditorEl) {
        console.log('[Writely Observer] Editor de mensagem desconectado.');
        this.detachEditorEvents();
        this.currentEditorEl = null;
        if (this.callbacks.onEditorLost) {
          this.callbacks.onEditorLost();
        }
      }
    }

    return this.currentEditorEl;
  }

  /**
   * Extract text using LexicalMutator (EPIC 03)
   */
  public getEditorText(): string {
    if (!this.currentEditorEl) {
      this.resilientFindEditor();
    }
    if (!this.currentEditorEl) return '';
    return LexicalMutator.extractEditorText(this.currentEditorEl);
  }

  /**
   * Replace text in Lexical editor using LexicalMutator (EPIC 06 & EPIC 07)
   */
  public async setEditorText(newText: string): Promise<boolean> {
    const editor = this.resilientFindEditor();
    if (!editor) {
      console.warn('[Writely Observer] Não foi possível injetar texto: editor não encontrado.');
      return false;
    }

    const success = await LexicalMutator.mutateEditorContent(editor, newText);
    this.handleTypingEvent();
    return success;
  }

  /**
   * Resiliently detect active chat title & details from header
   */
  private resilientDetectActiveChat(): ActiveChatInfo | null {
    let titleEl: HTMLElement | null =
      document.querySelector('#main header span[title]') ||
      document.querySelector('#main header div[title]') ||
      document.querySelector('header [role="button"] span[title]');

    if (!titleEl) {
      titleEl = document.querySelector('#main header h2') || document.querySelector('#main header span');
    }

    if (titleEl && titleEl.textContent) {
      const chatTitle = titleEl.textContent.trim();
      const groupSubEl = document.querySelector('#main header span[title*=","]') || document.querySelector('#main header span[title*="você"]');
      const isGroup = !!groupSubEl;

      if (!this.currentChatInfo || this.currentChatInfo.chatTitle !== chatTitle) {
        this.currentChatInfo = {
          chatTitle,
          isGroup,
          lastActiveTimestamp: Date.now(),
        };
        console.log(`[Writely Observer] Conversa ativa alterada para: "${chatTitle}" (Grupo: ${isGroup})`);
        if (this.callbacks.onChatChange) {
          this.callbacks.onChatChange(this.currentChatInfo);
        }
      }
    }

    return this.currentChatInfo;
  }

  private attachEditorEvents(editor: HTMLElement) {
    editor.addEventListener('input', this.handleTypingEvent);
    editor.addEventListener('keyup', this.handleTypingEvent);
    editor.addEventListener('focus', this.handleTypingEvent);
  }

  private detachEditorEvents() {
    if (this.currentEditorEl) {
      this.currentEditorEl.removeEventListener('input', this.handleTypingEvent);
      this.currentEditorEl.removeEventListener('keyup', this.handleTypingEvent);
      this.currentEditorEl.removeEventListener('focus', this.handleTypingEvent);
    }
  }

  private handleTypingEvent = () => {
    const text = this.getEditorText();
    const isNowTyping = text.length > 0;

    if (this.typingTimeout) {
      window.clearTimeout(this.typingTimeout);
    }

    const state: TypingState = {
      isTyping: isNowTyping,
      currentText: text,
      charCount: text.length,
      chatTitle: this.currentChatInfo?.chatTitle || 'Conversa Desconhecida',
    };

    if (this.callbacks.onTypingStateChange && (this.isTyping !== isNowTyping || this.lastText !== text)) {
      this.isTyping = isNowTyping;
      this.lastText = text;
      this.callbacks.onTypingStateChange(state);
    }

    this.typingTimeout = window.setTimeout(() => {
      if (this.isTyping) {
        this.isTyping = false;
        if (this.callbacks.onTypingStateChange) {
          this.callbacks.onTypingStateChange({
            ...state,
            isTyping: false,
          });
        }
      }
    }, 2500);
  };

  private setupMutationObserver() {
    const targetNode = document.getElementById('app') || document.body;
    let debounceTimer: number | null = null;

    this.mutationObserver = new MutationObserver(() => {
      if (debounceTimer) return;

      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        this.checkAppReady();
        this.resilientFindEditor();
        this.resilientDetectActiveChat();
      }, 300);
    });

    this.mutationObserver.observe(targetNode, {
      childList: true,
      subtree: true,
    });
  }

  public getActiveChat(): ActiveChatInfo | null {
    return this.currentChatInfo;
  }

  public getEditorElement(): HTMLElement | null {
    return this.currentEditorEl;
  }
}
