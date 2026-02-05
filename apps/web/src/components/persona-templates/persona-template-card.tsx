"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Zap, User, Sparkles } from "lucide-react";
import type { PersonaTemplate } from "@/lib/api";
import { PersonaInjectDialog } from "./persona-inject-dialog";
import { personaCategoryColors } from "./persona-constants";

interface PersonaTemplateCardProps {
  template: PersonaTemplate;
}

export function PersonaTemplateCard({ template }: PersonaTemplateCardProps) {
  const [injectDialogOpen, setInjectDialogOpen] = useState(false);
  const categoryColor = personaCategoryColors[template.category.toLowerCase()] ?? personaCategoryColors.custom;

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {template.identity?.emoji && (
                <span className="text-2xl">{template.identity.emoji}</span>
              )}
              <CardTitle className="text-lg">{template.name}</CardTitle>
            </div>
            {template.isBuiltin && (
              <Badge variant="secondary" className="shrink-0">Builtin</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="outline" className={categoryColor}>
              {template.category}
            </Badge>
            {template.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {template.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{template.tags.length - 2}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col justify-between gap-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {template.description}
          </p>

          {/* Feature highlights */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {template.identity && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{template.identity.name}</span>
              </div>
            )}
            {template.cronJobs.length > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{template.cronJobs.length} task{template.cronJobs.length !== 1 ? "s" : ""}</span>
              </div>
            )}
            {template.skills.length > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>{template.skills.length} skill{template.skills.length !== 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setInjectDialogOpen(true)}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Apply to Bot
            </Button>
            <Link href={`/persona-templates/${template.id}`}>
              <Button variant="ghost" size="sm">View Details</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <PersonaInjectDialog
        template={template}
        open={injectDialogOpen}
        onOpenChange={setInjectDialogOpen}
      />
    </>
  );
}
