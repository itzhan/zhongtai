import { ArrowDown, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string;
  trend?: { delta: number; suffix?: string };
  hint?: string;
  positiveIsGood?: boolean;
  icon?: LucideIcon;
  accent?: "primary" | "success" | "danger" | "warning" | "default";
}

const accentClasses: Record<NonNullable<StatCardProps["accent"]>, {
  iconBg: string;
  iconText: string;
  glow: string;
}> = {
  primary: {
    iconBg: "bg-primary/10 dark:bg-primary/20",
    iconText: "text-primary",
    glow: "from-primary/8 dark:from-primary/5",
  },
  success: {
    iconBg: "bg-success/10 dark:bg-success/20",
    iconText: "text-success",
    glow: "from-success/8 dark:from-success/5",
  },
  danger: {
    iconBg: "bg-destructive/10 dark:bg-destructive/20",
    iconText: "text-destructive",
    glow: "from-destructive/8 dark:from-destructive/5",
  },
  warning: {
    iconBg: "bg-warning/10 dark:bg-warning/20",
    iconText: "text-warning",
    glow: "from-warning/8 dark:from-warning/5",
  },
  default: {
    iconBg: "bg-secondary",
    iconText: "text-muted-foreground",
    glow: "from-secondary/40",
  },
};

export default function StatCard({
  label,
  value,
  trend,
  hint,
  positiveIsGood = true,
  icon: Icon,
  accent = "default",
}: StatCardProps) {
  const a = accentClasses[accent];

  let trendVariant: "success" | "destructive" | "secondary" = "secondary";
  if (trend && trend.delta !== 0) {
    const goingUp = trend.delta > 0;
    const good = positiveIsGood ? goingUp : !goingUp;
    trendVariant = good ? "success" : "destructive";
  }

  return (
    <Card className="rounded-2xl overflow-hidden relative">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-60",
          a.glow,
        )}
      />
      <CardContent className="p-5 pt-5 space-y-3 relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && (
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center",
                  a.iconBg,
                  a.iconText,
                )}
              >
                <Icon size={16} />
              </div>
            )}
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
          {trend && trend.delta !== 0 && (
            <Badge variant={trendVariant} className="gap-0.5">
              {trend.delta > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
              {Math.abs(trend.delta).toFixed(1)}
              {trend.suffix ?? "%"}
            </Badge>
          )}
        </div>
        <p className="text-3xl font-bold tracking-tight leading-none">
          {value}
        </p>
        {hint && (
          <p className="text-xs text-muted-foreground/70 truncate">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
