import type { ClipboardAdapter } from '@arcgis-api-keys/core';
import * as vscode from 'vscode';

export class VscodeClipboardAdapter implements ClipboardAdapter {
  public async copy(text: string): Promise<void> {
    await vscode.env.clipboard.writeText(text);
  }
}
