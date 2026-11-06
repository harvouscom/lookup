import { useState } from "react"
import { useForm } from "react-hook-form"

import { ChurchConsent } from "@/components/church-consent"
import { ChurchLookup } from "@/components/church-lookup"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ChurchRecord } from "@/lib/lookup-core"

type Values = {
  church_id: string
  name: string
  street: string
  city: string
  regionName: string
  postalCode: string
  phone: string
  website: string
  serviceTimes: string
  notes: string
}

// Field name → label. The names match Lookup's fields, so data-hmc-field and consent line up.
const FIELDS: [keyof Values, string, boolean?][] = [
  ["name", "Church name", true],
  ["street", "Street", true],
  ["city", "City"],
  ["regionName", "State or region"],
  ["postalCode", "Postal code"],
  ["phone", "Phone"],
  ["website", "Website", true],
  ["serviceTimes", "Service times", true],
]

export default function App() {
  const form = useForm<Values>({
    defaultValues: { church_id: "", name: "", street: "", city: "", regionName: "", postalCode: "", phone: "", website: "", serviceTimes: "", notes: "" },
  })
  const [record, setRecord] = useState<ChurchRecord | null>(null)
  const [submitted, setSubmitted] = useState<Values | null>(null)
  const values = form.watch()

  return (
    <div className="bg-muted/40 min-h-svh">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-6 py-3 text-sm">
          <span className="bg-foreground text-background grid size-7 place-items-center rounded-md text-xs font-bold">K</span>
          <span className="font-semibold">Kinship</span>
          <span className="text-muted-foreground">Partner churches / New</span>
          <span className="text-muted-foreground ml-auto">
            Lookup example · React, shadcn/ui and React Hook Form ·{" "}
            <a className="text-foreground underline underline-offset-4" href="/#examples">All examples</a>
          </span>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Add a partner church</h1>
            <p className="text-muted-foreground text-sm">
              Installed with <code className="bg-muted text-foreground rounded px-1 py-0.5 text-xs">shadcn add https://lookup.heresmychurch.com/r/church-lookup.json</code>
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit((v) => setSubmitted(v))} className="grid gap-5">
                  <FormField
                    control={form.control}
                    name="church_id"
                    rules={{ required: "Choose your church from the list." }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Church</FormLabel>
                        <FormControl>
                          <ChurchLookup {...field} client="lookup-demo" placeholder="Search by name or city" onFill={(r) => setRecord(r)} />
                        </FormControl>
                        <FormDescription>Pick a church and the fields below fill in. Anything you type is kept.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {FIELDS.map(([name, label, wide]) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem className={wide ? "sm:col-span-2" : undefined}>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <Input {...field} data-hmc-field={name} autoComplete="off" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ))}
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="How you work together" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <ChurchConsent
                    record={record}
                    values={values}
                    labels={Object.fromEntries(FIELDS.map(([n, l]) => [n, l]))}
                    client="lookup-demo"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => { form.reset(); setRecord(null); setSubmitted(null) }}>Cancel</Button>
                    <Button type="submit">Save church</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What handleSubmit gets</CardTitle>
              <CardDescription>React Hook Form values after Save.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted overflow-auto rounded-md p-3 text-xs leading-relaxed" data-testid="submitted">
                {submitted ? JSON.stringify(submitted, null, 2) : "Save to see the values."}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Demo mode</CardTitle>
              <CardDescription>
                This page uses <code>client="lookup-demo"</code>, so shared fixes are checked but never sent to Here’s My Church.
              </CardDescription>
            </CardHeader>
          </Card>
        </aside>
      </main>
    </div>
  )
}
