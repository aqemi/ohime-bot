/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { IttyRouter, error, withParams } from 'itty-router';
import { info, install, ok, onTelegramUpdate, gifsList, deleteGifRoute } from './routes';
import { gifsFile } from './routes/gifsFile';

const router = IttyRouter();

router.all('*', withParams);
router.head('/', ok);
router.get('/', ok);
router.get('/info', info);
router.post('/install', install);
router.post('/bot_*', onTelegramUpdate);
router.get('/gifs', gifsList);
router.get('/gifs/:file_id', gifsFile);
router.delete('/gifs/:id', deleteGifRoute);
router.all('*', () => error(404));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    ctx.passThroughOnException();
    try {
      const response = router.fetch(request, env, ctx);
      return response;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      console.error(_error);
      return error(500);
    }
  },
};

export { ThreadDurableObject } from './durable-objects/thread.do';
