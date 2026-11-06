"use client"

// ChurchConsent: after a ChurchLookup fill, offer to share the person's corrections back to Here's My
// Church. Every change starts unchecked, each says whether it goes live or waits for a moderator,
// and nothing is sent until they choose Share. When nothing changed, it offers "Still correct".
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  consentDiff,
  contributable,
  createLookup,
  fieldValue,
  stringsFor,
  type ChurchRecord,
  type FieldStatus,
  type Lookup,
  type Meta,
  type Strings,
} from "@/lib/lookup-core"

export interface ChurchConsentProps {
  /** The record ChurchLookup filled from (its onFill gives it to you). */
  record: ChurchRecord | null
  /** Current form values keyed by Lookup field name, such as React Hook Form's watch(). */
  values: Record<string, string | null | undefined>
  /** Field labels to show, such as { serviceTimes: "Service times" }. */
  labels?: Record<string, string>
  /** Your app's name. Use "lookup-demo" while testing: shares are checked but never sent. */
  client?: string
  baseUrl?: string
  lookup?: Lookup
  onShared?: (results: { field: string; status: FieldStatus; message?: string }[], sandbox: boolean) => void
  /** Text language, such as "es". Defaults to the page's. Load other languages with @/lib/lookup-strings. */
  lang?: string
  /** Override any text. */
  strings?: Partial<Strings>
  className?: string
}

type Result = { status: FieldStatus; message?: string }

export function ChurchConsent({ record, values, labels = {}, client, baseUrl, lookup: own, onShared, lang, strings, className }: ChurchConsentProps) {
  const lookup = React.useMemo(() => own ?? createLookup({ client, baseUrl }), [own, client, baseUrl])
  const t = React.useMemo<Strings>(
    () => ({ ...stringsFor(lang ?? (typeof document === "undefined" ? "" : document.documentElement.lang)), ...strings }),
    [lang, strings]
  )
  // Unique per instance, so two panels on a page don't share ids.
  const uid = React.useId()
  const [meta, setMeta] = React.useState<Meta | null>(null)
  const [checked, setChecked] = React.useState<Record<string, boolean>>({})
  const [sent, setSent] = React.useState<Map<string, string>>(new Map())
  const [results, setResults] = React.useState<Map<string, Result> | null>(null)
  const [sandbox, setSandbox] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [dismissed, setDismissed] = React.useState("")
  const [confirm, setConfirm] = React.useState<"" | "done" | "failed">("")

  React.useEffect(() => {
    lookup.meta().then(setMeta, () => setMeta(null))
  }, [lookup])
  // A new church starts a new conversation.
  React.useEffect(() => {
    setChecked({})
    setSent(new Map())
    setResults(null)
    setDismissed("")
    setConfirm("")
  }, [record?.id])

  if (!record || !meta) return null
  const country = String(record.fields.country ?? "")
  const rows = Object.entries(values).flatMap(([field, v]) => {
    const rule = contributable(meta, field, country)
    if (!rule) return []
    return [{ field, rule, label: labels[field] ?? field, was: (fieldValue(record, field) ?? "").trim(), value: String(v ?? "") }]
  })
  const changed = consentDiff(rows, sent)
  const sig = changed.map((r) => `${r.field}=${r.value.trim()}`).join("|")
  const shown = results ? rows.filter((r) => results.has(r.field) || changed.includes(r)) : changed

  async function share() {
    const picked = changed.filter((r) => checked[r.field] && r.rule.status !== "coming_soon")
    if (!picked.length) return
    const changes = picked.map((r) => ({ field: r.field, value: r.value.trim() }))
    setBusy(true)
    let out: { sandbox?: boolean; results: { field: string; status: FieldStatus; message?: string }[] }
    try {
      out = await lookup.contribute(record!.id, changes)
    } catch {
      out = { results: changes.map((c) => ({ field: c.field, status: "try_again" as const })) }
    }
    setBusy(false)
    const map = new Map(out.results.map((r) => [r.field, r]))
    setResults(map)
    setSandbox(Boolean(out.sandbox))
    setSent((s) => {
      const next = new Map(s)
      for (const c of changes) if (map.get(c.field)?.status !== "try_again") next.set(c.field, c.value)
      return next
    })
    setChecked({})
    onShared?.(out.results, Boolean(out.sandbox))
  }

  async function stillCorrect() {
    try {
      const r = await lookup.confirm(record!.id)
      setConfirm(r.status === "confirmed" ? "done" : "failed")
    } catch {
      setConfirm("failed")
    }
  }

  const box = cn("bg-muted/40 rounded-lg border p-4 text-sm", className)

  if (!changed.length && !results) {
    if (dismissed === "confirm") return null
    return (
      <div className={box} role="region" aria-label={t.confirmQ}>
        {confirm ? (
          <p role="status">{confirm === "done" ? t.thanks : t.st.try_again}</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>{t.confirmQ}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={stillCorrect}>{t.stillCorrect}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed("confirm")}>{t.notNow}</Button>
            </div>
          </div>
        )}
      </div>
    )
  }
  if (!results && dismissed === sig) return null
  const canShare = changed.some((r) => checked[r.field] && r.rule.status !== "coming_soon")
  const nothingLeft = results && !changed.some((r) => r.rule.status !== "coming_soon")

  return (
    <div className={box} role="region" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className="font-medium">{t.shareTitle}</h3>
      <p className="text-muted-foreground mt-1">{t.shareBody}</p>
      <ul className="mt-3 grid gap-2">
        {shown.map((r) => {
          const res = results?.get(r.field)
          const soon = r.rule.status === "coming_soon"
          const id = `${uid}-${r.field}`
          const badge = res
            ? res.status === "rejected" && res.message ? `${t.st.rejected}: ${res.message}` : t.st[res.status]
            : soon ? t.soon : r.rule.review === "moderated" ? t.reviewed : t.goesLive
          return (
            <li key={r.field} className="bg-background flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2">
              <Checkbox
                id={id}
                checked={Boolean(checked[r.field])}
                disabled={soon || (Boolean(res) && res!.status !== "try_again" && !changed.includes(r))}
                onCheckedChange={(v) => setChecked((c) => ({ ...c, [r.field]: v === true }))}
              />
              <label htmlFor={id} className="font-medium">{r.label}</label>
              <span className="text-muted-foreground min-w-0 flex-1 truncate">
                <s>{r.was || "—"}</s> <span aria-hidden="true">→</span> <ins className="text-foreground no-underline">{sent.get(r.field) ?? r.value.trim()}</ins>
              </span>
              <Badge variant={!res && !soon && r.rule.review === "live" ? "secondary" : "outline"}>{badge}</Badge>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {sandbox && <p className="text-muted-foreground mr-auto text-xs">{t.sandbox}</p>}
        {!nothingLeft && (
          <Button type="button" size="sm" onClick={share} disabled={!canShare || busy}>
            {busy ? t.sending : t.share}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => { setDismissed(sig); setResults(null) }}>
          {nothingLeft ? t.done : t.notNow}
        </Button>
      </div>
    </div>
  )
}
