export type ToastLevel = "ok" | "warn" | "error" | "info";

export type ToastItem = {
  id: string;
  level: ToastLevel;
  title: string;
  message: string;
};

export type NotifyFn = (level: ToastLevel, message: unknown, title?: string) => void;
