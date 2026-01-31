export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { WizardLayout } from "@/components/deploy-wizard/wizard-layout";
import { DeployWizard } from "@/components/deploy-wizard/deploy-wizard";
import { api } from "@/lib/api";

export default async function SetupPage() {
  // Redirect to dashboard if instances already exist
  try {
    const status = await api.getOnboardingStatus();
    if (status.hasInstances) {
      redirect("/");
    }
  } catch {
    // Continue to setup on error
  }

  return (
    <WizardLayout>
      <DeployWizard isFirstTime={true} />
    </WizardLayout>
  );
}
