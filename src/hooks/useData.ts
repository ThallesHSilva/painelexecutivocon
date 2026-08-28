import { useQuery } from "@tanstack/react-query";
import { usePartnerFilter } from "@/contexts/AppContexts";
import {
  fetchPartners,
  fetchDashboard,
  fetchMobile,
  fetchFtth,
  fetchAdvanced,
  fetchLicenses,
  fetchQsc,
  fetchCapacity,
  fetchPortfolio,
  fetchDataQuality,
  fetchClient,
} from "@/services/api";

export function usePartners() {
  return useQuery({ queryKey: ["partners"], queryFn: fetchPartners, staleTime: 60_000 });
}

export function useDashboard() {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({ queryKey: ["dashboard", selected], queryFn: () => fetchDashboard(selected) });
}
export function useMobile() {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({ queryKey: ["mobile", selected], queryFn: () => fetchMobile(selected) });
}
export function useFtth() {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({ queryKey: ["ftth", selected], queryFn: () => fetchFtth(selected) });
}
export function useAdvanced() {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({ queryKey: ["advanced", selected], queryFn: () => fetchAdvanced(selected) });
}
export function useLicenses() {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({ queryKey: ["licenses", selected], queryFn: () => fetchLicenses(selected) });
}
export function useQsc() {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({
    queryKey: ["qsc", selected],
    queryFn: () => fetchQsc(selected),
    staleTime: 0,
    refetchOnMount: "always",
  });
}
export function useCapacity() {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({ queryKey: ["capacity", selected], queryFn: () => fetchCapacity(selected) });
}
export function usePortfolio(page: number, pageSize: number) {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({
    queryKey: ["portfolio", selected, page, pageSize],
    queryFn: () => fetchPortfolio(selected, page, pageSize),
  });
}
export function useDataQuality() {
  const { effectiveSelected: selected } = usePartnerFilter();
  return useQuery({ queryKey: ["quality", selected], queryFn: () => fetchDataQuality(selected) });
}
export function useClient(id: string | null) {
  return useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClient(id!),
    enabled: !!id,
  });
}
