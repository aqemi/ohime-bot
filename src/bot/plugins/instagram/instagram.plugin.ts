import { RegexBasedPlugin } from '../regex-based.plugin';

const INSTAGRAM_URL = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/\S+/i;

export class Instagram extends RegexBasedPlugin {
  protected regex = INSTAGRAM_URL;
  protected queryRequired = false;

  public async run(): Promise<void> {
    const links = this.ctx.text.match(new RegExp(INSTAGRAM_URL, 'gi')) ?? [];
    if (!links.length) {
      return this.notFound();
    }

    const fixed = links.map((link) => link.replace(/instagram\.com/i, 'kkinstagram.com'));

    const caption = this.ctx.caption ? `${this.ctx.caption}\n` : '';
    const text = `${caption}${fixed.join('\n')}`;
    await this.api.sendMessage({
      chat_id: this.ctx.chatId,
      text,
      reply_to_message_id: this.replyTo,
      disable_notification: true,
    });
  }
}
