"use client";

import type { ReactNode } from "react";
import { ThemeProvider as Provider } from "@/src/context/ThemeContext";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>;
}
