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
import { EN, findTargets, fillTargets, type ChurchRecord, type FillPlan, type SearchResult } from "@/lib/lookup-core"

export interface ChurchLookupProps extends UseChurchLookupOptions {
  /** Submit the chosen church's ID under this name in a plain form. */
  name?: string
  /** The chosen church's ID. Set it to show a saved church, as on an edit screen. */
  value?: string
  /** Called with the church ID when a church is chosen, and with "" when cleared. */
  onChange?: (id: string) => void
  onBlur?: () => void
  /** Called with the full record after a pick, before or instead of the form fill. */
  onFill?: (record: ChurchRecord, plan: FillPlan | null) => void
  /** Fill fields tagged data-hmc-field in the enclosing form. Defaults to true. */
  fill?: boolean
  /** Replace fields that already have values. */
  overwrite?: boolean
  /** The accessible name. Defaults to "Church". */
  label?: string
  placeholder?: string
  id?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

const inputClass =
  "placeholder:text-muted-foreground dark:bg-input/30 border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent py-1 pr-9 pl-9 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"

export const ChurchLookup = React.forwardRef<HTMLInputElement, ChurchLookupProps>(function ChurchLookup(
  { name, value, onChange, onBlur, onFill, fill = true, overwrite, label = EN.label, placeholder = EN.placeholder, id, disabled, className, ...rest },
  ref
) {
  const {
    client, baseUrl, lookup: own, region, country, near, limit, geo, onResults,
    "aria-invalid": invalid, "aria-describedby": describedBy,
  } = rest
  const lookup = useChurchLookup({ client, baseUrl, lookup: own, region, country, near, limit, geo, onResults })
  const [text, setText] = React.useState("")
  const [status, setStatus] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(ref, () => inputRef.current!)
  const chosenId = lookup.selected?.id ?? ""

  // cmdk always marks its input expanded and sets its own id; keep both true to this field, so the
  // popup state is announced and a shadcn FormLabel (htmlFor) points at the input.
  React.useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.setAttribute("aria-expanded", String(lookup.open))
    if (id) input.id = id
  })

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
      })
      .catch(() => live && setStatus(EN.loadFail))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function type(next: string) {
    setText(next)
    const had = chosenId
    lookup.search(next)
    if (had && next.trim() !== lookup.selected?.name) onChange?.("")
  }

  async function pick(index: number) {
    const result = lookup.results[index]
    if (!result) return
    setText(result.name)
    let record: ChurchRecord | null
    try {
      record = await lookup.choose(index)
    } catch {
      setStatus(EN.loadFail)
      return
    }
    if (!record) return
    onChange?.(record.id)
    const form = wrapRef.current?.closest("form")
    const plan = fill && form ? fillTargets(record, findTargets(form), { overwrite }) : null
    onFill?.(record, plan)
    if (plan) setStatus(EN.filled(plan.changes.length, plan.empty))
  }

  function clear() {
    lookup.reset()
    setText("")
    onChange?.("")
    inputRef.current?.focus()
  }

  const showEmpty = !lookup.loading && lookup.results.length === 0 && lookup.query.length >= 2

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)} data-slot="church-lookup">
      <Command shouldFilter={false} loop label={label} className="h-auto overflow-visible bg-transparent">
        <Popover open={lookup.open} onOpenChange={lookup.setOpen}>
          <PopoverAnchor asChild>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
              <CommandPrimitive.Input
                ref={inputRef}
                value={text}
                onValueChange={type}
                onBlur={onBlur}
                onFocus={() => lookup.results.length > 0 && lookup.setOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={inputClass}
              />
              {lookup.loading ? (
                <LoaderCircle className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" aria-hidden="true" />
              ) : chosenId ? (
                <button
                  type="button"
                  onClick={clear}
                  disabled={disabled}
                  aria-label={EN.clear}
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
            aria-label="Church results"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (wrapRef.current?.contains(e.target as Node)) e.preventDefault()
            }}
          >
            <CommandList className="max-h-80">
              {lookup.error ? (
                <p className="text-muted-foreground px-3 py-4 text-sm">{EN.error}</p>
              ) : showEmpty ? (
                <p className="text-muted-foreground px-3 py-4 text-sm">
                  {EN.none}
                  <a className="text-foreground underline underline-offset-4" href="https://heresmychurch.com" target="_blank" rel="noopener">
                    {EN.add}
                  </a>
                </p>
              ) : null}
              {lookup.results.length > 0 && (
                <CommandGroup>
                  {lookup.results.map((r, i) => (
                    <CommandItem key={r.id} value={r.id} onSelect={() => void pick(i)} className="group gap-3 py-2">
                      <span className="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-md">
                        <Church className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.name}</span>
                        <span className="text-muted-foreground group-data-[selected=true]:text-foreground/75 block truncate text-xs">{r.locationLabel}</span>
                      </span>
                      {r.distanceKm != null && (
                        <span className="text-muted-foreground group-data-[selected=true]:text-foreground/75 shrink-0 text-xs tabular-nums">
                          {r.distanceKm < 10 ? r.distanceKm : Math.round(r.distanceKm)} km
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            <div className="text-muted-foreground flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
              <span>
                {EN.dataFrom}{" "}
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
        {status || (lookup.open && lookup.results.length ? EN.found(lookup.results.length) : "")}
      </span>
    </div>
  )
})
