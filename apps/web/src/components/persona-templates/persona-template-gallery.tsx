"use client";

import { useState, useMemo } from "react";
import { Search, Sparkles, Clock, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PersonaTemplateCard } from "./persona-template-card";
import type { PersonaTemplate } from "@/lib/api";

const categories = [
  "all",
  "marketing",
  "devops",
  "support",
  "assistant",
  "research",
  "creative",
  "custom",
] as const;

const categoryLabels: Record<string, string> = {
  all: "All",
  marketing: "Marketing",
  devops: "DevOps",
  support: "Support",
  assistant: "Assistant",
  research: "Research",
  creative: "Creative",
  custom: "Custom",
};

interface PersonaTemplateGalleryProps {
  templates: PersonaTemplate[];
}

export function PersonaTemplateGallery({ templates }: PersonaTemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result = templates;

    if (activeCategory !== "all") {
      result = result.filter(
        (t) => t.category.toLowerCase() === activeCategory
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }, [templates, activeCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                activeCategory === cat
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search personas..."
            aria-label="Search persona templates"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" />
          <span>{templates.filter((t) => t.isBuiltin).length} builtin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          <span>
            {templates.reduce((acc, t) => acc + t.cronJobs.length, 0)} scheduled tasks
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4" />
          <span>
            {templates.reduce((acc, t) => acc + t.skills.length, 0)} skills
          </span>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => (
            <PersonaTemplateCard key={template.id} template={template} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No personas found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search or filter to find what you are looking for.
          </p>
        </div>
      )}
    </div>
  );
}
