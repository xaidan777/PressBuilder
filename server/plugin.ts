/**
 * Серверная часть редактора — плагин дев-сервера Vite.
 *
 *   /api/decks            список, создание, чтение, сохранение и удаление роликов
 *                         (данные лежат в src/decks/<id>/deck.json)
 *   /api/decks/<id>/audio загрузка озвучки → src/decks/<id>/voice.<ext>
 *   /api/export/*         приёмник покадрового экспорта: H.264-поток (+ озвучка) → out/<id>.mp4
 *   /api/config           путь к ffmpeg (presbuilder.config.json → $FFMPEG → ffmpeg-static → PATH)
 *   /out/<файл>           готовые ролики — чтобы открыть результат из редактора
 *
 * Когда deck.json меняет кто-то другой (например, ИИ-агент правит реплики),
 * редактору уходит событие `pb:deck-changed`, и он перечитывает ролик.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const ROOT = process.cwd();
const DECKS_DIR = path.join(ROOT, 'src', 'decks');
const OUT_DIR = path.join(ROOT, 'out');
const TRASH_DIR = path.join(ROOT, '.trash');
const CONFIG_FILE = path.join(ROOT, 'presbuilder.config.json');

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm)$/i;

interface Config {
  ffmpeg?: string;
}

function readConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Config;
  } catch {
    return {};
  }
}

/** ffmpeg из npm-пакета ffmpeg-static — если эта необязательная зависимость установилась. */
function bundledFfmpeg(): string | undefined {
  try {
    const file = createRequire(path.join(ROOT, 'package.json'))('ffmpeg-static') as string | null;
    return file && fs.existsSync(file) ? file : undefined;
  } catch {
    return undefined;
  }
}

const ffmpegPath = () => readConfig().ffmpeg || process.env.FFMPEG || bundledFfmpeg() || 'ffmpeg';

function ffmpegOk(): boolean {
  try {
    return spawnSync(ffmpegPath(), ['-version'], { stdio: 'ignore', timeout: 5000 }).status === 0;
  } catch {
    return false;
  }
}

const deckFile = (id: string) => path.join(DECKS_DIR, id, 'deck.json');

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    req.on('data', (c: Buffer) => parts.push(c));
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function fail(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(message);
}

