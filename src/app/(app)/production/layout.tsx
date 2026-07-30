import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/TabNav";

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="生产管理" subtitle="按项目上传并管理产出结果" />
      <TabNav className="mb-4" />
      {children}
    </>
  );
}
