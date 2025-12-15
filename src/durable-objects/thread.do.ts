import { DurableObject } from 'cloudflare:workers';
import { config } from '../bot/ai.config';
import { AiResponseTransformer } from '../bot/handlers/ai-response-transformer';
import { AiResponse, MistraleAgent } from '../bot/plugins/mistrale/mistrale-agent';
import { ResponseHelper } from '../bot/response-helper';
import { TelegramApi } from '../bot/telegram-api';
import { GifManager } from '../managers/gif.manager';
import { PromptManager } from '../managers/prompt.manager';
import { StickerManager } from '../managers/sticker.manager';
import { ThreadManager } from '../managers/thread.manager';
import { random } from '../utils/random';

type ThreadReplyPayloadCommon = {
  text: string;
  chatId: number;
  messageId: number;
  replyTo?: number;
  businessConnectionId?: string;
  chatTitle: string | null;
  rawFallback: boolean;
  postProcessing: boolean;
};

type ThreadReplyPayload = ThreadReplyPayloadCommon & {};

type ThreadReplyDelayPayload = ThreadReplyPayloadCommon;

type ThreadObjectState = {
  chatId: number;
  businessConnectionId?: string;
  replyTo?: number;
  chatTitle: string | null;
  rawFallback: boolean;
  postProcessing: boolean;
  shouldRead?: boolean;
  messageId: number;
};

export class ThreadDurableObject extends DurableObject {
  readonly env: Env;
  private readonly api: TelegramApi;
  private readonly responseHelper: ResponseHelper;
  private readonly agent: MistraleAgent;
  private readonly threadManager: ThreadManager;
  private readonly promptManager: PromptManager;
  private state?: ThreadObjectState;
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.env = env;
    this.api = new TelegramApi(env.TG_TOKEN);
    this.responseHelper = new ResponseHelper(this.api, env);
    this.threadManager = new ThreadManager(env);
    this.promptManager = new PromptManager(env);
    this.agent = new MistraleAgent(env, this.promptManager);
  }

  public async reply({
    text,
    chatId,
    replyTo,
    messageId,
    businessConnectionId,
    chatTitle,
    rawFallback,
    postProcessing,
  }: ThreadReplyPayload): Promise<void> {
    this.state = {
      chatId,
      replyTo,
      messageId,
      businessConnectionId,
      chatTitle,
      rawFallback,
      postProcessing,
    };
    await this.threadManager.appendThread({ chatId, role: 'user', content: text });
    await this.processReply();
  }

  /**
   * Replies to a thread with a delay, updating the internal state and scheduling an alarm if necessary.
   *
   * This method appends a user message to the thread, checks if the thread is active,
   * and either reads the business message immediately or marks it to be read later.
   * It then persists the updated state and sets an alarm for delayed processing based on the thread's activity.
   *
   * @param {ThreadReplyDelayPayload} params - The payload containing reply details.
   * @param {string} params.text - The text content of the reply.
   * @param {string} params.chatId - The unique identifier of the chat.
   * @param {string} params.replyTo - The message ID to reply to.
   * @param {string} params.businessConnectionId - The business connection identifier.
   * @param {string} params.chatTitle - The title of the chat.
   * @param {boolean} params.rawFallback - Whether to use raw fallback processing.
   * @param {Function} params.postProcessing - Optional post-processing function.
   * @param {string} params.messageId - The unique identifier of the message.
   * @returns {Promise<void>} A promise that resolves when the reply and delay logic is complete.
   */
  public async replyWithDelay({
    text,
    chatId,
    replyTo,
    businessConnectionId,
    chatTitle,
    rawFallback,
    postProcessing,
    messageId,
  }: ThreadReplyDelayPayload): Promise<void> {
    this.state = {
      chatId,
      replyTo,
      messageId,
      businessConnectionId,
      chatTitle,
      rawFallback,
      postProcessing,
    };
    await this.threadManager.appendThread({ chatId, role: 'user', content: text });

    const isActive = await this.threadManager.isActive(chatId, config.staleness.business);
    if (isActive && businessConnectionId) {
      await this.readBusinessMessage(businessConnectionId, chatId, messageId);
    } else {
      this.state.shouldRead = true;
    }
    await this.persist();

    if (text.includes('/restart')) {
      await this.ctx.storage.deleteAlarm();
    }

    const alarm = await this.ctx.storage.getAlarm();
    if (!alarm) {
      const delayConfig = isActive ? config.delay.read : config.delay.idle;
      const delay = this.env.FORCE_BUSINESS ? 5000 : random(delayConfig.min, delayConfig.max);
      await this.ctx.storage.setAlarm(Date.now() + delay);
    }
  }

  async alarm(alarmInfo?: AlarmInvocationInfo): Promise<void> {
    try {
      await this.processReply();
    } catch (error) {
      console.error('Error processing reply in alarm:', error);
    }
  }

  private async sendTyping(chatId: number, businessConnectionId?: string) {
    try {
      await this.api.sendChatAction({
        chat_id: chatId,
        business_connection_id: businessConnectionId,
        action: 'typing',
      });
    } catch (error) {
      console.error('Error on send typing', error);
    }
  }

  private async processReply(): Promise<void> {
    const {
      chatId,
      businessConnectionId,
      replyTo,
      chatTitle,
      rawFallback,
      postProcessing,
      messageId,
      shouldRead = false,
    } = await this.getState();

    if (shouldRead && businessConnectionId) {
      await this.readBusinessMessage(businessConnectionId, chatId, messageId);
      const delay = random(config.delay.read.min, config.delay.read.max);
      await this.sleep(delay);
    }

    const typingDuration = random(config.delay.typing.min, config.delay.typing.max);
    await this.sendTyping(chatId, businessConnectionId);

    const [response] = await Promise.all([this.runCompletion(chatId, chatTitle), this.sleep(typingDuration)]);

    if (!response) {
      return;
    }

    const responseTransformer = new AiResponseTransformer(
      this.env,
      this.api,
      this.responseHelper,
      new StickerManager(this.api, this.env),
      new GifManager(this.env),
    );
    await responseTransformer.send(response, {
      chatId,
      replyTo,
      businessConnectionId,
      postProcessing,
      rawFallback,
    });

    await this.threadManager.appendThread({ chatId, role: 'assistant', content: response.raw });
  }

  private async runCompletion(chatId: number, chatTitle: string | null): Promise<AiResponse | void> {
    const thread = await this.threadManager.getThread(chatId);
    const threadWithPrompt = chatTitle ? [this.promptManager.getChatPrompt(chatTitle), ...thread] : thread;
    let completion;
    try {
      completion = await this.agent.completion(threadWithPrompt);
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 429) {
        return console.error(error);
      }
      throw error;
    }
    return completion;
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async readBusinessMessage(bussinessConnectionId: string, chatId: number, messageId: number) {
    try {
      await this.api.readBusinessMessage({
        business_connection_id: bussinessConnectionId,
        chat_id: chatId,
        message_id: messageId,
      });
    } catch (error) {
      console.error('Error on readBusinessMessage', error);
    }
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put('state', this.state);
  }

  private async getState(): Promise<ThreadObjectState> {
    const state = this.state ?? (await this.ctx.storage.get('state'));
    if (!state) {
      throw new Error('No state persisted for this object with id: ${this.ctx.id.toString()}');
    }
    return state;
  }
}

export function getThreadObject(env: Env, name: string | number) {
  const objectId = env.THREAD.idFromName(name.toString());
  return env.THREAD.get(objectId);
}
