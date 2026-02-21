import { LitElement, css, html } from 'lit';
import { categorizeExpiration } from '../logic/expiration.js';
import type { ExpirationCategory } from '../types/models.js';

export class ExpirationBadgeElement extends LitElement {
  public static override properties = {
    expiration: { type: String },
    nonExpiring: { type: Boolean, attribute: 'non-expiring' },
    keyLabel: { type: String, attribute: 'key-label' }
  };

  public static override styles = css`
    :host {
      display: inline-block;
      --akm-font: var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif);
      font-family: var(--akm-font);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 0;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--vscode-panel-border, #d0d7de);
      background: var(--vscode-editor-background, #ffffff);
      line-height: 1.2;
      letter-spacing: 0.01em;
    }

    .ok {
      color: var(--vscode-editor-foreground, #18202a);
    }

    .warning {
      color: var(--vscode-editorWarning-foreground, #8a4b00);
      border-color: var(--vscode-editorWarning-foreground, #8a4b00);
    }

    .critical {
      color: var(--vscode-errorForeground, #b42318);
      border-color: var(--vscode-errorForeground, #b42318);
    }

    .expired {
      color: var(--vscode-descriptionForeground, #57606a);
      text-decoration: line-through;
    }
  `;

  public expiration: string = '';
  public nonExpiring: boolean = false;
  public keyLabel: string = '';

  public override render() {
    if (this.nonExpiring) {
      const prefix = this.keyLabel ? `${this.keyLabel} · ` : '';
      return html`<span class="badge ok">${prefix}✓ Doesn't expire</span>`;
    }

    const category = this.getCategory();
    const text = this.getLabel(category);

    return html`<span class="badge ${category}" title=${this.expiration}>${text}</span>`;
  }

  private getCategory(): ExpirationCategory {
    try {
      return categorizeExpiration(this.expiration);
    } catch {
      return 'expired';
    }
  }

  private getLabel(category: ExpirationCategory): string {
    const dateLabel = this.expiration ? new Date(this.expiration).toLocaleDateString() : 'Unknown';
    const prefix = this.keyLabel ? `${this.keyLabel} · ` : '';

    if (category === 'ok') {
      return `${prefix}✓ Healthy · ${dateLabel}`;
    }

    if (category === 'warning') {
      return `${prefix}⚠ Expiring Soon · ${dateLabel}`;
    }

    if (category === 'critical') {
      return `${prefix}⚠ Critical · ${dateLabel}`;
    }

    return `${prefix}✕ Expired · ${dateLabel}`;
  }
}

if (!customElements.get('expiration-badge')) {
  customElements.define('expiration-badge', ExpirationBadgeElement);
}
