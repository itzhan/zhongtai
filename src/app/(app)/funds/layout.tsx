import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/TabNav";

export default function FundsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="团队资金" subtitle="头寸、团队成员与合作伙伴" />
      <TabNav className="mb-4" />
      {children}
    </>
  );
}
