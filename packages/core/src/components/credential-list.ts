import { LitElement, css, html } from 'lit';
import { debounce } from '../logic/debounce.js';
import { filterCredentials, sortCredentials } from '../logic/filter-sort.js';
import type {
  ApiKeyCredential,
  CredentialFilter,
  CredentialSort,
  EnvironmentType,
  ExpirationCategory
} from '../types/models.js';
import './expiration-badge.js';
import './icon.js';
import type { CredentialUpdateRequestDetail } from './credential-detail.js';

export type { CredentialUpdateRequestDetail };

export interface CredentialSelectDetail {
  credentialId: string;
}

type SortOption = 'name-asc' | 'expiration-asc' | 'expiration-desc' | 'created-desc';
type EditField = 'title' | 'snippet' | 'tags';

interface EditingState {
  credentialId: string;
  field: EditField;
  title: string;
  snippet: string;
  tags: string[];
  tagInput: string;
  tagDropdownOpen: boolean;
}

export class CredentialListElement extends LitElement {
  public static override properties = {
    credentials: { attribute: false },
    selectedCredentialId: { type: String, attribute: 'selected-credential-id' },
    loading: { type: Boolean },
    errorMessage: { type: String, attribute: 'error-message' },
    portalBase: { type: String, attribute: 'portal-base' },
    environmentType: { type: String, attribute: 'environment-type' },
    availableTags: { attribute: false },
    searchText: { state: true },
    searchDraft: { state: true },
    filterTag: { state: true },
    filterPrivilege: { state: true },
    filterExpiration: { state: true },
    filterFavorites: { state: true },
    sortOption: { state: true },
    _editingState: { state: true },
    _saving: { state: true },
    _advancedOpen: { state: true }
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
      --akm-input-bg: var(--vscode-input-background, #ffffff);
      --akm-input-fg: var(--vscode-input-foreground, #18202a);
      --akm-input-border: var(--vscode-input-border, var(--akm-border));
      --akm-focus: var(--vscode-focusBorder, #8fbef5);
      --akm-hover: var(--vscode-list-hoverBackground, #f1f6fb);
      --akm-selected: var(--vscode-list-activeSelectionBackground, #dceeff);
      --akm-credential-columns: minmax(220px, 2.8fr) minmax(220px, 1.6fr) minmax(120px, 0.9fr) 28px 28px 40px;
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

    .toolbar-basic {
      display: grid;
      gap: 6px;
      grid-template-columns: 1fr auto;
      align-items: center;
    }

    .toolbar-advanced {
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      align-items: end;
    }

    .advanced-toggle-row {
      display: flex;
      align-items: center;
    }

    .advanced-toggle {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 11px;
      color: var(--akm-primary);
      padding: 0;
      font-family: var(--akm-font);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .advanced-toggle:hover {
      opacity: 0.75;
    }

    .fav-toggle {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: none;
      border: 1px solid var(--akm-input-border);
      cursor: pointer;
      font-size: 12px;
      color: var(--akm-muted);
      padding: 7px 10px;
      font-family: var(--akm-font);
      min-height: 34px;
      white-space: nowrap;
      box-sizing: border-box;
    }

    .fav-toggle.active {
      color: var(--vscode-charts-yellow, #e8a020);
      border-color: var(--vscode-charts-yellow, #e8a020);
      background: color-mix(in srgb, var(--vscode-charts-yellow, #e8a020) 10%, transparent);
    }

    .fav-toggle:focus {
      outline: 2px solid var(--akm-focus);
      outline-offset: 1px;
    }

    .fav-col,
    .fav-cell {
      justify-self: center;
      text-align: center;
    }

    .star-fav {
      color: var(--vscode-charts-yellow, #e8a020);
      display: inline-flex;
    }

    .star-unfav {
      color: var(--akm-muted);
      opacity: 0.25;
      display: inline-flex;
    }

    label {
      display: grid;
      gap: 3px;
      font-size: 11px;
      color: var(--akm-muted);
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    input,
    select,
    button.action {
      border: 1px solid var(--akm-border);
      border-radius: 0;
      font-size: 13px;
      font-family: var(--akm-font);
      padding: 7px 8px;
      background: var(--akm-input-bg);
      color: var(--akm-input-fg);
      border-color: var(--akm-input-border);
      min-height: 34px;
      box-sizing: border-box;
    }

    button.action {
      border-color: var(--akm-primary);
      background: var(--akm-primary);
      color: var(--akm-primary-foreground);
    }

    button.action {
      cursor: pointer;
      font-weight: 600;
    }

    input:focus,
    select:focus,
    button.action:focus {
      outline: 2px solid var(--akm-focus);
      outline-offset: 1px;
    }

    button.action:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .table {
      border: 1px solid var(--akm-border);
      border-radius: 0;
      overflow: hidden;
      background: var(--akm-surface-raised);
    }

    .header-row {
      display: grid;
      gap: 8px;
      grid-template-columns: var(--akm-credential-columns);
      align-items: center;
      padding: 5px 10px;
      background: var(--akm-surface);
      border-bottom: 1px solid var(--akm-border);
      box-sizing: border-box;
    }

    .col-heading {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--akm-muted);
    }

    .row {
      display: grid;
      gap: 8px;
      grid-template-columns: var(--akm-credential-columns);
      align-items: center;
      padding: 8px 10px;
      border-top: 1px solid var(--akm-border);
      background: var(--akm-surface-raised);
      text-align: left;
      cursor: pointer;
      box-sizing: border-box;
    }

    .row:hover {
      background: var(--akm-hover);
    }

    .row.selected {
      background: var(--akm-selected);
    }

    .name {
      font-weight: 600;
      color: var(--akm-text);
      margin-bottom: 2px;
    }

    .subtle {
      font-size: 11px;
      color: var(--akm-muted);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--akm-border);
      background: var(--vscode-badge-background, #eff4f9);
      color: var(--akm-text);
      border-radius: 0;
      padding: 2px 6px;
      font-size: 11px;
    }

    .chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--akm-muted);
      padding: 0 0 0 2px;
      width: 14px;
      height: 14px;
      line-height: 1;
    }

    .chip-remove:hover {
      color: var(--vscode-errorForeground, #b42318);
    }

    .error {
      color: var(--vscode-errorForeground, #b42318);
      font-size: 12px;
    }

    .empty {
      padding: 14px 10px;
      color: var(--akm-muted);
      font-size: 13px;
    }

    .expiration-slots {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4px;
      align-items: flex-start;
    }

    .key-slot-missing {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--akm-border);
      background: var(--akm-surface);
      color: var(--akm-muted);
      border-radius: 0;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: 0.01em;
    }

    .settings-link {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--akm-muted);
      text-decoration: none;
      padding: 2px;
      border-radius: 2px;
    }

    .settings-link:hover {
      color: var(--akm-primary);
    }

    .keys-col {
      justify-self: start;
      min-width: 0;
    }

    .details-col,
    .details-cell {
      justify-self: center;
      text-align: center;
    }

    .usage-col,
    .usage-cell {
      justify-self: center;
      text-align: center;
    }

    .item-col,
    .item-cell {
      justify-self: center;
      text-align: center;
    }

    /* Inline edit styles */
    .editable-field {
      position: relative;
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      max-width: 100%;
    }

    .pencil-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--akm-muted);
      padding: 0;
      width: 14px;
      height: 14px;
      line-height: 1;
      opacity: 0;
      transition: opacity 0.1s;
      flex-shrink: 0;
      align-self: center;
    }

    .editable-field:hover .pencil-btn {
      opacity: 1;
    }

    .pencil-btn:focus {
      opacity: 1;
      outline: 1px solid var(--akm-focus);
    }

    .inline-input {
      font-size: 13px;
      font-weight: 600;
      font-family: var(--akm-font);
      color: var(--akm-text);
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--akm-focus);
      padding: 0 2px 1px;
      width: 100%;
      min-width: 80px;
      outline: none;
    }

    .inline-snippet-input {
      font-size: 11px;
      font-weight: 400;
      font-family: var(--akm-font);
      color: var(--akm-muted);
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--akm-focus);
      padding: 0 2px 1px;
      width: 100%;
      min-width: 80px;
      outline: none;
    }

    .field-actions {
      display: flex;
      gap: 4px;
      margin-top: 3px;
    }

    .save-btn,
    .cancel-btn {
      background: none;
      border: 1px solid var(--akm-border);
      cursor: pointer;
      font-size: 10px;
      padding: 1px 6px;
      font-family: var(--akm-font);
      border-radius: 0;
    }

    .save-btn {
      color: var(--akm-primary);
      border-color: var(--akm-primary);
    }

    .save-btn:hover {
      background: var(--akm-primary);
      color: var(--akm-primary-foreground);
    }

    .cancel-btn {
      color: var(--akm-muted);
    }

    .cancel-btn:hover {
      border-color: var(--akm-muted);
      color: var(--akm-text);
    }

    .tags-edit-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      align-items: center;
      border-bottom: 1px solid var(--akm-focus);
      padding-bottom: 2px;
      min-width: 100px;
    }

    .tag-input {
      border: none;
      background: transparent;
      font-size: 11px;
      font-family: var(--akm-font);
      color: var(--akm-text);
      outline: none;
      min-width: 60px;
      flex: 1;
      padding: 1px 2px;
    }

    .tag-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 100;
      background: var(--akm-surface-raised);
      border: 1px solid var(--akm-border);
      min-width: 140px;
      max-height: 140px;
      overflow-y: auto;
    }

    .tag-dropdown-item {
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      font-family: var(--akm-font);
      color: var(--akm-text);
    }

    .tag-dropdown-item:hover {
      background: var(--akm-hover);
    }
  `;

  public credentials: ApiKeyCredential[] = [];
  public selectedCredentialId: string | null = null;
  public loading: boolean = false;
  public errorMessage: string = '';
  public portalBase: string = '';
  public environmentType: EnvironmentType | null = null;
  public availableTags: string[] = [];

  private searchText: string = '';
  private searchDraft: string = '';
  private filterTag: string = '';
  private filterPrivilege: string = '';
  private filterExpiration: '' | ExpirationCategory = '';
  private filterFavorites: boolean = false;
  private sortOption: SortOption = 'created-desc';
  private _editingState: EditingState | null = null;
  private _saving: boolean = false;
  private _cancelRequested: boolean = false;
  private _advancedOpen: boolean = false;

  private readonly applySearchDebounced = debounce((value: string) => {
    this.searchText = value;
  }, 250);

  public override disconnectedCallback(): void {
    this.applySearchDebounced.cancel();
    super.disconnectedCallback();
  }

  public override updated(changed: Map<string, unknown>): void {
    if (changed.has('credentials') && this._saving && this._editingState) {
      const updatedCred = this.credentials.find(c => c.id === this._editingState!.credentialId);
      if (updatedCred) {
        this._editingState = null;
        this._saving = false;
      }
    }
  }

  public override render() {
    const filteredCredentials = this.getFilteredSortedCredentials();
    const tags = this.getUniqueValues((credential) => credential.tags);
    const privileges = this.getUniqueValues((credential) => credential.privileges);

    return html`
      <section class="panel">
        <div class="toolbar-basic">
          <input
            type="text"
            .value=${this.searchDraft}
            placeholder="Search by name, referrer, or partial API key"
            @input=${this.handleSearchInput}
            ?disabled=${this.loading}
          />
          <button
            type="button"
            class="fav-toggle ${this.filterFavorites ? 'active' : ''}"
            @click=${this.handleFavoritesToggle}
            ?disabled=${this.loading}
          >
            <akm-icon name="star" size="12"></akm-icon> Favorites only
          </button>
        </div>

        <div class="advanced-toggle-row">
          <button type="button" class="advanced-toggle" @click=${this.handleAdvancedToggle}>
            ${this._advancedOpen ? '▾' : '▸'} Advanced options
          </button>
        </div>

        ${this._advancedOpen ? html`
          <div class="toolbar-advanced">
            <label>
              Tag
              <select @change=${this.handleTagFilter} ?disabled=${this.loading}>
                <option value="">All tags</option>
                ${tags.map((tag) => html`<option value=${tag} ?selected=${this.filterTag === tag}>${tag}</option>`)}
              </select>
            </label>

            <label>
              Privilege
              <select @change=${this.handlePrivilegeFilter} ?disabled=${this.loading}>
                <option value="">All privileges</option>
                ${privileges.map(
                  (privilege) => html`<option value=${privilege} ?selected=${this.filterPrivilege === privilege}>${privilege}</option>`
                )}
              </select>
            </label>

            <label>
              Expiration
              <select @change=${this.handleExpirationFilter} ?disabled=${this.loading}>
                <option value="">All states</option>
                <option value="ok" ?selected=${this.filterExpiration === 'ok'}>Healthy</option>
                <option value="warning" ?selected=${this.filterExpiration === 'warning'}>Warning</option>
                <option value="critical" ?selected=${this.filterExpiration === 'critical'}>Critical</option>
                <option value="expired" ?selected=${this.filterExpiration === 'expired'}>Expired</option>
              </select>
            </label>

            <label>
              Sort
              <select @change=${this.handleSortChange} ?disabled=${this.loading}>
                <option value="expiration-asc" ?selected=${this.sortOption === 'expiration-asc'}>Expiration (Soonest)</option>
                <option value="expiration-desc" ?selected=${this.sortOption === 'expiration-desc'}>Expiration (Latest)</option>
                <option value="name-asc" ?selected=${this.sortOption === 'name-asc'}>Name (A-Z)</option>
                <option value="created-desc" ?selected=${this.sortOption === 'created-desc'}>Created (Newest)</option>
              </select>
            </label>
          </div>
        ` : null}

        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : null}

        <div class="table">
          ${
            filteredCredentials.length === 0
              ? html`<div class="empty">No credentials match the current filters.</div>`
              : html`
                  <div class="header-row">
                    <span class="col-heading">Credential</span>
                    <span class="col-heading keys-col">Keys</span>
                    <span class="col-heading details-col">Details</span>
                    <span class="col-heading fav-col"><akm-icon name="star" size="11" label="Favorite"></akm-icon></span>
                    <span class="col-heading usage-col">${this.environmentType === 'location-platform' ? html`<akm-icon name="chart-line" size="11" label="Usage"></akm-icon>` : null}</span>
                    <span class="col-heading item-col">Item</span>
                  </div>
                  ${filteredCredentials.map((credential) => this.renderRow(credential))}
                `
          }
        </div>
      </section>
    `;
  }

  private renderRow(credential: ApiKeyCredential) {
    const isSelected = this.selectedCredentialId === credential.id;
    const es = this._editingState?.credentialId === credential.id ? this._editingState : null;

    return html`
      <div
        class="row ${isSelected ? 'selected' : ''}"
        tabindex="0"
        role="button"
        @click=${() => this.handleRowClick(credential.id)}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') this.handleRowClick(credential.id); }}
      >
        <div>
          ${this.renderTitleField(credential, es)}
          ${this.renderSnippetField(credential, es)}
          ${this.renderTagsField(credential, es)}
        </div>
        <div class="expiration-slots keys-col">
          ${
            credential.isLegacy
              ? html`<expiration-badge .expiration=${credential.expiration} .nonExpiring=${true}></expiration-badge>`
              : html`
                  ${credential.key1.exists && credential.key1.expiration
                    ? html`<expiration-badge .expiration=${credential.key1.expiration} key-label="K1"></expiration-badge>`
                    : html`<span class="key-slot-missing">K1 not set</span>`}
                  ${credential.key2.exists && credential.key2.expiration
                    ? html`<expiration-badge .expiration=${credential.key2.expiration} key-label="K2"></expiration-badge>`
                    : html`<span class="key-slot-missing">K2 not set</span>`}
                `
          }
        </div>
        <div class="details-cell">
          <div class="subtle">${credential.privileges.length} privileges</div>
          <div class="subtle">${credential.referrers.length} referrers</div>
        </div>
        <div class="fav-cell">
          <span class="${credential.isFavorite ? 'star-fav' : 'star-unfav'}">
            <akm-icon name="star" size="13" label="${credential.isFavorite ? 'Favorite' : 'Not favorite'}"></akm-icon>
          </span>
        </div>
        <div class="usage-cell">
          ${this.environmentType === 'location-platform'
            ? html`<a
                class="settings-link"
                href="https://location.arcgis.com/usage/credentials/${credential.id}/"
                target="_blank"
                title="View API key usage"
                @click=${(e: Event) => e.stopPropagation()}
              ><akm-icon name="chart-line" size="13" label="View API key usage"></akm-icon></a>`
            : null}
        </div>
        <div class="item-cell">
          ${this.portalBase
            ? html`<a
                class="settings-link"
                href="${this.portalBase}/home/item.html?id=${credential.id}#settings"
                target="_blank"
                title="Open item settings"
                @click=${(e: Event) => e.stopPropagation()}
              ><akm-icon name="external-link" size="13" label="Open item settings"></akm-icon></a>`
            : null}
        </div>
      </div>
    `;
  }

  private renderTitleField(credential: ApiKeyCredential, es: EditingState | null) {
    const isEditing = es?.field === 'title';

    if (isEditing) {
      return html`
        <div @click=${(e: Event) => e.stopPropagation()}>
          <input
            class="inline-input"
            type="text"
            .value=${es!.title}
            @input=${(e: Event) => this.patchEditState({ title: (e.target as HTMLInputElement).value })}
            @focusout=${(e: FocusEvent) => this.handleFieldFocusOut(credential, e)}
          />
          <div class="field-actions">
            <button class="save-btn" @mousedown=${() => { this._cancelRequested = false; }} @click=${(e: Event) => { e.stopPropagation(); this.saveCurrentField(credential); }}>Save</button>
            <button class="cancel-btn" @mousedown=${() => { this._cancelRequested = true; }} @click=${(e: Event) => { e.stopPropagation(); this.cancelEdit(); }}>Cancel</button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="editable-field name">
        <span>${credential.name}</span>
        <button
          class="pencil-btn"
          title="Edit title"
          @click=${(e: Event) => { e.stopPropagation(); this.startEdit(credential, 'title'); }}
        ><akm-icon name="pencil" size="12" label="Edit title"></akm-icon></button>
      </div>
    `;
  }

  private renderSnippetField(credential: ApiKeyCredential, es: EditingState | null) {
    const isEditing = es?.field === 'snippet';

    if (isEditing) {
      return html`
        <div @click=${(e: Event) => e.stopPropagation()}>
          <input
            class="inline-snippet-input"
            type="text"
            .value=${es!.snippet}
            placeholder="Add a description…"
            @input=${(e: Event) => this.patchEditState({ snippet: (e.target as HTMLInputElement).value })}
            @focusout=${(e: FocusEvent) => this.handleFieldFocusOut(credential, e)}
          />
          <div class="field-actions">
            <button class="save-btn" @mousedown=${() => { this._cancelRequested = false; }} @click=${(e: Event) => { e.stopPropagation(); this.saveCurrentField(credential); }}>Save</button>
            <button class="cancel-btn" @mousedown=${() => { this._cancelRequested = true; }} @click=${(e: Event) => { e.stopPropagation(); this.cancelEdit(); }}>Cancel</button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="editable-field subtle">
        <span>${credential.snippet || 'No description'}</span>
        <button
          class="pencil-btn"
          title="Edit description"
          @click=${(e: Event) => { e.stopPropagation(); this.startEdit(credential, 'snippet'); }}
        ><akm-icon name="pencil" size="12" label="Edit description"></akm-icon></button>
      </div>
    `;
  }

  private renderTagsField(credential: ApiKeyCredential, es: EditingState | null) {
    const isEditing = es?.field === 'tags';

    if (isEditing) {
      const suggestions = this.availableTags.filter(
        t => !es!.tags.includes(t) && t.toLowerCase().includes(es!.tagInput.toLowerCase())
      );
      const showDropdown = es!.tagDropdownOpen && (suggestions.length > 0 || es!.tagInput.trim().length > 0);

      return html`
        <div style="position:relative" @click=${(e: Event) => e.stopPropagation()}>
          <div class="tags-edit-wrapper">
            ${es!.tags.map(tag => html`
              <span class="chip">
                ${tag}
                <button class="chip-remove" @mousedown=${(e: Event) => { e.preventDefault(); this.removeTag(tag); }}>
                  <akm-icon name="x" size="11" label="Remove tag"></akm-icon>
                </button>
              </span>
            `)}
            <input
              class="tag-input"
              type="text"
              placeholder="Add tag…"
              .value=${es!.tagInput}
              @input=${(e: Event) => this.patchEditState({ tagInput: (e.target as HTMLInputElement).value, tagDropdownOpen: true })}
              @focus=${() => this.patchEditState({ tagDropdownOpen: true })}
              @keydown=${(e: KeyboardEvent) => this.handleTagKeydown(e)}
              @focusout=${(e: FocusEvent) => this.handleFieldFocusOut(credential, e)}
            />
          </div>
          ${showDropdown ? html`
            <div class="tag-dropdown">
              ${es!.tagInput.trim() && !es!.tags.includes(es!.tagInput.trim()) ? html`
                <div class="tag-dropdown-item" @mousedown=${(e: Event) => { e.preventDefault(); this.addTag(es!.tagInput.trim()); }}>
                  Add: "${es!.tagInput.trim()}"
                </div>
              ` : null}
              ${suggestions.map(t => html`
                <div class="tag-dropdown-item" @mousedown=${(e: Event) => { e.preventDefault(); this.addTag(t); }}>
                  ${t}
                </div>
              `)}
            </div>
          ` : null}
          <div class="field-actions">
            <button class="save-btn" @mousedown=${() => { this._cancelRequested = false; }} @click=${(e: Event) => { e.stopPropagation(); this.saveCurrentField(credential); }}>Save</button>
            <button class="cancel-btn" @mousedown=${() => { this._cancelRequested = true; }} @click=${(e: Event) => { e.stopPropagation(); this.cancelEdit(); }}>Cancel</button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="editable-field subtle">
        <span><akm-icon name="tag" size="12"></akm-icon> ${credential.tags.join(', ') || 'No tags'}</span>
        <button
          class="pencil-btn"
          title="Edit tags"
          @click=${(e: Event) => { e.stopPropagation(); this.startEdit(credential, 'tags'); }}
        ><akm-icon name="pencil" size="12" label="Edit tags"></akm-icon></button>
      </div>
    `;
  }

  private startEdit(credential: ApiKeyCredential, field: EditField): void {
    this._editingState = {
      credentialId: credential.id,
      field,
      title: credential.name,
      snippet: credential.snippet ?? '',
      tags: [...credential.tags],
      tagInput: '',
      tagDropdownOpen: false
    };

    if (field === 'tags') {
      this.dispatchEvent(new CustomEvent('fetch-user-tags', { bubbles: true, composed: true }));
    }
  }

  private cancelEdit(): void {
    this._editingState = null;
    this._saving = false;
    this._cancelRequested = false;
  }

  private saveCurrentField(credential: ApiKeyCredential): void {
    if (!this._editingState) return;

    const { title, snippet, tags } = this._editingState;
    this._saving = true;

    this.dispatchEvent(
      new CustomEvent<CredentialUpdateRequestDetail>('credential-update-request', {
        detail: { credentialId: credential.id, title, snippet, tags },
        bubbles: true,
        composed: true
      })
    );
  }

  private patchEditState(patch: Partial<EditingState>): void {
    if (!this._editingState) return;
    this._editingState = { ...this._editingState, ...patch };
  }

  private addTag(tag: string): void {
    if (!this._editingState || this._editingState.tags.includes(tag)) return;
    this.patchEditState({ tags: [...this._editingState.tags, tag], tagInput: '', tagDropdownOpen: false });
  }

  private removeTag(tag: string): void {
    if (!this._editingState) return;
    this.patchEditState({ tags: this._editingState.tags.filter(t => t !== tag) });
  }

  private handleTagKeydown(e: KeyboardEvent): void {
    if (!this._editingState) return;
    if (e.key === 'Enter' && this._editingState.tagInput.trim()) {
      e.preventDefault();
      this.addTag(this._editingState.tagInput.trim());
    } else if (e.key === 'Escape') {
      this.patchEditState({ tagDropdownOpen: false });
    }
  }

  private handleFieldFocusOut(credential: ApiKeyCredential, event: FocusEvent): void {
    const related = event.relatedTarget as Node | null;
    if (related && this.shadowRoot?.contains(related)) return;

    if (this._cancelRequested) {
      this._cancelRequested = false;
      return;
    }

    this.saveCurrentField(credential);
  }

  private handleRowClick(credentialId: string): void {
    if (this._editingState?.credentialId === credentialId) return;
    this.dispatchEvent(
      new CustomEvent<CredentialSelectDetail>('credential-select', {
        detail: { credentialId },
        bubbles: true,
        composed: true
      })
    );
  }

  private getFilteredSortedCredentials(): ApiKeyCredential[] {
    const filter: CredentialFilter = {
      search: this.searchText || undefined,
      tag: this.filterTag || undefined,
      privilege: this.filterPrivilege || undefined,
      expiration: this.filterExpiration || undefined,
      favorites: this.filterFavorites || undefined
    };

    const sort = this.parseSortOption(this.sortOption);
    return sortCredentials(filterCredentials(this.credentials, filter), sort);
  }

  private getUniqueValues(extract: (credential: ApiKeyCredential) => string[]): string[] {
    const values = new Set<string>();
    for (const credential of this.credentials) {
      for (const value of extract(credential)) {
        values.add(value);
      }
    }

    return [...values].sort((left, right) => left.localeCompare(right));
  }

  private parseSortOption(option: SortOption): CredentialSort {
    if (option === 'name-asc') {
      return { field: 'name', direction: 'asc' };
    }

    if (option === 'expiration-desc') {
      return { field: 'expiration', direction: 'desc' };
    }

    if (option === 'created-desc') {
      return { field: 'created', direction: 'desc' };
    }

    return { field: 'expiration', direction: 'asc' };
  }

  private handleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchDraft = target.value;
    this.applySearchDebounced(this.searchDraft);
  }

  private handleTagFilter(event: Event): void {
    this.filterTag = (event.target as HTMLSelectElement).value;
  }

  private handlePrivilegeFilter(event: Event): void {
    this.filterPrivilege = (event.target as HTMLSelectElement).value;
  }

  private handleExpirationFilter(event: Event): void {
    this.filterExpiration = (event.target as HTMLSelectElement).value as '' | ExpirationCategory;
  }

  private handleSortChange(event: Event): void {
    this.sortOption = (event.target as HTMLSelectElement).value as SortOption;
  }

  private handleFavoritesToggle(): void {
    this.filterFavorites = !this.filterFavorites;
  }

  private handleAdvancedToggle(): void {
    this._advancedOpen = !this._advancedOpen;
  }
}

if (!customElements.get('credential-list')) {
  customElements.define('credential-list', CredentialListElement);
}
