import { ChatCompletionResponse } from '@mistralai/mistralai/models/components';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { GifManager } from './gif.manager';

describe('GifManager', () => {
  let gifManager: GifManager;
  let spy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    gifManager = new GifManager(env);
    spy = vi.spyOn(gifManager['client']['chat'], 'complete').mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'tag1, tag2',
          },
        },
      ],
    } as ChatCompletionResponse);
  });

  describe('addGif', () => {
    it('should classify the image, add the gif to the database', async () => {
      const file_id = 'test-file-id';
      const url = 'https://example.com/image.jpg';

      const result = await gifManager.addGif(file_id, url);
      expect(spy).toHaveBeenCalledWith({
        model: 'pixtral-12b',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Short, comma-separated list of tags to describe this ticker for future usage in prompt.',
              },
              {
                type: 'image_url',
                imageUrl: url,
              },
            ],
          },
        ],
      });
      const dbResult = await env.DB.prepare('SELECT * FROM gifs WHERE file_id = ?').bind(file_id).all();
      expect(dbResult.results).toHaveLength(1);
      expect(dbResult.results[0]).toMatchObject({
        file_id,
        description: 'tag1, tag2',
      });
      expect(result).toBe('tag1, tag2');
    });
    it('should classify the image, add the gif to the database (2nd)', async () => {
      await env.DB.prepare('INSERT INTO gifs (file_id, description) VALUES (?,?)').bind('test0', 'tag0').run();
      const file_id = 'test-file-id';
      const url = 'https://example.com/image.jpg';

      const result = await gifManager.addGif(file_id, url);
      expect(spy).toHaveBeenCalledWith({
        model: 'pixtral-12b',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Short, comma-separated list of tags to describe this ticker for future usage in prompt.',
              },
              {
                type: 'image_url',
                imageUrl: url,
              },
            ],
          },
        ],
      });

      const dbResult = await env.DB.prepare('SELECT * FROM gifs').all();
      expect(dbResult.results).toHaveLength(2);
      expect(dbResult.results[0]).toMatchObject({
        file_id: 'test0',
        description: 'tag0',
      });
      expect(dbResult.results[1]).toMatchObject({
        file_id,
        description: 'tag1, tag2',
      });
      expect(result).toBe('tag1, tag2');
    });
    it('should classify the image, add the gif to the database (duplicate)', async () => {
      const file_id = 'test-file-id';
      await env.DB.prepare('INSERT INTO gifs (file_id, description) VALUES (?,?)').bind(file_id, 'tag0').run();
      const url = 'https://example.com/image.jpg';

      const result = await gifManager.addGif(file_id, url);
      expect(spy).toHaveBeenCalledWith({
        model: 'pixtral-12b',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Short, comma-separated list of tags to describe this ticker for future usage in prompt.',
              },
              {
                type: 'image_url',
                imageUrl: url,
              },
            ],
          },
        ],
      });
      const dbResult = await env.DB.prepare('SELECT * FROM gifs WHERE file_id = ?').bind(file_id).all();
      expect(dbResult.results).toHaveLength(1);
      expect(dbResult.results[0]).toMatchObject({
        file_id,
        description: 'tag1, tag2',
      });

      expect(result).toBe('tag1, tag2');
    });
  });

  describe('getGif', () => {
    it('should return the gif when it exists in the database', async () => {
      const gif = { id: 1, file_id: 'test-file-id', description: 'tag1, tag2' };
      await env.DB.prepare('INSERT INTO gifs (id, file_id, description) VALUES (?, ?, ?)')
        .bind(gif.id, gif.file_id, gif.description)
        .run();

      const result = await gifManager.getGif(gif.id);
      expect(result).toEqual(gif);
    });

    it('should return null when the gif does not exist in the database', async () => {
      const result = await gifManager.getGif(999);
      expect(result).toBeNull();
    });

    it('should handle string IDs and return the gif when it exists', async () => {
      const gif = { id: 2, file_id: 'test-file-id-2', description: 'tag3, tag4' };
      await env.DB.prepare('INSERT INTO gifs (id, file_id, description) VALUES (?, ?, ?)')
        .bind(gif.id, gif.file_id, gif.description)
        .run();

      const result = await gifManager.getGif('2');
      expect(result).toEqual(gif);
    });
  });
  describe('getPrompt', () => {
    it('should return a prompt with all gifs in the correct format', async () => {
      // Insert multiple gifs into the database
      const gifs = [
        { id: 1, file_id: 'file1', description: 'tag1, tag2' },
        { id: 2, file_id: 'file2', description: 'tag3, tag4' },
        { id: 3, file_id: 'file3', description: 'tag5, tag6' },
      ];
      for (const gif of gifs) {
        await env.DB.prepare('INSERT INTO gifs (id, file_id, description) VALUES (?, ?, ?)')
          .bind(gif.id, gif.file_id, gif.description)
          .run();
      }

      const prompt = await gifManager.getPrompt();
      expect(prompt).toBe('Доступные гифки:\n1 - tag1, tag2\n2 - tag3, tag4\n3 - tag5, tag6');
    });

    it('should return only the header if there are no gifs', async () => {
      // Clear the gifs table
      await env.DB.prepare('DELETE FROM gifs').run();

      const prompt = await gifManager.getPrompt();
      expect(prompt).toBe('Доступные гифки:\n');
    });

    it('should return a prompt with a single gif', async () => {
      // Clear and insert one gif
      await env.DB.prepare('DELETE FROM gifs').run();
      await env.DB.prepare('INSERT INTO gifs (id, file_id, description) VALUES (?, ?, ?)')
        .bind(1, 'file1', 'tag1, tag2')
        .run();

      const prompt = await gifManager.getPrompt();
      expect(prompt).toBe('Доступные гифки:\n1 - tag1, tag2');
    });
  });

  describe('deleteGif', () => {
    it('should delete a gif by numeric id', async () => {
      await env.DB.prepare('DELETE FROM gifs').run();
      await env.DB.prepare('INSERT INTO gifs (id, file_id, description) VALUES (?, ?, ?)')
        .bind(10, 'file-del-10', 'to-delete')
        .run();

      await gifManager.deleteGif(10);
      const res = await env.DB.prepare('SELECT * FROM gifs WHERE id = ?').bind(10).all();
      expect(res.results).toHaveLength(0);
    });

    it('should delete a gif when id is passed as string', async () => {
      await env.DB.prepare('DELETE FROM gifs').run();
      await env.DB.prepare('INSERT INTO gifs (id, file_id, description) VALUES (?, ?, ?)')
        .bind(11, 'file-del-11', 'to-delete')
        .run();

      await gifManager.deleteGif('11');
      const res = await env.DB.prepare('SELECT * FROM gifs WHERE id = ?').bind(11).all();
      expect(res.results).toHaveLength(0);
    });

    it('should not throw when deleting a non-existent id', async () => {
      await env.DB.prepare('DELETE FROM gifs').run();
      await expect(gifManager.deleteGif(9999)).resolves.toBeUndefined();
    });
  });
});
