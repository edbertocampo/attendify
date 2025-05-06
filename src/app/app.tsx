// src/app/layout.tsx
import MyThemeProvider from "@/components/ThemeProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MyThemeProvider>
          {children}
        </MyThemeProvider>
      </body>
    </html>
  );
}
