// =========================================================
// ทดสอบ Edge Function (supabase/functions/api/index.ts) โดยไม่เรียก LINE / Supabase จริง
// วิธีรัน (ในโฟลเดอร์ tests):  npm run test:api
// =========================================================
Deno.env.set('QUIZZY_TEST', '1');
const { handle } = await import('../supabase/functions/api/index.ts');

function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }
function assertEq(a: unknown, b: unknown, msg = '') {
  const [x, y] = [JSON.stringify(a), JSON.stringify(b)];
  if (x !== y) throw new Error(`${msg}\n  ได้:     ${x}\n  ควรได้: ${y}`);
}

type Call = { fn: string; params: Record<string, unknown> };
function makeDeps(opts: { rpcError?: Error } = {}) {
  const calls: Call[] = [];
  return {
    calls,
    deps: {
      verifyLine: async (_token: string) => ({ sub: 'U-line-1', name: 'Phum', picture: 'https://pic' }),
      verifyEmail: async (_token: string) => ({ sub: 'auth:teacher-1', name: 'kru@school.ac.th', picture: null }),
      callRpc: async (fn: string, params: Record<string, unknown>) => {
        calls.push({ fn, params });
        if (opts.rpcError) throw opts.rpcError;
        return { fn };
      },
    },
  };
}
const post = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) });

Deno.test('OPTIONS ตอบ CORS', async () => {
  const res = await handle(new Request('http://x/api', { method: 'OPTIONS' }));
  assertEq(res.status, 200);
  assert(res.headers.get('Access-Control-Allow-Origin') === '*', 'ต้องมี CORS header');
});

Deno.test('action ที่ไม่รู้จักถูกปฏิเสธ และไม่เรียกฐานข้อมูล', async () => {
  const { deps, calls } = makeDeps();
  for (const action of ['drop_tables', 'toString', '__proto__', '']) {
    const res = await handle(post({ action, idToken: 't' }), deps);
    assertEq(res.status, 400, action);
  }
  assertEq(calls.length, 0);
});

Deno.test('ไม่มี idToken ได้ 401', async () => {
  const { deps } = makeDeps();
  const res = await handle(post({ action: 'me' }), deps);
  assertEq(res.status, 401);
  assertEq(await res.json(), { ok: false, error: 'invalid_token' });
});

Deno.test('me ใช้ line_user_id และชื่อจาก token ที่ตรวจแล้ว ไม่ใช่จากหน้าเว็บ', async () => {
  const { deps, calls } = makeDeps();
  const res = await handle(post({ action: 'me', idToken: 't', data: { p_line_user_id: 'U-hacker', display_name: 'ปลอม' } }), deps);
  assertEq(res.status, 200);
  assertEq(calls[0], { fn: 'api_me', params: { p_line_user_id: 'U-line-1', p_display_name: 'Phum', p_picture_url: 'https://pic' } });
});

Deno.test('register ส่งชื่อและรหัส', async () => {
  const { deps, calls } = makeDeps();
  await handle(post({ action: 'register', idToken: 't', data: { full_name: 'ภูมิ', student_code: '65012' } }), deps);
  assertEq(calls[0].params, { p_line_user_id: 'U-line-1', p_full_name: 'ภูมิ', p_student_code: '65012' });
});

Deno.test('ข้อมูลจากหน้าเว็บเขียนทับ p_line_user_id ไม่ได้', async () => {
  const { deps, calls } = makeDeps();
  for (const action of Object.keys(await actionsList())) {
    calls.length = 0;
    await handle(post({ action, idToken: 't', data: { p_line_user_id: 'U-hacker' } }), deps);
    if (calls[0]) assertEq(calls[0].params.p_line_user_id, 'U-line-1', action);
  }
});

Deno.test('save_questions ส่ง mode เฉพาะ replace / append และ set_published รับเฉพาะ true', async () => {
  const { deps, calls } = makeDeps();
  await handle(post({ action: 'save_questions', idToken: 't', data: { exam_id: 'e1', questions: [{}], mode: 'drop' } }), deps);
  await handle(post({ action: 'set_published', idToken: 't', data: { exam_id: 'e1', publish: 'yes' } }), deps);
  assertEq(calls[0].params.p_mode, 'replace');
  assertEq(calls[1].params.p_publish, false);
});

Deno.test('provider email ใช้ตัวตนจาก Supabase Auth (auth:<id>) และค่าอื่นใช้ LINE', async () => {
  const { deps, calls } = makeDeps();
  await handle(post({ action: 'me', provider: 'email', idToken: 't' }), deps);
  await handle(post({ action: 'me', provider: 'something-else', idToken: 't' }), deps);
  assertEq(calls[0].params, { p_line_user_id: 'auth:teacher-1', p_display_name: 'kru@school.ac.th', p_picture_url: null });
  assertEq(calls[1].params.p_line_user_id, 'U-line-1');
});

