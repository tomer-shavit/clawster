"use client";

import { 
  AreaChartComponent, 
  LineChartComponent, 
  BarChartComponent,
  generateTimeSeriesData 
} from "@/components/ui/charts";
import { useMemo } from "react";

interface ClientChartProps {
  height?: number;
}

export function ClientAreaChart({ height = 200 }: ClientChartProps) {
  // Generate data on client only to avoid SSR issues with Math.random()
  const data = useMemo(() => generateTimeSeriesData(24, [100, 500]), []);
  
  return <AreaChartComponent data={data} height={height} />;
}

export function ClientLineChart({ height = 200 }: ClientChartProps) {
  const data = useMemo(() => generateTimeSeriesData(24, [50, 200]), []);
  
  return <LineChartComponent data={data} height={height} />;
}

export function ClientBarChart({ height = 200 }: ClientChartProps) {
  const data = useMemo(() => generateTimeSeriesData(24, [20, 30]), []);
  
  return <BarChartComponent data={data} height={height} />;
}
