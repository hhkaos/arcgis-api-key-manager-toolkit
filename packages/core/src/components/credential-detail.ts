import { LitElement, css, html } from 'lit';
import { analyzeReferrers } from '../logic/referrers.js';
import type { ApiKeyCredential, EnvironmentType, KeySlotStatus } from '../types/models.js';
import './expiration-badge.js';

export interface KeyActionRequestDetail {
  credentialId: string;
  slot: 1 | 2;
  action: 'create' | 'regenerate' | 'revoke';
}

export interface CredentialUpdateRequestDetail {
  credentialId: string;
  title: string;
  snippet: string;
  tags: string[];
}

export interface CredentialReferrerUpdateRequestDetail {
  credentialId: string;
  referrers: string[];
}

export interface CredentialDeleteProtectionToggleRequestDetail {
  credentialId: string;
  protect: boolean;
}

export interface CredentialFavoriteToggleRequestDetail {
  credentialId: string;
  favorite: boolean;
}

export interface CredentialDeleteCheckRequestDetail {
  credentialId: string;
}

export interface CredentialDeleteExecuteRequestDetail {
  credentialId: string;
}

type EditingField = 'title' | 'snippet' | 'tags' | null;

export class CredentialDetailElement extends LitElement {
  public static override properties = {
    credential: { attribute: false },
    loading: { type: Boolean },
    errorMessage: { type: String, attribute: 'error-message' },
    portalBase: { type: String, attribute: 'portal-base' },
    environmentType: { type: String, attribute: 'environment-type' },
    availableTags: { attribute: false },
    _editingField: { state: true },
    _editTitle: { state: true },
    _editSnippet: { state: true },
    _editTags: { state: true },
    _tagInput: { state: true },
    _tagDropdownOpen: { state: true },
    _saving: { state: true },
    _editingReferrers: { state: true },
    _editReferrers: { state: true },
    _savingReferrers: { state: true },
    _showReferrerInstructions: { state: true },
    _updatingDeleteProtection: { state: true },
    _updatingFavorite: { state: true },
    _deleteCheckInFlight: { state: true },
    _deleteModalOpen: { state: true },
    _deleteModalCanDelete: { state: true },
    _deleteModalError: { state: true },
    _deleteInFlight: { state: true }
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

    h2 { margin: 0; font-size: 17px; color: var(--akm-text); }

    .header-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .title-wrap {
      display: grid;
      gap: 6px;
      min-width: 0;
      flex: 1;
    }

    .header-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .snippet { margin: 0; color: var(--akm-muted); font-size: 12px; line-height: 1.4; }

    .primary-action {
      border: 1px solid var(--akm-primary);
      border-radius: 0;
      background: var(--akm-primary);
      color: var(--akm-primary-foreground);
      font-weight: 600;
      font-family: var(--akm-font);
      padding: 7px 9px;
      cursor: pointer;
      height: 33px;
      box-sizing: border-box;
      font-size: 12px;
      line-height: 1.2;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .primary-action:focus { outline: 2px solid var(--akm-focus); outline-offset: 1px; }
    .primary-action:hover { filter: brightness(0.95); }

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

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    .section-links {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 12px;
    }

    .section-links a {
      color: var(--vscode-textLink-foreground, var(--akm-primary));
      text-decoration: none;
    }
    .section-links a:hover {
      color: var(--vscode-textLink-activeForeground, var(--akm-primary));
      text-decoration: underline;
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

    .value { color: var(--akm-text); font-size: 13px; }

    .chip-list { display: flex; flex-wrap: wrap; gap: 6px; }

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
    .referrer.warn { border-color: var(--vscode-editorWarning-foreground, #8a4b00); }

    .note { color: var(--akm-muted); font-size: 11px; }
    .note a { color: var(--vscode-textLink-foreground); }
    .note a:hover { color: var(--vscode-textLink-activeForeground); }

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

    button.danger {
      border-color: var(--vscode-errorForeground, #b42318);
      background: var(--vscode-errorForeground, #b42318);
      color: #ffffff;
    }

    button.confirm-save {
      min-height: unset;
      padding: 2px 8px;
      font-size: 11px;
    }

    button.confirm-cancel {
      min-height: unset;
      padding: 2px 8px;
      font-size: 11px;
      border-color: var(--akm-border);
      background: transparent;
      color: var(--akm-muted);
      font-weight: 400;
    }

    .button-row { display: flex; flex-wrap: wrap; gap: 6px; }

    .confirm-row { display: flex; gap: 4px; align-items: center; margin-top: 2px; }

    button:focus { outline: 2px solid var(--akm-focus); outline-offset: 1px; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }

    .empty, .error { font-size: 12px; }
    .empty { color: var(--akm-muted); }
    .error { color: var(--vscode-errorForeground, #b42318); }

    /* ── Inline editable fields ─────────────────────────────────── */

    /* Inline container for text + pencil side by side */
    .editable-field {
      display: inline-flex;
      align-items: baseline;
      gap: 5px;
      max-width: 100%;
      min-width: 0;
      width: 100%;
    }

    /* Stacked container used when field is active (input + confirm row) */
    .editable-field-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      min-width: 0;
    }

    .pencil-btn {
      opacity: 0;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--akm-muted);
      font-size: 11px;
      padding: 1px 4px;
      min-height: unset;
      width: auto;
      flex-shrink: 0;
      line-height: 1;
      font-weight: 400;
      transition: opacity 0.1s;
    }

    .editable-field:hover .pencil-btn,
    .editable-field-block:hover .pencil-btn {
      opacity: 1;
    }

    .pencil-btn:hover { color: var(--akm-primary); }

    /* Title input – same visual weight as h2 */
    .inline-title {
      font-size: 17px;
      font-weight: bold;
      font-family: var(--akm-font);
      color: var(--akm-text);
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--akm-border);
      padding: 0 0 2px 0;
      margin: 0;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      outline: none;
    }
    .inline-title:focus { border-bottom-color: var(--akm-focus); }

    /* Snippet textarea – same visual weight as .snippet */
    .inline-snippet {
      font-size: 12px;
      line-height: 1.4;
      font-family: var(--akm-font);
      color: var(--akm-muted);
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--akm-border);
      padding: 0 0 2px 0;
      margin: 0;
      width: 100%;
      box-sizing: border-box;
      resize: none;
      outline: none;
      min-height: 34px;
    }
    .inline-snippet:focus { border-bottom-color: var(--akm-focus); }

    .snippet-placeholder {
      font-size: 12px;
      color: var(--akm-border);
      font-style: italic;
      border-bottom: 1px dashed var(--akm-border);
      padding-bottom: 2px;
    }

    /* Tags field spans full grid width in edit mode */
    .tags-field { grid-column: 1 / -1; }

    /* ── Tag combobox ──────────────────────────────────────────── */

    .tag-editor { position: relative; width: 100%; }

    .tag-chips-input {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      border: 1px solid var(--akm-border);
      padding: 4px 6px;
      background: var(--akm-surface-raised);
      cursor: text;
      min-height: 33px;
    }
    .tag-chips-input:focus-within { outline: 2px solid var(--akm-focus); outline-offset: 1px; }

    .chip-removable {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      border: 1px solid var(--akm-border);
      background: var(--vscode-badge-background, #eff4f9);
      color: var(--akm-text);
      padding: 2px 4px 2px 7px;
      font-size: 11px;
    }

    .chip-remove {
      background: none;
      border: none;
      color: var(--akm-muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      min-height: unset;
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-weight: 400;
    }
    .chip-remove:hover { color: var(--vscode-errorForeground, #b42318); }

    .tag-input-field {
      border: none;
      outline: none;
      background: transparent;
      color: var(--akm-text);
      font-family: var(--akm-font);
      font-size: 12px;
      flex: 1;
      min-width: 80px;
      padding: 2px 0;
    }

    .tag-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--akm-surface-raised);
      border: 1px solid var(--akm-border);
      border-top: none;
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 180px;
      overflow-y: auto;
      z-index: 10;
    }

    .tag-dropdown-item {
      padding: 5px 8px;
      font-size: 12px;
      cursor: pointer;
      color: var(--akm-text);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tag-dropdown-item:hover,
    .tag-dropdown-item:focus { background: var(--vscode-list-hoverBackground, rgba(0,0,0,0.05)); outline: none; }

    .tag-dropdown-item.add-option { color: var(--akm-primary); border-bottom: 1px solid var(--akm-border); }

    .collapsible-help {
      border: 1px solid var(--akm-border);
      padding: 6px 8px;
      background: var(--akm-surface-raised);
      font-size: 12px;
      color: var(--akm-muted);
    }

    .collapsible-help summary {
      cursor: pointer;
      color: var(--akm-text);
      font-weight: 600;
      outline: none;
    }

    .collapsible-help p {
      margin: 6px 0 0 0;
      line-height: 1.4;
    }

    .collapsible-help a {
      color: var(--akm-primary);
    }

    .referrer-editor-list {
      display: grid;
      gap: 8px;
    }

    .referrer-input-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
    }

    .referrer-input-row input {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--akm-border);
      border-radius: 0;
      padding: 7px 8px;
      font-size: 12px;
      color: var(--akm-text);
      background: var(--akm-surface-raised);
      font-family: var(--akm-font);
    }

    .referrer-delete {
      border-color: var(--vscode-errorForeground, #b42318);
      background: transparent;
      color: var(--vscode-errorForeground, #b42318);
    }

    button.secondary {
      border-color: var(--akm-border);
      background: transparent;
      color: var(--akm-muted);
      font-weight: 400;
    }

    button.full-width {
      width: 100%;
      box-sizing: border-box;
    }

    .referrer-controls {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .toggle-description {
      color: var(--akm-muted);
      font-size: 12px;
    }

    .switch {
      position: relative;
      display: inline-flex;
      align-items: center;
      width: 44px;
      height: 24px;
      border: 1px solid var(--akm-border);
      background: var(--akm-surface);
      cursor: pointer;
      padding: 0;
      min-height: unset;
    }

    .switch::after {
      content: '';
      position: absolute;
      width: 18px;
      height: 18px;
      left: 2px;
      top: 2px;
      background: var(--akm-muted);
      transition: transform 0.15s ease;
    }

    .switch.on {
      border-color: var(--akm-primary);
      background: rgba(11, 99, 206, 0.15);
    }

    .switch.on::after {
      transform: translateX(20px);
      background: var(--akm-primary);
    }

    .delete-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: grid;
      place-items: center;
      z-index: 1000;
      padding: 16px;
      box-sizing: border-box;
    }

    .delete-modal {
      width: min(460px, 100%);
      border: 1px solid var(--akm-border);
      background: var(--akm-surface-raised);
      padding: 12px;
      display: grid;
      gap: 10px;
    }

    .delete-modal p {
      margin: 0;
      font-size: 13px;
      color: var(--akm-text);
      line-height: 1.4;
    }

    .delete-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }
  `;

  public credential: ApiKeyCredential | null = null;
  public loading: boolean = false;
  public errorMessage: string = '';
  public portalBase: string = '';
  public environmentType: EnvironmentType | null = null;
  public availableTags: string[] = [];

  private _editingField: EditingField = null;
  private _editTitle: string = '';
  private _editSnippet: string = '';
  private _editTags: string[] = [];
  private _tagInput: string = '';
  private _tagDropdownOpen: boolean = false;
  private _saving: boolean = false;
  private _editingReferrers: boolean = false;
  private _editReferrers: string[] = [];
  private _savingReferrers: boolean = false;
  private _showReferrerInstructions: boolean = false;
  private _cancelRequested: boolean = false;
  private _updatingDeleteProtection: boolean = false;
  private _updatingFavorite: boolean = false;
  private _deleteCheckInFlight: boolean = false;
  private _deleteModalOpen: boolean = false;
  private _deleteModalCanDelete: boolean | null = null;
  private _deleteModalError: string = '';
  private _deleteInFlight: boolean = false;

  public override updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('credential')) {
      if (this._saving) {
        this._saving = false;
        this._editingField = null;
      }

      if (this._savingReferrers) {
        this._savingReferrers = false;
        this._editingReferrers = false;
      }

      this._updatingDeleteProtection = false;
      this._updatingFavorite = false;
      this._deleteCheckInFlight = false;
      this._deleteInFlight = false;
    }

    if (changedProperties.has('errorMessage') && this._savingReferrers) {
      this._savingReferrers = false;
    }

    if (changedProperties.has('errorMessage') && this.errorMessage) {
      this._updatingDeleteProtection = false;
      this._updatingFavorite = false;
      if (this._deleteModalOpen) {
        this._deleteModalError = this.errorMessage;
      }
      this._deleteCheckInFlight = false;
      this._deleteInFlight = false;
    }
  }

  public handleDeleteCheckResult(canDelete: boolean): void {
    this._deleteCheckInFlight = false;
    this._deleteModalOpen = true;
    this._deleteModalCanDelete = canDelete;
    this._deleteModalError = '';
  }

  public handleCredentialDeleted(): void {
    this._deleteModalOpen = false;
    this._deleteModalCanDelete = null;
    this._deleteModalError = '';
    this._deleteInFlight = false;
    this._deleteCheckInFlight = false;
  }

  public handleOperationError(message: string): void {
    this._updatingDeleteProtection = false;
    this._updatingFavorite = false;
    this._deleteCheckInFlight = false;
    this._deleteInFlight = false;
    if (this._deleteModalOpen) {
      this._deleteModalError = message;
    }
  }

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
    const settingsHref = this.portalBase
      ? `${this.portalBase}/home/item.html?id=${this.credential.id}#settings`
      : '';
    const openInPortalHref = this.getOpenInPortalHref();

    const privilegesDocUrl = this.environmentType === 'online'
      ? 'https://developers.arcgis.com/documentation/security-and-authentication/reference/privileges/online/'
      : this.environmentType === 'location-platform'
        ? 'https://developers.arcgis.com/documentation/security-and-authentication/reference/privileges/location-platform/'
        : this.environmentType === 'enterprise'
          ? 'https://developers.arcgis.com/documentation/security-and-authentication/reference/privileges/enterprise/'
          : null;

    return html`
      <section class="panel">
        <div class="header-row">
          <div class="title-wrap">
            ${this.renderTitleField()}
            ${this.renderSnippetField()}
          </div>
          <div class="header-actions">
            ${openInPortalHref
              ? html`<a
                  class="primary-action"
                  href=${openInPortalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >Open in Portal</a>`
              : null}
            <button
              type="button"
              class="primary-action"
              @click=${this.toggleFavorite}
              ?disabled=${this.loading || this._updatingFavorite}
            >${this._updatingFavorite
                ? '...'
                : this.credential.isFavorite
                  ? 'Remove from favorite'
                  : 'Mark as Favorite'}</button>
          </div>
        </div>

        <div class="section">
          <h3>Deletion Management</h3>
          <div class="toggle-description">
            Prevent this item from being accidentally deleted.
          </div>
          <div class="toggle-row">
            <div class="note">${this.credential.isDeleteProtected ? 'Delete protection is on.' : 'Delete protection is off.'}</div>
            <button
              type="button"
              role="switch"
              aria-label="Prevent this item from being accidentally deleted."
              aria-checked=${String(this.credential.isDeleteProtected)}
              class="switch ${this.credential.isDeleteProtected ? 'on' : ''}"
              @click=${this.toggleDeleteProtection}
              ?disabled=${this.loading || this._updatingDeleteProtection}
            ></button>
          </div>
        </div>

        <div class="section">
          <h3>API Key Slots</h3>
          ${this.credential.isLegacy
            ? html`<div class="chip-list"><span class="chip">Legacy API key</span></div>`
            : html`<div class="slot-grid">
                ${this.renderSlotCard(this.credential.key1)}
                ${this.renderSlotCard(this.credential.key2)}
              </div>`}
        </div>

        <div class="section">
          <div class="section-header">
            <h3>Privileges</h3>
            <div class="section-links">
              ${settingsHref
                ? html`<a
                    href="${settingsHref}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >Edit ↗</a>`
                : null}
              ${privilegesDocUrl
                ? html`<a
                    href="${privilegesDocUrl}#list-of-privileges"
                    target="_blank"
                    rel="noopener noreferrer"
                  >View privilege reference ↗</a>`
                : null}
            </div>
          </div>
          ${this.credential.privileges.length === 0
            ? html`<div class="empty">No privileges available.</div>`
            : html`<div class="chip-list">
                ${this.credential.privileges.map(
                  (p) => html`<span class="chip" title=${p}>${p}</span>`
                )}
              </div>`}
        </div>

        <div class="section">
          <h3>Referrer Restrictions</h3>
          ${this._editingReferrers
            ? this.renderReferrerEditor()
            : html`
                ${referrerAnnotations.length === 0
                  ? html`<div class="empty">No referrer restrictions configured.</div>`
                  : referrerAnnotations.map(
                      (a) => html`
                        <div class="referrer ${a.warning ? 'warn' : ''}">
                          <div>
                            <div class="value">${a.value}</div>
                            <div class="note">${this.getReferrerReason(a.reason)}</div>
                          </div>
                          ${a.warning ? html`<span class="warning">Review</span>` : null}
                        </div>
                      `
                    )}
                <div class="referrer-controls">
                  <button
                    type="button"
                    class="full-width"
                    @click=${this.startReferrerEdit}
                    ?disabled=${this.loading}
                  >✎ Edit referrers</button>
                </div>
              `}
        </div>

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
            <div class=${this._editingField === 'tags' ? 'tags-field' : ''}>
              <div class="label">Tags</div>
              ${this.renderTagsField()}
            </div>
          </div>
        </div>

        <button
          type="button"
          class="danger full-width"
          @click=${this.requestDeleteCheck}
          ?disabled=${this.loading || this._deleteCheckInFlight || this._deleteInFlight}
        >${this._deleteCheckInFlight ? 'Checking...' : 'Delete item (API key)'}</button>
      </section>
      ${this.renderDeleteModal()}
    `;
  }

  private renderTitleField() {
    if (!this.credential) return null;

    if (this._editingField === 'title') {
      return html`
        <div
          class="editable-field-block"
          @focusout=${(e: FocusEvent) => this.handleFieldFocusOut('title', e)}
        >
          <input
            type="text"
            class="inline-title"
            .value=${this._editTitle}
            @input=${(e: Event) => { this._editTitle = (e.target as HTMLInputElement).value; }}
            ?disabled=${this._saving}
            aria-label="Title"
          />
          ${this.renderConfirmRow()}
        </div>
      `;
    }

    return html`
      <div class="editable-field">
        <h2>${this.credential.name}</h2>
        <button
          type="button"
          class="pencil-btn"
          title="Edit title"
          @click=${() => this.startEdit('title')}
          ?disabled=${this.loading}
        >✎</button>
      </div>
    `;
  }

  private renderSnippetField() {
    if (!this.credential) return null;

    if (this._editingField === 'snippet') {
      return html`
        <div
          class="editable-field-block"
          @focusout=${(e: FocusEvent) => this.handleFieldFocusOut('snippet', e)}
        >
          <textarea
            class="inline-snippet"
            .value=${this._editSnippet}
            @input=${(e: Event) => { this._editSnippet = (e.target as HTMLTextAreaElement).value; }}
            placeholder="Snippet (optional)"
            rows="2"
            ?disabled=${this._saving}
            aria-label="Snippet"
          ></textarea>
          ${this.renderConfirmRow()}
        </div>
      `;
    }

    if (this.credential.snippet) {
      return html`
        <div class="editable-field">
          <p class="snippet">${this.credential.snippet}</p>
          <button
            type="button"
            class="pencil-btn"
            title="Edit snippet"
            @click=${() => this.startEdit('snippet')}
            ?disabled=${this.loading}
          >✎</button>
        </div>
      `;
    }

    return html`
      <div class="editable-field">
        <span class="snippet-placeholder">No snippet</span>
        <button
          type="button"
          class="pencil-btn"
          title="Add snippet"
          @click=${() => this.startEdit('snippet')}
          ?disabled=${this.loading}
        >✎</button>
      </div>
    `;
  }

  private renderTagsField() {
    if (!this.credential) return null;

    if (this._editingField === 'tags') {
      return html`
        <div @focusout=${(e: FocusEvent) => this.handleFieldFocusOut('tags', e)}>
          ${this.renderTagEditor()}
          ${this.renderConfirmRow()}
        </div>
      `;
    }

    return html`
      <div class="editable-field">
        <div class="value">${this.credential.tags.join(', ') || 'No tags'}</div>
        <button
          type="button"
          class="pencil-btn"
          title="Edit tags"
          @click=${() => this.startEdit('tags')}
          ?disabled=${this.loading}
        >✎</button>
      </div>
    `;
  }

  private renderConfirmRow() {
    return html`
      <div class="confirm-row">
        <button
          type="button"
          class="confirm-save"
          @click=${() => { this.saveCurrentField(); }}
          ?disabled=${this._saving}
        >${this._saving ? '...' : '✓ Save'}</button>
        <button
          type="button"
          class="confirm-cancel"
          @mousedown=${() => { this._cancelRequested = true; }}
          @click=${() => { this.cancelEdit(); }}
        >✕ Cancel</button>
      </div>
    `;
  }

  private renderTagEditor() {
    return html`
      <div class="tag-editor">
        <div class="tag-chips-input">
          ${this._editTags.map(
            (tag) => html`
              <span class="chip-removable">
                ${tag}
                <button
                  type="button"
                  class="chip-remove"
                  @click=${() => { this.removeTag(tag); }}
                  title="Remove tag"
                >×</button>
              </span>
            `
          )}
          <input
            type="text"
            class="tag-input-field"
            placeholder=${this._editTags.length === 0 ? 'Add tags' : ''}
            .value=${this._tagInput}
            @input=${this.handleTagInput}
            @focus=${() => { this._tagDropdownOpen = true; }}
            @keydown=${this.handleTagKeydown}
            ?disabled=${this._saving}
          />
        </div>
        ${this._tagDropdownOpen ? this.renderTagDropdown() : null}
      </div>
    `;
  }

  private renderTagDropdown() {
    const inputTrimmed = this._tagInput.trim();
    const inputLower = inputTrimmed.toLowerCase();

    const available = (this.availableTags ?? [])
      .filter((tag) => !this._editTags.includes(tag))
      .filter((tag) => !inputLower || tag.toLowerCase().includes(inputLower));

    const showAddOption =
      inputTrimmed.length > 0 &&
      !this._editTags.some((t) => t.toLowerCase() === inputLower) &&
      !this.availableTags.some((t) => t.toLowerCase() === inputLower);

    if (!showAddOption && available.length === 0) return null;

    return html`
      <ul class="tag-dropdown">
        ${showAddOption
          ? html`<li
              class="tag-dropdown-item add-option"
              tabindex="0"
              @mousedown=${(e: MouseEvent) => { e.preventDefault(); this.addTag(inputTrimmed); }}
              @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.addTag(inputTrimmed); }}
            >Add: <strong>${inputTrimmed}</strong></li>`
          : null}
        ${available.map(
          (tag) => html`<li
            class="tag-dropdown-item"
            tabindex="0"
            @mousedown=${(e: MouseEvent) => { e.preventDefault(); this.addTag(tag); }}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.addTag(tag); }}
          >${tag}</li>`
        )}
      </ul>
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
          >${buttonText}</button>
          <button
            type="button"
            class="revoke"
            @click=${() => this.requestKeyAction(slot.slot, 'revoke')}
            ?disabled=${this.loading || !slot.exists}
          >✕ Revoke API key ${slot.slot}</button>
        </div>
      </div>
    `;
  }

  private renderReferrerEditor() {
    const annotations = analyzeReferrers(this._editReferrers);

    return html`
      <div class="referrer-editor-list">
        ${this._editReferrers.map((value, index) => {
          const annotation = annotations[index];
          return html`
            <div>
              <div class="referrer-input-row">
                <input
                  type="text"
                  .value=${value}
                  @input=${(event: Event) => {
                    this.updateReferrer(index, (event.target as HTMLInputElement).value);
                  }}
                  placeholder="https://your-app.example.com/"
                  ?disabled=${this._savingReferrers}
                  aria-label=${`Referrer ${index + 1}`}
                />
                <button
                  type="button"
                  class="referrer-delete"
                  @click=${() => this.removeReferrer(index)}
                  ?disabled=${this._savingReferrers}
                >Delete</button>
              </div>
              ${annotation
                ? html`<div class="note">${this.getReferrerReason(annotation.reason)}</div>`
                : null}
            </div>
          `;
        })}
      </div>
      ${this._showReferrerInstructions
        ? html`<div class="collapsible-help">
            <p>
              Allow access from specific HTTP/HTTPS domains. The value of the HTTP referrer header must match.
              You can use * as a wildcard. See
              <a
                href="https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/"
                target="_blank"
                rel="noopener noreferrer"
              >Security and authentication</a>
              for details. Updating referrers invalidates current keys and requires key regeneration.
            </p>
          </div>`
        : null}
      <div class="referrer-controls">
        <button
          type="button"
          @click=${this.addReferrer}
          ?disabled=${this._savingReferrers}
        >+ Add</button>
        <button
          type="button"
          class="secondary"
          @click=${this._toggleReferrerInstructions}
          ?disabled=${this._savingReferrers}
        >Instructions</button>
        <button
          type="button"
          @click=${this.saveReferrers}
          ?disabled=${this._savingReferrers}
        >${this._savingReferrers ? '...' : 'Save referrers'}</button>
        <button
          type="button"
          class="secondary"
          @click=${this.cancelReferrerEdit}
          ?disabled=${this._savingReferrers}
        >Cancel</button>
      </div>
    `;
  }

  private _toggleReferrerInstructions = (): void => {
    this._showReferrerInstructions = !this._showReferrerInstructions;
  };

  private startReferrerEdit = (): void => {
    if (!this.credential) return;

    this._editingReferrers = true;
    this._savingReferrers = false;
    this._editReferrers = this.credential.referrers.length > 0 ? [...this.credential.referrers] : [''];
  };

  private cancelReferrerEdit = (): void => {
    this._editingReferrers = false;
    this._savingReferrers = false;
    this._editReferrers = [];
  };

  private addReferrer = (): void => {
    this._editReferrers = [...this._editReferrers, ''];
  };

  private removeReferrer(index: number): void {
    this._editReferrers = this._editReferrers.filter((_value, valueIndex) => valueIndex !== index);
    if (this._editReferrers.length === 0) {
      this._editReferrers = [''];
    }
  }

  private updateReferrer(index: number, value: string): void {
    this._editReferrers = this._editReferrers.map((item, valueIndex) =>
      valueIndex === index ? value : item
    );
  }

  private saveReferrers = (): void => {
    if (!this.credential || this._savingReferrers) return;

    const normalizedReferrers = [...new Set(this._editReferrers.map((value) => value.trim()).filter(Boolean))];
    this._savingReferrers = true;

    this.dispatchEvent(
      new CustomEvent<CredentialReferrerUpdateRequestDetail>('credential-referrers-update-request', {
        detail: {
          credentialId: this.credential.id,
          referrers: normalizedReferrers
        },
        bubbles: true,
        composed: true
      })
    );
  };

  private startEdit(field: EditingField): void {
    if (!this.credential || field === null) return;

    this._editTitle = this.credential.name;
    this._editSnippet = this.credential.snippet ?? '';
    this._editTags = [...this.credential.tags];
    this._tagInput = '';
    this._tagDropdownOpen = false;
    this._cancelRequested = false;
    this._editingField = field;

    if (field === 'tags') {
      this.dispatchEvent(new CustomEvent('fetch-user-tags', { bubbles: true, composed: true }));
    }

    void this.updateComplete.then(() => {
      const selector =
        field === 'title' ? '.inline-title' :
        field === 'snippet' ? '.inline-snippet' :
        '.tag-input-field';
      (this.shadowRoot?.querySelector<HTMLElement>(selector))?.focus();
    });
  }

  private saveCurrentField(): void {
    if (!this.credential || !this._editingField) return;

    this._saving = true;
    this._tagDropdownOpen = false;

    this.dispatchEvent(
      new CustomEvent<CredentialUpdateRequestDetail>('credential-update-request', {
        detail: {
          credentialId: this.credential.id,
          title: this._editTitle.trim() || this.credential.name,
          snippet: this._editSnippet.trim(),
          tags: this._editTags
        },
        bubbles: true,
        composed: true
      })
    );
  }

  private cancelEdit(): void {
    this._editingField = null;
    this._saving = false;
    this._tagInput = '';
    this._tagDropdownOpen = false;
    this._cancelRequested = false;
  }

  private handleFieldFocusOut(field: EditingField, event: FocusEvent): void {
    if (this._editingField !== field) return;

    const relatedTarget = event.relatedTarget as Node | null;
    const wrapper = event.currentTarget as HTMLElement;
    if (relatedTarget && wrapper.contains(relatedTarget)) return;

    if (this._cancelRequested) {
      this._cancelRequested = false;
      this.cancelEdit();
      return;
    }

    this.saveCurrentField();
  }

  private addTag(tag: string): void {
    const trimmed = tag.trim();
    if (trimmed && !this._editTags.includes(trimmed)) {
      this._editTags = [...this._editTags, trimmed];
    }
    this._tagInput = '';
    this._tagDropdownOpen = true;

    void this.updateComplete.then(() => {
      (this.shadowRoot?.querySelector<HTMLInputElement>('.tag-input-field'))?.focus();
    });
  }

  private removeTag(tag: string): void {
    this._editTags = this._editTags.filter((t) => t !== tag);
  }

  private handleTagInput(event: Event): void {
    this._tagInput = (event.target as HTMLInputElement).value;
    this._tagDropdownOpen = true;
  }

  private handleTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const trimmed = this._tagInput.trim();
      if (!trimmed) return;
      const match = this.availableTags.find((t) => t.toLowerCase() === trimmed.toLowerCase());
      this.addTag(match ?? trimmed);
    } else if (event.key === 'Escape') {
      this._tagDropdownOpen = false;
    } else if (event.key === 'Backspace' && !this._tagInput && this._editTags.length > 0) {
      this._editTags = this._editTags.slice(0, -1);
    }
  }

  private requestKeyAction(slot: 1 | 2, action: 'create' | 'regenerate' | 'revoke'): void {
    if (!this.credential) return;
    this.dispatchEvent(
      new CustomEvent<KeyActionRequestDetail>('key-action-request', {
        detail: { credentialId: this.credential.id, slot, action },
        bubbles: true,
        composed: true
      })
    );
  }

  private toggleFavorite = (): void => {
    if (!this.credential || this._updatingFavorite) return;

    this._updatingFavorite = true;
    this.dispatchEvent(
      new CustomEvent<CredentialFavoriteToggleRequestDetail>('credential-favorite-toggle-request', {
        detail: {
          credentialId: this.credential.id,
          favorite: !this.credential.isFavorite
        },
        bubbles: true,
        composed: true
      })
    );
  };

  private getOpenInPortalHref(): string | undefined {
    if (!this.credential || !this.portalBase) {
      return undefined;
    }

    try {
      const hostname = new URL(this.portalBase).hostname;
      const [urlKey] = hostname.split('.');
      if (!urlKey) {
        return undefined;
      }

      return `https://${urlKey}.maps.arcgis.com/home/item.html?id=${encodeURIComponent(this.credential.id)}`;
    } catch {
      return undefined;
    }
  }

  private toggleDeleteProtection = (): void => {
    if (!this.credential || this._updatingDeleteProtection) return;

    this._updatingDeleteProtection = true;
    this.dispatchEvent(
      new CustomEvent<CredentialDeleteProtectionToggleRequestDetail>(
        'credential-delete-protection-toggle-request',
        {
          detail: {
            credentialId: this.credential.id,
            protect: !this.credential.isDeleteProtected
          },
          bubbles: true,
          composed: true
        }
      )
    );
  };

  private requestDeleteCheck = (): void => {
    if (!this.credential || this._deleteCheckInFlight || this._deleteInFlight) return;

    this._deleteCheckInFlight = true;
    this._deleteModalOpen = true;
    this._deleteModalCanDelete = null;
    this._deleteModalError = '';
    this.dispatchEvent(
      new CustomEvent<CredentialDeleteCheckRequestDetail>('credential-delete-check-request', {
        detail: {
          credentialId: this.credential.id
        },
        bubbles: true,
        composed: true
      })
    );
  };

  private executeDelete = (): void => {
    if (!this.credential || this._deleteInFlight) return;

    this._deleteInFlight = true;
    this._deleteModalError = '';
    this.dispatchEvent(
      new CustomEvent<CredentialDeleteExecuteRequestDetail>('credential-delete-execute-request', {
        detail: {
          credentialId: this.credential.id
        },
        bubbles: true,
        composed: true
      })
    );
  };

  private closeDeleteModal = (): void => {
    if (this._deleteInFlight) return;

    this._deleteModalOpen = false;
    this._deleteModalCanDelete = null;
    this._deleteModalError = '';
    this._deleteCheckInFlight = false;
  };

  private renderDeleteModal() {
    if (!this._deleteModalOpen) {
      return null;
    }

    const body =
      this._deleteModalCanDelete === null
        ? 'Checking if this item can be deleted...'
        : this._deleteModalCanDelete
          ? 'Are you sure you want to delete this item?'
          : "The item can't be deleted because it is delete protected.";

    return html`
      <div class="delete-modal-backdrop" @click=${this.closeDeleteModal}>
        <div
          class="delete-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Delete API key item"
          @click=${(event: Event) => event.stopPropagation()}
        >
          <p>${body}</p>
          ${this._deleteModalError ? html`<p class="error">${this._deleteModalError}</p>` : null}
          <div class="delete-modal-actions">
            <button
              type="button"
              class="secondary"
              @click=${this.closeDeleteModal}
              ?disabled=${this._deleteInFlight}
            >Cancel</button>
            ${this._deleteModalCanDelete
              ? html`<button
                  type="button"
                  class="danger"
                  @click=${this.executeDelete}
                  ?disabled=${this._deleteInFlight}
                >${this._deleteInFlight ? 'Deleting...' : 'Delete'}</button>`
              : null}
          </div>
        </div>
      </div>
    `;
  }

  private getReferrerReason(reason: 'wildcard-only' | 'permissive-pattern' | 'none' | undefined): string {
    if (reason === 'wildcard-only') return 'Wildcard-only rule can allow all origins.';
    if (reason === 'permissive-pattern') return 'Pattern may be too permissive. Verify this restriction.';
    return 'Restriction looks specific.';
  }
}

if (!customElements.get('credential-detail')) {
  customElements.define('credential-detail', CredentialDetailElement);
}
