import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const rawBaseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "";

export const apiBaseUrl =
  rawBaseUrl.length > 0 && rawBaseUrl !== "/"
    ? rawBaseUrl.replace(/\/$/, "")
    : "";

export const apiUrl = (path: string): string =>
  `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDateTime = (value?: string): string => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

