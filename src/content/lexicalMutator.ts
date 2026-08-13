/**
 * LexicalMutator - Resilient Lexical Editor Capture & Mutation Strategy for WhatsApp Web
 * Fully compliant with EPIC 03, EPIC 06, and EPIC 07
 *
 * WhatsApp Web uses a Lexical editor that ignores direct DOM manipulation.
 * The only reliable way to replace text is through Lexical's own input pipeline:
 *   Tier 1: Real clipboard write + execCommand('paste') — needs clipboardWrite permission
 *   Tier 2: Synthetic ClipboardEvent('paste') with DataTransfer
 *   Tier 3: InputEvent('beforeinput') with inputType 'insertFromPaste'
 *   Tier 4: InputEvent('beforeinput') with inputType 'insertText'
 *   Tier 5: document.execCommand('insertText') — legacy fallback
 *   Tier 6: Direct DOM reconstruction — last resort
 */

export class LexicalMutator {
  /**
   * EPIC 03 — Normalizes extracted text content preserving accents, emojis, line breaks, special characters
   */
  public static normalizeContent(rawText: string): string {
    if (!rawText) return '';
    return rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove zero-width spaces or non-printable control chars except \n and \t
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  /**
   * EPIC 03 — Extracts raw text from WhatsApp Web contenteditable editor
   */
  public static extractEditorText(editorEl: HTMLElement): string {
    if (!editorEl) return '';

    // Strategy A: Read span[data-lexical-text="true"] elements
    const lexicalSpans = editorEl.querySelectorAll('span[data-lexical-text="true"]');
    if (lexicalSpans.length > 0) {
      const parts: string[] = [];
      lexicalSpans.forEach((span) => {
        parts.push(span.textContent || '');
      });
      const combined = parts.join('');
      if (combined.length > 0) {
        return this.normalizeContent(combined);
      }
    }

    // Strategy B: Traverse child paragraph <p> blocks
    const paragraphEls = editorEl.querySelectorAll('p');
    if (paragraphEls.length > 0) {
      const pTexts: string[] = [];
      paragraphEls.forEach((p) => {
        pTexts.push(p.innerText || p.textContent || '');
      });
      return this.normalizeContent(pTexts.join('\n'));
    }

    // Strategy C: Fallback to innerText / textContent
    return this.normalizeContent(editorEl.innerText || editorEl.textContent || '');
  }

  /**
   * Helper: select all content inside the editor
   */
  private static selectAllContent(editorEl: HTMLElement): boolean {
    const selection = window.getSelection();
    if (!selection) return false;

    const range = document.createRange();
    range.selectNodeContents(editorEl);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  /**
   * Helper: move cursor to end of editor content
   */
  private static moveCursorToEnd(editorEl: HTMLElement): void {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(editorEl);
    range.collapse(false); // collapse to end
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Helper: sleep for async waiting
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: check if the editor content matches the expected text
   */
  private static verifyContent(editorEl: HTMLElement, expected: string): boolean {
    const current = this.extractEditorText(editorEl);
    const matches = current === expected;
    console.log(`[LexicalMutator] Verificação: "${current.substring(0, 50)}..." === "${expected.substring(0, 50)}..." → ${matches}`);
    return matches;
  }

  /**
   * EPIC 06 & EPIC 07 — Mutates Lexical editor content safely using multiple fallback strategies
   * Returns a Promise<boolean> — true if the substitution succeeded
   */
  public static async mutateEditorContent(editorEl: HTMLElement, newText: string): Promise<boolean> {
    if (!editorEl) return false;

    const normalizedText = this.normalizeContent(newText);
    console.log('[LexicalMutator] === INICIANDO SUBSTITUIÇÃO ===');
    console.log('[LexicalMutator] Texto original no editor:', this.extractEditorText(editorEl));
    console.log('[LexicalMutator] Novo texto desejado:', normalizedText);

    // Focus the editor first
    editorEl.focus();
    await this.sleep(50);

    // ============================================================
    // TIER 1: Real clipboard paste (most reliable for Lexical)
    // Uses navigator.clipboard.writeText + document.execCommand('paste')
    // Requires clipboardWrite + clipboardRead extension permissions
    // ============================================================
    try {
      console.log('[LexicalMutator] Tier 1: Clipboard real + execCommand paste...');

      // Write to real system clipboard
      await navigator.clipboard.writeText(normalizedText);
      console.log('[LexicalMutator] Tier 1: Texto escrito no clipboard do sistema.');

      // Select all current content
      this.selectAllContent(editorEl);
      await this.sleep(30);

      // Execute paste command — this triggers a REAL trusted paste event
      const pasteResult = document.execCommand('paste');
      console.log('[LexicalMutator] Tier 1: execCommand paste resultado:', pasteResult);

      await this.sleep(200);

      if (this.verifyContent(editorEl, normalizedText)) {
        console.log('[LexicalMutator] ✅ Tier 1 (clipboard real) BEM-SUCEDIDO!');
        this.moveCursorToEnd(editorEl);
        return true;
      }
    } catch (e) {
      console.warn('[LexicalMutator] Tier 1 falhou:', e);
    }

    // ============================================================
    // TIER 2: Synthetic ClipboardEvent('paste') with DataTransfer
    // Lexical listens for 'paste' events and reads clipboardData
    // ============================================================
    try {
      console.log('[LexicalMutator] Tier 2: ClipboardEvent paste sintético...');

      editorEl.focus();
      this.selectAllContent(editorEl);
      await this.sleep(30);

      const dt = new DataTransfer();
      dt.setData('text/plain', normalizedText);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      editorEl.dispatchEvent(pasteEvent);

      await this.sleep(200);

      if (this.verifyContent(editorEl, normalizedText)) {
        console.log('[LexicalMutator] ✅ Tier 2 (ClipboardEvent paste) BEM-SUCEDIDO!');
        this.moveCursorToEnd(editorEl);
        return true;
      }
    } catch (e) {
      console.warn('[LexicalMutator] Tier 2 falhou:', e);
    }

    // ============================================================
    // TIER 3: InputEvent('beforeinput') with insertFromPaste + DataTransfer
    // Lexical also processes beforeinput events for paste operations
    // ============================================================
    try {
      console.log('[LexicalMutator] Tier 3: beforeinput insertFromPaste...');

      editorEl.focus();
      this.selectAllContent(editorEl);
      await this.sleep(30);

      const dt2 = new DataTransfer();
      dt2.setData('text/plain', normalizedText);

      editorEl.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertFromPaste',
        dataTransfer: dt2,
      }));

      // Follow up with the input event (Lexical expects both)
      editorEl.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertFromPaste',
        dataTransfer: dt2,
      }));

      await this.sleep(200);

      if (this.verifyContent(editorEl, normalizedText)) {
        console.log('[LexicalMutator] ✅ Tier 3 (beforeinput insertFromPaste) BEM-SUCEDIDO!');
        this.moveCursorToEnd(editorEl);
        return true;
      }
    } catch (e) {
      console.warn('[LexicalMutator] Tier 3 falhou:', e);
    }

    // ============================================================
    // TIER 4: InputEvent('beforeinput') with insertReplacementText
    // Another Lexical-compatible input type for text replacement
    // ============================================================
    try {
      console.log('[LexicalMutator] Tier 4: beforeinput insertReplacementText...');

      editorEl.focus();
      this.selectAllContent(editorEl);
      await this.sleep(30);

      editorEl.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertReplacementText',
        data: normalizedText,
      }));

      editorEl.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertReplacementText',
        data: normalizedText,
      }));

      await this.sleep(200);

      if (this.verifyContent(editorEl, normalizedText)) {
        console.log('[LexicalMutator] ✅ Tier 4 (insertReplacementText) BEM-SUCEDIDO!');
        this.moveCursorToEnd(editorEl);
        return true;
      }
    } catch (e) {
      console.warn('[LexicalMutator] Tier 4 falhou:', e);
    }

    // ============================================================
    // TIER 5: document.execCommand('insertText') — legacy approach
    // ============================================================
    try {
      console.log('[LexicalMutator] Tier 5: execCommand insertText...');

      editorEl.focus();
      this.selectAllContent(editorEl);
      await this.sleep(30);

      const result = document.execCommand('insertText', false, normalizedText);
      console.log('[LexicalMutator] Tier 5: execCommand resultado:', result);

      await this.sleep(200);

      if (this.verifyContent(editorEl, normalizedText)) {
        console.log('[LexicalMutator] ✅ Tier 5 (execCommand insertText) BEM-SUCEDIDO!');
        this.moveCursorToEnd(editorEl);
        return true;
      }
    } catch (e) {
      console.warn('[LexicalMutator] Tier 5 falhou:', e);
    }

    // ============================================================
    // TIER 6: Direct DOM reconstruction (Lexical may revert this)
    // As last resort, manipulate DOM directly and fire all events
    // ============================================================
    try {
      console.log('[LexicalMutator] Tier 6: Reconstrução DOM direta (último recurso)...');

      editorEl.focus();
      editorEl.innerHTML = '';

      const lines = normalizedText.split('\n');
      lines.forEach((line) => {
        const pEl = document.createElement('p');
        pEl.className = 'selectable-text copyable-text';
        pEl.setAttribute('dir', 'ltr');
        pEl.style.cssText = 'text-indent: 0px; margin-top: 0px; margin-bottom: 0px;';

        if (line.trim() === '') {
          pEl.appendChild(document.createElement('br'));
        } else {
          const spanEl = document.createElement('span');
          spanEl.setAttribute('data-lexical-text', 'true');
          spanEl.className = 'selectable-text copyable-text';
          spanEl.textContent = line;
          pEl.appendChild(spanEl);
        }
        editorEl.appendChild(pEl);
      });

      // Fire comprehensive event suite to force Lexical state sync
      editorEl.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: normalizedText,
      }));
      editorEl.dispatchEvent(new Event('change', { bubbles: true }));
      editorEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified' }));
      editorEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));

      this.moveCursorToEnd(editorEl);

      await this.sleep(200);

      const finalText = this.extractEditorText(editorEl);
      console.log('[LexicalMutator] Tier 6 texto final:', finalText);

      if (finalText === normalizedText) {
        console.log('[LexicalMutator] ✅ Tier 6 (DOM direto) BEM-SUCEDIDO!');
        return true;
      }
    } catch (e) {
      console.warn('[LexicalMutator] Tier 6 falhou:', e);
    }

    console.error('[LexicalMutator] ❌ TODAS AS ESTRATÉGIAS FALHARAM. Substituição não foi possível.');
    return false;
  }
}
