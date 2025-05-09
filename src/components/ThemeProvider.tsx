// src/components/ThemeProvider.tsx
"use client";

import { createTheme, ThemeProvider, CssBaseline } from "@mui/material";
import { ReactNode, useEffect, useState } from "react";

export default function MyThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Detect system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setMode(prefersDark ? "dark" : "light");
  }, []);

  const theme = createTheme({
    palette: {
      mode,
      primary: {
        main: '#334eac', // Main brand color
        contrastText: '#fff',
      },
      secondary: {
        main: '#ffb300', // Complementary accent (amber)
        contrastText: '#fff',
      },
      background: {
        default: mode === 'dark' ? '#101624' : '#f6f8fa',
        paper: mode === 'dark' ? '#18213a' : '#fff',
      },
      error: {
        main: '#e53935',
      },
      success: {
        main: '#43a047',
      },
      warning: {
        main: '#ffa726',
      },
      info: {
        main: '#1976d2',
      },
      text: {
        primary: mode === 'dark' ? '#ededed' : '#171717',
        secondary: mode === 'dark' ? '#b0b8c1' : '#64748b',
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
