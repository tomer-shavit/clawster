import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const envStyles: Record<string, string> = {
  prod: "bg-green-100 text-green-700 border-green-200",
  staging: "bg-blue-100 text-blue-700 border-blue-200",
  dev: "bg-amber-100 text-amber-700 border-amber-200",
};

interface EnvironmentBadgeProps {
  environment: string;
  className?: string;
}

export function EnvironmentBadge({ environment, className }: EnvironmentBadgeProps) {
  const env = environment.toLowerCase();
  const style = envStyles[env] || "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <Badge
      variant="outline"
      className={cn("text-xs px-1.5 py-0 font-medium", style, className)}
    >
      {environment}
    </Badge>
  );
}
