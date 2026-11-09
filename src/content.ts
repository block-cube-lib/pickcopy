import { Setting } from './setting.ts';
import { MessageResponse } from './message.ts';
import { MessageType } from './message_type.ts';

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
