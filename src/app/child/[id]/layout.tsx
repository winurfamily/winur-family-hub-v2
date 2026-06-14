import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/actions/auth";

export default async function ChildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = await getCurrentSession();

  if (!session || session.role !== "child" || session.profileId !== params.id) {
    redirect("/");
  }

  return <div className="min-h-screen w-full">{children}</div>;
}
