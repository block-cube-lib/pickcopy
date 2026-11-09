import { MessageType } from './message_type.ts';
import { Setting } from './setting.ts';

class MessageRequest {
  messageType: MessageType;

  constructor(messageType: MessageType) {
    this.messageType = messageType;
  }
}

class GetTextRequest extends MessageRequest {
  setting: Setting;

  constructor(setting: Setting) {
    super(MessageType.GetText);
    this.setting = setting;
  }
}

class GetUrlRequest extends MessageRequest {
  constructor() {
    super(MessageType.GetUrl);
  }
}

class StartPickRequest extends MessageRequest {
  settingId: string;

  constructor(settingId: string) {
    super(MessageType.StartPick);
    this.settingId = settingId;
  }
}

class MessageResponse<T> {
  isSuccess: boolean;
  content: T;
  errorMessage: string;

  constructor(isSuccess: boolean, content: T, errorMessage: string) {
    this.isSuccess = isSuccess;
    this.content = content;
    this.errorMessage = errorMessage;
  }

  static createSuccess<T>(content: T) {
    return new MessageResponse(true, content, '');
  }

  static createError<T>(errorMessage: string) {
    return new MessageResponse(false, null, errorMessage);
  }
}

export {
  GetTextRequest,
  GetUrlRequest,
  MessageRequest,
  MessageResponse,
  StartPickRequest,
};
