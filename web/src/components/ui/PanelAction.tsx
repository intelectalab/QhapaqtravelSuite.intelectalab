"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FormError } from "@/features/auth/AuthForms";
import { Button } from "./Button";
import { SidePanel } from "./SidePanel";

export interface PanelActionState {
  message: string | null;
  done: boolean;
}

interface PanelActionProps<S extends PanelActionState> {
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  formId?: string;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  action: (state: S, form: FormData) => Promise<S>;
  initial: S;
  onDone?: (state: S) => void;
  children: (state: S) => ReactNode;
  footerExtra?: (state: S, pending: boolean) => ReactNode;
  trigger?: (open: () => void) => ReactNode;
  defaultOpen?: boolean;
  testId?: string;
  confirmTestId?: string;
}

export function PanelAction<S extends PanelActionState>({ label, icon, variant = "secondary", size = "md", formId: explicitFormId, title, description, submitLabel, action, initial, onDone, children, footerExtra, trigger, defaultOpen = false, testId, confirmTestId = "dialog-confirm" }: PanelActionProps<S>) {
  const [open, setOpen] = useState(defaultOpen);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (defaultOpen && !open && /(editar|cancelar)=/.test(window.location.search)) window.history.replaceState(null, "", window.location.pathname);
  }, [defaultOpen, open]);
  const [state, run, pending] = useActionState<S, FormData>(async (previous: S, form: FormData) => {
    const next = await action(previous, form);
    if (next.done) {
      setOpen(false);
      setFormKey((key) => key + 1);
      onDone?.(next);
    }
    return next;
  }, initial as Awaited<S>);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget, submitter instanceof HTMLButtonElement ? submitter : null);
    startTransition(() => run(form));
  };
  const formId = explicitFormId ?? `panel-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button variant={variant} size={size} iconOnlyOnMobile icon={icon} onClick={() => setOpen(true)} data-testid={testId}>
          {label}
        </Button>
      )}
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} data-testid="dialog-cancel">
              Cancelar
            </Button>
            {footerExtra?.(state, pending)}
            <Button type="submit" form={formId} variant="primary" disabled={pending} data-testid={confirmTestId}>
              {pending ? "Un momento…" : submitLabel}
            </Button>
          </>
        }
      >
        <form key={formKey} id={formId} onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={state.done ? null : state.message} />
          {children(state)}
        </form>
      </SidePanel>
    </>
  );
}
