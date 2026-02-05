"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Zap, User, Sparkles, Key, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PersonaTemplate } from "@/lib/api";
import { PersonaInjectDialog } from "./persona-inject-dialog";
import { personaCategoryColors } from "./persona-constants";

interface PersonaTemplateDetailProps {
  template: PersonaTemplate;
}

export function PersonaTemplateDetail({ template }: PersonaTemplateDetailProps) {
  const [injectDialogOpen, setInjectDialogOpen] = useState(false);
  const categoryColor = personaCategoryColors[template.category.toLowerCase()] ?? personaCategoryColors.custom;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <Link href="/persona-templates">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Personas
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            {template.identity?.emoji && (
              <span className="text-4xl">{template.identity.emoji}</span>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
              <p className="text-muted-foreground mt-1">{template.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={categoryColor}>
              {template.category}
            </Badge>
            {template.isBuiltin && (
              <Badge variant="secondary">Builtin</Badge>
            )}
            {template.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <Button onClick={() => setInjectDialogOpen(true)} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Apply to Bot
        </Button>
      </div>

      <Separator />

      {/* Content grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Identity */}
        {template.identity && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-4 w-4" />
                Identity
              </CardTitle>
              <CardDescription>
                Bot name and visual appearance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{template.identity.name}</span>
                {template.identity.emoji && (
                  <>
                    <span className="text-muted-foreground">Emoji:</span>
                    <span>{template.identity.emoji}</span>
                  </>
                )}
                {template.identity.creature && (
                  <>
                    <span className="text-muted-foreground">Creature:</span>
                    <span>{template.identity.creature}</span>
                  </>
                )}
                {template.identity.vibe && (
                  <>
                    <span className="text-muted-foreground">Vibe:</span>
                    <span>{template.identity.vibe}</span>
                  </>
                )}
                {template.identity.theme && (
                  <>
                    <span className="text-muted-foreground">Theme:</span>
                    <span>{template.identity.theme}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        {template.skills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-4 w-4" />
                Skills
              </CardTitle>
              <CardDescription>
                Enabled capabilities for this persona
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {template.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scheduled Tasks */}
        {template.cronJobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4" />
                Scheduled Tasks
              </CardTitle>
              <CardDescription>
                Automated tasks that run on a schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {template.cronJobs.map((job) => (
                <div key={job.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{job.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatSchedule(job.schedule)}
                    </Badge>
                  </div>
                  {job.description && (
                    <p className="text-xs text-muted-foreground">
                      {job.description}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Required Secrets */}
        {template.requiredSecrets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="h-4 w-4" />
                Required Secrets
              </CardTitle>
              <CardDescription>
                Credentials needed when applying this persona
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {template.requiredSecrets.map((secret) => (
                <div key={secret.key} className="space-y-0.5">
                  <div className="font-medium text-sm">{secret.label}</div>
                  {secret.description && (
                    <p className="text-xs text-muted-foreground">
                      {secret.description}
                    </p>
                  )}
                  <code className="text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded">
                    {secret.configPath}
                  </code>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Config Patches */}
        {template.configPatches && Object.keys(template.configPatches).length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-4 w-4" />
                Configuration Patches
              </CardTitle>
              <CardDescription>
                Additional configuration applied to the bot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                {JSON.stringify(template.configPatches, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Soul (personality) */}
        {template.soul && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-4 w-4" />
                Soul (Personality)
              </CardTitle>
              <CardDescription>
                Detailed personality instructions for the bot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                {template.soul}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      <PersonaInjectDialog
        template={template}
        open={injectDialogOpen}
        onOpenChange={setInjectDialogOpen}
      />
    </div>
  );
}

function formatSchedule(schedule: { kind: string; at?: string; everyMs?: number; expr?: string; tz?: string }): string {
  switch (schedule.kind) {
    case "at":
      return `at ${schedule.at}`;
    case "every": {
      const ms = schedule.everyMs ?? 0;
      if (ms < 1000) return `every ${ms}ms`;
      if (ms < 60_000) return `every ${Math.round(ms / 1000)}s`;
      if (ms < 3_600_000) return `every ${Math.round(ms / 60_000)}m`;
      if (ms < 86_400_000) return `every ${Math.round(ms / 3_600_000)}h`;
      return `every ${Math.round(ms / 86_400_000)}d`;
    }
    case "cron":
      return schedule.tz ? `${schedule.expr} (${schedule.tz})` : schedule.expr ?? "";
    default:
      return "unknown";
  }
}
