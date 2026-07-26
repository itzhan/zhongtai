import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/// 每个页面的第一个元素都必须是它 —— 页头统一由这里定义, 不要各页手写 h1。
export default function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  back?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-2 min-w-0">
        {back && (
          <Link
            href={back}
            aria-label="返回"
            className="mt-1.5 shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
