import { getBotCommandRegex } from '../../../utils';
import { ThreadManager } from '../../../managers/thread.manager';
import { RegexBasedPlugin } from '../regex-based.plugin';

export class RestartPromptPlugin extends RegexBasedPlugin {
  protected get regex() {
    return getBotCommandRegex('clear', this.env.BOT_USERNAME);
  }
  protected queryRequired = false;
  public async run(): Promise<void> {
    const threadManager = new ThreadManager(this.env);
    await threadManager.clearThread(this.ctx.chatId);
    await this.api.setMessageReaction({
      chat_id: this.ctx.chatId,
      message_id: this.ctx.messageId,
      reaction: [{ type: 'emoji', emoji: '🍓' }],
      is_big: true,
    });
  }
}
