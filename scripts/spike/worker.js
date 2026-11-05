// Throwaway measurement Worker. Every route requires the SPIKE_KEY secret.
const json = (v, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });

async function timedBatch(env, stmts) {
  const prepared = stmts.map((s) => env.DB.prepare(s.sql).bind(...(s.params ?? [])));
  const t0 = Date.now();
  const res = await env.DB.batch(prepared);
  return {
    wallMs: Date.now() - t0,
    rungs: res.map((r) => ({
      rows: r.results.length,
      durationMs: r.meta.duration,
      sqlMs: r.meta.timings?.sql_duration_ms,
      rowsRead: r.meta.rows_read,
      region: r.meta.served_by_region,
      primary: r.meta.served_by_primary,
    })),
    first: res.map((r) => r.results.slice(0, 5)),
  };
}

export default {
  async fetch(request, env) {
    if (request.headers.get("x-spike-key") !== env.SPIKE_KEY) return json({ error: "unauthorized" }, 401);
    const { pathname } = new URL(request.url);
    const body = request.method === "POST" ? await request.json() : {};
    try {
      if (pathname === "/bench") {
        // { stmts, repeat } sequential runs; the first run of each case is reported separately as cold.
        const runs = [];
        for (let i = 0; i < (body.repeat ?? 10); i++) runs.push(await timedBatch(env, body.stmts));
        return json({ colo: request.cf?.colo, runs });
      }
      if (pathname === "/burst") {
        // { stmts, concurrency, rounds } fires concurrent batches to observe queueing on the single writer thread.
        const out = [];
        for (let r = 0; r < (body.rounds ?? 1); r++) {
          const t0 = Date.now();
          const runs = await Promise.all(Array.from({ length: body.concurrency }, () => timedBatch(env, body.stmts)));
          out.push({ totalMs: Date.now() - t0, wall: runs.map((x) => x.wallMs) });
        }
        return json({ colo: request.cf?.colo, out });
      }
      if (pathname === "/embed") {
        const t0 = Date.now();
        const raw = await env.AI.run("@cf/baai/bge-m3", { text: body.text });
        return json({ wallMs: Date.now() - t0, raw });
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e?.message ?? e) }, 500);
    }
  },
};
