import type { AssistantMessage, SystemMessage, ToolMessage, UserMessage } from '@mistralai/mistralai/models/components';

type ThreadMessage = {
  chatId: number;
  createdAt: string;
  role: 'assistant' | 'user';
  content: string;
};

export type Thread = Array<
  | (SystemMessage & { role: 'system' })
  | (UserMessage & { role: 'user' })
  | (AssistantMessage & { role: 'assistant' })
  | (ToolMessage & { role: 'tool' })
>;

export class ThreadManager {
  constructor(private readonly env: Env) {}

  public async isActive(chatId: number, staleness: number): Promise<boolean> {
    const stalenessThreshold = `-${staleness} seconds`;
    const result = await this.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM threads WHERE createdAt > DATETIME(CURRENT_TIMESTAMP, ?) AND chatId = ? AND role = 'assistant'`,
    )
      .bind(stalenessThreshold, chatId)
      .first<{ count: number }>();

    return !!result && result.count > 0;
  }

  public async getThread(chatId: number): Promise<Thread> {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM threads WHERE chatId = ? ORDER BY id DESC LIMIT 10',
    )
      .bind(chatId)
      .all<ThreadMessage>();
    return results.map((x) => ({ role: x.role, content: x.content })).reverse();
  }

  public async appendThread(message: Omit<ThreadMessage, 'createdAt'>): Promise<void> {
    await this.env.DB.prepare('INSERT INTO threads (chatId, role, content) VALUES(?,?,?)')
      .bind(message.chatId, message.role, message.content)
      .run();
  }

  public async clearThread(chatId: number): Promise<void> {
    await this.env.DB.prepare('DELETE FROM threads WHERE chatId = ?').bind(chatId).run();
  }
}
