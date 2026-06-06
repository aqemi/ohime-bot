import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { PromptManager } from './prompt.manager';

describe('PromptManager', () => {
  let promptManager: PromptManager;

  beforeEach(async () => {
    promptManager = new PromptManager(env);
    await env.DB.prepare('DELETE FROM prompts').run();
  });

  describe('getPrompt', () => {
    it('should return mapped prompts from the database', async () => {
      // Insert mock data into the database
      await env.DB.exec(
        `INSERT INTO prompts (id, role, content) VALUES ('1', 'system', 'System prompt'), ('2', 'user', 'User prompt')`,
      );

      const result = await promptManager.getSystemPrompt();

      expect(result).toEqual([
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User prompt' },
      ]);
    });

    it('should handle empty results from the database', async () => {
      const result = await promptManager.getSystemPrompt();

      expect(result).toEqual([]);
    });
  });
  describe('updateSystemPrompt', () => {
    it('should insert a new system prompt into the database', async () => {
      const id = '1';
      const content = 'New system prompt';

      await promptManager.updateSystemPrompt(id, content);

      const { results } = await env.DB.prepare(`SELECT * FROM prompts WHERE id = ?1`).bind(id).all();
      expect(results).toEqual([{ id: '1', role: 'system', content: 'New system prompt' }]);
    });

    it('should update an existing system prompt in the database', async () => {
      const id = '1';
      const updatedContent = 'Updated system prompt';

      // Insert initial prompt
      await env.DB.exec(`INSERT INTO prompts (id, role, content) VALUES ('1', 'system', 'Initial system prompt')`);

      // Update the prompt
      await promptManager.updateSystemPrompt(id, updatedContent);

      const { results } = await env.DB.prepare(`SELECT * FROM prompts WHERE id = ?1`).bind(id).all();
      expect(results).toEqual([{ id: '1', role: 'system', content: 'Updated system prompt' }]);
    });
  });
  describe('getChatPrompt', () => {
    it('should return a system prompt with the chat title', () => {
      const result = promptManager.getChatPrompt('Test Group');

      expect(result).toEqual({
        role: 'system',
        content: 'Название чата: Test Group',
      });
    });
  });
});
