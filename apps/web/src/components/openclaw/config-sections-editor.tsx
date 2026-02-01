"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Wrench,
  MessageSquare,
  Cpu,
  Save,
  AlertCircle,
} from "lucide-react";

interface ConfigSectionsEditorProps {
  config: string;
  onApply: (config: string) => void;
  isApplying?: boolean;
  className?: string;
}

// --- Helpers for safe nested get/set on plain objects ---

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const clone = structuredClone(obj);
  const keys = path.split(".");
  let current: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (
      current[key] === null ||
      current[key] === undefined ||
      typeof current[key] !== "object"
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return clone;
}

// --- Local form state derived from parsed config ---

interface FormState {
  botName: string;
  emoji: string;
  systemPrompt: string;
  primaryModel: string;
  temperature: string;
  toolProfile: string;
  dmAccess: string;
  groupPolicy: string;
}

const MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet",
  "claude-3-haiku",
  "claude-3-opus",
  "gemini-pro",
];

const TOOL_PROFILE_OPTIONS = ["minimal", "coding", "messaging", "full"];

const DM_ACCESS_OPTIONS = ["open", "pairing-required", "allowlist"];

const GROUP_POLICY_OPTIONS = ["all", "mentioned", "none"];

const FIELD_PATHS: Record<keyof FormState, string> = {
  botName: "agents.defaults.identity.name",
  emoji: "agents.defaults.identity.emoji",
  systemPrompt: "agents.defaults.identity.systemPrompt",
  primaryModel: "models.primary.model",
  temperature: "models.primary.temperature",
  toolProfile: "agents.defaults.tools.profile",
  dmAccess: "channels.defaults.dmAccess",
  groupPolicy: "channels.defaults.groupPolicy",
};

function extractFormState(parsed: Record<string, unknown>): FormState {
  return {
    botName: String(getNestedValue(parsed, FIELD_PATHS.botName) ?? ""),
    emoji: String(getNestedValue(parsed, FIELD_PATHS.emoji) ?? ""),
    systemPrompt: String(getNestedValue(parsed, FIELD_PATHS.systemPrompt) ?? ""),
    primaryModel: String(getNestedValue(parsed, FIELD_PATHS.primaryModel) ?? ""),
    temperature: String(getNestedValue(parsed, FIELD_PATHS.temperature) ?? "0.7"),
    toolProfile: String(getNestedValue(parsed, FIELD_PATHS.toolProfile) ?? ""),
    dmAccess: String(getNestedValue(parsed, FIELD_PATHS.dmAccess) ?? ""),
    groupPolicy: String(getNestedValue(parsed, FIELD_PATHS.groupPolicy) ?? ""),
  };
}

function mergeFormIntoConfig(
  base: Record<string, unknown>,
  form: FormState
): Record<string, unknown> {
  let result = structuredClone(base);
  for (const [key, path] of Object.entries(FIELD_PATHS)) {
    const value = form[key as keyof FormState];
    if (key === "temperature") {
      const num = parseFloat(value);
      result = setNestedValue(result, path, isNaN(num) ? 0.7 : num);
    } else {
      result = setNestedValue(result, path, value);
    }
  }
  return result;
}

// --- Section header component ---

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}

