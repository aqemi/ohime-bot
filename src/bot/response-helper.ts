import { FetchError, getSanitizeRegex } from '../utils';
import { decorateError } from '../utils/decorate-error';
import { TelegramApi } from './telegram-api';

export class ResponseHelper {
  private readonly sanitizeExpr: RegExp;

  constructor(
    private readonly api: TelegramApi,
    private readonly env: Env,
  ) {
    this.sanitizeExpr = getSanitizeRegex(env);
  }

  public async sendJSON(chatId: number, json: object | string, replyTo?: number): Promise<void> {
    const stringified = typeof json === 'string' ? json : JSON.stringify(json, null, 2).replaceAll('\\"', '\\\\"');
    const open = '```json\n';
    const close = '\n```';
    const text = `${open}${stringified}${close}`;
    await this.api.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
      reply_to_message_id: replyTo,
    });
  }

  public async sendError(chatId: number, maybeError: unknown, replyTo?: number): Promise<void> {
    try {
      const error = this.toError(maybeError);
      if (error instanceof FetchError) {
        error.url = this.sanitize(error.url);
      }
      delete error.stack;
      const decoratedError = decorateError(error);
      await this.sendJSON(chatId, decoratedError, replyTo);
    } catch (extraError) {
      console.error('An additional error occurred while attempting to handle the original error:', extraError);
    }
  }

  public async removeKeyboard(chatId: number, messageId: number) {
    try {
      await this.api.editMessageReplyMarkup({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: undefined,
      });
    } catch (error) {
      console.error('Error on removeKeyboard', error);
    }
  }

  private toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(JSON.stringify(err));
  }

  private sanitize(text: string): string {
    return text.replace(this.sanitizeExpr, '<REDACTED>');
  }
}
