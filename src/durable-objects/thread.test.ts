import { env, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../bot/ai.config';
import { MistraleAgent } from '../bot/plugins/mistrale/mistrale-agent';
import { TelegramApi } from '../bot/telegram-api';
import { ThreadManager } from '../managers/thread.manager';

describe('ThreadDurableObject', () => {
  config.delay = {
    idle: {
      min: 25,
      max: 25,
    },
    read: {
      min: 25,
      max: 25,
    },
    typing: {
      min: 25,
      max: 25,
    },
  };

  const sendMessageSpy = vi.spyOn(TelegramApi.prototype, 'sendMessage').mockResolvedValue({
    ok: true,
    result: {
      message_id: 1,
      chat: {
        id: 123,
        type: 'private',
        title: 'Chat Title',
      },
      date: 1234567890,
    },
  });
  const sendChatActionSpy = vi.spyOn(TelegramApi.prototype, 'sendChatAction').mockResolvedValue({
    ok: true,
    result: true,
  });

  const readBusinessMessageSpy = vi.spyOn(TelegramApi.prototype, 'readBusinessMessage').mockResolvedValue({
    ok: true,
    result: true,
  });

  const completionSpy = vi.spyOn(MistraleAgent.prototype, 'completion').mockResolvedValue({
    valid: true,
    raw: '',
    text: 'Hello',
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await env.DB.prepare('DELETE FROM threads').run();
  });

  describe('reply', () => {
    it('should send text message', async () => {
      const id = env.THREAD.idFromName('123');
      const stub = env.THREAD.get(id);
      const payload = {
        text: 'Hello',
        chatId: 123,
        messageId: 456,
        replyTo: 456,
        chatTitle: 'Chat Title',
        rawFallback: false,
        postProcessing: false,
      };
      await runInDurableObject(stub, async (instance) => {
        await instance.reply(payload);
      });
      expect(sendMessageSpy).toHaveBeenCalledAfter(sendChatActionSpy);
      expect(completionSpy).toHaveBeenCalledExactlyOnceWith([
        {
          content: 'Название чата: Chat Title',
          role: 'system',
        },
        {
          content: 'Hello',
          role: 'user',
        },
      ]);
      expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
        chat_id: 123,
        text: expect.any(String),
        reply_to_message_id: 456,
      });
      expect(sendChatActionSpy).toHaveBeenCalledExactlyOnceWith({
        action: 'typing',
        chat_id: 123,
      });
    });
    it('should send raw', async () => {
      const id = env.THREAD.idFromName('123');
      const stub = env.THREAD.get(id);
      const payload = {
        text: 'Hello',
        chatId: 123,
        messageId: 456,
        replyTo: 456,
        chatTitle: 'Chat Title',
        rawFallback: true,
        postProcessing: false,
      };
      completionSpy.mockResolvedValueOnce({
        valid: false,
        raw: 'RAW',
      });
      await runInDurableObject(stub, async (instance) => {
        await instance.reply(payload);
      });
      expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
        chat_id: 123,
        text: '```json\nRAW\n```',
        reply_to_message_id: 456,
        parse_mode: 'MarkdownV2',
      });
    });
    it('should do post-processing', async () => {
      const id = env.THREAD.idFromName('123');
      const stub = env.THREAD.get(id);
      const payload = {
        text: 'Hello',
        chatId: 123,
        messageId: 456,
        replyTo: 456,
        chatTitle: 'Chat Title',
        rawFallback: false,
        postProcessing: true,
      };
      const text = 'video hatsune miku';
      completionSpy.mockResolvedValueOnce({
        valid: true,
        raw: '',
        text,
      });
      sendMessageSpy.mockResolvedValueOnce({
        ok: true,
        result: {
          message_id: 1,
          chat: {
            id: 123,
            type: 'private',
            title: 'Chat Title',
          },
          text,
          from: {
            id: 123,
            is_bot: true,
            first_name: 'Bot',
            username: 'bot',
          },
          date: 1234567890,
        },
      });
      await runInDurableObject(stub, async (instance) => {
        await instance.reply(payload);
      });
      expect(sendMessageSpy).toHaveBeenCalledTimes(2);
      expect(sendMessageSpy).toHaveBeenCalledWith({
        chat_id: 123,
        text,
        reply_to_message_id: 456,
      });

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chat_id: 123,
          text: expect.stringContaining('https://www.youtube.com/watch'),
        }),
      );
    });
  });

  describe('replyWithDelay', () => {
    it('should replyd', async () => {
      const id = env.THREAD.idFromName('123');
      const stub = env.THREAD.get(id);
      const payload = {
        text: 'Hello',
        chatId: 123,
        businessConnectionId: 'zxc',
        messageId: 456,
        chatTitle: 'Chat Title',
        rawFallback: false,
        postProcessing: false,
      };
      await runInDurableObject(stub, async (instance) => {
        await instance.replyWithDelay(payload);
        await instance.replyWithDelay(payload);
      });
      expect(readBusinessMessageSpy).not.toHaveBeenCalled();
      expect(sendChatActionSpy).not.toHaveBeenCalled();
      expect(sendMessageSpy).not.toHaveBeenCalled();
      const ran = await runDurableObjectAlarm(stub);
      expect(ran).toBe(true);
      expect(sendMessageSpy).toHaveBeenCalledAfter(sendChatActionSpy);
      expect(completionSpy).toHaveBeenCalledExactlyOnceWith([
        {
          content: 'Название чата: Chat Title',
          role: 'system',
        },
        {
          content: 'Hello',
          role: 'user',
        },
        {
          content: 'Hello',
          role: 'user',
        },
      ]);
      expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
        chat_id: 123,
        text: expect.any(String),
        business_connection_id: 'zxc',
      });
      expect(sendChatActionSpy).toHaveBeenCalledExactlyOnceWith({
        action: 'typing',
        chat_id: 123,
        business_connection_id: 'zxc',
      });
    });
    it('should reply (active)', async () => {
      const threadManager = new ThreadManager(env);
      await threadManager.appendThread({ chatId: 123, content: 'Hi', role: 'assistant' });
      const id = env.THREAD.idFromName('123');
      const stub = env.THREAD.get(id);
      const payload = {
        text: 'Hello',
        chatId: 123,
        businessConnectionId: 'zxc',
        messageId: 456,
        chatTitle: 'Chat Title',
        rawFallback: false,
        postProcessing: false,
      };
      await runInDurableObject(stub, async (instance) => {
        await instance.replyWithDelay(payload);
        await instance.replyWithDelay(payload);
      });
      expect(readBusinessMessageSpy).toHaveBeenCalledTimes(2);
      expect(readBusinessMessageSpy).toHaveBeenCalledWith({
        business_connection_id: 'zxc',
        chat_id: 123,
        message_id: 456,
      });
      expect(sendChatActionSpy).not.toHaveBeenCalled();
      expect(sendMessageSpy).not.toHaveBeenCalled();
      const ran = await runDurableObjectAlarm(stub);
      expect(ran).toBe(true);
      expect(sendMessageSpy).toHaveBeenCalledAfter(sendChatActionSpy);
      expect(completionSpy).toHaveBeenCalledExactlyOnceWith([
        {
          content: 'Название чата: Chat Title',
          role: 'system',
        },
        {
          content: 'Hi',
          role: 'assistant',
        },
        {
          content: 'Hello',
          role: 'user',
        },
        {
          content: 'Hello',
          role: 'user',
        },
      ]);
      expect(sendMessageSpy).toHaveBeenCalledExactlyOnceWith({
        chat_id: 123,
        text: expect.any(String),
        business_connection_id: 'zxc',
      });
      expect(sendChatActionSpy).toHaveBeenCalledExactlyOnceWith({
        action: 'typing',
        chat_id: 123,
        business_connection_id: 'zxc',
      });
    });
    it('should NOT send raw', async () => {
      const id = env.THREAD.idFromName('123');
      const stub = env.THREAD.get(id);
      const payload = {
        text: 'Hello',
        chatId: 123,
        businessConnectionId: 'zxc',
        messageId: 456,
        chatTitle: 'Chat Title',
        rawFallback: false,
        postProcessing: false,
      };
      completionSpy.mockResolvedValueOnce({
        valid: false,
        raw: 'RAW',
      });
      await runInDurableObject(stub, async (instance) => {
        await instance.replyWithDelay(payload);
      });
      const ran = await runDurableObjectAlarm(stub);
      expect(ran).toBe(true);
      expect(sendMessageSpy).not.to.toHaveBeenCalled();
    });
    it('should NOT do post-processing', async () => {
      const id = env.THREAD.idFromName('123');
      const stub = env.THREAD.get(id);
      const payload = {
        text: 'Hello',
        chatId: 123,
        businessConnectionId: 'zxc',
        messageId: 456,
        chatTitle: 'Chat Title',
        rawFallback: false,
        postProcessing: false,
      };
      completionSpy.mockResolvedValueOnce({
        valid: true,
        raw: '',
        text: 'video hatsune miku',
      });
      await runInDurableObject(stub, async (instance) => {
        await instance.replyWithDelay(payload);
      });
      const ran = await runDurableObjectAlarm(stub);
      expect(ran).toBe(true);
      expect(sendMessageSpy).to.toHaveBeenCalledOnce();
    });
    it('should handle errors', async () => {
      const id = env.THREAD.idFromName('123');
      const stub = env.THREAD.get(id);
      const payload = {
        text: 'Hello',
        chatId: 123,
        businessConnectionId: 'zxc',
        messageId: 456,
        chatTitle: 'Chat Title',
        rawFallback: false,
        postProcessing: false,
      };
      completionSpy.mockRejectedValueOnce(new Error('test'));
      await runInDurableObject(stub, async (instance) => {
        await instance.replyWithDelay(payload);
      });
      const ran = await runDurableObjectAlarm(stub);
      expect(ran).toBe(true);
      expect(sendMessageSpy).not.to.toHaveBeenCalled();
    });
  });
}, 10_000);
