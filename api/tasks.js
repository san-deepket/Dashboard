// Vercel serverless function: stores the task list in a Redis database
// (Upstash Redis, connected from the Vercel Storage tab). All browsers read
// and write the same data through this function.

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = 'rathor:tasks';   // hash: field = task id, value = task JSON
const META = 'rathor:meta';   // "1" once the database has been set up
const STATUS = ['Pending', 'In Process', 'Completed'];

async function redis(cmds) {
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('Redis ' + r.status);
  const out = await r.json();
  out.forEach(o => { if (o && o.error) throw new Error(o.error); });
  return out.map(o => o.result);
}

const s = (v, n) => String(v == null ? '' : v).slice(0, n);

function clean(t) {
  if (!t || typeof t !== 'object') return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(t.id))) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.due))) return null;
  if (typeof t.task !== 'string' || !t.task.trim()) return null;
  if (!STATUS.includes(t.status)) return null;
  return {
    id: String(t.id), no: Number(t.no) || 0, task: s(t.task, 200), details: s(t.details, 600),
    due: t.due, startTime: s(t.startTime, 5), endTime: s(t.endTime, 5),
    entered: /^\d{4}-\d{2}-\d{2}$/.test(String(t.entered)) ? t.entered : t.due,
    assigned: s(t.assigned, 80), status: t.status, priority: t.priority === 'High' ? 'High' : 'Normal',
    remark: s(t.remark, 200), alarmAt: s(t.alarmAt, 16),
    repeat: ['none', 'daily', 'weekdays', 'weekly'].includes(t.repeat) ? t.repeat : 'none',
    alarmFired: !!t.alarmFired, updated: s(t.updated, 30)
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const need = process.env.ACCESS_CODE;
  if (need && req.headers['x-access-code'] !== need) return res.status(401).json({ error: 'Access code needed.' });
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Database is not connected. Add Upstash Redis in the Vercel Storage tab.' });

  try {
    if (req.method === 'GET') {
      const [flat, meta] = await redis([['HGETALL', KEY], ['GET', META]]);
      const tasks = [];
      const arr = Array.isArray(flat) ? flat : [];
      for (let i = 1; i < arr.length; i += 2) { try { tasks.push(JSON.parse(arr[i])); } catch (e) {} }
      return res.status(200).json({ tasks, initialized: meta === '1' });
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
      if (!body) return res.status(400).json({ error: 'Bad request.' });
      const up = Array.isArray(body.upsert) ? body.upsert : [];
      const rm = Array.isArray(body.remove) ? body.remove : [];
      if (up.length > 500 || rm.length > 500) return res.status(400).json({ error: 'Too many changes at once.' });
      const cmds = [];
      for (const t of up) {
        const c = clean(t);
        if (!c) return res.status(400).json({ error: 'A task had invalid data.' });
        cmds.push(['HSET', KEY, c.id, JSON.stringify(c)]);
      }
      const ids = rm.map(String).filter(id => /^[A-Za-z0-9_-]{1,64}$/.test(id));
      if (ids.length) cmds.push(['HDEL', KEY, ...ids]);
      if (up.length || body.init) cmds.push(['SET', META, '1']);
      if (cmds.length) await redis(cmds);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Use GET or POST.' });
  } catch (e) {
    return res.status(502).json({ error: 'Database error. Try again.' });
  }
};
