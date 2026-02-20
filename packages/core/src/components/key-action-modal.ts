import { LitElement, css, html } from 'lit';

export interface KeyActionExecuteDetail {
  credentialId: string;
  slot: 1 | 2;
  action: 'create' | 'regenerate';
  expirationDays: number;
}

export class KeyActionModalElement extends LitElement {
  public static override properties = {
    open: { type: Boolean, reflect: true },
    loading: { type: Boolean },
    errorMessage: { type: String, attribute: 'error-message' },
    credentialId: { type: String, attribute: 'credential-id' },
    credentialName: { type: String, attribute: 'credential-name' },
    keySlot: { type: Number, attribute: 'key-slot' },
    action: { type: String },
    existingPartialId: { type: String, attribute: 'existing-partial-id' },
    existingCreated: { type: String, attribute: 'existing-created' },
    resultKey: { type: String, attribute: false },
    expirationDateInput: { state: true },
    copyState: { state: true }
  };

  public static override styles = css`
    :host {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 999;
      --akm-font: var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif);
      --akm-text: var(--vscode-editor-foreground, #18202a);
      --akm-muted: var(--vscode-descriptionForeground, #4d5a69);
      --akm-border: var(--vscode-panel-border, #c6d0db);
      --akm-surface: var(--vscode-sideBar-background, #f7fafc);
      --akm-surface-raised: var(--vscode-editor-background, #ffffff);
      --akm-primary: var(--vscode-button-background, #0b63ce);
      --akm-primary-foreground: var(--vscode-button-foreground, #ffffff);
      --akm-input-bg: var(--vscode-input-background, #ffffff);
      --akm-input-fg: var(--vscode-input-foreground, #18202a);
      --akm-input-border: var(--vscode-input-border, var(--akm-border));
      --akm-focus: var(--vscode-focusBorder, #8fbef5);
      font-family: var(--akm-font);
    }

    :host([open]) {
      display: grid;
      place-items: center;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(9, 30, 66, 0.35);
    }

    .dialog {
      position: relative;
      z-index: 1;
      width: min(720px, calc(100vw - 24px));
      max-height: calc(100vh - 24px);
      overflow: auto;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      background: var(--akm-surface);
      padding: 10px;
      display: grid;
      gap: 10px;
      box-shadow: 0 14px 24px rgba(0, 0, 0, 0.14);
    }

    h2 {
      margin: 0;
      font-size: 17px;
      color: var(--akm-text);
    }

    .context {
      border: 1px solid var(--akm-border);
      border-radius: 0;
      padding: 8px;
      display: grid;
      gap: 6px;
      background: var(--akm-surface-raised);
    }

    .row {
      display: grid;
      grid-template-columns: 170px 1fr;
      gap: 7px;
      font-size: 13px;
    }

    .label {
      color: var(--akm-muted);
    }

    .value {
      color: var(--akm-text);
      word-break: break-word;
    }

    .warning {
      border: 1px solid #f4c57a;
      background: #fff8e6;
      color: #8a4b00;
      border-radius: 0;
      padding: 8px;
      font-size: 12px;
      font-weight: 600;
    }

    .field {
      display: grid;
      gap: 4px;
      max-width: 240px;
      font-size: 11px;
      color: var(--akm-muted);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    input,
    textarea {
      border: 1px solid var(--akm-border);
      border-radius: 0;
      font-size: 13px;
      color: var(--akm-input-fg);
      padding: 7px 8px;
      width: 100%;
      box-sizing: border-box;
      font-family: var(--akm-font);
      background: var(--akm-input-bg);
      border-color: var(--akm-input-border);
    }

    textarea {
      min-height: 72px;
      resize: vertical;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    input:focus,
    textarea:focus,
    button:focus {
      outline: 2px solid var(--akm-focus);
      outline-offset: 1px;
    }

    .result {
      border: 1px solid #9ad3a6;
      background: #ecfdf3;
      border-radius: 0;
      padding: 8px;
      display: grid;
      gap: 6px;
    }

    .copy-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .toast {
      font-size: 12px;
      font-weight: 600;
    }

    .toast.ok {
      color: #146c2e;
    }

    .toast.error {
      color: #b42318;
    }

    .error {
      color: #b42318;
      font-size: 13px;
    }

    .actions {
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }

    button {
      border: 1px solid var(--akm-border);
      border-radius: 0;
      padding: 7px 9px;
      background: var(--akm-surface-raised);
      color: var(--akm-text);
      font-weight: 600;
      font-family: var(--akm-font);
      font-size: 12px;
      cursor: pointer;
      min-height: 33px;
    }

    button.primary {
      border-color: var(--akm-primary);
      background: var(--akm-primary);
      color: var(--akm-primary-foreground);
    }

    button.primary.create {
      border-color: #2b8a3e;
      background: #2b8a3e;
      color: #ffffff;
    }

    button.primary.regenerate {
      border-color: #b42318;
      background: #b42318;
      color: #ffffff;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;

  public open: boolean = false;
  public loading: boolean = false;
  public errorMessage: string = '';
  public credentialId: string = '';
  public credentialName: string = '';
  public keySlot: 1 | 2 = 1;
  public action: 'create' | 'regenerate' = 'create';
  public existingPartialId: string = '';
  public existingCreated: string = '';
  public resultKey: string | null = null;

  private expirationDateInput: string = '';
  private copyState: 'idle' | 'copied' | 'failed' = 'idle';
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  public override updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('open')) {
      if (!this.open) {
        this.purgeKeyFromState();
      } else if (!this.expirationDateInput) {
        this.expirationDateInput = getDefaultExpirationDateInput();
      }
    }
  }

  public override disconnectedCallback(): void {
    this.clearCopyTimer();
    this.purgeKeyFromState();
    super.disconnectedCallback();
  }

  public override render() {
    if (!this.open) {
      return html``;
    }

    const title =
      this.action === 'regenerate'
        ? `Regenerate API Key ${this.keySlot}`
        : `Create API Key ${this.keySlot}`;
    const primaryLabel = this.loading ? 'Running...' : title;
    const minDate = getMinExpirationDateInput();
    const maxDate = getMaxExpirationDateInput();

    return html`
      <div class="backdrop" @click=${this.handleClose}></div>
      <section class="dialog" role="dialog" aria-modal="true" aria-label="${title}">
        <h2>${title}</h2>

