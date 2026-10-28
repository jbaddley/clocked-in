"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { DialogFooter } from "@/components/ui/dialog";

const DialogActionsContext = createContext<{
  target: HTMLElement | null;
  setTarget: (node: HTMLElement | null) => void;
} | null>(null);

export function DialogActionsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <DialogActionsContext.Provider value={value}>{children}</DialogActionsContext.Provider>;
}

export function DialogActionsSlot() {
  const context = useContext(DialogActionsContext);
  if (!context) return null;
  return <div ref={context.setTarget} className="empty:hidden" />;
}

export function DialogActions({
  children,
  className,
  form,
}: {
  children: ReactNode;
  className?: string;
  form?: string;
}) {
  const context = useContext(DialogActionsContext);
  const actions = form ? withForm(children, form) : children;
  if (context) {
    if (!context.target) return null;
    return createPortal(<DialogFooter className={className}>{actions}</DialogFooter>, context.target);
  }

  return <div className={cn("flex justify-end gap-2", className)}>{actions}</div>;
}

function withForm(children: ReactNode, form: string) {
  return Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<{ form?: string }>;
    return element.props.form ? element : cloneElement(element, { form });
  });
}
