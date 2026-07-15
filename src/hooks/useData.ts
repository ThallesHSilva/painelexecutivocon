import { useQuery } from "@tanstack/react-query";
import { usePartnerFilter } from "@/contexts/AppContexts";
import {
  fetchPartners,
  fetchDashboard,
  fetchMobile,
  fetchFtth,
  fetchLicenses,
  fetchCapacity,
  fetchPortfolio,
  fetchDataQuality,
  fetchClient,
} from "@/services/api";

export function usePartners() {
  return useQuery({ queryKey: ["partners"], queryFn: fetchPartners, staleTime: 60_000 });
}

export function useDashboard() {
  const { selected } = usePartnerFilter();
  return useQuery({ queryKey: ["dashboard", selected], queryFn: () => fetchDashboard(selected) });
}
export function useMobile() {
  const { selected } = usePartnerFilter();
  return useQuery({ queryKey: ["mobile", selected], queryFn: () => fetchMobile(selected) });
}
export function useFtth() {
  const { selected } = usePartnerFilter();
  return useQuery({ queryKey: ["ftth", selected], queryFn: () => fetchFtth(selected) });
}
export function useLicenses() {
  const { selected } = usePartnerFilter();
  return useQuery({ queryKey: ["licenses", selected], queryFn: () => fetchLicenses(selected) });
}
export function useCapacity() {
  const { selected } = usePartnerFilter();
  return useQuery({ queryKey: ["capacity", selected], queryFn: () => fetchCapacity(selected) });
}
export function usePortfolio(page: number, pageSize: number) {
  const { selected } = usePartnerFilter();
  return useQuery({
    queryKey: ["portfolio", selected, page, pageSize],
    queryFn: () => fetchPortfolio(selected, page, pageSize),
  });
}
export function useDataQuality() {
  const { selected } = usePartnerFilter();
  return useQuery({ queryKey: ["quality", selected], queryFn: () => fetchDataQuality(selected) });
}
export function useClient(id: string | null) {
  return useQuery({
    queryKey: ["client", id],
    queryFn: () => fetchClient(id!),
    enabled: !!id,
  });
}
