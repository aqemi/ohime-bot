import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBotEndpoint } from '../../../utils';
import { TelegramApi } from '../../telegram-api';
import requestFixture from './fixtures/request.json';

const sendMessageSpy = vi.spyOn(TelegramApi.prototype, 'sendMessage').mockResolvedValue({
  ok: true,
  result: {} as never,
});

describe('Tiktok', () => {
  const url = `https://example.org${getBotEndpoint(env)}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rewrite a tiktok.com link to kktiktok.com', async () => {
    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(requestFixture) });

    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'https://www.kktiktok.com/@user/video/123456',
      reply_to_message_id: 1,
      disable_notification: true,
    });
  });

  it('should rewrite multiple links, including short and scheme-less ones', async () => {
    const fixture = {
      ...requestFixture,
      message: {
        ...requestFixture.message,
        text: 'https://vm.tiktok.com/AAA and tiktok.com/@x/video/999',
      },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'https://vm.kktiktok.com/AAA\nkktiktok.com/@x/video/999',
      reply_to_message_id: 1,
      disable_notification: true,
    });
  });

  it('should not trigger for a message without a tiktok link', async () => {
    const fixture = {
      ...requestFixture,
      message: { ...requestFixture.message, text: 'just a regular message' },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});
