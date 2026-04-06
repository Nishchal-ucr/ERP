import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
}

export function AppHeader({ title, onBack }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex items-center gap-2 p-4">
        {onBack && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Back"
            onClick={onBack}
          >
            <ArrowLeft className="size-5" />
          </Button>
        )}

        <div className="text-lg font-semibold">{title}</div>
      </div>
    </header>
  );
}
