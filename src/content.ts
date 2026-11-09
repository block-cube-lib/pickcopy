import { Setting } from './setting.ts';
import { MessageResponse } from './message.ts';
import { MessageType } from './message_type.ts';
import { generateSelector } from './selector.ts';
import {
  addPendingPickedSelector,
  removePendingPick,
} from './storage.ts';

// Every branch responds synchronously, so the listener does not need
// to return true (which would only be required to keep the message
// channel open for an asynchronous sendResponse call).
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
});

// A trailing "@name" at the very end of a selector means "read this
// attribute" (e.g. 'a@href'). Matching only a trailing identifier
// keeps '@' characters that legitimately appear inside a selector
// (e.g. in an attribute value like [data-user="@me"]) from being
// treated as the attribute separator.
const ATTRIBUTE_SUFFIX = /@([a-zA-Z_][\w:-]*)$/;

function extractValue(selector: string): string {
  // One bad selector must not break the whole copy: treat it as empty.
  try {
    if (selector.trim() === '') {
      return '';
    }

    const attributeMatch = selector.match(ATTRIBUTE_SUFFIX);
    if (attributeMatch) {
      const valueSelector = selector.slice(0, attributeMatch.index);
      const attribute = attributeMatch[1];
      const element = document.querySelector(valueSelector);
      if (element === null || element === undefined) {
        return '';
      }
      // No attribute -> empty string (no innerText fallback).
      if (!element.hasAttribute(attribute)) {
        return '';
      }
      return element.getAttribute(attribute) ?? '';
    }

    const element = document.querySelector(selector);
    if (element === null) {
      return '';
    }
    if (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement
    ) {
      return element.value;
    }
    // HTMLElement has innerText; SVG and other elements may not, so
    // fall back to textContent for them.
    const innerText = (element as HTMLElement).innerText;
    return innerText ?? element.textContent ?? '';
  } catch (error) {
    console.warn(`Failed to extract value for selector "${selector}":`, error);
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
// Marker attribute on the picker's own UI (overlay/toast), so its
// elements can be excluded from hover/click handling.
const PICKER_UI_ATTRIBUTE = 'data-copy-picker-ui';

type PickerState = {
  settingId: string;
  highlighted: HTMLElement | null;
  previousOutline: string;
  previousOutlineOffset: string;
  overlay: HTMLDivElement;
  listeners: { type: string; handler: (event: Event) => void }[];
};

let pickerState: PickerState | null = null;

function makePickerDiv(): HTMLDivElement {
  const div = document.createElement('div');
  div.setAttribute(PICKER_UI_ATTRIBUTE, 'true');
  div.style.cssText =
    `position: fixed; z-index: ${PICKER_Z_INDEX}; pointer-events: none;` +
    'font-family: monospace; font-size: 12px; line-height: 1.4;' +
    'color: #fff; background: rgba(33, 33, 33, 0.92);' +
    'padding: 6px 10px; border-radius: 4px; max-width: 80vw;' +
    'word-break: break-all; box-shadow: 0 2px 8px rgba(0,0,0,0.35);';
  return div;
}

// True when the event target is (or is inside) the picker's own UI.
function isPickerUiTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest(`[${PICKER_UI_ATTRIBUTE}]`) !== null;
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
  for (const { type, handler } of pickerState.listeners) {
    document.removeEventListener(type, handler, true);
  }
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

// Swallow an event completely so the page never sees it.
function swallowEvent(event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function confirmPick(state: PickerState, target: Element) {
  const confirmedSettingId = state.settingId;
  // Clean up first: even if generating or saving the selector throws,
  // the picker must not stay behind on the page.
  stopPickMode();
  void (async () => {
    try {
      const selector = generateSelector(target);
      await addPendingPickedSelector({
        settingId: confirmedSettingId,
        selector,
      });
      await removePendingPick();
      showPickToast(`Selector saved: ${selector}`);
    } catch (error) {
      console.error(`Failed to save the picked selector: ${error}`);
      showPickToast('Failed to save the selector.');
    }
  })();
}

function startPickMode(settingId: string) {
  // A second StartPick replaces the running session instead of being
  // ignored, so a stale session never lingers.
  if (pickerState) {
    stopPickMode();
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
    listeners: [],
  };

  const onMouseMove = (event: Event) => {
    const mouseEvent = event as MouseEvent;
    if (!(mouseEvent.target instanceof Element)) {
      return;
    }
    if (isPickerUiTarget(mouseEvent.target)) {
      return;
    }
    const target = mouseEvent.target as HTMLElement;
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
  };

  // mousedown/mouseup and their pointer equivalents are swallowed too,
  // so picking does not focus fields, start text selection or trigger
  // drag behaviour on the page.
  const onPress = (event: Event) => {
    swallowEvent(event);
  };

  const onClick = (event: Event) => {
    swallowEvent(event);
    if (!(event.target instanceof Element)) {
      return;
    }
    if (isPickerUiTarget(event.target)) {
      return;
    }
    confirmPick(state, event.target);
  };

  const onKeyDown = (event: Event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key === 'Escape') {
      keyEvent.preventDefault();
      keyEvent.stopImmediatePropagation();
      stopPickMode();
      void removePendingPick();
    }
  };

  state.listeners = [
    { type: 'mousemove', handler: onMouseMove },
    { type: 'mousedown', handler: onPress },
    { type: 'mouseup', handler: onPress },
    { type: 'pointerdown', handler: onPress },
    { type: 'pointerup', handler: onPress },
    { type: 'click', handler: onClick },
    { type: 'keydown', handler: onKeyDown },
  ];

  pickerState = state;
  for (const { type, handler } of state.listeners) {
    document.addEventListener(type, handler, true);
  }
}
