import { IRequestStrict } from 'itty-router';
import { TelegramApi } from '../bot/telegram-api';
import { defined, throwOnFetchError } from '../utils';

export async function gifsFile(req: IRequestStrict, env: Env): Promise<Response> {
  const api = new TelegramApi(env.TG_TOKEN);

  const { result: file } = await api.getFile({ file_id: req.params.file_id });
  const filePath = defined(file.file_path, 'file.file_path');
  const fileUrl = `https://api.telegram.org/file/bot${env.TG_TOKEN}/${filePath}`;

  const response = await fetch(fileUrl);
  await throwOnFetchError(response);

  // Proxy response headers (content-type, content-length, etc.)
  const headers = new Headers();
  response.headers.forEach((value, key) => headers.set(key, value));

  const body = await response.arrayBuffer();
  return new Response(body, { status: response.status, headers });
}
