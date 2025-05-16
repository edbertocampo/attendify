// This file allows customizing type definitions for Recharts components
import React from 'react';

// Extend Next.js dynamic import declarations
declare module 'next/dynamic' {
  const dynamic: any;
  export default dynamic;
}

// Declare module for Recharts to solve TypeScript errors
declare module 'recharts' {
  // Extend component interfaces as needed for TypeScript props validation
  
  export interface ResponsiveContainerProps {
    width?: string | number;
    height?: string | number;
    children: React.ReactElement; // ResponsiveContainer only accepts exactly one child
    [key: string]: any;
  }

  export interface AreaChartProps {
    data?: any[];
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface AreaProps {
    type?: string;
    dataKey?: string;
    stroke?: string;
    fill?: string;
    fillOpacity?: number;
    name?: string;
    strokeWidth?: number;
    [key: string]: any;
  }

  export interface XAxisProps {
    dataKey?: string;
    tick?: object;
    tickLine?: boolean;
    axisLine?: object;
    tickMargin?: number;
    padding?: { left?: number; right?: number };
    domain?: (string | number)[];
    [key: string]: any;
  }

  export interface YAxisProps {
    tick?: object;
    tickLine?: boolean;
    axisLine?: object;
    domain?: (string | number)[];
    [key: string]: any;
  }

  export interface TooltipProps {
    contentStyle?: object;
    cursor?: object;
    itemStyle?: object;
    [key: string]: any;
  }

  export interface PieChartProps {
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface PieProps {
    data?: any[];
    cx?: string | number;
    cy?: string | number;
    labelLine?: boolean;
    label?: Function | boolean | object;
    outerRadius?: number | string;
    fill?: string;
    dataKey?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface CellProps {
    key?: string;
    fill?: string;
    [key: string]: any;
  }

  export interface BarChartProps {
    data?: any[];
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface BarProps {
    dataKey?: string;
    name?: string;
    radius?: number[];
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface LegendProps {
    wrapperStyle?: object;
    verticalAlign?: string;
    height?: number;
    [key: string]: any;
  }
}
