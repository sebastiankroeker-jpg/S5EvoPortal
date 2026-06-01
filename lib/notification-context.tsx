"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationVariant = "success" | "error" | "info";

type NotificationInput = {
  title: string;
  description?: string | null;
  variant?: NotificationVariant;
  durationMs?: number;
};

type NotificationItem = NotificationInput & {
  id: string;
  variant: NotificationVariant;
};

type NotificationContextValue = {
  notify: (input: NotificationInput) => void;
  success: (title: string, description?: string | null) => void;
  error: (title: string, description?: string | null) => void;
  info: (title: string, description?: string | null) => void;
  dismiss: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_DURATION_MS: Record<NotificationVariant, number> = {
  success: 4200,
  error: 6500,
  info: 4200,
};

function buildNotificationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const variantStyles: Record<NotificationVariant, string> = {
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-950 dark:text-emerald-50",
  error: "border-destructive/30 bg-destructive/10 text-foreground",
  info: "border-primary/20 bg-primary/10 text-foreground",
};

const iconStyles: Record<NotificationVariant, string> = {
  success: "text-emerald-600 dark:text-emerald-300",
  error: "text-destructive",
  info: "text-primary",
};

function NotificationViewport({
  notifications,
  onDismiss,
}: {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[10000] flex justify-center px-3 pb-20 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:block sm:px-0 sm:pb-0">
      <div className="flex w-full max-w-md flex-col gap-2 sm:w-96">
        <AnimatePresence initial={false}>
          {notifications.map((notification) => {
            const Icon =
              notification.variant === "success"
                ? CheckCircle2
                : notification.variant === "error"
                  ? XCircle
                  : Info;

            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={cn(
                  "pointer-events-auto rounded-xl border shadow-lg backdrop-blur-sm",
                  variantStyles[notification.variant],
                )}
              >
                <div className="flex items-start gap-3 p-3.5">
                  <div className={cn("mt-0.5 shrink-0", iconStyles[notification.variant])}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-5">{notification.title}</div>
                    {notification.description ? (
                      <div className="mt-1 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                        {notification.description}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="mt-[-2px] shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onDismiss(notification.id)}
                    aria-label="Hinweis schliessen"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutIdsRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }

    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    ({ title, description, variant = "info", durationMs }: NotificationInput) => {
      const id = buildNotificationId();
      const item: NotificationItem = {
        id,
        title,
        description,
        variant,
      };

      setNotifications((current) => [...current.slice(-2), item]);

      const timeoutId = window.setTimeout(
        () => dismiss(id),
        durationMs ?? DEFAULT_DURATION_MS[variant],
      );
      timeoutIdsRef.current.set(id, timeoutId);
    },
    [dismiss],
  );

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;

    return () => {
      for (const timeoutId of timeoutIds.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutIds.clear();
    };
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notify,
      dismiss,
      success: (title, description) => notify({ title, description, variant: "success" }),
      error: (title, description) => notify({ title, description, variant: "error" }),
      info: (title, description) => notify({ title, description, variant: "info" }),
    }),
    [dismiss, notify],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationViewport notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }

  return context;
}
