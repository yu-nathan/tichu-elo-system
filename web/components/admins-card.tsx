"use client";

import { useId, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminEntry } from "@/lib/admin-access";

export const AdminsCard = ({
  initialAdmins,
}: {
  initialAdmins: AdminEntry[];
}) => {
  const emailInputId = useId();
  const [admins, setAdmins] = useState(initialAdmins);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as {
        admins?: AdminEntry[];
        error?: string;
      };
      if (!response.ok || !result.admins) {
        throw new Error(result.error ?? "Could not add admin. Try again.");
      }
      setAdmins(result.admins);
      setEmail("");
      setStatus(
        "Admin added. They can now sign in to manage games and players.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add admin.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admins</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Admins can manage games and players. Only you, the owner, can add
          admins.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <label
            htmlFor={emailInputId}
            className="flex min-w-0 flex-col gap-1.5 text-sm"
          >
            ChatGPT account email
            <Input
              id={emailInputId}
              required
              type="email"
              autoComplete="email"
              maxLength={254}
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={busy || !email.trim()}>
            <Plus /> {busy ? "Adding…" : "Add admin"}
          </Button>
          {error ? (
            <p role="alert" className="text-sm">
              {error}
            </p>
          ) : null}
          {status ? <output className="block text-sm">{status}</output> : null}
        </form>
        <ul className="divide-y divide-border">
          {admins.map((admin) => (
            <li
              key={admin.email}
              className="flex items-center gap-3 py-3 text-sm"
            >
              <span className="min-w-0 flex-1 break-all">{admin.email}</span>
              <span className="text-muted-foreground">
                {admin.role === "owner" ? "Owner" : "Admin"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
