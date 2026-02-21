import { LitElement, css, html } from 'lit';
import { debounce } from '../logic/debounce.js';
import { filterCredentials, sortCredentials } from '../logic/filter-sort.js';
import type {
  ApiKeyCredential,
  CredentialFilter,
  CredentialSort,
  ExpirationCategory
} from '../types/models.js';
import './expiration-badge.js';

export interface CredentialSelectDetail {
  credentialId: string;
}

type SortOption = 'name-asc' | 'expiration-asc' | 'expiration-desc' | 'created-desc';

export class CredentialListElement extends LitElement {
  public static override properties = {
    credentials: { attribute: false },
    selectedCredentialId: { type: String, attribute: 'selected-credential-id' },
    loading: { type: Boolean },
    errorMessage: { type: String, attribute: 'error-message' },
    portalBase: { type: String, attribute: 'portal-base' },
    searchText: { state: true },
    searchDraft: { state: true },
    filterTag: { state: true },
    filterPrivilege: { state: true },
    filterExpiration: { state: true },
    sortOption: { state: true }
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

    .toolbar {
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      align-items: end;
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
      grid-template-columns: minmax(160px, 2fr) minmax(180px, 2fr) 100px 28px;
      align-items: center;
      padding: 5px 10px;
      background: var(--akm-surface);
      border-bottom: 1px solid var(--akm-border);
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
      grid-template-columns: minmax(160px, 2fr) minmax(180px, 2fr) 100px 28px;
      align-items: center;
      padding: 8px 10px;
      border-top: 1px solid var(--akm-border);
      background: var(--akm-surface-raised);
      text-align: left;
      width: 100%;
      border-right: none;
      border-left: none;
      border-bottom: none;
      border-radius: 0;
      font-family: var(--akm-font);
      color: var(--akm-text);
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
      font-size: 13px;
      padding: 2px;
      border-radius: 2px;
    }

    .settings-link:hover {
      color: var(--akm-primary);
    }
  `;

  public credentials: ApiKeyCredential[] = [];
  public selectedCredentialId: string | null = null;
  public loading: boolean = false;
  public errorMessage: string = '';
  public portalBase: string = '';

  private searchText: string = '';
  private searchDraft: string = '';
  private filterTag: string = '';
  private filterPrivilege: string = '';
  private filterExpiration: '' | ExpirationCategory = '';
  private sortOption: SortOption = 'created-desc';

  private readonly applySearchDebounced = debounce((value: string) => {
    this.searchText = value;
  }, 250);

  public override disconnectedCallback(): void {
    this.applySearchDebounced.cancel();
    super.disconnectedCallback();
  }

  public override render() {
    const filteredCredentials = this.getFilteredSortedCredentials();
    const tags = this.getUniqueValues((credential) => credential.tags);
    const privileges = this.getUniqueValues((credential) => credential.privileges);

    return html`
      <section class="panel">
        <div class="toolbar">
          <label>
            Search Name or Referrer
            <input
              type="text"
              .value=${this.searchDraft}
              placeholder="Find credential or referrer"
              @input=${this.handleSearchInput}
              ?disabled=${this.loading}
            />
          </label>

          <label>
            Filter Tag
            <select @change=${this.handleTagFilter} ?disabled=${this.loading}>
              <option value="">All tags</option>
              ${tags.map((tag) => html`<option value=${tag} ?selected=${this.filterTag === tag}>${tag}</option>`)}
            </select>
          </label>

          <label>
            Filter Privilege
            <select @change=${this.handlePrivilegeFilter} ?disabled=${this.loading}>
              <option value="">All privileges</option>
              ${privileges.map(
                (privilege) => html`<option value=${privilege} ?selected=${this.filterPrivilege === privilege}>${privilege}</option>`
              )}
            </select>
          </label>

          <label>
            Filter Expiration
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

          <button type="button" class="action" @click=${this.handleRefresh} ?disabled=${this.loading}>
            ${this.loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : null}

        <div class="table">
          ${
            filteredCredentials.length === 0
              ? html`<div class="empty">No credentials match the current filters.</div>`
              : html`
                  <div class="header-row">
                    <span class="col-heading">Credential</span>
                    <span class="col-heading">Keys</span>
                    <span class="col-heading">Details</span>
                    <span></span>
                  </div>
                  ${filteredCredentials.map(
                    (credential) => html`
                      <button
                        type="button"
                        class="row ${this.selectedCredentialId === credential.id ? 'selected' : ''}"
                        @click=${() => this.handleSelectCredential(credential.id)}
                      >
                        <div>
                          <div class="name">${credential.name}</div>
                          <div class="subtle">${credential.tags.join(', ') || 'No tags'}</div>
                        </div>
                        <div class="expiration-slots">
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
                        <div>
                          <div class="subtle">${credential.privileges.length} privileges</div>
                          <div class="subtle">${credential.referrers.length} referrers</div>
                        </div>
                        <div>
                          ${this.portalBase
                            ? html`<a
                                class="settings-link"
                                href="${this.portalBase}/home/item.html?id=${credential.id}#settings"
                                target="_blank"
                                title="Open item settings"
                                @click=${(e: Event) => e.stopPropagation()}
                              >↗</a>`
                            : null}
                        </div>
                      </button>
                    `
                  )}
                `
          }
        </div>
      </section>
    `;
  }

  private getFilteredSortedCredentials(): ApiKeyCredential[] {
    const filter: CredentialFilter = {
      search: this.searchText || undefined,
      tag: this.filterTag || undefined,
      privilege: this.filterPrivilege || undefined,
      expiration: this.filterExpiration || undefined
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

  private handleRefresh(): void {
    this.dispatchEvent(
      new CustomEvent('credential-refresh', {
        bubbles: true,
        composed: true
      })
    );
  }

  private handleSelectCredential(credentialId: string): void {
    this.dispatchEvent(
      new CustomEvent<CredentialSelectDetail>('credential-select', {
        detail: { credentialId },
        bubbles: true,
        composed: true
      })
    );
  }
}

if (!customElements.get('credential-list')) {
  customElements.define('credential-list', CredentialListElement);
}
