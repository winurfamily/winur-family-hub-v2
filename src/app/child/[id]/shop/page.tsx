import { redirect } from "next/navigation";
import { getChildShop } from "@/app/actions/child-shop";
import { ShopRewardCard } from "@/components/child/shop-reward-card";
import { PointPill } from "@/components/child/stat-pills";
import { SectionCard } from "@/components/child/layout/section-card";
import { EmptyState } from "@/components/child/layout/empty-state";

export default async function ChildShopPage({ params }: { params: { id: string } }) {
  const data = await getChildShop(params.id);
  if (!data) redirect("/");

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <SectionCard title="Point Shop" icon="🎁" action={<PointPill value={data.point} />}>
        {data.rewards.length === 0 ? (
          <EmptyState
            icon="🎁"
            title="Belum ada hadiah di toko."
            description="Minta Ayah/Mamah menambahkan hadiah ya!"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {data.rewards.map((reward) => (
              <ShopRewardCard key={reward.id} childId={params.id} reward={reward} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
