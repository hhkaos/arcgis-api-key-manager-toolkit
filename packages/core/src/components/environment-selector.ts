import { LitElement, css, html } from 'lit';
import type { EnvironmentConfig } from '../types/models.js';

export interface EnvironmentChangeDetail {
  environmentId: string;
}

export class EnvironmentSelectorElement extends LitElement {
  public static override properties = {
    environments: { attribute: false },
    activeEnvironmentId: { type: String, attribute: 'active-environment-id' },
    disabled: { type: Boolean }
  };

  public static override styles = css`
    :host {
      display: inline-block;
      --akm-font: var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif);
      --akm-muted: var(--vscode-descriptionForeground, #4d5a69);
      --akm-text: var(--vscode-editor-foreground, #18202a);
      --akm-border: var(--vscode-panel-border, #c6d0db);
      --akm-input-bg: var(--vscode-input-background, #ffffff);
      --akm-input-border: var(--vscode-input-border, var(--akm-border));
      --akm-focus: var(--vscode-focusBorder, #8fbef5);
      font-family: var(--akm-font);
    }

    label {
      display: grid;
      gap: 4px;
      font-size: 11px;
      color: var(--akm-muted);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    select {
      min-width: 260px;
      padding: 7px 8px;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      font-size: 13px;
      color: var(--akm-text);
      background: var(--akm-input-bg);
      border-color: var(--akm-input-border);
      min-height: 34px;
      box-sizing: border-box;
      font-family: var(--akm-font);
    }

    select:focus {
      outline: 2px solid var(--akm-focus);
      outline-offset: 1px;
    }
  `;

  public environments: EnvironmentConfig[] = [];
  public activeEnvironmentId: string | null = null;
  public disabled: boolean = false;

  public override render() {
    return html`
      <label>
        Active Environment
        <select @change=${this.handleChange} ?disabled=${this.disabled}>
          <option value="">Select environment</option>
          ${this.environments.map(
            (environment) => html`
              <option value=${environment.id} ?selected=${environment.id === this.activeEnvironmentId}>
                ${environment.name}
              </option>
            `
          )}
        </select>
      </label>
    `;
  }

  private handleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const nextEnvironmentId = target.value;

    if (!nextEnvironmentId) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent<EnvironmentChangeDetail>('environment-change', {
        detail: { environmentId: nextEnvironmentId },
        bubbles: true,
        composed: true
      })
    );
  }
}

if (!customElements.get('environment-selector')) {
  customElements.define('environment-selector', EnvironmentSelectorElement);
}
