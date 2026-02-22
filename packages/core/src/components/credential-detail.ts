import { LitElement, css, html } from 'lit';
import { analyzeReferrers } from '../logic/referrers.js';
import type { ApiKeyCredential, KeySlotStatus } from '../types/models.js';
import './expiration-badge.js';

export interface KeyActionRequestDetail {
  credentialId: string;
  slot: 1 | 2;
  action: 'create' | 'regenerate' | 'revoke';
}

export class CredentialDetailElement extends LitElement {
  public static override properties = {
    credential: { attribute: false },
    loading: { type: Boolean },
    errorMessage: { type: String, attribute: 'error-message' }
  };

  public static override styles = css`
    :host {
      display: block;
      --akm-font: var(--vscode-font-family, 'Manrope', 'Segoe UI', 'Helvetica Neue', sans-serif);
      --akm-text: var(--vscode-editor-foreground, #18202a);
      --akm-muted: var(--vscode-descriptionForeground, #4d5a69);
      --akm-border: var(--vscode-panel-border, #c6d0db);
      --akm-surface: var(--vscode-sideBar-background, #f7fafc);
      --akm-surface-raised: var(--vscode-editor-background, #ffffff);
      --akm-primary: var(--vscode-button-background, #0b63ce);
      --akm-primary-foreground: var(--vscode-button-foreground, #ffffff);
      --akm-focus: var(--vscode-focusBorder, #8fbef5);
      font-family: var(--akm-font);
      color: var(--akm-text);
    }

    .panel {
      display: grid;
      gap: 10px;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      background: var(--akm-surface);
      padding: 10px;
    }

    h2 {
      margin: 0;
      font-size: 17px;
      color: var(--akm-text);
    }

    h3 {
      margin: 0;
      font-size: 13px;
      color: var(--akm-text);
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .section {
      display: grid;
      gap: 6px;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      padding: 8px;
      background: var(--akm-surface-raised);
    }

    .meta-grid {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .label {
      color: var(--akm-muted);
      font-size: 11px;
      margin-bottom: 2px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .value {
      color: var(--akm-text);
      font-size: 13px;
    }

    .chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .chip {
      border: 1px solid var(--akm-border);
      background: var(--vscode-badge-background, #eff4f9);
      color: var(--akm-text);
      border-radius: 0;
      padding: 3px 7px;
      font-size: 11px;
    }

    .referrer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      padding: 7px;
      font-size: 12px;
      background: var(--akm-surface-raised);
    }

    .referrer.warn {
      border-color: var(--vscode-editorWarning-foreground, #8a4b00);
    }

    .note {
      color: var(--akm-muted);
      font-size: 11px;
    }

    .warning {
      color: var(--vscode-editorWarning-foreground, #8a4b00);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .slot-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }

    .slot-card {
      border: 1px solid var(--akm-border);
      border-radius: 0;
      padding: 8px;
      display: grid;
      gap: 6px;
      background: var(--akm-surface-raised);
    }

    button {
      border: 1px solid var(--akm-primary);
      border-radius: 0;
      background: var(--akm-primary);
      color: var(--akm-primary-foreground);
      font-weight: 600;
      font-family: var(--akm-font);
      padding: 7px 9px;
      cursor: pointer;
      width: max-content;
      min-height: 33px;
      font-size: 12px;
    }

    button.regenerate,
    button.revoke {
      border-color: var(--vscode-errorForeground, #b42318);
      background: var(--akm-surface-raised);
      color: var(--vscode-errorForeground, #b42318);
    }

    .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    button:focus {
      outline: 2px solid var(--akm-focus);
      outline-offset: 1px;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .empty,
    .error {
      font-size: 12px;
    }

    .empty {
      color: var(--akm-muted);
    }

    .error {
      color: var(--vscode-errorForeground, #b42318);
    }
  `;

  public credential: ApiKeyCredential | null = null;
  public loading: boolean = false;
  public errorMessage: string = '';

