import { Setting } from "./setting.ts";
import { MessageResponse } from "./message.ts";
import { MessageType } from "./message_type.ts";

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
    };

  } catch (error) {
    const errorMessage =
      `Error processing message: ${error}\nmessage: ${message}`;
    console.error(errorMessage);
    const response = MessageResponse.createError('responseMessage');
    sendResponse(response);
  }

  return true;
});

function getText(setting: Setting) {
  const selectors: string[] = setting.selectors ? setting.selectors : [];
  const values: string[] = selectors.map((selector) => {
    if (selector.trim() === '') {
      return '';
    } // if selector includes '@', it is an attribute
    else if (selector.includes('@')) {
      const [valueSelector, attribute] = selector.split('@');
      const element = document.querySelector(valueSelector) as HTMLElement | null;
      if (element === null || element === undefined) {
        return '';
      } else if (element.hasAttribute(attribute)) {
        return element.getAttribute(attribute) ?? '';
      }
      element.innerText;
    } else {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (element as HTMLTextAreaElement != null) {
        return (element as HTMLTextAreaElement).value;
      }
      else {
        return element?.innerText ?? '';
      }
    }
  }) as string[];

  // Replace {0}, {1}, etc. with captured values
  let formattedString = setting.format.replace(/{(\d+)}/g, (match, number) => {
    return values?.[number] ?? match;
  });

  const specialValues: { [key: string]: string } = {
    '{Title}': document.title,
    '{URL}': window.location.href,
  };
  // Replace {Title} and {URL} with their actual values
  formattedString = formattedString.replace(/{Title}|{URL}/g, (match) => {
    return specialValues[match] || match;
  });

  return formattedString;
}

