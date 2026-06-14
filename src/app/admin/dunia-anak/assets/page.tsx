import Link from "next/link";
import { ArrowLeft, Boxes } from "lucide-react";
import { getAssetsLibrary } from "@/app/actions/anak-assets";
import { getRoomThemesByChild } from "@/app/actions/room-theme";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateAvatarForm } from "./_components/create-avatar-form";
import { AvatarList } from "./_components/avatar-list";
import { CreatePetForm } from "./_components/create-pet-form";
import { PetList } from "./_components/pet-list";
import { RoomBgManager } from "./_components/room-bg-manager";
import { VoiceRecorderManager } from "./_components/voice-recorder-manager";

export default async function AssetsPage() {
  const [{ avatars, pets }, childrenThemes] = await Promise.all([getAssetsLibrary(), getRoomThemesByChild()]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/dunia-anak" className="inline-flex items-center gap-1 text-sm text-ink-2 mb-1">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
        <h1 className="font-heading font-extrabold text-2xl text-ink-1 flex items-center gap-2">
          <Boxes className="w-6 h-6 text-primary" /> Assets
        </h1>
        <p className="text-sm text-ink-2">Kelola library avatar &amp; pet, background kamar anak, upload gambar, dan atur level unlock.</p>
      </div>

      <Tabs defaultValue="avatar" className="space-y-4">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="avatar">Avatar</TabsTrigger>
          <TabsTrigger value="pet">Pet</TabsTrigger>
          <TabsTrigger value="kamar">Kamar</TabsTrigger>
          <TabsTrigger value="suara">Suara</TabsTrigger>
        </TabsList>

        <TabsContent value="avatar" className="space-y-3">
          <CreateAvatarForm />
          <AvatarList avatars={avatars} />
        </TabsContent>

        <TabsContent value="pet" className="space-y-3">
          <CreatePetForm />
          <PetList pets={pets} />
        </TabsContent>

        <TabsContent value="kamar" className="space-y-3">
          <p className="text-sm text-ink-2">
            Upload background kamar (siang/malam) per anak. Background jadi tema yang bisa dipilih anak di kamarnya. Tata letak hotspot mengikuti referensi.
          </p>
          <RoomBgManager childrenThemes={childrenThemes} />
        </TabsContent>

        <TabsContent value="suara" className="space-y-3">
          <p className="text-sm text-ink-2">
            Rekam ulang sapaan suara Daffa &amp; Dio dari mic. Saat diputar di kamar anak, rekaman otomatis dinaikkan sedikit pitch-nya (terdengar lebih muda) tanpa mengubah file aslinya.
          </p>
          <VoiceRecorderManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
