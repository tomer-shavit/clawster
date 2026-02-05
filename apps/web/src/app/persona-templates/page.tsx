export const dynamic = 'force-dynamic';

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { personaTemplatesClient } from "@/lib/api";
import { PersonaTemplateGallery } from "@/components/persona-templates/persona-template-gallery";

async function getPersonaTemplates() {
  try {
    return await personaTemplatesClient.list();
  } catch {
    return [];
  }
}

export default async function PersonaTemplatesPage() {
  const templates = await getPersonaTemplates();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Persona Templates</h1>
          <p className="text-muted-foreground mt-1">
            Pre-built bot personalities with identity, scheduled tasks, and skills
          </p>
        </div>
      </div>
      <PersonaTemplateGallery templates={templates} />
    </DashboardLayout>
  );
}
