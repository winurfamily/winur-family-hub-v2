import { redirect } from "next/navigation";
import { getFamilyState, getProfilesForPicker } from "@/app/actions/auth";
import { ProfilePicker } from "@/components/profile-picker/profile-picker";

export default async function Home() {
  const familyState = await getFamilyState();

  if (!familyState || !familyState.setupComplete) {
    redirect("/setup");
  }

  const profiles = await getProfilesForPicker(familyState.familyId);

  return <ProfilePicker profiles={profiles} familyId={familyState.familyId} />;
}
