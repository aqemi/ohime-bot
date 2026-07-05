import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBotEndpoint } from '../../../utils';
import { TelegramApi } from '../../telegram-api';
import requestFixture from './fixtures/request.json';
import moarFixture from './fixtures/moar.json';
import delFixture from './fixtures/del.json';
import retryFixture from './fixtures/retry.json';

const sendMessageSpy = vi.spyOn(TelegramApi.prototype, 'sendMessage').mockResolvedValue({
  ok: true,
  result: {} as never,
});
const deleteMessageSpy = vi.spyOn(TelegramApi.prototype, 'deleteMessage').mockResolvedValue({
  ok: true,
  result: true,
});
const answerCallbackQuerySpy = vi.spyOn(TelegramApi.prototype, 'answerCallbackQuery').mockResolvedValue({
  ok: true,
  result: true,
});
const editMessageReplyMarkupSpy = vi.spyOn(TelegramApi.prototype, 'editMessageReplyMarkup').mockResolvedValue({
  ok: true,
  result: true,
});

const youtubeUrl = expect.stringMatching(/^https:\/\/www\.youtube\.com\/watch\?v=.+/);
const youtubeUrlWithMention = expect.stringMatching(/^@username\nhttps:\/\/www\.youtube\.com\/watch\?v=.+/);

describe('Youtube Plugin', () => {
  const url = `https://example.org${getBotEndpoint(env)}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a video link', async () => {
    await SELF.fetch(url, {
      method: 'POST',
      body: JSON.stringify(requestFixture),
    });
    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: 777,
      disable_notification: true,
      text: youtubeUrl,
      reply_markup: {
        inline_keyboard: [
          [
            {
              callback_data: '{"0":0,"1":777}',
              text: 'del',
            },
            {
              callback_data: '{"0":1,"1":777,"2":"Youtube","3":1}',
              text: 're:',
            },
            {
              callback_data: '{"0":2,"1":777,"2":"Youtube","3":1}',
              text: 'moar!',
            },
          ],
        ],
      },
      reply_to_message_id: 0,
    });
  });

  it('should return the next video on the "moar!" button', async () => {
    await SELF.fetch(url, {
      method: 'POST',
      body: JSON.stringify(moarFixture),
    });
    expect(editMessageReplyMarkupSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: 777,
      message_id: 1,
      reply_markup: undefined,
    });
    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: 777,
      disable_notification: true,
      text: youtubeUrlWithMention,
      reply_markup: {
        inline_keyboard: [
          [
            {
              callback_data: '{"0":0,"1":777}',
              text: 'del',
            },
            {
              callback_data: '{"0":1,"1":777,"2":"Youtube","3":2}',
              text: 're:',
            },
            {
              callback_data: '{"0":2,"1":777,"2":"Youtube","3":2}',
              text: 'moar!',
            },
          ],
        ],
      },
      reply_to_message_id: 0,
    });
  });

  it('should delete the message on the "del" button when the initiator owns it', async () => {
    await SELF.fetch(url, {
      method: 'POST',
      body: JSON.stringify(delFixture),
    });
    expect(deleteMessageSpy).toHaveBeenCalledExactlyOnceWith({ chat_id: 777, message_id: 1 });
    expect(answerCallbackQuerySpy).not.toHaveBeenCalled();
  });

  it('should refuse to delete on the "del" button when a different user presses it', async () => {
    const fixture = {
      ...delFixture,
      callback_query: {
        ...delFixture.callback_query,
        from: { ...delFixture.callback_query.from, id: 888 },
      },
    };
    await SELF.fetch(url, {
      method: 'POST',
      body: JSON.stringify(fixture),
    });
    expect(deleteMessageSpy).not.toHaveBeenCalled();
    expect(answerCallbackQuerySpy).toHaveBeenCalledExactlyOnceWith({
      callback_query_id: '0000000',
      text: 'Не твой ответ, не трогай',
      show_alert: false,
    });
  });

  it('should delete the old message and send a fresh video on the "re:" button', async () => {
    await SELF.fetch(url, {
      method: 'POST',
      body: JSON.stringify(retryFixture),
    });
    expect(deleteMessageSpy).toHaveBeenCalledExactlyOnceWith({ chat_id: 777, message_id: 1 });
    expect(editMessageReplyMarkupSpy).not.toHaveBeenCalled();
    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: 777,
      disable_notification: true,
      text: youtubeUrlWithMention,
      reply_markup: {
        inline_keyboard: [
          [
            {
              callback_data: '{"0":0,"1":777}',
              text: 'del',
            },
            {
              callback_data: '{"0":1,"1":777,"2":"Youtube","3":2}',
              text: 're:',
            },
            {
              callback_data: '{"0":2,"1":777,"2":"Youtube","3":2}',
              text: 'moar!',
            },
          ],
        ],
      },
      reply_to_message_id: 0,
    });
  });

  it('should refuse to retry on the "re:" button when a different user presses it', async () => {
    const fixture = {
      ...retryFixture,
      callback_query: {
        ...retryFixture.callback_query,
        from: { ...retryFixture.callback_query.from, id: 888 },
      },
    };
    await SELF.fetch(url, {
      method: 'POST',
      body: JSON.stringify(fixture),
    });
    expect(deleteMessageSpy).not.toHaveBeenCalled();
    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(answerCallbackQuerySpy).toHaveBeenCalledExactlyOnceWith({
      callback_query_id: '0000000',
      text: 'Не твой ответ, не трогай',
      show_alert: false,
    });
  });
});
