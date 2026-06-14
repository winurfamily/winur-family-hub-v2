import { redirect } from "next/navigation";
import { getFamilyState } from "@/app/actions/auth";
import { SetupWizard } from "@/components/setup/setup-wizard";

export default async function SetupPage() {
  const familyState = await getFamilyState();

  if (familyState?.setupComplete) {
    redirect("/");
  }

  return <SetupWizard />;
}
