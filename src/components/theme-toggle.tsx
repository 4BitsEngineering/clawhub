"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Vive siempre en headers navy AI-Office → icono crema fijo
  const headerStyle = { color: "rgba(245,239,228,0.85)" };

  // Pre-mount placeholder con el mismo tamaño para evitar layout shift.
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="size-9 px-0 hover:bg-white/10"
        style={headerStyle}
        aria-hidden
      >
        <span className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-9 px-0 hover:bg-white/10"
      style={headerStyle}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={isDark ? "Tema claro" : "Tema oscuro"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
