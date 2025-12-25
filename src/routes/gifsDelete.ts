import { IRequestStrict } from 'itty-router';
import { TelegramApi } from '../bot/telegram-api';
import { GifManager } from '../managers/gif.manager';

export async function deleteGifRoute(req: IRequestStrict, env: Env): Promise<Response> {
  const api = new TelegramApi(env.TG_TOKEN);
  const manager = new GifManager(env, api);

  await manager.deleteGif(Number(req.params.id));
  return new Response(null, { status: 204 });
}
