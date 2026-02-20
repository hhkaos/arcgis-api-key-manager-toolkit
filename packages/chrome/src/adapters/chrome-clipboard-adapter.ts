import type { ClipboardAdapter } from '@arcgis-api-keys/core';

export class ChromeClipboardAdapter implements ClipboardAdapter {
  public async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      this.copyWithSelectionFallback(text);
    }
  }

  private copyWithSelectionFallback(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';

    document.body.append(textarea);
    textarea.focus();
    textarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error('Clipboard unavailable in this browser context.');
    }
  }
}
