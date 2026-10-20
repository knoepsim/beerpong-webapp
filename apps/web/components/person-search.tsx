"use client";

import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { useUserSearch } from "@/hooks/queries/user";
import { errorMessage } from "@/lib/errors";
import type { PublicUser } from "@/types";

/**
 * Find a person: a part of the name, or a whole phone number or e-mail address (no parts: they could be guessed).
 * It searches on submit, not on every key; the same search again asks the server again. Each person found is a
 * row, what can be done with it is up to the caller.
 */
export function PersonSearch({
  id,
  renderAction,
  notFound = "Niemand gefunden.",
}: Readonly<{
  id: string;
  /** What can be done with this person (a button, or what they are already). */
  renderAction: (person: PublicUser) => ReactNode;
  notFound?: string;
}>) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const search = useUserSearch(submitted);
  const term = query.trim();

  const handleSearch = () => {
    if (term.length < 2) return;
    if (term === submitted) void search.refetch();
    else setSubmitted(term);
  };

  return (
    <div className="space-y-3">
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <Label htmlFor={id}>Person suchen</Label>
        <div className="flex gap-2">
          <Input
            id={id}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, Handynummer oder E-Mail"
            autoComplete="off"
            aria-describedby={`${id}-hint`}
          />
          <Button type="submit" variant="secondary" className="shrink-0" disabled={term.length < 2 || search.isFetching}>
            <Search aria-hidden="true" />
            Suchen
          </Button>
        </div>
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          Teil des Namens, oder die ganze Nummer bzw. E-Mail-Adresse.
        </p>
      </form>

      {search.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(search.error, "Die Suche hat nicht geklappt. Versuch es noch einmal.")}
        </p>
      )}
      {search.isSuccess && search.data.length === 0 && <p className="text-sm text-muted-foreground">{notFound}</p>}
      {search.data && search.data.length > 0 && (
        <ItemGroup className="gap-1">
          {search.data.map((person) => (
            <Item key={person.id} role="listitem" variant="muted" size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{person.name}</ItemTitle>
              </ItemContent>
              <ItemActions>{renderAction(person)}</ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
