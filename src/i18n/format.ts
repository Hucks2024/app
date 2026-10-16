import { Fragment, createElement, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages/en";

// Filling in a translated line, the same on the server and in the browser.

type Vars = Record<string, string | number>;

/** "{name} is going" with the gaps filled in. */
export function fill(template: string, vars: Vars): string {
  return template.replace(/\{(\w+)\}/g, (gap, key: string) => (key in vars ? String(vars[key]) : gap));
}

/** A line that changes with a number: "1 meetup", "2 meetups". Chinese
 * has one form; the rest have one for 1 (French for 0 and 1 too). */
export type Plural = { one: string; other: string };

/** Which of the two forms a number takes, still with its gaps. */
export function pick(forms: Plural, n: number, locale: Locale): string {
  return new Intl.PluralRules(locale).select(n) === "one" ? forms.one : forms.other;
}

export function plural(forms: Plural, n: number, locale: Locale, vars: Vars = {}): string {
  return fill(pick(forms, n, locale), { n, ...vars });
}

/** A line with links or bold bits in it, wherever this language puts
 * them: each {name} in the text becomes parts.name. */
export function rich(template: string, parts: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((piece, i) => {
    const key = piece.match(/^\{(\w+)\}$/)?.[1];
    return createElement(Fragment, { key: i }, key && key in parts ? parts[key] : piece);
  });
}

/** A meetup type's name in this language ("Walk / hike"); a type the
 * lines don't know reads as "Something else". */
export function typeName(t: Messages, value: string): string {
  const names: Record<string, string> = t.types;
  return names[value] ?? names.SOCIAL;
}

/** An example for the comment that fits the type: coffee gets a coffee
 * one, not "bring water". */
export function commentHint(t: Messages, value: string): string {
  const hints: Record<string, string> = t.commentHints;
  return hints[value] ?? hints.SOCIAL;
}

/** A check's message in this language: the name of one of t.errors (the
 * schemas use names, since they're written before anyone's language is
 * known), or failing that the fallback. */
export function errorText(t: Messages, code: string | undefined, fallback?: string): string {
  const found = code ? (t.errors as Record<string, unknown>)[code] : undefined;
  return typeof found === "string" ? found : fallback || t.errors.notRight;
}
