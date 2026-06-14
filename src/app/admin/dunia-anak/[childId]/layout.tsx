import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getChildBasicInfo } from "@/app/actions/anak-overview";
import { AvatarDisplay } from "@/components/shared/avatar-display";
import { AnakSubnav } from "./_components/anak-subnav";

export default async function ChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const child = await getChildBasicInfo(childId);

  if (!child) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/dunia-anak"
          className="rounded-xl border-2 border-border bg-card p-2 shrink-0"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-5 h-5 text-ink-2" />
        </Link>
        <AvatarDisplay src={child.avatarUrl ?? child.photoUrl} name={child.name} size={44} />
        <div>
          <h1 className="font-heading font-extrabold text-xl text-ink-1">{child.name}</h1>
          <p className="text-sm text-ink-2">Dunia Anak</p>
        </div>
      </div>
      <AnakSubnav childId={childId} />
      {children}
    </div>
  );
}
