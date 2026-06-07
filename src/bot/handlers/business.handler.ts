import type { Update as TelegramUpdate } from 'node-telegram-bot-api';
import { MikuHandler } from './miku.handler';
import { AiMessageInterpreter } from './ai-message-interpreter';
import { getThreadObject } from '../../durable-objects/thread.do';

export class BusinessChatHandler extends MikuHandler {
  async match(payload: TelegramUpdate) {
    const message = payload.business_message ?? payload.edited_business_message;
    return !!this.env.FORCE_BUSINESS || (!!message && message.from?.id === message.chat?.id);
  }

  async handle(payload: TelegramUpdate) {
    try {
      const message = payload.business_message ?? payload.edited_business_message ?? payload.message;
      if (!message) {
        throw new Error('No message');
      }
      const interpreter = new AiMessageInterpreter(this.env, this.api);
      const aiInput = await interpreter.formatMessage(message);
      if (!aiInput) {
        console.debug('Ignored');
        return;
      }
      const thread = getThreadObject(this.env, message.chat.id);
      await thread.replyWithDelay({
        businessConnectionId: message.business_connection_id,
        chatId: message.chat.id,
        displayErrors: false,
        messageId: message.message_id,
        postProcessing: false,
        rawFallback: false,
        text: aiInput,
        chatTitle: null,
      });
    } catch (error) {
      console.error('Error in business.handler', error);
    }
  }
}
