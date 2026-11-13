"use client"

// ChurchConsent: after a ChurchLookup fill, offer to share the person's corrections back to Here's My
// Church. Changed fields start checked, each says whether it goes live, is checked automatically or
// goes to the church first (a claimed listing), and nothing is sent until they choose Share (or
// submit the form with a checked data-hmc-share box).
// When nothing changed, it asks "Still correct?" of listings nobody confirmed this year. It also
// offers "Report a problem" and a link to fix anything else on Here's My Church.
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  changeFor,
  consentBadge,
  consentDiff,
  contributable,
  createLookup,
  fieldValue,
  isStale,
  mergeAddress,
  resultText,
  stringsFor,
  suggestUrl,
  type ChurchRecord,
  type FieldStatus,
  type Lookup,
  type Meta,
  type Strings,
} from "@/lib/lookup-core"

export interface ChurchConsentProps {
  /** The record ChurchLookup filled from (its onFill gives it to you). */
  record: ChurchRecord | null
  /**
   * Current form values keyed by Lookup field name, such as React Hook Form's watch(). street, city
   * and postalCode show as one Address row and are sent together.
   */
  values: Record<string, string | null | undefined>
  /** Field labels to show, such as { serviceTimes: "Service times" }. */
  labels?: Record<string, string>
  /** Your app's name. Use "lookup-demo" while testing: shares are checked but never sent. */
  client?: string
  baseUrl?: string
  lookup?: Lookup
  onShared?: (results: { field: string; status: FieldStatus; message?: string; reviewBy?: "church" }[], sandbox: boolean) => void
  /** Text language, such as "es". Defaults to the page's. Load other languages with @/lib/lookup-strings. */
  lang?: string
  /** Override any text. */
  strings?: Partial<Strings>
  className?: string
}

type Result = { status: FieldStatus; message?: string; reviewBy?: "church" }
const REPORTS = ["reportClosed", "reportDuplicate", "reportRelocated"] as const

