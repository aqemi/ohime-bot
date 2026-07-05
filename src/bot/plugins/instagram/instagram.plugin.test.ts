import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBotEndpoint } from '../../../utils';
import { TelegramApi } from '../../telegram-api';
import requestFixture from './fixtures/request.json';

const sendMessageSpy = vi.spyOn(TelegramApi.prototype, 'sendMessage').mockResolvedValue({
  ok: true,
  result: {} as never,
});

describe('Instagram', () => {
  const url = `https://example.org${getBotEndpoint(env)}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rewrite an instagram.com link to kkinstagram.com', async () => {
    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(requestFixture) });

    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'https://www.kkinstagram.com/reel/ABC123/',
      reply_to_message_id: 1,
      disable_notification: true,
    });
  });

  it('should rewrite multiple links, including ones without a scheme', async () => {
    const fixture = {
      ...requestFixture,
      message: {
        ...requestFixture.message,
        text: 'https://instagram.com/p/AAA and instagram.com/reel/BBB',
      },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'https://kkinstagram.com/p/AAA\nkkinstagram.com/reel/BBB',
      reply_to_message_id: 1,
      disable_notification: true,
    });
  });

  it('should not trigger for a message without an instagram link', async () => {
    const fixture = {
      ...requestFixture,
      message: { ...requestFixture.message, text: 'just a regular message' },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});
