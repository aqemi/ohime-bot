import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBotEndpoint } from '../../../utils';
import { ResponseCallbackType, stringify } from '../../../utils/callback-data';
import { TelegramApi } from '../../telegram-api';
import requestFixture from './fixtures/request.json';

const xaiImageResponse = { data: [{ url: 'https://images.x.ai/generated.png' }] };

const sendChatActionSpy = vi.spyOn(TelegramApi.prototype, 'sendChatAction').mockResolvedValue({
  ok: true,
  result: true,
});
const sendPhotoSpy = vi.spyOn(TelegramApi.prototype, 'sendPhoto').mockResolvedValue({
  ok: true,
  result: {} as never,
});

const ownerId = 777;
const expectedKeyboard = {
  inline_keyboard: [
    [
      {
        text: 'del',
        callback_data: stringify({ type: ResponseCallbackType.Delete, ownerId }),
      },
      {
        text: 're:',
        callback_data: stringify({ type: ResponseCallbackType.Retry, plugin: 'DrawPlugin', resultNumber: 0, ownerId }),
      },
      {
        text: 'moar!',
        callback_data: stringify({ type: ResponseCallbackType.More, plugin: 'DrawPlugin', resultNumber: 0, ownerId }),
      },
    ],
  ],
};

describe('DrawPlugin', () => {
  const url = `https://example.org${getBotEndpoint(env)}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate an image from the prompt and send it as a photo', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(xaiImageResponse),
    });
    vi.stubGlobal('fetch', fetchSpy);

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(requestFixture) });

    expect(sendChatActionSpy).toHaveBeenCalledExactlyOnceWith({ action: 'upload_photo', chat_id: -100777 });

    const [generationUrl, requestInit] = fetchSpy.mock.calls[0];
    expect(generationUrl).toBe('https://api.x.ai/v1/images/generations');
    expect(JSON.parse(requestInit.body as string)).toMatchObject({
      model: 'grok-imagine-image',
      prompt: ' cat on the moon',
      response_format: 'url',
    });

    expect(sendPhotoSpy).toHaveBeenCalledExactlyOnceWith({
      chat_id: -100777,
      photo: 'https://images.x.ai/generated.png',
      reply_to_message_id: 1,
      caption: '',
      reply_markup: expectedKeyboard,
      disable_notification: true,
    });

    vi.unstubAllGlobals();
  });

  it('should not send a photo when the response has no image url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      }),
    );

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(requestFixture) });

    expect(sendChatActionSpy).toHaveBeenCalledOnce();
    expect(sendPhotoSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('should not trigger for a message without the Алиса prefix', async () => {
    const fixture = {
      ...requestFixture,
      message: { ...requestFixture.message, text: 'just a regular message' },
    };

    await SELF.fetch(url, { method: 'POST', body: JSON.stringify(fixture) });

    expect(sendChatActionSpy).not.toHaveBeenCalled();
    expect(sendPhotoSpy).not.toHaveBeenCalled();
  });
});
