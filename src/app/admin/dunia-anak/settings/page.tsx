import Link from "next/link";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { getFamilySettings, getChildProfiles, getFamilyProfiles } from "@/app/actions/anak-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FamilySettingsForm } from "./_components/family-settings-form";
import { ChildSettingsRow } from "./_components/child-settings-row";
import { FamilyProfileCard } from "./_components/family-profile-card";

export default async function DuniaAnakSettingsPage() {
  const [settings, children, familyProfiles] = await Promise.all([
    getFamilySettings(),
    getChildProfiles(),
    getFamilyProfiles(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/dunia-anak" className="inline-flex items-center gap-1 text-sm text-ink-2 mb-1">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <h1 className="font-heading font-extrabold text-2xl text-ink-1 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-ink-2" /> Pengaturan
        </h1>
        <p className="text-sm text-ink-2">Atur reward default, suara, tema, profil anak, dan PIN.</p>
      </div>

      <Tabs defaultValue="keluarga" className="space-y-4">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="keluarga">Keluarga</TabsTrigger>
          <TabsTrigger value="profil">Avatar</TabsTrigger>
          <TabsTrigger value="anak">Profil Anak</TabsTrigger>
        </TabsList>

        <TabsContent value="keluarga">
          {settings ? (
            <FamilySettingsForm settings={settings} />
          ) : (
            <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
              Data keluarga tidak ditemukan.
            </div>
          )}
        </TabsContent>

        <TabsContent value="profil" className="space-y-3">
          <p className="text-sm text-ink-2">Pilih/ganti avatar untuk setiap anggota keluarga. Avatar ini tampil di layar Pilih Profil.</p>
          {familyProfiles.length === 0 ? (
            <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
              Belum ada profil keluarga.
            </div>
          ) : (
            familyProfiles.map((profile) => <FamilyProfileCard key={profile.id} profile={profile} />)
          )}
        </TabsContent>

        <TabsContent value="anak" className="space-y-3">
          {children.length === 0 ? (
            <div className="rounded-2xl border-2 border-border bg-card shadow-card p-6 text-center text-sm text-ink-2">
              Belum ada profil anak.
            </div>
          ) : (
            children.map((child) => <ChildSettingsRow key={child.id} child={child} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
