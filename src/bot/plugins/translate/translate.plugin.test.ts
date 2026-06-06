import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBotEndpoint } from '../../../utils';
import { TelegramApi } from '../../telegram-api';
import requestFixture from './fixtures/request.json';

const xaiResponse = { choices: [{ message: { content: 'Салам' } }] };

const sendChatActionSpy = vi.spyOn(TelegramApi.prototype, 'sendChatAction').mockResolvedValue({
  ok: true,
  result: true,
});
const sendMessageSpy = vi.spyOn(TelegramApi.prototype, 'sendMessage').mockResolvedValue({
  ok: true,
  result: {} as never,
});

describe('TranslatePlugin', () => {
  const url = `https://example.org${getBotEndpoint(env)}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should translate a forwarded message containing Ukrainian characters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(xaiResponse),
      }),
    );

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(requestFixture) });

    expect(sendChatActionSpy).toHaveBeenCalledExactlyOnceWith({ action: 'typing', chat_id: -100777 });
    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'Салам',
      reply_to_message_id: 1,
      disable_notification: true,
    });

    vi.unstubAllGlobals();
  });

  it('should not trigger for a non-forwarded message', async () => {
    const fixture = {
      ...requestFixture,
      message: { ...requestFixture.message, forward_date: undefined },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendChatActionSpy).not.toHaveBeenCalled();
  });

  it('should not trigger for a forwarded message without Ukrainian characters', async () => {
    const fixture = {
      ...requestFixture,
      message: { ...requestFixture.message, text: 'Hello world' },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendChatActionSpy).not.toHaveBeenCalled();
  });
});
