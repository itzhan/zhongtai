import PageHeader from "@/components/PageHeader";
import AllocationsPage from "@/app/(app)/resources/allocations/page";

export default function ResourceAllocationsPage() {
  return (
    <>
      <PageHeader title="分配记录" subtitle="向生产人员分配邮箱、代理 IP 和卡资源" />
      <AllocationsPage />
    </>
  );
}
