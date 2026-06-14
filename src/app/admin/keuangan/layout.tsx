import { KeuanganSubnav } from "./_components/keuangan-subnav";

export default function KeuanganLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading font-extrabold text-2xl text-ink-1">💰 Keuangan</h1>
        <p className="text-sm text-ink-2">Kelola dompet keluarga, transfer, dan belanja.</p>
      </div>
      <KeuanganSubnav />
      {children}
    </div>
  );
}
