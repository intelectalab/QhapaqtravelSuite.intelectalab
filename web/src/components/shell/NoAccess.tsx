import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestAccessButton } from "@/features/account/RequestAccessButton";

interface NoAccessProps {
  home: string;
  path?: string;
  permissions?: string[];
  requestable?: boolean;
}

export function NoAccess({ home, path, permissions = [], requestable = false }: NoAccessProps) {
  return (
    <div className="pt-8" data-testid="forbidden-page">
      <Card>
        <EmptyState
          icon={<Lock size={22} />}
          title="Esta sección no está disponible para tu rol"
          description="Si la necesitas para tu trabajo, pide a la administración de tu agencia que te dé acceso."
          action={
            <Button href={home} variant="primary">
              Ir al inicio
            </Button>
          }
        />
        {(path || permissions.length > 0) && (
          <dl className="mx-auto mb-8 grid max-w-sm gap-1.5 text-center text-[12.5px] text-fg-3">
            {path && (
              <div>
                <dt className="inline">Ruta: </dt>
                <dd className="inline font-mono text-fg-2" data-testid="forbidden-requested-path">
                  {path}
                </dd>
              </div>
            )}
            {permissions.length > 0 && (
              <div>
                <dt className="inline">Permiso necesario: </dt>
                <dd className="inline font-mono text-fg-2" data-testid="forbidden-required-perms">
                  {permissions.join(", ")}
                </dd>
              </div>
            )}
          </dl>
        )}
        {requestable && path && <RequestAccessButton path={path} />}
      </Card>
    </div>
  );
}
