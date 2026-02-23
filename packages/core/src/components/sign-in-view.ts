import { LitElement, css, html } from 'lit';
import './icon.js';

export class SignInViewElement extends LitElement {
  public static override properties = {
    loading: { type: Boolean },
    disabled: { type: Boolean },
    errorMessage: { type: String, attribute: 'error-message' },
    acknowledged: { type: Boolean }
  };

  public static override styles = css`
    :host {
      display: block;
      --akm-font: var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif);
      --akm-text: var(--vscode-editor-foreground, #18202a);
      --akm-border: var(--vscode-panel-border, #c6d0db);
      --akm-surface: var(--vscode-sideBar-background, #f7fafc);
      --akm-primary: var(--vscode-button-background, #0b63ce);
      --akm-primary-foreground: var(--vscode-button-foreground, #ffffff);
      --akm-focus: var(--vscode-focusBorder, #8fbef5);
      font-family: var(--akm-font);
    }

    .card {
      display: grid;
      gap: 10px;
      max-width: 560px;
      padding: 12px;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      background: var(--akm-surface);
    }

    p {
      margin: 0;
      color: var(--akm-text);
      font-size: 13px;
    }

    .error {
      color: #b42318;
      font-size: 13px;
    }

    .disclaimer {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      border-left: 3px solid #d97706;
      padding-left: 8px;
      font-size: 12px;
      line-height: 1.4;
    }

    .disclaimer a {
      color: var(--akm-primary);
    }

    .acknowledge {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      line-height: 1.4;
      cursor: pointer;
    }

    .acknowledge input[type='checkbox'] {
      margin: 2px 0 0 0;
    }

    button {
      width: max-content;
      border: 1px solid var(--akm-primary);
      border-radius: 0;
      background: var(--akm-primary);
      color: var(--akm-primary-foreground);
      font-weight: 600;
      font-family: var(--akm-font);
      font-size: 12px;
      padding: 7px 10px;
      cursor: pointer;
      min-height: 33px;
    }

    button:focus {
      outline: 2px solid var(--akm-focus);
      outline-offset: 1px;
    }

    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `;

  public loading: boolean = false;
  public disabled: boolean = false;
  public errorMessage: string = '';
  public acknowledged: boolean = false;

  public override render() {
    return html`
      <div class="card">
        <p>Sign in to load your API key credentials for the active environment.</p>
        <p class="disclaimer">
          <akm-icon name="alert-triangle" size="14" label="Warning"></akm-icon>
          <span>
            This is an experimental side project created for fun and personal use. It is not an official Esri project, so use it at your own risk. If you still decide to use it, you can report bugs or share any feedback at <a href="https://github.com/hhkaos/arcgis-api-key-manager-toolkit/issues" target="_blank" rel="noopener noreferrer">the GitHub repo issues</a>.
          </span>
        </p>
        <label class="acknowledge">
          <input type="checkbox" .checked=${this.acknowledged} @change=${this.handleAcknowledgementChange} />
          <span>I have read the warning message above and I understand I want to proceed.</span>
        </label>
        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : null}
        <button @click=${this.handleSignIn} ?disabled=${this.loading || this.disabled || !this.acknowledged}>
          ${this.loading ? 'Signing in...' : 'Sign in with ArcGIS'}
        </button>
      </div>
    `;
  }

  private handleSignIn(): void {
    this.dispatchEvent(
      new CustomEvent('sign-in', {
        bubbles: true,
        composed: true
      })
    );
  }

  private handleAcknowledgementChange(event: Event): void {
    this.acknowledged = (event.target as HTMLInputElement).checked;
  }
}

if (!customElements.get('sign-in-view')) {
  customElements.define('sign-in-view', SignInViewElement);
}
