import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/TabNav";

/// 页头与 tab 条由本 layout 统一出, 子页只渲染自己的工具条和表格。
export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="资源库" subtitle="卡 / 代理 IP / 邮箱" />
      <TabNav className="mb-4" />
      {children}
    </>
  );
}
