This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load custom fonts throughout the application.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Typography and Fonts

Attendify uses a carefully selected font combination to create a modern, professional appearance:

### Primary Font: Outfit (Gilroy Alternative)

The primary font used throughout the application is Outfit, which serves as an alternative to Gilroy (a premium font). Outfit provides a clean, contemporary feel for headings, navigation, and primary UI elements.

Font weights used:
- Light (300)
- Regular (400)
- Medium (500)
- SemiBold (600)
- Bold (700)
- ExtraBold (800)

### Secondary Font: Nunito

Nunito is used as a secondary font for body text, paragraphs, and supporting content. It pairs well with Outfit due to its excellent readability and clean design.

Font weights used:
- Regular (400)
- Medium (500)
- SemiBold (600)
- Bold (700)

### Implementation

The fonts are implemented using Next.js font optimization:

```typescript
// src/app/fonts.ts
import { Outfit, Nunito } from 'next/font/google';

// Primary font - Outfit (similar to Gilroy)
export const gilroy = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-gilroy',
  display: 'swap',
});

// Secondary font - Nunito
export const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nunito',
  display: 'swap',
});
```

These fonts are then applied globally via CSS variables and through MUI's ThemeProvider to ensure consistent typography throughout the application.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
