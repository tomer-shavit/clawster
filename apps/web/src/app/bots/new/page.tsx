export const dynamic = "force-dynamic";

import { WizardLayout } from "@/components/deploy-wizard/wizard-layout";
import { DeployWizard } from "@/components/deploy-wizard/deploy-wizard";

export default async function AddBotPage() {
  return (
    <WizardLayout>
      <DeployWizard isFirstTime={false} />
    </WizardLayout>
  );
}
