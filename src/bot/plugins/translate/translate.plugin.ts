import { throwOnFetchError } from '../../../utils';
import { BasePlugin } from '../base.plugin';

const REGEX = /[їєіґ]/iu;

interface XaiChatResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

export class TranslatePlugin extends BasePlugin {
  public match(): boolean {
    return !!this.ctx.isForwarded && REGEX.test(this.ctx.text);
  }

  public async run(): Promise<void> {
    await this.api.sendChatAction({ action: 'typing', chat_id: this.ctx.chatId });

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a translator. Translate the user message to Chuvash language. Return only the translation, nothing else.',
          },
          {
            role: 'user',
            content: this.ctx.text,
          },
        ],
      }),
    });

    await throwOnFetchError(response);

    const result: XaiChatResponse = await response.json();
    const translation = result.choices[0]?.message.content;

    if (!translation) {
      throw new Error('No translation in response');
    }

    await this.api.sendMessage({
      chat_id: this.ctx.chatId,
      text: translation,
      reply_to_message_id: this.ctx.replyToId ?? this.ctx.messageId,
      disable_notification: true,
    });
  }
}
