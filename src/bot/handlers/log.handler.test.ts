import { type Update } from 'node-telegram-bot-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { ResponseHelper } from '../response-helper';
import { TelegramApi } from '../telegram-api';
import { LogHandler } from './log.handler';

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

describe('LogHandler + IgnoreHandler (integration)', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM logs').run();
  });

  it('should write an ignored user to D1', async () => {
    const handler = new LogHandler({} as TelegramApi, env, {} as ResponseHelper);
    await handler.handle(makePayload(42));

    const { results } = await env.DB.prepare('SELECT * FROM logs').all();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ chat_id: 100, message_id: 1, date: 1234567890, username: 'User' });
  });

  it('should write a non-ignored user to D1', async () => {
    const handler = new LogHandler({} as TelegramApi, env, {} as ResponseHelper);
    await handler.handle(makePayload(99));

    const { results } = await env.DB.prepare('SELECT * FROM logs').all();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ chat_id: 100, message_id: 1, date: 1234567890, username: 'User' });
  });
});

describe('LogHandler', () => {
  const dbRun = vi.fn().mockResolvedValue(undefined);
  const dbBind = vi.fn().mockReturnValue({ run: dbRun });
  const dbPrepare = vi.fn().mockReturnValue({ bind: dbBind });

  const mockEnv = {
    BOT_USERNAME: 'testbot',
    AI: { run: vi.fn() },
    DB: { prepare: dbPrepare },
  } as unknown as Env;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log an ignored user', async () => {
    const handler = new LogHandler({} as TelegramApi, mockEnv, {} as ResponseHelper);
    const payload = makePayload(42);

    expect(await handler.match(payload)).toBe(true);
    await handler.handle(payload);

    expect(dbBind).toHaveBeenCalledWith(100, 1, 1234567890, 'User');
    expect(handler.passThrough).toBe(true);
  });

  it('should log a non-ignored user', async () => {
    const handler = new LogHandler({} as TelegramApi, mockEnv, {} as ResponseHelper);
    const payload = makePayload(99);

    expect(await handler.match(payload)).toBe(true);
    await handler.handle(payload);

    expect(dbBind).toHaveBeenCalledWith(100, 1, 1234567890, 'User');
  });
});
