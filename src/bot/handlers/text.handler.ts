import type { Update as TelegramUpdate } from 'node-telegram-bot-api';
import { defined } from '../../utils';
import {
  BasePlugin,
  TranslatePlugin,
  DrawPlugin,
  GoogleImageSearch,
  // GrokPlugin,
  Instagram,
  InvocationContext,
  Keyboard,
  PluginDerived,
  Tenor,
  TestPlugin,
  Reddit,
  Tiktok,
  XCom,
  Youtube,
} from '../plugins';
import { RestartPromptPlugin } from '../plugins/restart/restart.plugin';
import { TelegramUpdateHandler } from './base.handler';

const plugins: PluginDerived[] = [
  // GrokPlugin,
  GoogleImageSearch,
  Youtube,
  Tenor,
  Instagram,
  Tiktok,
  XCom,
  Reddit,
  DrawPlugin,
  Keyboard,
  RestartPromptPlugin,
  TestPlugin,
  TranslatePlugin,
];

export class TelegramTextHandler extends TelegramUpdateHandler {
  private plugin?: BasePlugin;

  async match(payload: TelegramUpdate) {
    const { message } = payload;
    if (!message?.text && !message?.caption) {
      return false;
    }
    const chatId = defined(message?.chat.id, 'chatId');

    const ctx: InvocationContext = {
      chatId,
      messageId: defined(message?.message_id, 'message.message_id'),
      replyToId: message?.reply_to_message?.message_id,
      initiatorId: defined(message?.from?.id, 'message.from.id'),
      initiatorName: defined(message?.from?.username ?? message?.from?.first_name, 'message?.from?.first_name'),
      text: defined(message?.caption || message?.text, 'message.text|caption'),
      replyToText: message?.reply_to_message?.text,
      replyToMessage: message?.reply_to_message ?? undefined,
      isForwarded: !!message.forward_date
    };

    for (const Plugin of plugins) {
      const plugin = new Plugin(ctx, this.api, this.env, this.responseHelper);
      if (await plugin.match()) {
        this.plugin = plugin;
        return true;
      }
    }
    return false;
  }

  async handle(payload: TelegramUpdate) {
    const { message } = payload;
    const chatId = defined(message?.chat.id, 'chatId');
    try {
      await this.plugin?.run({});
    } catch (error) {
      await this.responseHelper.sendError(chatId, error, message?.message_id);
    }
  }
}
