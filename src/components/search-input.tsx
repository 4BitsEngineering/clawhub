"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";
import { Input } from "@/components/ui/input";

export function SearchInput({
  placeholder = "Buscar...",
  paramName = "q",
}: {
  placeholder?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  function handleChange(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      params.delete("page");
      startTransition(() => {
        router.replace(`?${params.toString()}`);
      });
    }, 300);
  }

  return (
    <Input
      type="search"
      placeholder={placeholder}
      defaultValue={searchParams.get(paramName) ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      className={`max-w-xs h-9 text-sm ${isPending ? "opacity-60" : ""}`}
    />
  );
}
