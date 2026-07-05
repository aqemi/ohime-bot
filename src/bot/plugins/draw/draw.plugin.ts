import { throwOnFetchError } from '../../../utils';
import { RegexBasedPlugin } from '../regex-based.plugin';

interface XaiImageResponse {
  data: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

export class DrawPlugin extends RegexBasedPlugin {
  protected regex = /^(?:Алиса)(?:[, ](.+))?$/iu;

  public async run(): Promise<void> {
    this.api.sendChatAction({ action: 'upload_photo', chat_id: this.ctx.chatId });

    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-imagine-image',
        prompt: this.query,
        response_format: 'url',
      }),
    });

    await throwOnFetchError(response);

    const result: XaiImageResponse = await response.json();

    const imageUrl = result.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    await this.api.sendPhoto({
      chat_id: this.ctx.chatId,
      photo: imageUrl,
      reply_to_message_id: this.replyTo,
      caption: this.ctx.caption ?? '',
      reply_markup: this.getKeyboard(0),
      disable_notification: true,
    });
  }
}