/** Запись через временный файл: редактор сохраняет часто, битый JSON недопустим. */
function writeAtomic(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export function presbuilder(): Plugin {
  /** Что сервер сам записал последним — чтобы не слать редактору эхо его же сохранений. */
  const written = new Map<string, string>();
  let vite: ViteDevServer | null = null;

  /** Ролик изменился: сообщаем всем вкладкам, кроме той, что сама его сохранила. */
  const announce = (id: string, client = '') =>
    vite?.ws.send({ type: 'custom', event: 'pb:deck-changed', data: { id, client } });

  // ---------------------------------------------------------------- ролики

  function listDecks() {
    if (!fs.existsSync(DECKS_DIR)) return [];
    return fs
      .readdirSync(DECKS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(deckFile(d.name)))
      .map((d) => {
        try {
          const deck = JSON.parse(fs.readFileSync(deckFile(d.name), 'utf8'));
          return {
            id: d.name,
            title: String(deck.title ?? d.name),
            slides: Array.isArray(deck.slides) ? deck.slides.length : 0,
            target: deck.target ?? null,
            hasScenes: fs.existsSync(path.join(DECKS_DIR, d.name, 'index.ts')),
            style: typeof deck.style === 'string' ? deck.style : undefined,
            mtime: fs.statSync(deckFile(d.name)).mtimeMs,
          };
        } catch {
          return null;
        }
      })
      .filter((d) => d !== null)
      .sort((a, b) => b.mtime - a.mtime);
  }

  async function decksApi(req: IncomingMessage, res: ServerResponse, rest: string): Promise<void> {
    if (!rest) {
      if (req.method === 'GET') return json(res, listDecks());
      if (req.method === 'POST') {
        const deck = JSON.parse((await readBody(req)).toString('utf8'));
        const id = String(deck.id ?? '');
        if (!ID_RE.test(id)) return fail(res, 400, 'id: латиница, цифры, дефис');
        if (fs.existsSync(path.join(DECKS_DIR, id))) return fail(res, 409, `Ролик «${id}» уже есть`);
        const content = `${JSON.stringify(deck, null, 2)}\n`;
        written.set(id, content);
        writeAtomic(deckFile(id), content);
        return json(res, { ok: true });
      }
      return fail(res, 405, 'method');
    }

    const audio = /^([^/]+)\/audio$/.exec(rest);
    if (audio) return audioApi(req, res, audio[1]);

    const id = rest;
    if (!ID_RE.test(id)) return fail(res, 400, 'bad id');
    const file = deckFile(id);

    if (req.method === 'GET') {
      if (!fs.existsSync(file)) return fail(res, 404, `Нет ролика «${id}»`);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return void res.end(fs.readFileSync(file));
    }
    if (req.method === 'PUT') {
      if (!fs.existsSync(file)) return fail(res, 404, `Нет ролика «${id}»`);
      const deck = JSON.parse((await readBody(req)).toString('utf8'));
      if (deck.id !== id) return fail(res, 400, 'id не совпадает');
      const content = `${JSON.stringify(deck, null, 2)}\n`;
      written.set(id, content);
      writeAtomic(file, content);
      announce(id, String(req.headers['x-pb-client'] ?? ''));
      return json(res, { ok: true });
    }
    if (req.method === 'DELETE') {
      // не стираем, а убираем в .trash — вместе с кодом сцен
      const dir = path.join(DECKS_DIR, id);
      if (!fs.existsSync(dir)) return fail(res, 404, `Нет ролика «${id}»`);
      fs.mkdirSync(TRASH_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      fs.renameSync(dir, path.join(TRASH_DIR, `${id}-${stamp}`));
      written.delete(id);
      return json(res, { ok: true });
    }
    return fail(res, 405, 'method');
  }

  /** Озвучка: файл кладётся в папку ролика как voice.<ext>, прежний — удаляется. */
  async function audioApi(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    if (!ID_RE.test(id) || !fs.existsSync(deckFile(id))) return fail(res, 404, `Нет ролика «${id}»`);
    if (req.method !== 'PUT') return fail(res, 405, 'method');
    const name = new URL(req.url ?? '/', 'http://x').searchParams.get('name') ?? '';
    const ext = AUDIO_EXT.exec(name)?.[1]?.toLowerCase();
    if (!ext) return fail(res, 400, 'Нужен звуковой файл: mp3, wav, m4a, aac, ogg, opus, flac или webm');
    const buf = await readBody(req);
    if (!buf.length) return fail(res, 400, 'Файл пустой');
    const dir = path.join(DECKS_DIR, id);
    for (const f of fs.readdirSync(dir)) if (/^voice\./.test(f)) fs.rmSync(path.join(dir, f), { force: true });
    const file = `voice.${ext}`;
    fs.writeFileSync(path.join(dir, file), buf);
    return json(res, { file, size: buf.length });
  }

  // ---------------------------------------------------------------- экспорт

  let stream: fs.WriteStream | null = null;
  let raw = '';
  let mp4 = '';
  let fps = 60;
  /** Озвучка текущего экспорта: где лежит, где начинается в ролике, какой кусок ролика пишем. */
  let voice: { file: string; offset: number; volume: number; from: number; dur: number } | null = null;

  /** Аргументы ffmpeg для звука: срез начала, задержка, громкость, обрезка по длине видео. */
  function voiceArgs(): { input: string[]; output: string[] } {
    if (!voice) return { input: [], output: [] };
    const skip = voice.from - voice.offset;
    const delay = -skip;
    const filters = [
      ...(delay > 0.001 ? [`adelay=${Math.round(delay * 1000)}:all=1`] : []),
      ...(voice.volume !== 1 ? [`volume=${voice.volume}`] : []),
    ];
    return {
      input: [...(skip > 0.001 ? ['-ss', skip.toFixed(3)] : []), '-i', voice.file],
      output: [
        '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k',
        ...(filters.length ? ['-af', filters.join(',')] : []),
        ...(voice.dur > 0 ? ['-t', voice.dur.toFixed(3)] : []),
      ],
    };
  }

  function mux(): Promise<{ file: string; size: number }> {
    return new Promise((resolve, reject) => {
      // время кадров — строго по номеру кадра: сырой H.264 без отметок, и ffmpeg (сборки 2025) иначе
      // расставляет их неверно — файл играет целиком, а длительность в заголовке — доли секунды
      const ts = `${fps}*TB`;
      const a = voiceArgs();
      const args = ['-y', '-f', 'h264', '-framerate', String(fps), '-i', raw, ...a.input, '-map', '0:v:0', '-c:v', 'copy',
        '-bsf:v', `setts=pts=N/(${ts}):dts=N/(${ts}):duration=1/(${ts})`, ...a.output, '-movflags', '+faststart', mp4];
      let err = '';
      const ff = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
      ff.stderr?.on('data', (c: Buffer) => (err = (err + c.toString()).slice(-600)));
      ff.on('error', (e) =>
        reject(new Error(`ffmpeg не запустился (${ffmpegPath()}): ${e.message}. Поток сохранён: ${raw}`)),
      );
      ff.on('close', (code) => {
        if (code !== 0) return reject(new Error(`ffmpeg завершился с кодом ${code}: ${err}`));
        fs.rmSync(raw, { force: true });
        resolve({ file: path.relative(ROOT, mp4).replace(/\\/g, '/'), size: fs.statSync(mp4).size });
      });
    });
  }

  async function exportApi(req: IncomingMessage, res: ServerResponse, url: URL, rest: string): Promise<void> {
    if (req.method !== 'POST') return fail(res, 405, 'method');

    if (rest === 'start') {
      fps = Number(url.searchParams.get('fps') ?? 60) || 60;
      const name = (url.searchParams.get('name') ?? '').replace(/[^\w-]/g, '') || 'presentation';
      // озвучка: путь «<id>/<файл>» внутри src/decks, сдвиг и громкость — из deck.json
      voice = null;
      const audio = url.searchParams.get('audio');
      if (audio) {
        const file = path.resolve(DECKS_DIR, audio);
        if (!file.startsWith(DECKS_DIR + path.sep) || !fs.existsSync(file)) return fail(res, 404, `Нет файла озвучки: ${audio}`);
        const num = (k: string, d: number) => {
          const v = Number(url.searchParams.get(k) ?? d);
          return Number.isFinite(v) ? v : d;
        };
        voice = { file, offset: num('offset', 0), volume: num('volume', 1), from: num('from', 0), dur: num('dur', 0) };
      }
      fs.mkdirSync(OUT_DIR, { recursive: true });
      stream?.destroy();
      raw = path.join(OUT_DIR, `${name}.h264`);
      mp4 = path.join(OUT_DIR, `${name}.mp4`);
      stream = fs.createWriteStream(raw);
      return json(res, { ok: true });
    }
    if (rest === 'chunk') {
      if (!stream) return fail(res, 409, 'экспорт не начат');
      const buf = await readBody(req);
      await new Promise<void>((resolve, reject) => stream?.write(buf, (e) => (e ? reject(e) : resolve())));
      return json(res, { ok: true });
    }
    if (rest === 'finish') {
      if (!stream) return fail(res, 409, 'экспорт не начат');
      const s = stream;
      stream = null;
      await new Promise<void>((resolve) => s.end(resolve));
      try {
        return json(res, await mux());
      } catch (e) {
        return fail(res, 500, e instanceof Error ? e.message : String(e));
      }
    }
    if (rest === 'cancel') {
      const s = stream;
      stream = null;
      if (s) await new Promise<void>((resolve) => s.end(resolve));
      if (raw) fs.rmSync(raw, { force: true });
      return json(res, { ok: true });
    }
    return fail(res, 404, 'export');
  }

  // ---------------------------------------------------------------- прочее

  async function configApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'PUT') {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as Config;
      const cfg = { ...readConfig(), ffmpeg: String(body.ffmpeg ?? '').trim() || undefined };
      fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(cfg, null, 2)}\n`);
    }
    return json(res, { ffmpeg: ffmpegPath(), ffmpegOk: ffmpegOk() });
  }

  /** Путь внутри out/ — наружу не выпускаем. */
  function outPath(name: string): string | null {
    const file = path.resolve(OUT_DIR, name);
    return file.startsWith(OUT_DIR + path.sep) && fs.existsSync(file) ? file : null;
  }

  function reveal(res: ServerResponse, url: URL): void {
    const file = outPath(path.basename(url.searchParams.get('file') ?? ''));
    if (!file) return fail(res, 404, 'нет файла');
    if (process.platform === 'win32') spawn('explorer.exe', [`/select,${file}`], { detached: true });
    else if (process.platform === 'darwin') spawn('open', ['-R', file], { detached: true });
    else spawn('xdg-open', [path.dirname(file)], { detached: true });
    return json(res, { ok: true });
  }

  function serveOut(req: IncomingMessage, res: ServerResponse, name: string): void {
    const file = outPath(decodeURIComponent(name));
    if (!file) return fail(res, 404, 'нет файла');
    const size = fs.statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    res.setHeader('Content-Type', file.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    if (range) {
      const start = Number(range[1] || 0);
      const end = range[2] ? Number(range[2]) : size - 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', end - start + 1);
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', size);
      fs.createReadStream(file).pipe(res);
    }
  }

  function watchDecks(server: ViteDevServer): void {
    const notify = (file: string) => {
      const rel = path.relative(DECKS_DIR, file).split(path.sep);
      if (rel.length !== 2 || rel[1] !== 'deck.json') return;
      const id = rel[0];
      let content: string | null = null;
      try {
        content = fs.readFileSync(file, 'utf8');
      } catch {
        /* файл удалён */
      }
      if (content !== null && written.get(id) === content) return;
      announce(id);
    };
    server.watcher.on('change', notify);
    server.watcher.on('add', notify);
    server.watcher.on('unlink', notify);
  }

  return {
    name: 'presbuilder',
    configureServer(server) {
      vite = server;
      watchDecks(server);
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://x');
        const p = url.pathname;
        const run = (job: Promise<void> | void) =>
          Promise.resolve(job).catch((e) => fail(res, 500, e instanceof Error ? e.message : String(e)));

        if (p === '/api/decks' || p === '/api/decks/') return void run(decksApi(req, res, ''));
        if (p.startsWith('/api/decks/')) return void run(decksApi(req, res, p.slice('/api/decks/'.length)));
        if (p.startsWith('/api/export/')) return void run(exportApi(req, res, url, p.slice('/api/export/'.length)));
        if (p === '/api/config') return void run(configApi(req, res));
        if (p === '/api/reveal') return void run(reveal(res, url));
        if (p.startsWith('/out/')) return void run(serveOut(req, res, p.slice('/out/'.length)));
        next();
      });
    },
  };
}
