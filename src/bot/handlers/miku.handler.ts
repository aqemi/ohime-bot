import type { Update as TelegramUpdate } from 'node-telegram-bot-api';
import { ThreadManager } from '../../managers/thread.manager';
import { config } from '../ai.config';
import { ResponseHelper } from '../response-helper';
import { TelegramApi } from '../telegram-api';
import { AiMessageInterpreter } from './ai-message-interpreter';
import { TelegramUpdateHandler } from './base.handler';
import { getThreadObject } from '../../durable-objects/thread.do';

export class MikuHandler extends TelegramUpdateHandler {
  private readonly threadManager: ThreadManager;

  constructor(
    protected readonly api: TelegramApi,
    protected readonly env: Env,
    protected readonly responseHelper: ResponseHelper,
  ) {
    super(api, env, responseHelper);
    this.threadManager = new ThreadManager(env);
  }

  async match(payload: TelegramUpdate) {
    const { message } = payload;
    if (!message) {
      return false;
    }
    const interpreter = new AiMessageInterpreter(this.env, this.api);
    try {
      return (
        interpreter.isMentioned(message) ||
        interpreter.isReplyToMe(message) ||
        (!interpreter.isOtherMentioned(message) &&
          !interpreter.isReplyToOther(message) &&
          (await this.threadManager.isActive(message.chat.id, config.staleness.default)))
      );
    } catch (error) {
      console.error('Error in ai.handler matcher', error);
      return false;
    }
  }

  async handle(payload: TelegramUpdate) {
    const { message } = payload;
    if (!message) {
      throw new Error('No message provided to ai.handler');
    }
    try {
      const interpreter = new AiMessageInterpreter(this.env, this.api);
      const aiInput = await interpreter.formatMessage(message);
      if (!aiInput) {
        console.debug('No AI input extracted from message');
        return;
      }
      const thread = getThreadObject(this.env, message.chat.id);
      await thread.reply({
        text: aiInput,
        chatId: message.chat.id,
        replyTo: message.message_id,
        businessConnectionId: message.business_connection_id,
        chatTitle: interpreter.getChatTitle(message),
        messageId: message.message_id,
        rawFallback: true,
        postProcessing: true,
      });
    } catch (error) {
      console.error(error);
      await this.responseHelper.sendError(message.chat.id, error, message.message_id);
    }
  }
}