Deno.test('body ไม่ใช่ JSON ได้ 400', async () => {
  const { deps } = makeDeps();
  const res = await handle(new Request('http://x/api', { method: 'POST', body: 'not json' }), deps);
  assertEq(res.status, 400);
});

Deno.test('error ที่ไม่คาดคิดตอบ 500 แบบไม่เปิดเผยรายละเอียด', async () => {
  const { deps } = makeDeps({ rpcError: new Error('secret db detail') });
  const res = await handle(post({ action: 'me', idToken: 't' }), deps);
  assertEq(res.status, 500);
  const body = await res.json();
  assert(!JSON.stringify(body).includes('secret'), 'ห้ามส่งรายละเอียด error ภายในออกไป');
});

// ---------- ใช้ verifyLine / callRpc ตัวจริง แต่จำลอง fetch ----------
function withFetch(fake: (url: string, init: RequestInit) => Response, run: () => Promise<void>) {
  return async () => {
    const real = globalThis.fetch;
    globalThis.fetch = ((url: string, init: RequestInit) => Promise.resolve(fake(String(url), init))) as typeof fetch;
    Deno.env.set('LINE_CHANNEL_ID', '1234567890');
    Deno.env.set('SUPABASE_URL', 'https://proj.supabase.co');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
    try { await run(); } finally { globalThis.fetch = real; }
  };
}

Deno.test('LINE ตอบว่า token ใช้ไม่ได้ → 401', withFetch(
  (url) => url.includes('api.line.me') ? new Response('{"error":"invalid_request"}', { status: 400 }) : new Response('null'),
  async () => {
    const res = await handle(post({ action: 'me', idToken: 'expired' }));
    assertEq(res.status, 401);
  },
));

Deno.test('ส่ง client_id ที่ถูกต้องไปตรวจ token และใช้ secret key แบบใหม่ถูกวิธี', withFetch(
  (url, init) => {
    if (url.includes('api.line.me')) {
      const p = new URLSearchParams(String(init.body));
      assertEq([p.get('id_token'), p.get('client_id')], ['tok', '1234567890']);
      return Response.json({ sub: 'U-real', name: 'Real' });
    }
    assertEq(url, 'https://proj.supabase.co/rest/v1/rpc/api_me');
    const h = init.headers as Record<string, string>;
    assertEq([h.apikey, h.Authorization], ['sb_secret_test', undefined], 'secret key แบบใหม่ไม่ต้องใส่ Bearer');
    return Response.json({ id: 'p1' });
  },
  async () => {
    const res = await handle(post({ action: 'me', idToken: 'tok' }));
    assertEq(await res.json(), { ok: true, data: { id: 'p1' } });
  },
));

Deno.test('ข้อความ error จากฐานข้อมูล (P0001) ส่งต่อให้ผู้ใช้', withFetch(
  (url) => url.includes('api.line.me')
    ? Response.json({ sub: 'U-real' })
    : Response.json({ code: 'P0001', message: 'ลงทะเบียนไว้แล้ว' }, { status: 400 }),
  async () => {
    const res = await handle(post({ action: 'register', idToken: 'tok', data: {} }));
    assertEq(res.status, 400);
    assertEq(await res.json(), { ok: false, error: 'ลงทะเบียนไว้แล้ว' });
  },
));

Deno.test('email: ตรวจ token กับ Supabase Auth ถ้าใช้ไม่ได้ได้ 401 และไม่เรียก LINE', withFetch(
  (url, init) => {
    if (url.includes('api.line.me')) throw new Error('ห้ามเรียก LINE');
    if (url.endsWith('/auth/v1/user')) {
      const h = init.headers as Record<string, string>;
      return h.Authorization === 'Bearer good' ? Response.json({ id: 'u-123', email: 'kru@school.ac.th' }) : new Response('{}', { status: 401 });
    }
    return Response.json({ ok: 1 });
  },
  async () => {
    assertEq((await handle(post({ action: 'me', provider: 'email', idToken: 'bad' }))).status, 401);
    const res = await handle(post({ action: 'me', provider: 'email', idToken: 'good' }));
    assertEq(await res.json(), { ok: true, data: { ok: 1 } });
  },
));

// รายชื่อ action ทั้งหมด (อ่านจากไฟล์ เพื่อทดสอบทุก action อัตโนมัติ)
async function actionsList() {
  const src = await Deno.readTextFile(new URL('../supabase/functions/api/index.ts', import.meta.url));
  const block = src.slice(src.indexOf('const ACTIONS'), src.indexOf('const CORS'));
  return Object.fromEntries([...block.matchAll(/^\s{2}(\w+): \{ fn:/gm)].map((m) => [m[1], true]));
}
