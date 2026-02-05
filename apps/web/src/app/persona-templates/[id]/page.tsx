export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { personaTemplatesClient } from "@/lib/api";
import { PersonaTemplateDetail } from "@/components/persona-templates/persona-template-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getPersonaTemplate(id: string) {
  try {
    return await personaTemplatesClient.getById(id);
  } catch {
    return null;
  }
}

export default async function PersonaTemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const template = await getPersonaTemplate(id);

  if (!template) {
    notFound();
  }

  return (
    <DashboardLayout>
      <PersonaTemplateDetail template={template} />
    </DashboardLayout>
  );
}
