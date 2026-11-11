import { ArrowUpRight, History, Info } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { TintCardTitle } from "@/components/ui/Tinted";
import { HELP_ACTIONS, ORIGIN_TONES, type HelpArticle, type HelpRealm } from "@/lib/help";
import { formatDateTime } from "@/lib/format";
import { HelpArticleBody } from "./HelpArticleBody";
import { HelpEditAction, HelpStatusActions, type HelpActionSet } from "./HelpArticleForms";
import { HelpLinkList } from "./HelpButton";

export function HelpArticleView({ article, realm, actions, editing = false }: { article: HelpArticle; realm: HelpRealm; actions: HelpActionSet; editing?: boolean }) {
  const roles = article.roles.map((role) => article.options?.roles.find((option) => option.value === role)?.label ?? role);
  const opensScreen = article.status === "published";

  return (
    <>
      <PageHeader
        back={{ href: realm.centerHref, label: "Centro de ayuda" }}
        title={article.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="t1" dot={false}>
              {article.module}
            </Badge>
            <Badge tone={ORIGIN_TONES[article.origin]}>{article.origin_label}</Badge>
            {article.status === "archived" && <Badge tone="mute">Archivado</Badge>}
          </span>
        }
        actions={article.can_manage && article.status === "published" ? <HelpEditAction article={article} actions={actions} defaultOpen={editing} /> : undefined}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-6">
          <HelpArticleBody summary={article.summary} steps={article.steps} faqs={article.faqs} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <TintCardTitle icon={Info} title="Sobre este artículo" />
            <FieldList
              fields={[
                { label: "Pantalla", value: <code className="text-[12.5px]">{article.screen}</code> },
                { label: "Origen", value: article.origin_label },
                { label: "Para", value: roles.length > 0 ? roles.join(", ") : "Todos los roles con acceso" },
                { label: "Actualizado", value: formatDateTime(article.updated_at) },
              ]}
            />
            {opensScreen && (realm.platform ? article.audience === "platform" : true) && (
              <Button href={article.screen} variant="secondary" size="sm" className="mt-3 w-full" icon={<ArrowUpRight size={15} />}>
                Ir a la pantalla
              </Button>
            )}
            {article.can_manage && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-2 pt-3">
                <HelpStatusActions article={article} actions={actions} platform={realm.platform} />
              </div>
            )}
          </Card>
          {article.related.length > 0 && (
            <Card>
              <HelpLinkList title="Del mismo módulo" items={article.related} realm={realm} />
            </Card>
          )}
          {article.can_manage && article.history.length > 0 && (
            <Card>
              <TintCardTitle icon={History} title="Historial de cambios" />
              <ol className="flex flex-col gap-2.5">
                {article.history.map((entry) => (
                  <li key={entry.code} className="border-l-2 border-accent/30 pl-3">
                    <b className="block text-[13px] font-semibold">{HELP_ACTIONS[entry.action] ?? entry.action}</b>
                    <span className="block text-[12px] text-fg-3">
                      {entry.actor ?? "Sistema"} · {formatDateTime(entry.at)}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
