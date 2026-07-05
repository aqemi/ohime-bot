import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBotEndpoint } from '../../../utils';
import { TelegramApi } from '../../telegram-api';
import requestFixture from './fixtures/request.json';

const sendMessageSpy = vi.spyOn(TelegramApi.prototype, 'sendMessage').mockResolvedValue({
  ok: true,
  result: {} as never,
});

describe('XCom', () => {
  const url = `https://example.org${getBotEndpoint(env)}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rewrite an x.com link to girlcockx.com', async () => {
    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(requestFixture) });

    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'https://girlcockx.com/user/status/123456',
      reply_to_message_id: 1,
      disable_notification: true,
    });
  });

  it('should rewrite multiple links, including scheme-less ones', async () => {
    const fixture = {
      ...requestFixture,
      message: {
        ...requestFixture.message,
        text: 'https://x.com/a/status/1 and x.com/b/status/2',
      },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      text: 'https://girlcockx.com/a/status/1\ngirlcockx.com/b/status/2',
      reply_to_message_id: 1,
      disable_notification: true,
    });
  });

  it('should not match x.com inside another hostname like netflix.com', async () => {
    const fixture = {
      ...requestFixture,
      message: { ...requestFixture.message, text: 'watch on https://netflix.com/title/999' },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).not.toHaveBeenCalled();
  });

  it('should not trigger for a message without an x link', async () => {
    const fixture = {
      ...requestFixture,
      message: { ...requestFixture.message, text: 'just a regular message' },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});
