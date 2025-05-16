"use client";

import React from 'react';
import dynamic from 'next/dynamic';

// Only dynamically import the chart containers
export const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
);
export const AreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  { ssr: false }
);
export const BarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  { ssr: false }
);
export const PieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  { ssr: false }
);

// Import all primitives directly from recharts
export {
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Pie,
  Cell,
  Bar,
  Legend
} from 'recharts';

// SVG helpers
export const Defs = (props: any) => <defs {...props} />;
export const LinearGradient = (props: any) => <linearGradient {...props} />;
export const Stop = (props: any) => <stop {...props} />;
