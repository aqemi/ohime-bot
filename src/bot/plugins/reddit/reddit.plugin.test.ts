import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBotEndpoint } from '../../../utils';
import { TelegramApi } from '../../telegram-api';
import requestFixture from './fixtures/request.json';

const sendMessageSpy = vi.spyOn(TelegramApi.prototype, 'sendMessage').mockResolvedValue({
  ok: true,
  result: {} as never,
});

describe('Reddit', () => {
  const url = `https://example.org${getBotEndpoint(env)}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rewrite a reddit.com link to rxddit.com', async () => {
    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(requestFixture) });

    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'https://www.rxddit.com/r/aww/comments/abc123/title/',
      reply_to_message_id: 1,
      disable_notification: true,
    });
  });

  it('should rewrite multiple links, including subdomain and scheme-less ones', async () => {
    const fixture = {
      ...requestFixture,
      message: {
        ...requestFixture.message,
        text: 'https://old.reddit.com/r/a/comments/1 and reddit.com/r/b/comments/2',
      },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'https://old.rxddit.com/r/a/comments/1\nrxddit.com/r/b/comments/2',
      reply_to_message_id: 1,
      disable_notification: true,
    });
  });

  it('should not trigger for a message without a reddit link', async () => {
    const fixture = {
      ...requestFixture,
      message: { ...requestFixture.message, text: 'just a regular message' },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});
