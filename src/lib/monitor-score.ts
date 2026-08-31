import { isOneOf, MONITOR_STATUS, type MonitorGrade, type MonitorStatus } from "./enums";

/// 约 12 分钟窗口（每分钟探测一次）
const WINDOW = 12;
const UNAVAILABLE_STREAK = 3;
const UNAVAILABLE_FAIL_RATE = 0.5;
const EXCELLENT_FAIL_RATE = 0.1;
const EXCELLENT_SLOW_RATE = 0.25;

export interface MonitorSampleLike {
  status: string;
}

export interface MonitorScore {
  grade: MonitorGrade;
  up: number;
  slow: number;
  down: number;
  total: number;
}

function asStatus(value: string): MonitorStatus {
  return isOneOf(MONITOR_STATUS, value) ? value : "unknown";
}

export function scoreMonitor(samples: readonly MonitorSampleLike[]): MonitorScore {
  const window = samples.slice(-WINDOW);
  const statuses = window
    .map((row) => asStatus(row.status))
    .filter((status) => status !== "unknown" && status !== "limited");
  const total = statuses.length;
  const up = statuses.filter((status) => status === "up").length;
  const slow = statuses.filter((status) => status === "slow").length;
  const down = statuses.filter((status) => status === "down").length;
  if (!total) return { grade: "unknown", up, slow, down, total };

  const failRate = down / total;
  const slowRate = slow / total;
  const last = statuses[total - 1];
  let streak = 0;
  for (let i = total - 1; i >= 0 && statuses[i] === "down"; i -= 1) streak += 1;

  let grade: MonitorGrade;
  if (streak >= UNAVAILABLE_STREAK || failRate >= UNAVAILABLE_FAIL_RATE) grade = "unavailable";
  else if (failRate <= EXCELLENT_FAIL_RATE && slowRate <= EXCELLENT_SLOW_RATE && last !== "down") grade = "excellent";
  else grade = "unstable";

  return { grade, up, slow, down, total };
}
