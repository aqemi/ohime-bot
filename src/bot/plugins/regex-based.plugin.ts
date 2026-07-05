import { ResponseHelper } from '../response-helper';
import { TelegramApi } from '../telegram-api';
import { BasePlugin, InvocationContext } from './base.plugin';

export abstract class RegexBasedPlugin extends BasePlugin {
  protected abstract regex: RegExp;
  protected queryRequired = true;
  protected readonly replyTo: number;

  constructor(
    protected readonly ctx: InvocationContext,
    protected readonly api: TelegramApi,
    protected readonly env: Env,
    protected readonly responseHelper: ResponseHelper,
  ) {
    super(ctx, api, env, responseHelper);
    this.replyTo = ctx.replyToId ?? ctx.messageId;
  }

  public abstract run(arg: { resultNumber: number }): Promise<void>;

  public match(): boolean | Promise<boolean> {
    return this.regex.test(this.ctx.text) && (!this.queryRequired || !!this.query);
  }

  public get query(): string {
    const [, match] = this.ctx.text.match(this.regex) ?? [];
    const query = match === undefined && this.ctx.replyToText ? this.ctx.replyToText : match;
    return query ?? '';
  }

  protected async notFound() {
    await this.api.sendMessage({
      chat_id: this.ctx.chatId,
      text: 'Не нашел \u{1F614}',
      reply_to_message_id: this.replyTo,
      disable_notification: true,
    });
  }
}
export type RegexBasedPluginDerived = {
  new (ctx: InvocationContext, api: TelegramApi, env: Env, responseHelper: ResponseHelper): RegexBasedPlugin;
} & typeof RegexBasedPlugin;
