import { runDispatch } from "./sub2-dispatch";
import { runEnabledMonitors } from "./supplier-probe";

export const MONITOR_INTERVAL_MS = 60_000;

const g = globalThis as typeof globalThis & {
  __monitorLoop?: ReturnType<typeof setInterval>;
  __monitorLoopRunning?: boolean;
};

export function startMonitorLoop() {
  if (g.__monitorLoop) return;

  const tick = async () => {
    if (g.__monitorLoopRunning) return;
    g.__monitorLoopRunning = true;
    try {
      await runEnabledMonitors();
      await runDispatch();
    } catch (e) {
      console.error("[monitor] 自动探测/调度失败", e);
    } finally {
      g.__monitorLoopRunning = false;
    }
  };

  void tick();
  g.__monitorLoop = setInterval(() => void tick(), MONITOR_INTERVAL_MS);
  console.info("[monitor] 每分钟自动探测与调度已启动");
}
