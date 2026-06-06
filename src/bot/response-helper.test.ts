import { afterEach, describe, expect, it, Mock, vi } from 'vitest';
import { FetchError } from '../utils';
import { ResponseHelper } from './response-helper';
import { TelegramApi } from './telegram-api';

describe('ResponseHelper', () => {
  const mockApi = {
    sendMessage: vi.fn(),
    editMessageReplyMarkup: vi.fn(),
  } as unknown as TelegramApi;

  const mockEnv = {
    AI_GATEWAY_ID: 'sensitive',
    FORCE_BUSINESS: '',
  } as Env;
  const responseHelper = new ResponseHelper(mockApi, mockEnv);

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendJSON', () => {
    it('should send a JSON object as a formatted string', async () => {
      const chatId = 123;
      const json = { key: 'value', key2: 'value="1"' };
      const replyTo = 456;

      await responseHelper.sendJSON(chatId, json, replyTo);

      expect(mockApi.sendMessage).toHaveBeenCalledWith({
        chat_id: chatId,
        text: '```json\n{\n  "key": "value",\n  "key2": "value=\\\\"1\\\\""\n}\n```',
        parse_mode: 'MarkdownV2',
        reply_to_message_id: replyTo,
      });
    });
    it('should handle string input correctly', async () => {
      const chatId = 123;
      const jsonString = '{"key":"value"}';
      const replyTo = 456;

      await responseHelper.sendJSON(chatId, jsonString, replyTo);

      expect(mockApi.sendMessage).toHaveBeenCalledWith({
        chat_id: chatId,
        text: '```json\n{"key":"value"}\n```',
        parse_mode: 'MarkdownV2',
        reply_to_message_id: replyTo,
      });
    });
  });

  describe('sendError', () => {
    it('should send a decorated error as JSON', async () => {
      const chatId = 123;
      const error = new Error('Test error');
      const replyTo = 456;

      await responseHelper.sendError(chatId, error, replyTo);

      expect(mockApi.sendMessage).toHaveBeenCalledWith({
        chat_id: chatId,
        text: '```json\n{\n  "message": "Test error"\n}\n```',
        parse_mode: 'MarkdownV2',
        reply_to_message_id: replyTo,
      });
    });

    it('should sanitize FetchError URLs', async () => {
      const chatId = 123;
      const fetchError = new FetchError('ERROR', { body: 'body', code: 500, url: 'https://example.com/sensitive' });
      const replyTo = 456;

      await responseHelper.sendError(chatId, fetchError, replyTo);

      expect((mockApi.sendMessage as Mock).mock.calls[0][0]).toMatchInlineSnapshot(`
          {
            "chat_id": 123,
            "parse_mode": "MarkdownV2",
            "reply_to_message_id": 456,
            "text": "\`\`\`json
          {
            "message": "ERROR",
            "url": "https://example.com/<REDACTED>",
            "code": 500,
            "body": "body",
            "name": "FetchError"
          }
          \`\`\`",
          }
        `);
    });

    it('should handle additional errors gracefully', async () => {
      const chatId = 123;
      const invalidError = null;

      (mockApi.sendMessage as Mock).mockRejectedValueOnce(new Error('SEND ERROR'));
      const consoleSpy = vi.spyOn(console, 'error');

      await responseHelper.sendError(chatId, invalidError);
      expect(consoleSpy).toHaveBeenCalledWith(
        'An additional error occurred while attempting to handle the original error:',
        new Error('SEND ERROR'),
      );
    });
  });

  describe('removeKeyboard', () => {
    it('should remove the keyboard from a message', async () => {
      const chatId = 123;
      const messageId = 456;

      await responseHelper.removeKeyboard(chatId, messageId);

      expect(mockApi.editMessageReplyMarkup).toHaveBeenCalledWith({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: undefined,
      });
    });

    it('should handle errors gracefully', async () => {
      (mockApi.editMessageReplyMarkup as Mock).mockRejectedValue(new Error('Test error'));
      const chatId = 123;
      const messageId = 456;
      const consoleSpy = vi.spyOn(console, 'error');

      await responseHelper.removeKeyboard(chatId, messageId);

      expect(mockApi.editMessageReplyMarkup).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error on removeKeyboard', new Error('Test error'));
    });
  });
});
