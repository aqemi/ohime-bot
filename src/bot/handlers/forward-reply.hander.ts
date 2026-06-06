import { Message, Update } from 'node-telegram-bot-api';
import { getThreadObject } from '../../durable-objects/thread.do';
import { LogManager } from '../../managers/log.manager';
import { AiMessageInterpreter } from './ai-message-interpreter';
import { TelegramUpdateHandler } from './base.handler';

export class ForwardReplyHandler extends TelegramUpdateHandler {
  public async match({ message }: Update): Promise<boolean> {
    return message?.chat.type === 'private' && !!message.forward_date;
  }
  public async handle({ message }: Update): Promise<void> {
    if (!message) {
      throw new Error('No message provided to LogHandler');
    }

    try {
      const logManager = new LogManager(this.env);
      const username = this.getUsername(message);
      const logs = await logManager.find(message.forward_date!, username);

      if (!logs.length) {
        throw new Error(`No logs found for ${message.date}, ${username}`);
      }

      if (logs.length > 1) {
        throw new Error(`Multiple logs found for ${message.date}, ${username}`);
      }

      const [log] = logs;

      const interpreter = new AiMessageInterpreter(this.env, this.api);
      const originalFrom = message.forward_from ?? {
        id: 0,
        is_bot: false,
        first_name: message.forward_sender_name ?? '',
      };
      const aiInput = await interpreter.formatMessage({ ...message, from: originalFrom });
      if (!aiInput) {
        throw new Error('No input extracted from message');
      }

      const thread = getThreadObject(this.env, log.chat_id);
      await thread.reply({
        text: aiInput,
        chatId: log.chat_id,
        replyTo: log.message_id,
        chatTitle: null,
        messageId: log.message_id,
        displayErrors: false,
        rawFallback: true,
        postProcessing: true,
      });
    } catch (error) {
      console.error(error);
      await this.responseHelper.sendError(message.chat.id, error, message.message_id);
    }
  }

  private getUsername(message: Message): string {
    return (
      message.forward_sender_name ??
      `${message.forward_from?.first_name}${message.forward_from?.last_name ? ` ${message.forward_from.last_name}` : ''}`
    );
  }
}
