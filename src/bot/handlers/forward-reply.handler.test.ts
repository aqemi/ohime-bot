import { type Update } from 'node-telegram-bot-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { ResponseHelper } from '../response-helper';
import { TelegramApi } from '../telegram-api';
import { AiMessageInterpreter } from './ai-message-interpreter';
import { ForwardReplyHandler } from './forward-reply.hander';

const makeForwardPayload = (forwardSenderName: string): Update => ({
  update_id: 2,
  message: {
    message_id: 10,
    chat: { id: 200, type: 'private' },
    from: { id: 200, first_name: 'Recipient', is_bot: false },
    date: 9999999,
    forward_date: 1234567890,
    forward_sender_name: forwardSenderName,
    text: 'forwarded text',
  },
});

describe('ForwardReplyHandler', () => {
  describe('match', () => {
    const handler = new ForwardReplyHandler({} as TelegramApi, {} as Env, {} as ResponseHelper);

    it('should match a private forwarded message', async () => {
      expect(await handler.match(makeForwardPayload('Someone'))).toBe(true);
    });

    it('should not match a group chat', async () => {
      expect(await handler.match({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 1, type: 'supergroup', title: 'Group' },
          from: { id: 1, first_name: 'User', is_bot: false },
          date: 1,
          forward_date: 1234567890,
          text: 'hello',
        },
      })).toBe(false);
    });

    it('should not match a non-forwarded private message', async () => {
      expect(await handler.match({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 1, type: 'private' },
          from: { id: 1, first_name: 'User', is_bot: false },
          date: 1,
          text: 'hello',
        },
      })).toBe(false);
    });
  });

  describe('handle (integration)', () => {
    const replyMock = vi.fn().mockResolvedValue(undefined);
    const sendErrorMock = vi.fn().mockResolvedValue(undefined);

    const makeTestEnv = () => ({
      DB: env.DB,
      BOT_USERNAME: 'testbot',
      THREAD: {
        idFromName: vi.fn().mockReturnValue('id'),
        get: vi.fn().mockReturnValue({ reply: replyMock }),
      },
    }) as unknown as Env;

    const makeResponseHelper = () => ({ sendError: sendErrorMock }) as unknown as ResponseHelper;

    beforeEach(async () => {
      replyMock.mockClear();
      sendErrorMock.mockClear();
      vi.spyOn(AiMessageInterpreter.prototype, 'formatMessage').mockResolvedValue('formatted message');
      await env.DB.prepare('DELETE FROM logs').run();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should call thread.reply with log data when exactly one log matches', async () => {
      await env.DB.prepare('INSERT INTO logs (chat_id, message_id, date, username) VALUES (100, 1, 1234567890, ?)').bind('ForwardedUser').run();

      const handler = new ForwardReplyHandler({} as TelegramApi, makeTestEnv(), makeResponseHelper());
      await handler.handle(makeForwardPayload('ForwardedUser'));

      expect(replyMock).toHaveBeenCalledWith(expect.objectContaining({
        chatId: 100,
        replyTo: 1,
        messageId: 1,
        text: 'formatted message',
        chatTitle: null,
        rawFallback: true,
        postProcessing: true,
      }));
    });

    it('should send error when no log matches', async () => {
      const handler = new ForwardReplyHandler({} as TelegramApi, makeTestEnv(), makeResponseHelper());
      await handler.handle(makeForwardPayload('Unknown'));

      expect(replyMock).not.toHaveBeenCalled();
      expect(sendErrorMock).toHaveBeenCalledWith(200, expect.any(Error), 10);
    });

    it('should format message with original author username, not the forwarder', async () => {
      await env.DB.prepare('INSERT INTO logs (chat_id, message_id, date, username) VALUES (100, 1, 1234567890, ?)').bind('OriginalAuthor').run();

      const formatSpy = vi.spyOn(AiMessageInterpreter.prototype, 'formatMessage').mockResolvedValue('formatted message');
      const payload: Update = {
        update_id: 2,
        message: {
          message_id: 10,
          chat: { id: 200, type: 'private' },
          from: { id: 200, first_name: 'Forwarder', is_bot: false },
          date: 9999999,
          forward_date: 1234567890,
          forward_sender_name: 'OriginalAuthor',
          text: 'forwarded text',
        },
      };

      const handler = new ForwardReplyHandler({} as TelegramApi, makeTestEnv(), makeResponseHelper());
      await handler.handle(payload);

      expect(formatSpy.mock.calls[0][0].from?.first_name).toBe('OriginalAuthor');
    });

    it('should look up the original author, not the forwarder', async () => {
      await env.DB.prepare('INSERT INTO logs (chat_id, message_id, date, username) VALUES (100, 1, 1234567890, ?)').bind('OriginalAuthor').run();

      const payload: Update = {
        update_id: 2,
        message: {
          message_id: 10,
          chat: { id: 200, type: 'private' },
          from: { id: 200, first_name: 'Forwarder', is_bot: false },
          date: 9999999,
          forward_date: 1234567890,
          forward_sender_name: 'OriginalAuthor',
          text: 'forwarded text',
        },
      };

      const handler = new ForwardReplyHandler({} as TelegramApi, makeTestEnv(), makeResponseHelper());
      await handler.handle(payload);

      expect(replyMock).toHaveBeenCalled();
      expect(sendErrorMock).not.toHaveBeenCalled();
    });

    it('should send error when multiple logs match', async () => {
      await env.DB.prepare('INSERT INTO logs (chat_id, message_id, date, username) VALUES (100, 1, 1234567890, ?)').bind('ForwardedUser').run();
      await env.DB.prepare('INSERT INTO logs (chat_id, message_id, date, username) VALUES (101, 2, 1234567890, ?)').bind('ForwardedUser').run();

      const handler = new ForwardReplyHandler({} as TelegramApi, makeTestEnv(), makeResponseHelper());
      await handler.handle(makeForwardPayload('ForwardedUser'));

      expect(replyMock).not.toHaveBeenCalled();
      expect(sendErrorMock).toHaveBeenCalledWith(200, expect.any(Error), 10);
    });
  });
});
