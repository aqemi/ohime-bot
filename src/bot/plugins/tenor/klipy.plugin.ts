import { getBotUsername, throwOnFetchError } from '../../../utils';
import { RegexBasedPlugin } from '../regex-based.plugin';
import { SearchResponse } from './tenor-api.interface';

const ITEMS_PER_PAGE = 50;

export class Tenor extends RegexBasedPlugin {
  protected regex = /^(?:gif|гиф|гифка)(?: (.+))?$/i;
  public async run({ resultNumber = 0 }: { resultNumber: number }): Promise<void> {
    const nextResultNum = resultNumber + 1;
    const params = new URLSearchParams({
      q: this.query,
      // key: this.env.KLIPY_API_KEY,
      limit: ITEMS_PER_PAGE.toString(),
      content_filter: 'off',
      client_key: getBotUsername(this.env),
    });
    const url = `https://api.klipy.com/api/v1/${this.env.KLIPY_API_KEY}/gifs/search?${params}`;

    const response = await fetch(url, {
      cf: {
        cacheEverything: true,
        cacheTtl: 86400,
      },
    });
    await throwOnFetchError(response);
    const results: any = await response.json();

    const result = results.data.data[resultNumber]?.file.hd.mp4.url;
    if (!result) {
      return this.notFound();
    }

    const reply_markup = this.hasNext(results, nextResultNum) ? this.getKeyboard(nextResultNum) : undefined;

    await this.api.sendAnimation({
      chat_id: this.ctx.chatId,
      animation: result,
      reply_to_message_id: this.replyTo,
      reply_markup,
      disable_notification: true,
      caption: this.ctx.caption ?? undefined,
    });
  }

  private hasNext(results: any, index: number): boolean {
    return !!results.data.data[index];
  }
}
