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
