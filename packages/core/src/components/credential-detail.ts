import { LitElement, css, html } from 'lit';
import { analyzeReferrers } from '../logic/referrers.js';
import type { ApiKeyCredential, KeySlotStatus } from '../types/models.js';
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

type EditingField = 'title' | 'snippet' | 'tags' | null;

export class CredentialDetailElement extends LitElement {
  public static override properties = {
    credential: { attribute: false },
    loading: { type: Boolean },
    errorMessage: { type: String, attribute: 'error-message' },
    portalBase: { type: String, attribute: 'portal-base' },
    availableTags: { attribute: false },
    _editingField: { state: true },
    _editTitle: { state: true },
    _editSnippet: { state: true },
    _editTags: { state: true },
    _tagInput: { state: true },
    _tagDropdownOpen: { state: true },
    _saving: { state: true }
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

    .snippet { margin: 0; color: var(--akm-muted); font-size: 12px; line-height: 1.4; }

    .settings-link {
      border: 1px solid var(--akm-primary);
      border-radius: 0;
      background: var(--akm-primary);
      color: var(--akm-primary-foreground);
      font-weight: 600;
      font-family: var(--akm-font);
      padding: 7px 9px;
      cursor: pointer;
      min-height: 33px;
      font-size: 12px;
      line-height: 1.2;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .settings-link:focus { outline: 2px solid var(--akm-focus); outline-offset: 1px; }
    .settings-link:hover { filter: brightness(0.95); }

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
  `;

  public credential: ApiKeyCredential | null = null;
  public loading: boolean = false;
  public errorMessage: string = '';
  public portalBase: string = '';
  public availableTags: string[] = [];

  private _editingField: EditingField = null;
  private _editTitle: string = '';
  private _editSnippet: string = '';
  private _editTags: string[] = [];
  private _tagInput: string = '';
  private _tagDropdownOpen: boolean = false;
  private _saving: boolean = false;
  private _cancelRequested: boolean = false;

  public override updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('credential') && this._saving) {
      this._saving = false;
      this._editingField = null;
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

    return html`
      <section class="panel">
        <div class="header-row">
          <div class="title-wrap">
            ${this.renderTitleField()}
            ${this.renderSnippetField()}
          </div>
          ${settingsHref
            ? html`<a
                class="settings-link"
                href="${settingsHref}"
                target="_blank"
                rel="noopener noreferrer"
                title="Open API Key settings in ArcGIS"
              >Open API Key settings in ArcGIS ↗</a>`
            : null}
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

        <div class="section">
          <h3>Privileges</h3>
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
          ${referrerAnnotations.length === 0
            ? html`<div class="empty">No referrer restrictions configured.</div>`
            : referrerAnnotations.map(
                (a) => html`
                  <div class="referrer ${a.warning ? 'warn' : ''}">
                    <div>
                      <div class="value">${a.value}</div>
                      <div class="note">${this.getReferrerReason(a.reason)}</div>
                    </div>
                    ${a.warning ? html`<span class="warning">⚠ Review</span>` : null}
                  </div>
                `
              )}
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
      </section>
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

  private getReferrerReason(reason: 'wildcard-only' | 'permissive-pattern' | 'none' | undefined): string {
    if (reason === 'wildcard-only') return 'Wildcard-only rule can allow all origins.';
    if (reason === 'permissive-pattern') return 'Pattern may be too permissive. Verify this restriction.';
    return 'Restriction looks specific.';
  }
}

if (!customElements.get('credential-detail')) {
  customElements.define('credential-detail', CredentialDetailElement);
}
