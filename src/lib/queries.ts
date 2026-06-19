import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import type { Database } from '../types/database';

export type Vehicle = Database['public']['Tables']['vehicles']['Row'];
export type RentContract = Database['public']['Tables']['rent_contracts']['Row'];
export type ChargeLog = Database['public']['Tables']['charge_logs']['Row'];

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

/** 가족 충전 기록 (RLS 로 가족 범위 자동 한정) */
export function useChargeLogs(familyId?: string | null) {
  return useQuery({
    queryKey: ['charge_logs', familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charge_logs')
        .select('*')
        .order('charged_at', { ascending: false });
      if (error) throw error;
      return data as ChargeLog[];
    },
  });
}

/** 충전 기록 추가 */
export function useAddChargeLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: {
      vehicleId: string;
      kwh: number | null;
      costKrw: number | null;
      operator: string | null;
      chargedAt?: string | null;
      recordedBy?: string | null;
    }) => {
      const row: Database['public']['Tables']['charge_logs']['Insert'] = {
        vehicle_id: c.vehicleId,
        kwh: c.kwh,
        cost_krw: c.costKrw,
        operator: c.operator,
        recorded_by: c.recordedBy ?? null,
        ...(c.chargedAt ? { charged_at: c.chargedAt } : {}),
      };
      const { error } = await supabase.from('charge_logs').insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charge_logs'] });
    },
  });
}

// ── 충전소(공공 API 프록시) ──────────────────────────────────
export interface StationCharger {
  chgerId: string;
  type: string | null;
  stat: string | null;
  statUpdDt: string | null;
}
export interface Station {
  statId: string;
  statNm: string;
  addr: string | null;
  lat: number | null;
  lng: number | null;
  busiNm: string | null;
  parkingFree: boolean;
  chargers: StationCharger[];
  available: number;
  total: number;
  distanceKm: number | null;
}

export function useNearbyStations(params: {
  lat?: number;
  lng?: number;
  zcode?: string;
  freeOnly?: boolean;
  enabled?: boolean;
}) {
  const { lat, lng, zcode, freeOnly, enabled = true } = params;
  return useQuery({
    queryKey: ['stations', lat, lng, zcode, freeOnly],
    enabled: enabled && lat != null && lng != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('charger-stations', {
        body: { lat, lng, zcode, freeOnly, limit: 50 },
      });
      if (error) throw new Error(error.message ?? '충전소 조회 실패');
      if (data?.error) throw new Error(data.error);
      return (data?.stations ?? []) as Station[];
    },
  });
}

// ── 즐겨찾기 ─────────────────────────────────────────────────
export function useFavorites(familyId?: string | null) {
  return useQuery({
    queryKey: ['favorites', familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from('favorites').select('station_ext_id');
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.station_ext_id));
    },
  });
}

export function useToggleFavorite(familyId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { stationExtId: string; on: boolean }) => {
      if (v.on) {
        const { error } = await supabase
          .from('favorites')
          .insert({ family_id: familyId!, station_ext_id: v.stationExtId });
        if (error && error.code !== '23505') throw error; // 중복 무시
      } else {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('family_id', familyId!)
          .eq('station_ext_id', v.stationExtId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
}

// ── 충전소 도착 난이도 메모(위키) ────────────────────────────
export type StationNote = Database['public']['Tables']['station_notes']['Row'];
export type StationNoteKind = 'parking' | 'access' | 'tip';

export function useStationNotes(stationExtId?: string) {
  return useQuery({
    queryKey: ['station_notes', stationExtId],
    enabled: !!stationExtId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_notes')
        .select('*')
        .eq('station_ext_id', stationExtId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as StationNote[];
    },
  });
}

export function useAddStationNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (n: {
      stationExtId: string;
      familyId: string | null;
      kind: StationNoteKind;
      content: string;
      photoPath?: string | null;
      createdBy?: string | null;
    }) => {
      const { error } = await supabase.from('station_notes').insert({
        station_ext_id: n.stationExtId,
        family_id: n.familyId,
        kind: n.kind,
        content: n.content,
        photo_path: n.photoPath ?? null,
        created_by: n.createdBy ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, n) => qc.invalidateQueries({ queryKey: ['station_notes', n.stationExtId] }),
  });
}

// ── 충전소 도착 난이도(구조화) ───────────────────────────────
export type StationFacts = Database['public']['Tables']['station_facts']['Row'];

export function useStationFacts(familyId?: string | null, stationExtId?: string) {
  return useQuery({
    queryKey: ['station_facts', familyId, stationExtId],
    enabled: !!familyId && !!stationExtId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_facts')
        .select('*')
        .eq('family_id', familyId!)
        .eq('station_ext_id', stationExtId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as StationFacts | null;
    },
  });
}

export function useUpsertStationFacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: {
      familyId: string;
      stationExtId: string;
      parkingFee: 'free' | 'paid' | 'conditional' | null;
      parkingFeeNote: string | null;
      chargingFreeMinutes: number | null;
      floorType: 'ground' | 'underground' | null;
      floorLevel: number | null;
      extraNote: string | null;
      updatedBy?: string | null;
    }) => {
      const { error } = await supabase.from('station_facts').upsert(
        {
          family_id: f.familyId,
          station_ext_id: f.stationExtId,
          parking_fee: f.parkingFee,
          parking_fee_note: f.parkingFeeNote,
          charging_free_minutes: f.chargingFreeMinutes,
          floor_type: f.floorType,
          floor_level: f.floorLevel,
          extra_note: f.extraNote,
          updated_by: f.updatedBy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'family_id,station_ext_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_d, f) =>
      qc.invalidateQueries({ queryKey: ['station_facts', f.familyId, f.stationExtId] }),
  });
}
