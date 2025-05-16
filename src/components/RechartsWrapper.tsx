"use client";

// This file is no longer needed as we're directly importing from recharts in each component
// We're keeping this file to avoid having to change imports throughout the application
// The actual implementation has moved to the dynamic imports in each consuming component

// Re-export from recharts for backward compatibility
export {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
