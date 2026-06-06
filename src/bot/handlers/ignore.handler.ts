import { Update } from 'node-telegram-bot-api';
import { TelegramUpdateHandler } from './base.handler';

export class IgnoreHandler extends TelegramUpdateHandler {
  public async match(payload: Update): Promise<boolean> {
    const ignoreList = (this.env.IGNORE_LIST ?? '').split(',').map(Number).filter(Boolean);
    const senderId = payload.message?.from?.id ?? payload.callback_query?.from.id;
    return senderId != null && ignoreList.includes(senderId);
  }
  public async handle(_payload: Update): Promise<void> {}
}
