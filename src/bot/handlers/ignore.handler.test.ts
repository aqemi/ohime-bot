import { type Update } from 'node-telegram-bot-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponseHelper } from '../response-helper';
import { TelegramApi } from '../telegram-api';
import { IgnoreHandler } from './ignore.handler';

const IGNORED_ID = 42;
const NORMAL_ID = 99;

const makePayload = (fromId: number): Update => ({
  update_id: 1,
  message: {
    message_id: 1,
    chat: { id: 100, type: 'supergroup', title: 'Test' },
    from: { id: fromId, first_name: 'User', is_bot: false },
    date: 1234567890,
    text: 'hello',
  },
});

describe('IgnoreHandler', () => {
  const mockEnv = {
    IGNORE_LIST: String(IGNORED_ID),
  } as unknown as Env;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should match and stop an ignored user', async () => {
    const handler = new IgnoreHandler({} as TelegramApi, mockEnv, {} as ResponseHelper);

    expect(await handler.match(makePayload(IGNORED_ID))).toBe(true);
    expect(handler.passThrough).toBe(false);
  });

  it('should not match a non-ignored user', async () => {
    const handler = new IgnoreHandler({} as TelegramApi, mockEnv, {} as ResponseHelper);

    expect(await handler.match(makePayload(NORMAL_ID))).toBe(false);
  });
});
