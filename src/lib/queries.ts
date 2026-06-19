import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Database } from '../types/database';

export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type RentContract = Database['public']['Tables']['rent_contracts']['Row'];

/** 가족 차량 목록 (생성순) */
export function useVehicles(familyId?: string | null) {
  return useQuery({
    queryKey: ['vehicles', familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('family_id', familyId!)
        .order('created_at');
      if (error) throw error;
      return data as Vehicle[];
    },
  });
}

/** 차량의 최신 약정 (없으면 null) */
export function useContract(vehicleId?: string) {
  return useQuery({
    queryKey: ['contract', vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_contracts')
        .select('*')
        .eq('vehicle_id', vehicleId!)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as RentContract | null;
    },
  });
}

/** 주행거리 기록 추가 (트리거가 vehicles.current_odo_km 갱신) */
export function useAddOdoReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { vehicleId: string; odoKm: number; recordedBy?: string | null }) => {
      const { error } = await supabase.from('odo_readings').insert({
        vehicle_id: v.vehicleId,
        odo_km: v.odoKm,
        recorded_by: v.recordedBy ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['contract', v.vehicleId] });
    },
  });
}

/** 약정 생성/교체 (차량당 최신 1건을 사용) */
export function useUpsertContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: {
      vehicleId: string;
      contractDistanceKm: number;
      startOdoKm: number;
      startDate: string;
      endDate: string;
      notes?: string | null;
    }) => {
      // 차량당 약정 1건만 유지(교체). rent_contracts 에 생성시각이 없어
      // start_date 정렬로 "최신"을 고르면 수정이 반영 안 되는 문제를 막기 위함.
      const { error: delError } = await supabase
        .from('rent_contracts')
        .delete()
        .eq('vehicle_id', c.vehicleId);
      if (delError) throw delError;

      const { error } = await supabase.from('rent_contracts').insert({
        vehicle_id: c.vehicleId,
        contract_distance_km: c.contractDistanceKm,
        start_odo_km: c.startOdoKm,
        start_date: c.startDate,
        end_date: c.endDate,
        notes: c.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, c) => {
      qc.invalidateQueries({ queryKey: ['contract', c.vehicleId] });
    },
  });
}
