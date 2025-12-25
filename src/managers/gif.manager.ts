import { Mistral } from '@mistralai/mistralai';

type Gif = {
  id: number;
  file_id: string;
  description: string;
};

export class GifManager {
  private readonly client: Mistral;

  constructor(private readonly env: Env) {
    this.client = new Mistral({
      apiKey: this.env.MISTRAL_API_KEY,
      serverURL: `https://gateway.ai.cloudflare.com/v1/${this.env.CF_ACCOUNT_ID}/${this.env.AI_GATEWAY_ID}/mistral`,
    });
  }

  public async getGif(id: string | number): Promise<Gif | null> {
    const gif = await this.env.DB.prepare('SELECT * FROM gifs WHERE id=?').bind(id).first<Gif>();
    return gif;
  }

  public async addGif(file_id: string, url: string): Promise<string> {
    const description = await this.classifyImage(url);
    await this.env.DB.prepare(
      'INSERT INTO gifs (file_id, description) VALUES (?,?) ON CONFLICT(file_id) DO UPDATE SET description = excluded.description',
    )
      .bind(file_id, description)
      .run();
    return description;
  }

  public async getAllGifs(): Promise<Gif[]> {
    const { results } = await this.env.DB.prepare('SELECT * FROM gifs').all<Gif>();
    return results;
  }

  public async deleteGif(id: string | number): Promise<void> {
    await this.env.DB.prepare('DELETE FROM gifs WHERE id = ?').bind(id).run();
  }

  public async getPrompt(): Promise<string> {
    const gifs = await this.getAllGifs();
    const prompt = `Доступные гифки:\n${gifs.map((x) => `${x.id} - ${x.description}`).join('\n')}`;
    return prompt;
  }

  private async classifyImage(imageUrl: string): Promise<string> {
    const response = await this.client.chat.complete({
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
              imageUrl,
            },
          ],
        },
      ],
    });
    const { content } = response.choices?.[0].message ?? {};
    return typeof content === 'string' ? content : '';
  }
}