function SectionHeader({ icon, title, expanded, onToggle }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between py-2 px-1 text-left"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {expanded ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

// --- Field wrapper ---

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// --- Main component ---

export function ConfigSectionsEditor({
  config,
  onApply,
  isApplying = false,
  className,
}: ConfigSectionsEditorProps) {
  // Parse the incoming config
  const parsed = useMemo(() => {
    try {
      return JSON.parse(config) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [config]);

  const initialForm = useMemo(() => {
    if (!parsed) return null;
    return extractFormState(parsed);
  }, [parsed]);

  const [form, setForm] = useState<FormState | null>(initialForm);
  const [rawFallback, setRawFallback] = useState(config);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    identity: true,
    model: false,
    tools: false,
    channels: false,
  });

  const toggleSection = useCallback((section: string) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    []
  );

  // Detect unsaved changes
  const hasChanges = useMemo(() => {
    if (!parsed || !form || !initialForm) {
      return rawFallback !== config;
    }
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [parsed, form, initialForm, rawFallback, config]);

  const handleApply = useCallback(() => {
    if (!parsed || !form) {
      // Fallback mode: validate raw JSON and apply
      try {
        JSON.parse(rawFallback);
        onApply(rawFallback);
      } catch {
        // invalid JSON, do nothing
      }
      return;
    }
    const merged = mergeFormIntoConfig(parsed, form);
    onApply(JSON.stringify(merged, null, 2));
  }, [parsed, form, rawFallback, onApply]);

  // If config is invalid JSON, render a raw textarea fallback
  if (!parsed || !form) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Bot className="h-4 w-4" />
              Configuration
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && <Badge variant="warning">Unsaved Changes</Badge>}
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!hasChanges || isApplying}
              >
                {isApplying ? (
                  "Applying..."
                ) : (
                  <>
                    <Save className="mr-1 h-4 w-4" /> Apply Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Invalid JSON configuration. Edit the raw config below or fix the
              JSON to use the structured editor.
            </span>
          </div>
          <textarea
            value={rawFallback}
            onChange={(e) => setRawFallback(e.target.value)}
            className="w-full min-h-[300px] p-4 rounded-lg border bg-muted font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            spellCheck={false}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Bot className="h-4 w-4" />
            Configuration
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && <Badge variant="warning">Unsaved Changes</Badge>}
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!hasChanges || isApplying}
            >
              {isApplying ? (
                "Applying..."
              ) : (
                <>
                  <Save className="mr-1 h-4 w-4" /> Apply Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Identity Section */}
        <Card className="border hover:border-primary/30 transition-colors">
          <CardHeader className="py-3 px-4">
            <SectionHeader
              icon={<User className="h-4 w-4 text-blue-500" />}
              title="Identity"
              expanded={expanded.identity}
              onToggle={() => toggleSection("identity")}
            />
          </CardHeader>
          {expanded.identity && (
            <CardContent className="px-4 pb-4 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bot Name">
                  <Input
                    value={form.botName}
                    onChange={(e) => updateField("botName", e.target.value)}
                    placeholder="My Bot"
                  />
                </Field>
                <Field label="Emoji">
                  <Input
                    value={form.emoji}
                    onChange={(e) => updateField("emoji", e.target.value)}
                    placeholder="🤖"
                    maxLength={2}
                    className="w-20"
                  />
                </Field>
              </div>
              <Field label="System Prompt / Personality">
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => updateField("systemPrompt", e.target.value)}
                  rows={4}
                  placeholder="You are a helpful assistant..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                />
              </Field>
            </CardContent>
          )}
        </Card>

        {/* Model Section */}
        <Card className="border hover:border-primary/30 transition-colors">
          <CardHeader className="py-3 px-4">
            <SectionHeader
              icon={<Cpu className="h-4 w-4 text-purple-500" />}
              title="Model"
              expanded={expanded.model}
              onToggle={() => toggleSection("model")}
            />
          </CardHeader>
          {expanded.model && (
            <CardContent className="px-4 pb-4 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Primary Model">
                  <Select
                    value={form.primaryModel}
                    onChange={(e) => updateField("primaryModel", e.target.value)}
                  >
                    <option value="">Select a model...</option>
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Temperature">
                  <Input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.temperature}
                    onChange={(e) => updateField("temperature", e.target.value)}
                    className="w-28"
                  />
                </Field>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Tools Section */}
        <Card className="border hover:border-primary/30 transition-colors">
          <CardHeader className="py-3 px-4">
            <SectionHeader
              icon={<Wrench className="h-4 w-4 text-orange-500" />}
              title="Tools"
              expanded={expanded.tools}
              onToggle={() => toggleSection("tools")}
            />
          </CardHeader>
          {expanded.tools && (
            <CardContent className="px-4 pb-4 pt-0 space-y-4">
              <Field label="Tool Profile">
                <Select
                  value={form.toolProfile}
                  onChange={(e) => updateField("toolProfile", e.target.value)}
                >
                  <option value="">Select a profile...</option>
                  {TOOL_PROFILE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardContent>
          )}
        </Card>

        {/* Channels Section */}
        <Card className="border hover:border-primary/30 transition-colors">
          <CardHeader className="py-3 px-4">
            <SectionHeader
              icon={<MessageSquare className="h-4 w-4 text-green-500" />}
              title="Channels"
              expanded={expanded.channels}
              onToggle={() => toggleSection("channels")}
            />
          </CardHeader>
          {expanded.channels && (
            <CardContent className="px-4 pb-4 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="DM Access Policy">
                  <Select
                    value={form.dmAccess}
                    onChange={(e) => updateField("dmAccess", e.target.value)}
                  >
                    <option value="">Select policy...</option>
                    {DM_ACCESS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o
                          .split("-")
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(" ")}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Group Policy">
                  <Select
                    value={form.groupPolicy}
                    onChange={(e) => updateField("groupPolicy", e.target.value)}
                  >
                    <option value="">Select policy...</option>
                    {GROUP_POLICY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o.charAt(0).toUpperCase() + o.slice(1)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </CardContent>
          )}
        </Card>
      </CardContent>
    </Card>
  );
}
