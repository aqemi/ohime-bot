import { RegexBasedPlugin } from '../regex-based.plugin';

const REDDIT_URL = /(?:https?:\/\/)?(?:\w+\.)?reddit\.com\/\S+/i;

export class Reddit extends RegexBasedPlugin {
  protected regex = REDDIT_URL;
  protected queryRequired = false;

  public async run(): Promise<void> {
    const links = this.ctx.text.match(new RegExp(REDDIT_URL, 'gi')) ?? [];
    if (!links.length) {
      return this.notFound();
    }

    const fixed = links.map((link) => link.replace(/reddit\.com/i, 'rxddit.com'));

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
