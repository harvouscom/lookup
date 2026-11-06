"use client"

// useChurchLookup: Lookup's search engine as a React hook, for building your own church picker.
// The debounce, settled search, "Show more", stale-result handling and record loading all live in
// @/lib/lookup-core, the same engine the <church-lookup> element uses.
import * as React from "react"

import {
  createLookupController,
  type ChurchRecord,
  type ControllerState,
  type Lookup,
  type SearchParams,
  type SearchResult,
} from "@/lib/lookup-core"

export interface UseChurchLookupOptions extends SearchParams {
  /** Your app's name, sent with requests. Use "lookup-demo" while testing. */
  client?: string
  /** Point at another Lookup server. Defaults to https://lookup.heresmychurch.com. */
  baseUrl?: string
  /** Bring your own client, such as one with a custom fetch. */
  lookup?: Lookup
  /** Results arrived. `more` is true when they came from more(). `state` is the search state now. */
  onResults?: (detail: { query: string; results: SearchResult[]; settled: boolean; more: boolean }, state: Readonly<ControllerState>) => void
  /** A search or "Show more" failed. */
  onError?: (error: unknown, query: string) => void
  /** A church is about to be chosen. Return false to cancel. */
  onSelect?: (result: SearchResult) => boolean | void
}

export interface UseChurchLookup extends ControllerState {
  /** Call with what the person typed. */
  search: (text: string) => void
  /** Choose a result by index (the highlighted one by default) and load its full record. */
  choose: (index?: number) => Promise<ChurchRecord | null>
  /** Show the next page of results. Resolves to the rows it added. */
  more: () => Promise<SearchResult[]>
  /** Search the current text again, such as after an error. */
  retry: () => void
  /** Mark a church as chosen without searching, such as a saved one. */
  select: (result: SearchResult | null) => void
  move: (dir: 1 | -1) => void
  highlight: (index: number) => void
  setOpen: (open: boolean) => void
  reset: () => void
  /** The underlying client, for getChurch, meta, contribute and confirm. */
  lookup: Lookup
}

export function useChurchLookup(options: UseChurchLookupOptions = {}): UseChurchLookup {
  const opts = React.useRef(options)
  opts.current = options
  const ctl = React.useMemo(() => {
    const c = createLookupController({
      lookup: opts.current.lookup,
      client: opts.current.client,
      baseUrl: opts.current.baseUrl,
      // Every SearchParams key passes through, read when each search runs.
      params: () => opts.current,
      onChange: (s) => setState({ ...s }),
      onResults: (d) => opts.current.onResults?.(d, c.state),
      onError: (e, q) => opts.current.onError?.(e, q),
      onSelect: (r) => opts.current.onSelect?.(r),
    })
    return c
  }, [])
  const [state, setState] = React.useState<ControllerState>(() => ({ ...ctl.state }))
  React.useEffect(() => () => ctl.destroy(), [ctl])

  return {
    ...state,
    search: ctl.input,
    choose: ctl.choose,
    more: ctl.more,
    retry: ctl.retry,
    select: ctl.select,
    move: ctl.move,
    highlight: ctl.highlight,
    setOpen: (open) => (open ? ctl.open() : ctl.close()),
    reset: ctl.reset,
    lookup: ctl.lookup,
  }
}
