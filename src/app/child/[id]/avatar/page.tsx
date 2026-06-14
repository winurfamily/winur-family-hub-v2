import { redirect } from "next/navigation";
import { getChildCollections } from "@/app/actions/child-avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollectionGrid } from "@/components/child/collection-grid";
import { SectionCard } from "@/components/child/layout/section-card";

export default async function AvatarPage({ params }: { params: { id: string } }) {
  const data = await getChildCollections(params.id);
  if (!data) redirect("/");

  const unlockedAvatars = data.avatars.filter((a) => a.unlocked).length;
  const unlockedPets = data.pets.filter((p) => p.unlocked).length;

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <SectionCard
        title="Avatar & Pet"
        icon="🎭"
        action={
          <span className="rounded-lg bg-accent/15 px-2 py-1 text-xs font-extrabold text-accent">
            Level {data.level}
          </span>
        }
      >
        <Tabs defaultValue="avatar">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-white/5 p-1">
            <TabsTrigger
              value="avatar"
              className="rounded-xl py-2 font-heading text-xs font-extrabold data-[state=active]:bg-accent data-[state=active]:text-white sm:text-sm"
            >
              Avatar ⭐ {unlockedAvatars}/{data.avatars.length}
            </TabsTrigger>
            <TabsTrigger
              value="pet"
              className="rounded-xl py-2 font-heading text-xs font-extrabold data-[state=active]:bg-accent data-[state=active]:text-white sm:text-sm"
            >
              Pet ⭐ {unlockedPets}/{data.pets.length}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="avatar" className="mt-3">
            <CollectionGrid childId={params.id} type="avatar" items={data.avatars} />
          </TabsContent>
          <TabsContent value="pet" className="mt-3">
            <CollectionGrid childId={params.id} type="pet" items={data.pets} />
          </TabsContent>
        </Tabs>
      </SectionCard>
    </div>
  );
}
