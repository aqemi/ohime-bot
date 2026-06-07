import { ChatCompletionResponse } from '@mistralai/mistralai/models/components';
import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, Mock, MockInstance, vi } from 'vitest';
import { PromptManager } from '../../../managers/prompt.manager';
import { config } from '../../ai.config';
import { MikuAgent } from './miku.agent';

describe('MikuAgent', () => {
  let agent: MikuAgent;
  let spy: MockInstance;
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = {
      getSystemPrompt: vi.fn().mockResolvedValue([]),
    } as unknown as PromptManager;

    agent = new MikuAgent(env, promptManager);
    spy = vi.spyOn(agent['client']['agents'], 'complete').mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ text: 'valid' }),
          },
        },
      ],
    } as ChatCompletionResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return valid response (text and sticker)', async () => {
    const aiResponse = JSON.stringify({ text: 'text', sticker: 'sticker' });
    vi.spyOn(agent['client']['agents'], 'complete').mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: aiResponse,
          },
        },
      ],
    } as ChatCompletionResponse);
    const response = await agent.completion([{ role: 'user', content: 'test' }]);
    expect(response.valid).toEqual(true);
    expect(response.raw).toEqual(aiResponse);
    expect(response.text).toEqual('text');
    expect(response.sticker).toEqual('sticker');
  });

  it('should return valid response (text)', async () => {
    const aiResponse = JSON.stringify({ text: 'text' });
    vi.spyOn(agent['client']['agents'], 'complete').mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: aiResponse,
          },
        },
      ],
    } as ChatCompletionResponse);
    const response = await agent.completion([{ role: 'user', content: 'test' }]);
    expect(response.valid).toEqual(true);
    expect(response.raw).toEqual(aiResponse);
    expect(response.text).toEqual('text');
  });
  it('should return valid response (sticker)', async () => {
    const aiResponse = JSON.stringify({ sticker: 'sticker' });
    vi.spyOn(agent['client']['agents'], 'complete').mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: aiResponse,
          },
        },
      ],
    } as ChatCompletionResponse);
    const response = await agent.completion([{ role: 'user', content: 'test' }]);
    expect(response.valid).toEqual(true);
    expect(response.raw).toEqual(aiResponse);
    expect(response.sticker).toEqual('sticker');
  });
  it('should return invalid response', async () => {
    const aiResponse = 'malformed';
    vi.spyOn(agent['client']['agents'], 'complete').mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: aiResponse,
          },
        },
      ],
    } as ChatCompletionResponse);
    const response = await agent.completion([{ role: 'user', content: 'test' }]);
    expect(response.valid).toEqual(false);
    expect(response.raw).toEqual('malformed');
  });
  it('should return invalid response (text wrong type)', async () => {
    const aiResponse = JSON.stringify({ text: ['test'] });
    vi.spyOn(agent['client']['agents'], 'complete').mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: aiResponse,
          },
        },
      ],
    } as ChatCompletionResponse);
    const response = await agent.completion([{ role: 'user', content: 'test' }]);
    expect(response.valid).toEqual(false);
    expect(response.raw).toEqual('{"text":["test"]}');
  });
  it('should return invalid response (sticker wrong type)', async () => {
    const aiResponse = JSON.stringify({ text: 'valid', sticker: null });
    vi.spyOn(agent['client']['agents'], 'complete').mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: aiResponse,
          },
        },
      ],
    } as ChatCompletionResponse);
    const response = await agent.completion([{ role: 'user', content: 'test' }]);
    expect(response.valid).toEqual(false);
    expect(response.raw).toEqual('{"text":"valid","sticker":null}');
  });

  it('should pass static prompt', async () => {
    await agent.completion([{ role: 'user', content: 'test' }]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining(config.demo.aggressive),
      }),
    );
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining(config.demo.basic),
      }),
    );
  });

  it('should pass dynamic prompt', async () => {
    (promptManager.getSystemPrompt as Mock).mockResolvedValueOnce([{ role: 'system', content: 'test' }]);
    await agent.completion([{ role: 'user', content: 'test' }]);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([{ role: 'system', content: 'test' }]),
      }),
    );
  });
});
