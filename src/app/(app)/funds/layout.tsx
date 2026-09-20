import PageHeader from "@/components/PageHeader";

export default function FundsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="团队资金" subtitle="按归属人记钱在哪、币种和未结账单" />
      {children}
    </>
  );
}
