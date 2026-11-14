import { UserLock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface ScopeDeniedProps {
  message: string;
  back: { href: string; label: string };
}

export function ScopeDenied({ message, back }: ScopeDeniedProps) {
  return (
    <div className="pt-8" data-testid="scope-denied">
      <Card>
        <EmptyState
          icon={<UserLock size={22} />}
          title="Registro fuera de tu cartera"
          description={message}
          action={
            <Button href={back.href} variant="primary">
              {back.label}
            </Button>
          }
        />
      </Card>
    </div>
  );
}
