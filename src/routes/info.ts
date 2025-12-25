import { TelegramApi } from '../bot/telegram-api';

export async function info(req: Request, env: Env): Promise<Response> {
  const api = new TelegramApi(env.TG_TOKEN);
  const webhookInfo = await api.getWebhookInfo();
  if (webhookInfo?.result?.url) {
    webhookInfo.result.url = webhookInfo?.result?.url.replace(env.TG_TOKEN, 'CORRECT_TG_TOKEN');
  }

  return new Response(
    JSON.stringify({
      webhookInfo,
      me: await api.getMe(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}
