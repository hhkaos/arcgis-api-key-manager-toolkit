import { LitElement, css, html } from 'lit';
import type { EnvironmentType } from '../types/models.js';

export interface ConfigSubmitDetail {
  type: EnvironmentType;
  clientId: string;
  portalUrl?: string;
}

export class ConfigGateElement extends LitElement {
  public static override properties = {
    errorMessage: { type: String, attribute: 'error-message' },
    submitting: { type: Boolean }
  };

  public static override styles = css`
    :host {
      display: block;
      --akm-font: var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif);
      --akm-text: var(--vscode-editor-foreground, #18202a);
      --akm-muted: var(--vscode-descriptionForeground, #4d5a69);
      --akm-border: var(--vscode-panel-border, #c6d0db);
      --akm-surface: var(--vscode-sideBar-background, #f7fafc);
      --akm-primary: var(--vscode-button-background, #0b63ce);
      --akm-primary-foreground: var(--vscode-button-foreground, #ffffff);
      --akm-input-bg: var(--vscode-input-background, #ffffff);
      --akm-input-fg: var(--vscode-input-foreground, #18202a);
      --akm-input-border: var(--vscode-input-border, var(--akm-border));
      --akm-focus: var(--vscode-focusBorder, #8fbef5);
      font-family: var(--akm-font);
    }

    form {
      display: grid;
      gap: 10px;
      max-width: 560px;
      padding: 12px;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      background: var(--akm-surface);
    }

    label {
      display: grid;
      gap: 4px;
      font-size: 11px;
      color: var(--akm-muted);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    input,
    select,
    button {
      padding: 7px 8px;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      font-size: 13px;
      font-family: var(--akm-font);
      min-height: 34px;
      box-sizing: border-box;
      background: var(--akm-input-bg);
      color: var(--akm-input-fg);
      border-color: var(--akm-input-border);
    }

    input:focus,
    select:focus,
    button:focus {
      outline: 2px solid var(--akm-focus);
      outline-offset: 1px;
    }

    .error {
      color: #b42318;
      font-size: 13px;
    }

    button {
      cursor: pointer;
      width: max-content;
      background: var(--akm-primary);
      color: var(--akm-primary-foreground);
      border-color: var(--akm-primary);
      font-weight: 600;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  `;

  private selectedType: EnvironmentType = 'online';
  private clientId = '';
  private portalUrl = '';

  public errorMessage: string = '';
  public submitting: boolean = false;

  public override render() {
    const showPortalUrl = this.selectedType === 'enterprise';

    return html`
      <form @submit=${this.handleSubmit}>
        <label>
          Environment Type
          <select @change=${this.handleTypeChange} ?disabled=${this.submitting}>
            <option value="online">ArcGIS Online</option>
            <option value="location-platform">Location Platform</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>

        <label>
          Client ID
          <input
            type="text"
            .value=${this.clientId}
            @input=${this.handleClientIdInput}
            placeholder="ArcGIS OAuth client ID"
            ?disabled=${this.submitting}
            required
          />
        </label>

        ${
          showPortalUrl
            ? html`<label>
                Enterprise Portal URL
                <input
                  type="url"
                  .value=${this.portalUrl}
                  @input=${this.handlePortalUrlInput}
                  placeholder="https://gis.example.com/portal"
                  ?disabled=${this.submitting}
                  required
                />
              </label>`
            : null
        }

        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : null}

        <button type="submit" ?disabled=${this.submitting}>${this.submitting ? 'Saving...' : 'Save Environment'}</button>
      </form>
    `;
  }

  private handleTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedType = target.value as EnvironmentType;
    if (this.selectedType !== 'enterprise') {
      this.portalUrl = '';
    }
    this.requestUpdate();
  }

  private handleClientIdInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.clientId = target.value;
  }

  private handlePortalUrlInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.portalUrl = target.value;
  }

  private handleSubmit(event: Event): void {
    event.preventDefault();

    const detail: ConfigSubmitDetail = {
      type: this.selectedType,
      clientId: this.clientId.trim()
    };

    if (this.selectedType === 'enterprise') {
      detail.portalUrl = this.portalUrl.trim();
    }

    this.dispatchEvent(
      new CustomEvent<ConfigSubmitDetail>('config-submit', {
        detail,
        bubbles: true,
        composed: true
      })
    );
  }
}

if (!customElements.get('config-gate')) {
  customElements.define('config-gate', ConfigGateElement);
}