export function ChurchConsent({ record, values, labels = {}, client, baseUrl, lookup: own, onShared, lang, strings, className }: ChurchConsentProps) {
  const lookup = React.useMemo(() => own ?? createLookup({ client, baseUrl }), [own, client, baseUrl])
  const t = React.useMemo<Strings>(
    () => ({ ...stringsFor(lang ?? (typeof document === "undefined" ? "" : document.documentElement.lang)), ...strings }),
    [lang, strings]
  )
  // Unique per instance, so two panels on a page don't share ids.
  const uid = React.useId()
  const [meta, setMeta] = React.useState<Meta | null>(null)
  // Rows the person unchecked. Changed rows start checked.
  const [off, setOff] = React.useState<Record<string, boolean>>({})
  const [sent, setSent] = React.useState<Map<string, string>>(new Map())
  const [results, setResults] = React.useState<Map<string, Result> | null>(null)
  const [sandbox, setSandbox] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [dismissed, setDismissed] = React.useState("")
  const [confirm, setConfirm] = React.useState<"" | "done" | "failed">("")
  const [reporting, setReporting] = React.useState(false)
  const [reportNote, setReportNote] = React.useState("")

  React.useEffect(() => {
    lookup.meta().then(setMeta, () => setMeta(null))
  }, [lookup])
  // A new church starts a new conversation.
  React.useEffect(() => {
    setOff({})
    setSent(new Map())
    setResults(null)
    setDismissed("")
    setConfirm("")
    setReporting(false)
    setReportNote("")
  }, [record?.id])

  // A checked data-hmc-share box in the submitted form sends the checked changes, without holding up the submit.
  const pending = React.useRef<{ id: string; changes: { field: string; value: unknown }[]; sent: [string, string][] } | null>(null)
  React.useEffect(() => {
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement
      const p = pending.current
      if (!p?.changes.length || !form.querySelector<HTMLInputElement>("[data-hmc-share]")?.checked) return
      lookup.contribute(p.id, p.changes, { keepalive: true }).catch(() => {})
      setSent((s) => new Map([...s, ...p.sent]))
    }
    document.addEventListener("submit", onSubmit, true)
    return () => document.removeEventListener("submit", onSubmit, true)
  }, [lookup])

  if (!record || !meta) {
    pending.current = null
    return null
  }
  const country = String(record.fields.country ?? "")
  const rows = mergeAddress(Object.entries(values).flatMap(([field, v]) => {
    const rule = contributable(meta, field, country)
    if (!rule) return []
    return [{ field, rule, label: labels[field] ?? field, was: (fieldValue(record, field) ?? "").trim(), value: String(v ?? "") }]
  }))
  const changed = consentDiff(rows, sent)
  const sig = changed.map((r) => `${r.field}=${r.value.trim()}`).join("|")
  const shown = results ? rows.filter((r) => results.has(r.field) || changed.includes(r)) : changed
  const sendable = changed.filter((r) => !off[r.field] && r.rule.status !== "coming_soon")
  pending.current = { id: record.id, changes: sendable.map(changeFor), sent: sendable.map((r) => [r.field, r.value.trim()]) }
  const reports = REPORTS.filter((f) => contributable(meta, f, country))
  const fixUrl = suggestUrl(record)

  async function report(field: (typeof REPORTS)[number]) {
    let st: FieldStatus = "try_again"
    let sandboxed = false
    try {
      const out = await lookup.contribute(record!.id, [{ field, value: "true" }])
      st = out.results[0]?.status ?? "try_again"
      sandboxed = Boolean(out.sandbox)
    } catch {
      st = "try_again"
    }
    setReportNote(st === "try_again" || st === "rejected" ? t.st[st] : `${t.reported}${sandboxed ? ` ${t.sandbox}` : ""}`)
  }

  const extras = (reports.length > 0 || fixUrl) && (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {reportNote ? (
        <p role="status">{reportNote}</p>
      ) : reporting ? (
        reports.map((f) => (
          <button key={f} type="button" className="text-primary underline underline-offset-4" onClick={() => void report(f)}>{t.reports[f]}</button>
        ))
      ) : reports.length > 0 ? (
        <button type="button" className="text-primary underline underline-offset-4" aria-expanded={false} onClick={() => setReporting(true)}>{t.report}</button>
      ) : null}
      {fixUrl && <a className="text-primary underline underline-offset-4" href={fixUrl} target="_blank" rel="noopener">{t.moreFixes}</a>}
    </div>
  )

  async function share() {
    const picked = sendable
    if (!picked.length) return
    const changes = picked.map(changeFor)
    setBusy(true)
    let out: { sandbox?: boolean; results: { field: string; status: FieldStatus; message?: string; reviewBy?: "church" }[] }
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
      for (const r of picked) if (map.get(r.field)?.status !== "try_again") next.set(r.field, r.value.trim())
      return next
    })
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
    const ask = isStale(record) && dismissed !== "confirm"
    if (!ask && !extras) return null
    return (
      <div className={box} role="region" aria-label={t.confirmQ}>
        {!ask ? null : confirm ? (
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
        {extras}
      </div>
    )
  }
  if (!results && dismissed === sig) return null
  const canShare = sendable.length > 0
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
          const label = r.parts ? t.address : r.label
          const before = consentBadge(t, r, soon, record.claimed)
          const badge = res ? resultText(t, res) : before.text
          return (
            <li key={r.field} className="bg-background flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2">
              <Checkbox
                id={id}
                checked={!soon && changed.includes(r) && !off[r.field]}
                disabled={soon || !changed.includes(r)}
                onCheckedChange={(v) => setOff((c) => ({ ...c, [r.field]: v !== true }))}
              />
              <label htmlFor={id} className="font-medium">{label}</label>
              <span className="text-muted-foreground min-w-0 flex-1 truncate">
                <s>{r.was || "—"}</s> <span aria-hidden="true">→</span> <ins className="text-foreground no-underline">{sent.get(r.field) ?? r.value.trim()}</ins>
              </span>
              <Badge variant={!res && before.live ? "secondary" : "outline"}>{badge}</Badge>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {sandbox && <p className="text-muted-foreground mr-auto text-xs">{t.sandbox}</p>}
        {!nothingLeft && (
          <Button type="button" size="sm" onClick={share} disabled={!canShare || busy}>
            {busy ? t.sending : canShare ? t.shareN(sendable.length) : t.share}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => { setDismissed(sig); setResults(null) }}>
          {nothingLeft ? t.done : t.notNow}
        </Button>
      </div>
      {extras}
    </div>
  )
}
