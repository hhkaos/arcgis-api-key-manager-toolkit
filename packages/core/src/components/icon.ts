import { config, icon } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowLeft,
  faArrowRightFromBracket,
  faArrowUpRightFromSquare,
  faBook,
  faCheck,
  faChartLine,
  faClipboard,
  faCircleInfo,
  faFloppyDisk,
  faPenToSquare,
  faPlus,
  faRotateLeft,
  faStar,
  faTag,
  faTrash,
  faTriangleExclamation,
  faUser,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import { LitElement, css, html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

config.autoAddCss = false;

type IconName =
  | 'alert-triangle'
  | 'arrow-left'
  | 'book'
  | 'chart-line'
  | 'clipboard'
  | 'check'
  | 'external-link'
  | 'floppy-disk'
  | 'info'
  | 'pencil'
  | 'plus'
  | 'rotate-ccw'
  | 'star'
  | 'tag'
  | 'trash'
  | 'user'
  | 'arrow-right-from-bracket'
  | 'x';

const ICONS = {
  'alert-triangle': faTriangleExclamation,
  'arrow-left': faArrowLeft,
  'arrow-right-from-bracket': faArrowRightFromBracket,
  book: faBook,
  'chart-line': faChartLine,
  clipboard: faClipboard,
  check: faCheck,
  'external-link': faArrowUpRightFromSquare,
  'floppy-disk': faFloppyDisk,
  info: faCircleInfo,
  pencil: faPenToSquare,
  plus: faPlus,
  'rotate-ccw': faRotateLeft,
  star: faStar,
  tag: faTag,
  trash: faTrash,
  user: faUser,
  x: faXmark
} as const;

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toAccessibleSvgMarkup(name: IconName, label: string): string {
  const svg = icon(ICONS[name] ?? faCircleInfo).html.join('');
  if (!label) {
    return svg.replace('<svg', '<svg role="presentation" aria-hidden="true"');
  }

  const escapedLabel = escapeHtmlAttribute(label);
  return svg.replace('<svg', `<svg role="img" aria-hidden="false" aria-label="${escapedLabel}"`);
}

export class AkmIconElement extends LitElement {
  public static override properties = {
    name: { type: String },
    label: { type: String },
    size: { type: Number }
  };

  public static override styles = css`
    :host {
      --akm-icon-size: 14px;
      display: inline-flex;
      width: var(--akm-icon-size);
      height: var(--akm-icon-size);
      color: currentColor;
      vertical-align: text-bottom;
      line-height: 0;
    }

    :host svg {
      width: 100%;
      height: 100%;
      display: block;
      fill: currentColor;
    }
  `;

  public name: IconName = 'info';
  public label: string = '';
  public size: number = 14;

  public override render() {
    const iconName = (this.name in ICONS ? this.name : 'info') as IconName;
    this.style.setProperty('--akm-icon-size', `${this.size}px`);

    return html`${unsafeHTML(toAccessibleSvgMarkup(iconName, this.label))}`;
  }
}

if (!customElements.get('akm-icon')) {
  customElements.define('akm-icon', AkmIconElement);
}
