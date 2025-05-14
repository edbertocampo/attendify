// src/app/layout.tsx
import MyThemeProvider from "@/components/ThemeProvider";
import { gilroy, nunito } from './fonts';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${gilroy.variable} ${nunito.variable}`}>
        <MyThemeProvider>
          {children}
        </MyThemeProvider>
      </body>
    </html>
  );
}
