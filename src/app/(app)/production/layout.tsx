import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/TabNav";

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="生产管理" subtitle="产出批次与资源消耗申报" />
      <TabNav className="mb-4" />
      {children}
    </>
  );
}
