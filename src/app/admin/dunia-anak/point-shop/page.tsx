import Link from "next/link";
import { ArrowLeft, Gift } from "lucide-react";
import { getPointShop } from "@/app/actions/anak-pointshop";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateRewardForm } from "./_components/create-reward-form";
import { RewardList } from "./_components/reward-list";
import { RequestList } from "./_components/request-list";

export default async function PointShopPage() {
  const { rewards, requests } = await getPointShop();
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/dunia-anak" className="inline-flex items-center gap-1 text-sm text-ink-2 mb-1">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <h1 className="font-heading font-extrabold text-2xl text-ink-1 flex items-center gap-2">
          <Gift className="w-6 h-6 text-accent" /> Point Shop
        </h1>
        <p className="text-sm text-ink-2">Kelola hadiah tukar point dan persetujuan permintaan anak.</p>
      </div>

      <Tabs defaultValue="hadiah" className="space-y-4">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="hadiah">Hadiah</TabsTrigger>
          <TabsTrigger value="permintaan">
            Permintaan{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hadiah" className="space-y-3">
          <CreateRewardForm />
          <RewardList rewards={rewards} />
        </TabsContent>

        <TabsContent value="permintaan">
          <RequestList requests={requests} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
