import PageHeader from "@/components/PageHeader";
import SupplierPanel from "@/components/settings/SupplierPanel";

export default function ResourceSuppliersPage() {
  return (
    <>
      <PageHeader title="资源供应商" subtitle="管理邮箱、代理 IP 和卡的供应渠道" />
      <SupplierPanel />
    </>
  );
}
