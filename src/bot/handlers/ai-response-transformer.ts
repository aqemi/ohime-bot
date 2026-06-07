import { Message } from 'node-telegram-bot-api';
import { GifManager } from '../../managers/gif.manager';
import { StickerManager } from '../../managers/sticker.manager';
import { defined } from '../../utils';
import { GoogleImageSearch, InvocationContext, PluginDerived, Tenor, Youtube } from '../plugins';
import { AiResponse } from '../agents/miku/miku.agent';
import { ResponseHelper } from '../response-helper';
import { TelegramApi } from '../telegram-api';

export const plugins: PluginDerived[] = [GoogleImageSearch, Youtube, Tenor];

type SendOptions = {
  chatId: number;
  replyTo?: number;
  businessConnectionId?: string;
  rawFallback: boolean;
  postProcessing: boolean;
};

export class AiResponseTransformer {
  constructor(
    private readonly env: Env,
    private readonly api: TelegramApi,
    private readonly responseHelper: ResponseHelper,
    private readonly stickerManager: StickerManager,
    private readonly gifManager: GifManager,
  ) {}

  public async send(
    response: AiResponse,
    { chatId, replyTo, businessConnectionId, rawFallback, postProcessing }: SendOptions,
  ): Promise<void> {
    if (!response.valid) {
      if (rawFallback) {
        await this.responseHelper.sendJSON(chatId, response.raw, replyTo);
      }
      return;
    }

    if (response.text) {
      const sentMessage = await this.sendText(response.text, chatId, replyTo, businessConnectionId);
      if (postProcessing) {
        await this.postProcessMessage({
          text: defined(sentMessage.text, 'sent.text'),
          chatId,
          messageId: sentMessage.message_id,
          replyToId: sentMessage.message_id,
          businessConnectionId,
          initiatorId: defined(sentMessage.from?.id, 'sent.from?.id'),
          initiatorName: defined(sentMessage.from?.username),
        });
      }
    }

    if (typeof response.sticker === 'string' && response.sticker) {
      await this.sendSticker(response.sticker, chatId, businessConnectionId);
    }

    if (typeof response.gif === 'number') {
      await this.sendGif(response.gif, chatId, businessConnectionId);
    }
  }

  private async sendText(
    text: string,
    chatId: number,
    replyTo?: number,
    businessConnectionId?: string,
  ): Promise<Message> {
    const { result } = await this.api.sendMessage({
      chat_id: chatId,
      business_connection_id: businessConnectionId,
      reply_to_message_id: replyTo,
      text,
    });
    return result;
  }

  private async postProcessMessage(ctx: InvocationContext) {
    for (const Plugin of plugins) {
      const plugin = new Plugin(ctx, this.api, this.env, this.responseHelper);
      if (await plugin.match()) {
        return await plugin.run({});
      }
    }
  }

  private async sendSticker(stickerId: string, chatId: number, businessConnectionId?: string): Promise<void> {
    const sticker = await this.stickerManager.getSticker(stickerId);
    if (sticker) {
      await this.api.sendSticker({
        chat_id: chatId,
        business_connection_id: businessConnectionId,
        sticker: sticker.file_id,
      });
    } else {
      await this.api.sendMessage({
        chat_id: chatId,
        business_connection_id: businessConnectionId,
        text: stickerId,
      });
    }
  }

  private async sendGif(gifId: string | number, chatId: number, businessConnectionId?: string): Promise<void> {
    const gif = await this.gifManager.getGif(gifId);
    if (gif) {
      await this.api.sendAnimation({
        chat_id: chatId,
        business_connection_id: businessConnectionId,
        animation: gif.file_id,
      });
    }
  }
}
