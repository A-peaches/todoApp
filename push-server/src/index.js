// 공주 투두 푸시 서버 (Cloudflare Workers)
// - POST /subscribe   { subscription, lat, lon, tz }  구독 저장 (KV)
// - POST /unsubscribe { endpoint }                    구독 삭제
// - POST /test        { endpoint, slot? }             저장된 구독에 바로 한 번 보내기 (slot 없으면 연결 확인 알림)
// - 매시 정각(cron): 구독자 현지 시각이 7·12·18·21·23시면 { slot, weather }를 보냄
//   문구(이름·남은 할 일 포함)는 폰의 서비스 워커가 notify.js로 완성해요.
import { buildPushPayload } from '@block65/webcrypto-web-push';

const SLOTS = [7, 12, 18, 21, 23];
const ALLOWED_ORIGINS = ['https://a-peaches.github.io', 'http://localhost:8080'];

const cors = origin => ({
  'access-control-allow-origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'vary': 'origin'
});
const json = (body, status, origin) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors(origin) } });

// 구독 키: endpoint를 그대로 쓰지 않고 해시
async function keyOf(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return 'sub:' + [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const validSub = s => s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && s.keys && s.keys.p256dh && s.keys.auth;
const validTz = tz => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
const num = (x, lo, hi) => typeof x === 'number' && isFinite(x) && x >= lo && x <= hi ? Math.round(x * 100) / 100 : null;

function localHour(tz, now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
}

// 오늘·내일 날씨 (Open-Meteo, 키 없음)
async function weatherFor(lat, lon, tz) {
  if (lat == null || lon == null) return null;
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_mean' +
    '&timezone=' + encodeURIComponent(tz || 'auto') + '&forecast_days=2';
  try {
    const d = (await (await fetch(url)).json()).daily;
    return { code: d.weather_code, max: d.temperature_2m_max, min: d.temperature_2m_min, rain: d.precipitation_probability_max, hum: d.relative_humidity_2m_mean };
  } catch { return null; }
}

async function send(env, rec, data) {
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const payload = await buildPushPayload({ data, options: { ttl: 60 * 60, urgency: 'normal' } }, rec.subscription, vapid);
  return fetch(rec.subscription.endpoint, payload);
}

async function runSchedule(env) {
  const now = new Date(), weatherCache = new Map();
  let cursor;
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor });
    for (const { name } of page.keys) {
      const rec = await env.SUBS.get(name, 'json');
      if (!rec) continue;
      const slot = localHour(rec.tz, now);
      if (!SLOTS.includes(slot)) continue;
      let weather = null;
      if (slot === 7 || slot === 21) {
        const wk = rec.lat + ',' + rec.lon + ',' + rec.tz;
        if (!weatherCache.has(wk)) weatherCache.set(wk, await weatherFor(rec.lat, rec.lon, rec.tz));
        weather = weatherCache.get(wk);
      }
      // 보낸 결과를 구독 기록에 남김 (알림이 안 온다는 문의를 확인할 때 씀)
      let status = 0, error = null;
      try {
        const res = await send(env, rec, { slot, weather });
        status = res.status;
        if (!res.ok) error = (await res.text()).slice(0, 200);
      } catch (e) { error = String(e && e.message || e).slice(0, 200); }
      console.log('push', slot, rec.subscription.endpoint.split('/')[2], status, error || '');
      if (status === 404 || status === 410) await env.SUBS.delete(name);   // 만료된 구독 정리
      else await env.SUBS.put(name, JSON.stringify({ ...rec, last: { slot, status, error, at: Date.now() } }));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const { pathname } = new URL(req.url);
    if (req.method === 'GET' && pathname === '/') return json({ ok: true, name: 'princess-todo-push' }, 200, origin);
    if (req.method !== 'POST') return json({ error: 'not found' }, 404, origin);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, origin); }

    if (pathname === '/subscribe') {
      if (!validSub(body.subscription)) return json({ error: 'bad subscription' }, 400, origin);
      const tz = validTz(body.tz) ? body.tz : 'Asia/Seoul';
      const key = await keyOf(body.subscription.endpoint);
      const prev = await env.SUBS.get(key, 'json');   // 마지막 발송 결과(last)는 지우지 않고 이어감
      const rec = { subscription: body.subscription, lat: num(body.lat, -90, 90), lon: num(body.lon, -180, 180), tz, updatedAt: Date.now(),
        createdAt: prev && prev.createdAt || Date.now(), ...(prev && prev.last ? { last: prev.last } : {}) };
      await env.SUBS.put(key, JSON.stringify(rec));
      return json({ ok: true }, 200, origin);
    }
    if (pathname === '/unsubscribe') {
      if (typeof body.endpoint !== 'string') return json({ error: 'bad endpoint' }, 400, origin);
      await env.SUBS.delete(await keyOf(body.endpoint));
      return json({ ok: true }, 200, origin);
    }
    if (pathname === '/test') {
      if (typeof body.endpoint !== 'string') return json({ error: 'bad endpoint' }, 400, origin);
      const rec = await env.SUBS.get(await keyOf(body.endpoint), 'json');
      if (!rec) return json({ error: 'not subscribed' }, 404, origin);
      // slot 없이 부르면 '연결됐어요' 확인 알림, slot을 주면 그 시간 알림을 미리 보기
      const slot = SLOTS.includes(body.slot) ? body.slot : null;
      const weather = slot === 7 || slot === 21 ? await weatherFor(rec.lat, rec.lon, rec.tz) : null;
      const data = slot ? { slot, weather } : { tag: 'todo-on', body: '푸시 알림이 연결됐어요 ・₊✧ 매일 7시·12시·18시·21시·23시에 찾아올게요' };
      const res = await send(env, rec, data);
      return json({ ok: res.ok, status: res.status }, 200, origin);
    }
    return json({ error: 'not found' }, 404, origin);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSchedule(env));
  }
};
