import { GifManager } from '../managers/gif.manager';
import { TelegramApi } from '../bot/telegram-api';

function escapeHtml(input: string | undefined | null) {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function gifsList(req: Request, env: Env): Promise<Response> {
  const api = new TelegramApi(env.TG_TOKEN);
  const manager = new GifManager(env, api);

  const gifs = await manager.getAllGifs();

  const itemsHtml = gifs
    .map((g) => {
      const desc = escapeHtml(g.description ?? '');
      const id = escapeHtml(String(g.id));
      const fileId = encodeURIComponent(g.file_id);
      const src = '/gifs/' + fileId;
      return `
          <div class="card">
            <div class="media" aria-label="media-${id}">
              <video playsinline muted autoplay loop preload="metadata" style="width:100%" src="${src}">Your browser does not support the video tag.</video>
            </div>
            <div class="meta">
              <div class="id">ID: ${id} <button class="del" aria-label="Delete gif ${id}" data-id="${id}" title="Delete">🗑️</button></div>
              <div class="desc">${desc}</div>
            </div>
          </div>
        `;
    })
    .join('\n');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Gifs</title>
  <style>
    /* Dracula theme */
    :root{
      --bg:#282a36; --current:#44475a; --fg:#f8f8f2; --muted:#6272a4;
      --cyan:#8be9fd; --green:#50fa7b; --orange:#ffb86c; --pink:#ff79c6; --purple:#bd93f9; --red:#ff5555; --yellow:#f1fa8c;
    }

    html,body{height:100%}
    body{
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial;
      margin:0;padding:20px;background:var(--bg);color:var(--fg);
      -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale
    }
    h1{margin:0 0 18px;color:var(--purple);font-weight:600}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;justify-items:center}
    .card{background:var(--current);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,0.6);width:250px}
    .media{background:linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.18));display:block;width:250px;height:250px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid rgba(255,255,255,0.03)}
    .media video{width:100%;height:100%;display:block;object-fit:contain}
    .meta{padding:12px 14px;background:transparent}
    .id{font-size:13px;color:var(--fg);font-weight:700;margin-bottom:6px;text-shadow:0 1px 0 rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:space-between;gap:8px}
    .del{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);color:var(--red);padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;line-height:1;transition:background .12s,transform .06s;display:inline-flex;align-items:center;justify-content:center}
    .del:hover{background:rgba(255,85,85,0.08)}
    .del:active{transform:scale(0.96)}
    .del:focus{outline:2px solid rgba(255,85,85,0.14);outline-offset:2px}
    .desc{font-size:14px;color:var(--fg);white-space:pre-wrap}
    a{color:var(--cyan)}
    .placeholder{color:var(--muted)}
  </style>
</head>
<body>
  <h1>Gifs</h1>
  <div class="grid">
    ${itemsHtml}
  </div>
  <script>
    async function deleteGif(id, card) {
      try {
        const res = await fetch('/gifs/' + encodeURIComponent(id), { method: 'DELETE' });
        if (res.status === 204) {
          card.remove();
        } else {
          console.error('Delete failed', await res.text());
        }
      } catch (e) {
        console.error(e);
      }
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('.del');
      if (!btn) return;
      const id = btn.dataset.id;
      const card = btn.closest('.card');
      if (!id || !card) return;
      deleteGif(id, card);
    });
  </script>

</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
