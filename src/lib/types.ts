import type { SunDay } from './sunCalc';

export interface LocationConfig {
  id: string;
  lat: number;
  lng: number;
  tz: string;
  observeDst: boolean;
  /** City name shown in legend and card header */
  label: string;
  /** Assigned chart color */
  color: string;
}

export interface ChartLocation {
  data: SunDay[];
  label: string;
  color: string;
}
