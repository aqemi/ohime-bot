import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThreadManager } from './thread.manager';

describe('ThreadManager', () => {
  let threadManager: ThreadManager;

  beforeEach(async () => {
    threadManager = new ThreadManager(env);
    await env.DB.prepare('DELETE FROM threads').run();
  });

  it('should check if a thread is active', async () => {
    await env.DB.prepare('INSERT INTO threads (chatId, role, content) VALUES (?, ?, ?)')
      .bind(123, 'assistant', 'Hello')
      .run();

    const isActive = await threadManager.isActive(123, 60);
    expect(isActive).toBe(true);
  });
  it('should check if a thread not active (last is user)', async () => {
    await env.DB.prepare('INSERT INTO threads (chatId, role, content) VALUES (?, ?, ?)')
      .bind(123, 'user', 'Hello')
      .run();

    const isActive = await threadManager.isActive(123, 60);
    expect(isActive).toBe(false);
  });

  it('should check if a thread is not active (time)', async () => {
    await env.DB.prepare(
      'INSERT INTO threads (chatId, role, content, createdAt) VALUES (?, ?, ?, DATETIME(1092941466))',
    )
      .bind(123, 'user', 'Hello')
      .run();

    const isActive = await threadManager.isActive(123, 60);
    expect(isActive).toBe(false);
  });

  it('should return false if no active thread exists', async () => {
    const isActive = await threadManager.isActive(123, 60);
    expect(isActive).toBe(false);
  });

  it('should retrieve a thread', async () => {
    await env.DB.prepare('INSERT INTO threads (chatId, role, content, createdAt) VALUES (?, ?, ?, ?)')
      .bind(123, 'user', 'Hello', new Date().toISOString())
      .run();
    await env.DB.prepare('INSERT INTO threads (chatId, role, content, createdAt) VALUES (?, ?, ?, ?)')
      .bind(123, 'assistant', 'Hi there!', new Date().toISOString())
      .run();
    await env.DB.prepare('INSERT INTO threads (chatId, role, content, createdAt) VALUES (?, ?, ?, ?)')
      .bind(124, 'user', 'Another thread!', new Date().toISOString())
      .run();

    const thread = await threadManager.getThread(123);
    expect(thread).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]);
  });

  it('should append a thread message', async () => {
    await threadManager.appendThread({ chatId: 123, role: 'user', content: 'Hello' });

    const { results } = await env.DB.prepare('SELECT * FROM threads WHERE chatId = ?').bind(123).all();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      chatId: 123,
      role: 'user',
      content: 'Hello',
    });
  });

  it('should clear a thread', async () => {
    await env.DB.prepare('INSERT INTO threads (chatId, role, content, createdAt) VALUES (?, ?, ?, ?)')
      .bind(123, 'user', 'Hello', new Date().toISOString())
      .run();

    await threadManager.clearThread(123);

    const { results } = await env.DB.prepare('SELECT * FROM threads WHERE chatId = ?').bind(123).all();
    expect(results).toHaveLength(0);
  });
});