        <div class="context">
          <div class="row"><div class="label">Credential</div><div class="value">${this.credentialName || 'Unknown'}</div></div>
          <div class="row"><div class="label">Key Slot</div><div class="value">${this.keySlot}</div></div>
          <div class="row"><div class="label">Existing Partial ID</div><div class="value">${this.existingPartialId || 'N/A'}</div></div>
          <div class="row"><div class="label">Existing Created</div><div class="value">${this.existingCreated ? new Date(this.existingCreated).toLocaleString() : 'N/A'}</div></div>
        </div>

        <div class="warning">Regeneration permanently invalidates the previous key. This action cannot be undone.</div>

        <label class="field">
          Expiration Date (required)
          <input
            type="date"
            .value=${this.expirationDateInput}
            min=${minDate}
            max=${maxDate}
            required
            @input=${this.handleExpirationDateInput}
            ?disabled=${this.loading}
          />
          <span>Select between tomorrow and ${maxDate}. Default is +60 days.</span>
        </label>

        ${
          this.resultKey
            ? html`
                <div class="result">
                  <div class="label">New Key (shown once)</div>
                  <textarea id="generated-key" readonly .value=${this.resultKey}></textarea>
                  <div class="copy-row">
                    <button type="button" @click=${this.handleCopyKey}>Copy Key</button>
                    ${this.copyState === 'copied' ? html`<span class="toast ok">Copied!</span>` : null}
                    ${
                      this.copyState === 'failed'
                        ? html`<span class="toast error">Clipboard unavailable. Key text selected for manual copy.</span>`
                        : null
                    }
                  </div>
                  <div class="label">This key will not be shown again.</div>
                </div>
              `
            : null
        }

        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : null}

        <div class="actions">
          <button type="button" @click=${this.handleClose} ?disabled=${this.loading}>Close</button>
          <button
            type="button"
            class="primary ${this.action}"
            @click=${this.handleExecute}
            ?disabled=${this.loading || !this.credentialId}
          >
            ${primaryLabel}
          </button>
        </div>
      </section>
    `;
  }

  private handleExpirationDateInput(event: Event): void {
    this.expirationDateInput = (event.target as HTMLInputElement).value;
  }

  private handleExecute(): void {
    const expirationDays = this.parseExpirationDaysFromDate();
    if (!expirationDays) {
      this.errorMessage = 'Expiration date is required and must be between tomorrow and 365 days.';
      return;
    }

    this.dispatchEvent(
      new CustomEvent<KeyActionExecuteDetail>('key-action-execute', {
        detail: {
          credentialId: this.credentialId,
          slot: this.keySlot,
          action: this.action,
          expirationDays
        },
        bubbles: true,
        composed: true
      })
    );
  }

  private async handleCopyKey(): Promise<void> {
    if (!this.resultKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.resultKey);
      this.copyState = 'copied';
      this.resetCopyToastAfterDelay();
    } catch {
      this.copyState = 'failed';
      this.selectGeneratedKey();
      this.resetCopyToastAfterDelay();
    }
  }

  private handleClose(): void {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('key-action-close', {
        bubbles: true,
        composed: true
      })
    );
  }

  private parseExpirationDaysFromDate(): number | undefined {
    const value = this.expirationDateInput.trim();
    if (!value) {
      return undefined;
    }

    const selectedAt = Date.parse(`${value}T00:00:00`);
    if (Number.isNaN(selectedAt)) {
      return undefined;
    }

    const now = new Date();
    const todayAt = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const days = Math.round((selectedAt - todayAt) / 86_400_000);
    if (days < 1 || days > 365) {
      return undefined;
    }

    return days;
  }

  private purgeKeyFromState(): void {
    this.resultKey = null;
    this.copyState = 'idle';
    this.errorMessage = '';
    this.expirationDateInput = '';
    const textarea = this.renderRoot.querySelector<HTMLTextAreaElement>('#generated-key');
    if (textarea) {
      textarea.value = '';
    }
  }

  private selectGeneratedKey(): void {
    const textarea = this.renderRoot.querySelector<HTMLTextAreaElement>('#generated-key');
    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.select();
  }

  private resetCopyToastAfterDelay(): void {
    this.clearCopyTimer();
    this.copyTimer = setTimeout(() => {
      this.copyState = 'idle';
      this.copyTimer = null;
    }, 2000);
  }

  private clearCopyTimer(): void {
    if (this.copyTimer) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
  }
}

if (!customElements.get('key-action-modal')) {
  customElements.define('key-action-modal', KeyActionModalElement);
}

function formatDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinExpirationDateInput(): string {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return formatDateInput(value);
}

function getMaxExpirationDateInput(): string {
  const value = new Date();
  value.setDate(value.getDate() + 365);
  return formatDateInput(value);
}

function getDefaultExpirationDateInput(): string {
  const value = new Date();
  value.setDate(value.getDate() + 60);
  return formatDateInput(value);
}