  public override render() {
    if (this.loading) {
      return html`<div class="panel"><div class="empty">Loading credential detail...</div></div>`;
    }

    if (this.errorMessage) {
      return html`<div class="panel"><div class="error">${this.errorMessage}</div></div>`;
    }

    if (!this.credential) {
      return html`<div class="panel"><div class="empty">Select a credential to view details.</div></div>`;
    }

    const referrerAnnotations = analyzeReferrers(this.credential.referrers);

    return html`
      <section class="panel">
        <h2>${this.credential.name}</h2>

        <div class="section">
          <h3>Metadata</h3>
          <div class="meta-grid">
            <div>
              <div class="label">Credential ID</div>
              <div class="value">${this.credential.id}</div>
            </div>
            <div>
              <div class="label">Created</div>
              <div class="value">${new Date(this.credential.created).toLocaleString()}</div>
            </div>
            ${this.credential.isLegacy
              ? html`<div>
                  <div class="label">Expiration</div>
                  <div class="value">
                    <expiration-badge
                      .expiration=${this.credential.expiration}
                      .nonExpiring=${true}
                    ></expiration-badge>
                  </div>
                </div>`
              : null}
            <div>
              <div class="label">Tags</div>
              <div class="value">${this.credential.tags.join(', ') || 'No tags'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h3>Privileges</h3>
          ${
            this.credential.privileges.length === 0
              ? html`<div class="empty">No privileges available.</div>`
              : html`<div class="chip-list">
                  ${this.credential.privileges.map(
                    (privilege) => html`<span class="chip" title=${privilege}>${privilege}</span>`
                  )}
                </div>`
          }
        </div>

        <div class="section">
          <h3>Referrer Restrictions</h3>
          ${
            referrerAnnotations.length === 0
              ? html`<div class="empty">No referrer restrictions configured.</div>`
              : referrerAnnotations.map(
                  (annotation) => html`
                    <div class="referrer ${annotation.warning ? 'warn' : ''}">
                      <div>
                        <div class="value">${annotation.value}</div>
                        <div class="note">${this.getReferrerReason(annotation.reason)}</div>
                      </div>
                      ${annotation.warning ? html`<span class="warning">⚠ Review</span>` : null}
                    </div>
                  `
                )
          }
        </div>

        <div class="section">
          <h3>API Key Slots</h3>
          ${
            this.credential.isLegacy
              ? html`<div class="chip-list"><span class="chip">Legacy API key</span></div>`
              : html`<div class="slot-grid">
                  ${this.renderSlotCard(this.credential.key1)}
                  ${this.renderSlotCard(this.credential.key2)}
                </div>`
          }
        </div>
      </section>
    `;
  }

  private renderSlotCard(slot: KeySlotStatus) {
    const action = slot.exists ? 'regenerate' : 'create';
    const buttonText = slot.exists
      ? `↺ Regenerate API key ${slot.slot}`
      : slot.slot === 1
        ? '+ Generate a primary API key'
        : '+ Generate a secondary API key';

    return html`
      <div class="slot-card">
        <div>
          <div class="label">${slot.slot === 1 ? 'Primary key (slot 1)' : 'Secondary key (slot 2)'}</div>
          <div class="value">${slot.exists ? 'Exists' : 'Not created'}</div>
        </div>
        <div class="note">Partial ID: ${slot.partialId ?? 'N/A'}</div>
        <div class="note">
          Expires:
          ${slot.exists && slot.expiration
            ? html`<expiration-badge .expiration=${slot.expiration}></expiration-badge>`
            : html`<span>N/A</span>`}
        </div>
        <div class="button-row">
          <button
            type="button"
            class=${action}
            @click=${() => this.requestKeyAction(slot.slot, action)}
            ?disabled=${this.loading}
          >
            ${buttonText}
          </button>
          <button
            type="button"
            class="revoke"
            @click=${() => this.requestKeyAction(slot.slot, 'revoke')}
            ?disabled=${this.loading || !slot.exists}
          >
            ✕ Revoke API key ${slot.slot}
          </button>
        </div>
      </div>
    `;
  }

  private requestKeyAction(slot: 1 | 2, action: 'create' | 'regenerate' | 'revoke'): void {
    if (!this.credential) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent<KeyActionRequestDetail>('key-action-request', {
        detail: {
          credentialId: this.credential.id,
          slot,
          action
        },
        bubbles: true,
        composed: true
      })
    );
  }

  private getReferrerReason(reason: 'wildcard-only' | 'permissive-pattern' | 'none' | undefined): string {
    if (reason === 'wildcard-only') {
      return 'Wildcard-only rule can allow all origins.';
    }

    if (reason === 'permissive-pattern') {
      return 'Pattern may be too permissive. Verify this restriction.';
    }

    return 'Restriction looks specific.';
  }
}

if (!customElements.get('credential-detail')) {
  customElements.define('credential-detail', CredentialDetailElement);
}
