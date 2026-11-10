interface Env {
  HEALTH_CHECK_URL: string;
}

/** Keeps the free-tier Render API awake by hitting its liveness endpoint on a schedule. */
export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(ping(env));
  },
  async fetch(_request: Request, env: Env) {
    return new Response(await ping(env));
  },
} satisfies ExportedHandler<Env>;

async function ping(env: Env): Promise<string> {
  const start = Date.now();
  try {
    const res = await fetch(env.HEALTH_CHECK_URL, { signal: AbortSignal.timeout(55_000) });
    const ms = Date.now() - start;
    const result = `${res.status} in ${ms}ms`;
    console.log(`keepalive: ${result}`);
    return result;
  } catch (err) {
    const message = `keepalive failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(message);
    return message;
  }
}
