import { Setting } from './setting.ts';
import { MessageResponse } from './message.ts';
import { MessageType } from './message_type.ts';
import { generateSelector } from './selector.ts';
import type { PendingPickedSelector } from './storage.ts';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    const messageType = message.messageType;
    switch (messageType) {
      case MessageType.GetText: {
        const text = getText(message.setting);
        const response = MessageResponse.createSuccess(text);
        sendResponse(response);
        break;
      }
      case MessageType.GetUrl: {
        const response = MessageResponse.createSuccess(window.location.href);
        sendResponse(response);
        break;
      }
      case MessageType.StartPick: {
        startPickMode(message.settingId as string);
        const response = MessageResponse.createSuccess(null);
        sendResponse(response);
        break;
      }
      default: {
        const response = MessageResponse.createError('Invalid message');
        sendResponse(response);
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const errorMessage = `Error processing message: ${detail}`;
    console.error(errorMessage);
    const response = MessageResponse.createError(errorMessage);
    sendResponse(response);
  }

  return true;
});

function extractValue(selector: string): string {
  // One bad selector must not break the whole copy: treat it as empty.
  try {
    if (selector.trim() === '') {
      return '';
    }

    // If the selector includes '@', the part after the FIRST '@' is an
    // attribute name (e.g. 'a@href').
    const atIndex = selector.indexOf('@');
    if (atIndex !== -1) {
      const valueSelector = selector.slice(0, atIndex);
      const attribute = selector.slice(atIndex + 1);
      const element = document.querySelector(valueSelector) as
        | HTMLElement
        | null;
      if (element === null || element === undefined) {
        return '';
      }
      // No attribute -> empty string (no innerText fallback).
      if (!element.hasAttribute(attribute)) {
        return '';
      }
      return element.getAttribute(attribute) ?? '';
    }

    const element = document.querySelector(selector) as HTMLElement | null;
    if (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement
    ) {
      return element.value;
    }
    return element?.innerText ?? '';
  } catch {
    return '';
  }
}

function getText(setting: Setting) {
  const selectors: string[] = setting.selectors ? setting.selectors : [];
  const values: string[] = selectors.map(extractValue);

  const specialValues: { [key: string]: string } = {
    Title: document.title,
    URL: window.location.href,
  };

  // Single-pass replacement: extracted values are inserted as-is, so a
  // literal "{Title}" / "{URL}" inside an extracted value is never
  // rewritten by a later replacement pass.
  const formattedString = setting.format.replace(
    /\{(\d+|Title|URL)\}/g,
    (match, key: string) => {
      if (key === 'Title' || key === 'URL') {
        return specialValues[key];
      }
      return values[Number(key)] ?? match;
    },
  );

  return formattedString;
}

// === Element picker ===
//
// Started by a StartPick message from the popup. While active, the
// hovered element is outlined and its generated selector is shown in a
// small overlay. A click confirms the pick (and is not delivered to the
// page), Esc cancels. Only the main document is supported: elements in
// iframes or shadow DOM are out of scope.

const PICKER_Z_INDEX = '2147483647';

type PickerState = {
  settingId: string;
  highlighted: HTMLElement | null;
  previousOutline: string;
  previousOutlineOffset: string;
  overlay: HTMLDivElement;
  onMouseMove: (event: MouseEvent) => void;
  onClick: (event: MouseEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
};

let pickerState: PickerState | null = null;

function makePickerDiv(): HTMLDivElement {
  const div = document.createElement('div');
  div.style.cssText =
    `position: fixed; z-index: ${PICKER_Z_INDEX}; pointer-events: none;` +
    'font-family: monospace; font-size: 12px; line-height: 1.4;' +
    'color: #fff; background: rgba(33, 33, 33, 0.92);' +
    'padding: 6px 10px; border-radius: 4px; max-width: 80vw;' +
    'word-break: break-all; box-shadow: 0 2px 8px rgba(0,0,0,0.35);';
  return div;
}

function clearHighlight(state: PickerState) {
  if (state.highlighted) {
    state.highlighted.style.outline = state.previousOutline;
    state.highlighted.style.outlineOffset = state.previousOutlineOffset;
    state.highlighted = null;
  }
}

function stopPickMode() {
  if (!pickerState) {
    return;
  }
  document.removeEventListener('mousemove', pickerState.onMouseMove, true);
  document.removeEventListener('click', pickerState.onClick, true);
  document.removeEventListener('keydown', pickerState.onKeyDown, true);
  clearHighlight(pickerState);
  pickerState.overlay.remove();
  pickerState = null;
}

function showPickToast(text: string) {
  const toast = makePickerDiv();
  toast.style.left = '50%';
  toast.style.bottom = '24px';
  toast.style.transform = 'translateX(-50%)';
  toast.textContent = text;
  document.documentElement.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function startPickMode(settingId: string) {
  if (pickerState) {
    return;
  }

  const overlay = makePickerDiv();
  overlay.style.right = '12px';
  overlay.style.bottom = '12px';
  overlay.textContent = 'Click an element to copy its selector (Esc to cancel)';
  document.documentElement.appendChild(overlay);

  const state: PickerState = {
    settingId,
    highlighted: null,
    previousOutline: '',
    previousOutlineOffset: '',
    overlay,
    onMouseMove: (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target === overlay) {
        return;
      }
      if (state.highlighted !== target) {
        clearHighlight(state);
        state.previousOutline = target.style.outline;
        state.previousOutlineOffset = target.style.outlineOffset;
        target.style.outline = '2px solid #2196f3';
        target.style.outlineOffset = '1px';
        state.highlighted = target;
      }
      try {
        overlay.textContent = generateSelector(target);
      } catch {
        overlay.textContent = '';
      }
    },
    onClick: (event: MouseEvent) => {
      // The confirming click must not reach the page.
      event.preventDefault();
      event.stopPropagation();
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const selector = generateSelector(target);
      const confirmedSettingId = state.settingId;
      stopPickMode();
      void (async () => {
        const data = await chrome.storage.local.get(
          'pendingPickedSelectors',
        );
        const picked = (data.pendingPickedSelectors ??
          []) as PendingPickedSelector[];
        picked.push({ settingId: confirmedSettingId, selector });
        await chrome.storage.local.set({
          pendingPickedSelectors: picked,
        });
        await chrome.storage.local.remove('pendingPick');
        showPickToast(`Selector saved: ${selector}`);
      })();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        stopPickMode();
        void chrome.storage.local.remove('pendingPick');
      }
    },
  };

  pickerState = state;
  document.addEventListener('mousemove', state.onMouseMove, true);
  document.addEventListener('click', state.onClick, true);
  document.addEventListener('keydown', state.onKeyDown, true);
}
