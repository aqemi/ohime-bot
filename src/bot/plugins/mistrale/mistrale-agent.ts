import { Mistral } from '@mistralai/mistralai';
import { PromptManager } from '../../../managers/prompt.manager';
import { type Thread } from '../../../managers/thread.manager';
import { config } from '../../ai.config';

export type AiResponse = {
  text?: string;
  sticker?: string;
  gif?: string | number;
  valid: boolean;
  raw: string;
};

type ConversationTraits = {
  aggressive: boolean;
};

export class MistraleAgent {
  private readonly client: Mistral;
  constructor(
    private readonly env: Env,
    private readonly promptManager: PromptManager,
  ) {
    this.client = new Mistral({
      apiKey: this.env.MISTRAL_API_KEY,
      serverURL: `https://gateway.ai.cloudflare.com/v1/${this.env.CF_ACCOUNT_ID}/${this.env.AI_GATEWAY_ID}/mistral`,
    });
  }

  public async completion(thread: Thread): Promise<AiResponse> {
    const prompt = await this.getPrompt({ aggressive: true });
    const { choices } = await this.client.agents.complete({
      agentId: this.env.MISTRAL_AGENT_ID,
      messages: [...prompt, ...thread],
      responseFormat: { type: 'json_object' },
    });

    const content = choices?.[0].message.content;
    if (typeof content === 'string') {
      const parsed = this.parseAiResponse(content);
      return parsed;
    } else {
      return {
        valid: false,
        raw: content?.toString() ?? 'null',
      };
    }
  }

  private async getPrompt(traits: ConversationTraits): Promise<Thread> {
    const dynamicPrompt = await this.promptManager.getSystemPrompt();
    const finalPrompt = [...config.demo.basic, ...dynamicPrompt, ...(traits.aggressive ? config.demo.aggressive : [])];

    return finalPrompt.sort((a, b) => {
      if (a.role === 'system' && b.role !== 'system') {
        return -1; // 'a' should come before 'b' if 'a' is 'system'
      } else if (b.role === 'system' && a.role !== 'system') {
        return 1; // 'b' should come before 'a' if 'b' is 'system'
      }
      return 0; // Keep other roles in the same order
    }) as Thread;
  }

  private parseAiResponse(raw: string): AiResponse {
    try {
      const parsed = JSON.parse(raw);
      return { valid: this.validateAiResponse(parsed), raw, ...parsed };
    } catch (error) {
      return { valid: false, raw };
    }
  }

  private validateAiResponse(response: AiResponse): boolean {
    if (typeof response !== 'object' || response === null) {
      return false;
    }
    if ('text' in response && typeof response.text === 'object') {
      return false;
    }
    if ('sticker' in response && (typeof response.sticker !== 'string' || !response.sticker)) {
      return false;
    }
    if ('gif' in response && typeof response.gif !== 'string' && typeof response.gif !== 'number') {
      return false;
    }
    if (!response.text && !response.sticker && !response.gif) {
      return false;
    }
    return true;
  }
}
