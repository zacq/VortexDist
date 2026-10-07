import type { DashboardData, DashboardPeriod } from "../../shared/dashboard";
import { useApi } from "../api/useApi";

export function useDashboard(period: DashboardPeriod) {
  return useApi<DashboardData>(`/dashboard?period=${period}`, { cache: true });
}
