"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select-radix";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, AlertCircle, CheckCircle2, Bot } from "lucide-react";
import { botInstancesClient, personaTemplatesClient } from "@/lib/api";
import type { PersonaTemplate, BotInstance } from "@/lib/api";

interface PersonaInjectDialogProps {
  template: PersonaTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonaInjectDialog({
  template,
  open,
  onOpenChange,
}: PersonaInjectDialogProps) {
  const router = useRouter();
  const [instances, setInstances] = useState<BotInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load running bot instances when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingInstances(true);
      setError(null);
      setSuccess(false);
      botInstancesClient
        .list()
        .then((data) => {
          // Filter to only running instances
          const running = data.filter((i) => i.status === "RUNNING");
          setInstances(running);
          if (running.length === 1) {
            setSelectedInstance(running[0].id);
          }
        })
        .catch((e) => {
          setError(`Failed to load bot instances: ${e.message}`);
        })
        .finally(() => {
          setLoadingInstances(false);
        });

      // Initialize secrets with empty values
      const initialSecrets: Record<string, string> = {};
      for (const secret of template.requiredSecrets) {
        initialSecrets[secret.key] = "";
      }
      setSecrets(initialSecrets);
    }
  }, [open, template.requiredSecrets]);

  const handleInject = async () => {
    if (!selectedInstance) {
      setError("Please select a bot instance");
      return;
    }

    // Check all required secrets are provided
    const missingSecrets = template.requiredSecrets.filter(
      (s) => !secrets[s.key]?.trim()
    );
    if (missingSecrets.length > 0) {
      setError(
        `Missing required secrets: ${missingSecrets.map((s) => s.label).join(", ")}`
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await personaTemplatesClient.inject(
        selectedInstance,
        template.id,
        { secrets }
      );

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          router.push(`/bots/${selectedInstance}`);
        }, 1500);
      } else {
        setError(result.error ?? "Injection failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Apply Persona: {template.name}
          </DialogTitle>
          <DialogDescription>
            Inject this persona into a running bot instance. The bot will be configured
            with the persona&apos;s identity, scheduled tasks, and skills.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Bot instance selector */}
          <div className="grid gap-2">
            <Label htmlFor="instance">Target Bot Instance</Label>
            {loadingInstances ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading instances...
              </div>
            ) : instances.length === 0 ? (
              <Alert>
                <Bot className="h-4 w-4" />
                <AlertDescription>
                  No running bot instances found. Deploy a bot first to apply personas.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a bot instance" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Required secrets */}
          {template.requiredSecrets.length > 0 && (
            <div className="grid gap-3">
              <Label>Required Secrets</Label>
              {template.requiredSecrets.map((secret) => (
                <div key={secret.key} className="grid gap-1.5">
                  <Label htmlFor={secret.key} className="text-sm font-normal">
                    {secret.label}
                    {secret.description && (
                      <span className="text-muted-foreground ml-1">
                        - {secret.description}
                      </span>
                    )}
                  </Label>
                  <Input
                    id={secret.key}
                    type="password"
                    placeholder={`Enter ${secret.label}`}
                    value={secrets[secret.key] ?? ""}
                    onChange={(e) =>
                      setSecrets({ ...secrets, [secret.key]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {/* Error/success messages */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Persona applied successfully! Redirecting to bot details...
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleInject}
            disabled={loading || !selectedInstance || success}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {success ? "Applied!" : "Apply Persona"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
