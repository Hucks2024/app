import type { Locale } from "@/i18n/config";
import en, { type Messages } from "./en";
import zh from "./zh";
import hi from "./hi";
import es from "./es";
import fr from "./fr";

export type { Messages };

// Only ever imported on the server: a page gets just its own language.
export const MESSAGES: Record<Locale, Messages> = { en, zh, hi, es, fr };
