"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/en";

// The visitor's language for the parts of the page that run in the
// browser. The layout hands down just the one language's lines.

const I18n = createContext<{ locale: Locale; t: Messages } | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  return <I18n.Provider value={{ locale, t: messages }}>{children}</I18n.Provider>;
}

function useI18n() {
  const value = useContext(I18n);
  if (!value) throw new Error("useT outside I18nProvider");
  return value;
}

export function useT(): Messages {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
