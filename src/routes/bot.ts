import type { Update as TelegramUpdate } from 'node-telegram-bot-api';
import {
  AiHandler,
  BusinessChatHandler,
  CopyStickerPackContinueHandler,
  CopyStickerPackHandler,
  StoreGifHandler,
  TelegramCallbackHandler,
  TelegramTextHandler,
  TelegramUpdateHandlerDerived,
} from '../bot/handlers';
import { ForwardReplyHandler } from '../bot/handlers/forward-reply.hander';
import { LogHandler } from '../bot/handlers/log.handler';
import { ResponseHelper } from '../bot/response-helper';
import { TelegramApi } from '../bot/telegram-api';
import { getBotEndpoint } from '../utils';

const handlers: TelegramUpdateHandlerDerived[] = [
  BusinessChatHandler,
  LogHandler,
  AiHandler,
  ForwardReplyHandler,
  TelegramTextHandler,
  TelegramCallbackHandler,
  CopyStickerPackHandler,
  CopyStickerPackContinueHandler,
  StoreGifHandler,
];

export async function onTelegramUpdate(request: Request, env: Env): Promise<Response> {
  if (!request.url.endsWith(getBotEndpoint(env))) {
    return new Response(null, { status: 404 });
  }

  const payload = await request.json<TelegramUpdate>();
  const api = new TelegramApi(env.TG_TOKEN);
  const responseHelper = new ResponseHelper(api, env);

  for (const Handler of handlers) {
    const handler = new Handler(api, env, responseHelper);
    if (await handler.match(payload)) {
      await handler.handle(payload);
      if (!handler.passThrough) {
        console.debug(`Incoming message to ${handler.constructor.name}`, payload);
        return new Response(null, { status: 204 });
      }
    }
  }
  console.debug('Unsupported update', payload);
  return new Response(null, { status: 204 });
}
