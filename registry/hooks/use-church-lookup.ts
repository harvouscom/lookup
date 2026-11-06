"use client"

// useChurchLookup: Lookup's search engine as a React hook, for building your own church picker.
// The debounce, settled search, stale-result handling and record loading all live in
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
  /** Results arrived. */
  onResults?: (detail: { query: string; results: SearchResult[]; settled: boolean }) => void
}

export interface UseChurchLookup extends ControllerState {
  /** Call with what the person typed. */
  search: (text: string) => void
  /** Choose a result by index (the highlighted one by default) and load its full record. */
  choose: (index?: number) => Promise<ChurchRecord | null>
  /** Mark a church as chosen without searching, such as a saved one. */
  select: (result: SearchResult | null) => void
  move: (dir: 1 | -1) => void
  setOpen: (open: boolean) => void
  reset: () => void
  /** The underlying client, for getChurch, meta, contribute and confirm. */
  lookup: Lookup
}

export function useChurchLookup(options: UseChurchLookupOptions = {}): UseChurchLookup {
  const opts = React.useRef(options)
  opts.current = options
  const [state, setState] = React.useState<ControllerState>({
    query: "",
    results: [],
    active: -1,
    open: false,
    loading: false,
    error: false,
    selected: null,
  })
  const ctl = React.useMemo(
    () =>
      createLookupController({
        lookup: opts.current.lookup,
        client: opts.current.client,
        baseUrl: opts.current.baseUrl,
        params: () => {
          const { region, country, near, limit, geo } = opts.current
          return { region, country, near, limit, geo }
        },
        onChange: (s) => setState({ ...s }),
        onResults: (d) => opts.current.onResults?.(d),
      }),
    []
  )
  React.useEffect(() => () => ctl.destroy(), [ctl])

  return {
    ...state,
    search: ctl.input,
    choose: ctl.choose,
    select: ctl.select,
    move: ctl.move,
    setOpen: (open) => (open ? ctl.open() : ctl.close()),
    reset: ctl.reset,
    lookup: ctl.lookup,
  }
}
