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
    typography: {
      fontFamily: [
        'var(--font-gilroy)',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: {
        fontFamily: 'var(--font-gilroy)',
        fontWeight: 700,
      },
      h2: {
        fontFamily: 'var(--font-gilroy)',
        fontWeight: 700,
      },
      h3: {
        fontFamily: 'var(--font-gilroy)',
        fontWeight: 600,
      },
      h4: {
        fontFamily: 'var(--font-gilroy)',
        fontWeight: 600,
      },
      h5: {
        fontFamily: 'var(--font-gilroy)',
        fontWeight: 600,
      },
      h6: {
        fontFamily: 'var(--font-gilroy)',
        fontWeight: 600,
      },
      subtitle1: {
        fontFamily: 'var(--font-nunito)',
      },
      subtitle2: {
        fontFamily: 'var(--font-nunito)',
      },
      body1: {
        fontFamily: 'var(--font-gilroy)',
      },
      body2: {
        fontFamily: 'var(--font-nunito)',
      },
      button: {
        fontFamily: 'var(--font-gilroy)',
        fontWeight: 600,
      },
    },    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: mode === 'dark' ? '#334eac80' : '#33333380',
              borderRadius: '4px',
            },
          }
        }
      },
      MuiInput: {
        styleOverrides: {
          root: {
            fontFamily: 'var(--font-nunito)',
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontFamily: 'var(--font-nunito)',
          }
        }
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiInputBase-input': {
              fontFamily: 'var(--font-nunito)',
            }
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            fontFamily: 'var(--font-gilroy)',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontFamily: 'var(--font-gilroy)',
            fontWeight: 600,
          },
          body: {
            fontFamily: 'var(--font-nunito)',
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          label: {
            fontFamily: 'var(--font-nunito)',
          }
        }
      },
    }
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
