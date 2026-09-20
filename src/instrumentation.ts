export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // 本地 next dev 不跑探测/调度，避免和线上抢同一批供货方。
  if (process.env.NODE_ENV !== "production") return;
  const { startMonitorLoop } = await import("./lib/monitor-loop");
  startMonitorLoop();
}
