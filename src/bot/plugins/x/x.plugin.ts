import { RegexBasedPlugin } from '../regex-based.plugin';

const X_URL = /(?<![\w.])(?:https?:\/\/)?(?:www\.)?x\.com\/\S+/i;

export class XCom extends RegexBasedPlugin {
  protected regex = X_URL;
  protected queryRequired = false;

  public async run(): Promise<void> {
    const links = this.ctx.text.match(new RegExp(X_URL, 'gi')) ?? [];
    if (!links.length) {
      return this.notFound();
    }

    const fixed = links.map((link) => link.replace(/x\.com/i, 'girlcockx.com'));

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
