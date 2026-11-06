"use client"

// ChurchLookup: a church search box for shadcn/ui apps. Pick a church and the form's fields fill
// from Here's My Church. Works with plain forms (a hidden input submits the church ID), controlled
// state, and React Hook Form (spread a FormField's `field` onto it).
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { Church, LoaderCircle, Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { useChurchLookup, type UseChurchLookupOptions } from "@/hooks/use-church-lookup"
import {
  applyFill,
  findTargets,
  matchField,
  planFill,
  stringsFor,
  type ChurchRecord,
  type FillPlan,
  type LookupError,
  type SearchResult,
  type Strings,
} from "@/lib/lookup-core"

export interface ChurchLookupProps extends Omit<UseChurchLookupOptions, "onError"> {
  /** Submit the chosen church's ID under this name in a plain form. */
  name?: string
  /** The chosen church's ID. Set it to show a saved church, as on an edit screen. */
  value?: string
  /** Called with the church ID when a church is chosen, and with "" when cleared. */
  onChange?: (id: string) => void
  onBlur?: () => void
  /** The choice was cleared, with the clear button or by editing the name. */
  onClear?: () => void
  /**
   * A church was chosen and its record loaded. Called before the form fills, with what would change
   * (null when nothing fills). Return false to fill the form yourself.
   */
  onFill?: (record: ChurchRecord, plan: FillPlan | null) => boolean | void
  /** A search, "Show more" or a church's record failed, such as for logging. */
  onError?: (error: LookupError | unknown, detail: { query?: string; id?: string }) => void
  /**
   * Which fields to fill: tagged with data-hmc-field or named for the church (church_city), by
   * default. "auto" also fills plain names like city or zip; "tagged" only tagged ones; false none.
   */
  fill?: boolean | "auto" | "tagged"
  /** Fill from `value` when it's first shown, as when a saved church should refresh the form. */
  fillOnLoad?: boolean
  /** The id of the form to fill. Defaults to the enclosing form, then the whole page. */
  form?: string
  /** Replace fields that already have values. */
  overwrite?: boolean
  /** The form won't submit until a church is chosen from the list. */
  required?: boolean
  /** Text language, such as "es". Defaults to the page's. Load other languages with @/lib/lookup-strings. */
  lang?: string
  /** Override any text, such as { label: "Your parish" }. */
  strings?: Partial<Strings>
  /** The accessible name. Defaults to "Church". */
  label?: string
  placeholder?: string
  /** "compact" rows (the default) or "comfortable" ones with larger icons. */
  density?: "compact" | "comfortable"
  /** The icon beside each result, or null for none. Defaults to a church. */
  icon?: React.ReactNode
  /** The icon in the search box. */
  searchIcon?: React.ReactNode
  /** Show how far each church is. Defaults to true. */
  showDistance?: boolean
  id?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

const inputClass =
  "placeholder:text-muted-foreground dark:bg-input/30 border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent py-1 pr-9 pl-9 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

const MORE = "__more"
// Layout effects warn during server rendering; on the server there's nothing to lay out anyway.
const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

export const ChurchLookup = React.forwardRef<HTMLInputElement, ChurchLookupProps>(function ChurchLookup(
  {
    name, value, onChange, onBlur, onClear, onFill, onError, fill = true, fillOnLoad, form, overwrite, required, lang, strings,
    label, placeholder, density = "compact", icon, searchIcon, showDistance = true, id, disabled, className,
    "aria-invalid": invalid, "aria-describedby": describedBy, onResults, onSelect, ...search
  },
  ref
) {
  const t = React.useMemo<Strings>(
    () => ({ ...stringsFor(lang ?? (typeof document === "undefined" ? "" : document.documentElement.lang)), ...strings }),
    [lang, strings]
  )
  const shown = React.useRef(0)
  const [announce, setAnnounce] = React.useState("")
  const lookup = useChurchLookup({
    ...search,
    onSelect,
    onError: (e, query) => {
      setAnnounce(t.error)
      onError?.(e, { query })
    },
    onResults: (d, st) => {
      const n = d.results.length
      setAnnounce(
        d.more ? t.moreFound(n - shown.current)
          : n ? (st.corrected ? `${t.corrected(st.corrected)}. ` : "") + t.found(n)
          : t.noneShort
      )
      shown.current = n
      onResults?.(d, st)
    },
  })
  const [text, setText] = React.useState("")
  // cmdk's highlighted item, kept here so "Show more" can move it to the first new church.
  const [active, setActive] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(ref, () => inputRef.current!)
  const chosenId = lookup.selected?.id ?? ""
  const comfy = density === "comfortable"

  // cmdk always marks its input expanded and sets its own id; keep both true to this field, so the
  // popup state is announced and a shadcn FormLabel (htmlFor) points at the input.
  useIsoLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.setAttribute("aria-expanded", String(lookup.open))
    if (id) input.id = id
  })

  // Required: the form won't submit until a church is chosen, with a message on the search box.
  React.useEffect(() => {
    inputRef.current?.setCustomValidity(required && !chosenId ? t.required : "")
  }, [required, chosenId, t])

  function targets() {
    const scope = (form && document.getElementById(form)) || wrapRef.current?.closest("form")
    const generic = fill === "auto" && Boolean(scope)
    return findTargets(scope || document, fill === "tagged" ? undefined : (el) => matchField(el, generic))
  }

  function fillFrom(record: ChurchRecord) {
    const plan = fill ? planFill(record, targets(), { overwrite }) : null
    if (onFill?.(record, plan) === false || !plan) return
    applyFill(plan.changes)
    setAnnounce(t.filled(plan.changes.length, plan.empty))
  }

  // A value set from outside (a saved church, or a form reset) shows that church.
  React.useEffect(() => {
    if ((value ?? "") === chosenId) return
    if (!value) {
      lookup.select(null)
      setText("")
      return
    }
    let live = true
    lookup.lookup
      .getChurch(value)
      .then((r) => {
        if (!live) return
        const n = String(r.fields.name ?? "")
        lookup.select({ id: r.id, name: n, label: n, locationLabel: "" } as SearchResult)
        setText(n)
        // A saved ID whose listing merged into another: hand back the new ID to store.
        if (r.id !== value) onChange?.(r.id)
        if (fillOnLoad) fillFrom(r)
      })
      .catch((e) => {
        if (!live) return
        setAnnounce(t.loadFail)
        onError?.(e, { id: value })
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function type(next: string) {
    setText(next)
    setAnnounce("")
    const had = chosenId
    lookup.search(next)
    if (had && next.trim() !== lookup.selected?.name) {
      onChange?.("")
      onClear?.()
    }
  }

  // cmdk refocuses its input by the id it gave it whenever the highlight moves. The id is the form's
  // here (so FormLabel points at it), so cmdk focuses the list instead: put focus back in the box.
  function highlight(v: string) {
    setActive(v)
    const focused = document.activeElement
    if (focused && focused !== inputRef.current && (focused === listRef.current || wrapRef.current?.contains(focused))) {
      inputRef.current?.focus({ preventScroll: true })
    }
  }

  async function more() {
    const added = await lookup.more()
    if (added[0]) setActive(added[0].id)
  }

  async function pick(index: number) {
    const result = lookup.results[index]
    if (!result) return
    setText(result.name)
    let record: ChurchRecord | null
    try {
      record = await lookup.choose(index)
    } catch (e) {
      setAnnounce(t.loadFail)
      onError?.(e, { id: result.id })
      return
    }
    if (!record) return
    onChange?.(record.id)
    fillFrom(record)
  }

  function clear() {
    lookup.reset()
    setText("")
    onChange?.("")
    onClear?.()
    inputRef.current?.focus()
  }

  const showEmpty = !lookup.loading && !lookup.error && lookup.results.length === 0 && lookup.query.length >= (search.minChars ?? 2)
  const churchIcon = icon === undefined ? <Church className={comfy ? "size-5" : "size-4"} aria-hidden="true" /> : icon

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)} data-slot="church-lookup">
      <Command shouldFilter={false} loop label={label ?? t.label} value={active} onValueChange={highlight} className="h-auto overflow-visible bg-transparent">
        <Popover open={lookup.open} onOpenChange={lookup.setOpen}>
          <PopoverAnchor asChild>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 grid size-4 -translate-y-1/2 place-items-center [&_svg]:size-4" aria-hidden="true">
                {searchIcon ?? <Search />}
              </span>
              <CommandPrimitive.Input
                ref={inputRef}
                value={text}
                onValueChange={type}
                onBlur={onBlur}
                onFocus={() => lookup.results.length > 0 && lookup.setOpen(true)}
                onKeyDown={(e) => {
                  // Down on "Show more" loads more instead of wrapping to the top.
                  if (e.key === "ArrowDown" && active === MORE && lookup.hasMore) {
                    e.preventDefault()
                    void more()
                  } else if (e.key === "Enter" && lookup.error) {
                    e.preventDefault()
                    lookup.retry()
                  }
                }}
                placeholder={placeholder ?? t.placeholder}
                disabled={disabled}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                aria-required={required || undefined}
                className={inputClass}
              />
              {lookup.loading ? (
                <LoaderCircle className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin motion-reduce:animate-[spin_2s_linear_infinite]" aria-hidden="true" />
              ) : chosenId ? (
                <button
                  type="button"
                  onClick={clear}
                  disabled={disabled}
                  aria-label={t.clear}
                  className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-sm outline-none focus-visible:ring-[3px]"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-(--radix-popover-trigger-width) min-w-[280px] p-0"
            aria-label={t.label}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (wrapRef.current?.contains(e.target as Node)) e.preventDefault()
            }}
          >
            {lookup.corrected && lookup.results.length > 0 && (
              <p className="text-muted-foreground px-3 pt-2 text-xs" data-slot="church-lookup-corrected">{t.corrected(lookup.corrected)}</p>
            )}
            <CommandList ref={listRef} className="max-h-[min(60vh,26rem)]">
              {lookup.error ? (
                <div className="text-muted-foreground px-3 py-4 text-sm">
                  <p>{t.error}</p>
                  <button type="button" onClick={lookup.retry} className="text-foreground hover:bg-accent mt-2 rounded-md border px-3 py-1.5 font-medium">
                    {t.retry}
                  </button>
                </div>
              ) : showEmpty ? (
                <p className="text-muted-foreground px-3 py-4 text-sm">
                  {t.none}
                  <a className="text-foreground underline underline-offset-4" href="https://heresmychurch.com" target="_blank" rel="noopener">
                    {t.add}
                  </a>
                </p>
              ) : null}
              {lookup.results.length > 0 && (
                <CommandGroup>
                  {lookup.results.map((r, i) => (
                    <CommandItem
                      key={r.id}
                      value={r.id}
                      onSelect={() => void pick(i)}
                      className={cn("group", comfy ? "min-h-14 gap-3 py-2" : "min-h-11 gap-2.5 py-1")}
                    >
                      {churchIcon !== null && (
                        <span className={cn("bg-primary/10 text-primary grid shrink-0 place-items-center rounded-md", comfy ? "size-10" : "size-7")}>
                          {churchIcon}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cn("block font-medium", comfy ? "text-[0.9375rem]" : "truncate")}>{r.name}</span>
                        <span className="text-muted-foreground group-data-[selected=true]:text-foreground/75 block truncate text-xs">{r.locationLabel}</span>
                      </span>
                      {showDistance && r.distanceKm != null && (
                        <span className="text-muted-foreground group-data-[selected=true]:text-foreground/75 shrink-0 text-xs tabular-nums">
                          {r.distanceKm < 10 ? r.distanceKm : Math.round(r.distanceKm)} km
                        </span>
                      )}
                    </CommandItem>
                  ))}
                  {lookup.hasMore && (
                    <CommandItem
                      value={MORE}
                      onSelect={() => void more()}
                      disabled={lookup.loadingMore}
                      className="text-primary min-h-11 justify-center font-medium"
                    >
                      {lookup.loadingMore ? t.loading : t.more}
                    </CommandItem>
                  )}
                </CommandGroup>
              )}
            </CommandList>
            <div className="text-muted-foreground flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
              <span>
                {t.dataFrom}{" "}
                <a className="text-foreground font-medium" href="https://heresmychurch.com" target="_blank" rel="noopener">
                  Here’s My Church
                </a>
              </span>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
                © OpenStreetMap
              </a>
            </div>
          </PopoverContent>
        </Popover>
      </Command>
      {name ? <input type="hidden" name={name} value={chosenId} /> : null}
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  )
})
