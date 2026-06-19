/**
 * Supabase 스키마 타입 — supabase/migrations 와 일치.
 * 실제 프로젝트 연결 후에는 아래로 자동 생성 가능:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 */

export type OwnershipType = 'own' | 'rent' | 'lease';
export type StationNoteKind = 'parking' | 'access' | 'tip';
export type ParkingFee = 'free' | 'paid' | 'conditional';
export type FloorType = 'ground' | 'underground';

export interface Database {
  public: {
    Tables: {
      families: {
        Row: { id: string; name: string; invite_code: string; created_at: string };
        Insert: { id?: string; name: string; invite_code: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['families']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: { id: string; family_id: string | null; display_name: string | null; created_at: string };
        Insert: { id: string; family_id?: string | null; display_name?: string | null; created_at?: string };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          family_id: string;
          nickname: string;
          model: string | null;
          ownership_type: OwnershipType;
          current_odo_km: number;
          plate: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          nickname: string;
          model?: string | null;
          ownership_type?: OwnershipType;
          current_odo_km?: number;
          plate?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vehicles']['Insert']>;
        Relationships: [];
      };
      rent_contracts: {
        Row: {
          id: string;
          vehicle_id: string;
          contract_distance_km: number;
          start_odo_km: number;
          start_date: string;
          end_date: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          contract_distance_km: number;
          start_odo_km?: number;
          start_date: string;
          end_date: string;
          notes?: string | null;
        };
        Update: Partial<Database['public']['Tables']['rent_contracts']['Insert']>;
        Relationships: [];
      };
      odo_readings: {
        Row: {
          id: string;
          vehicle_id: string;
          odo_km: number;
          recorded_at: string;
          recorded_by: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          odo_km: number;
          recorded_at?: string;
          recorded_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['odo_readings']['Insert']>;
        Relationships: [];
      };
      charge_logs: {
        Row: {
          id: string;
          vehicle_id: string;
          station_ext_id: string | null;
          operator: string | null;
          kwh: number | null;
          cost_krw: number | null;
          charged_at: string;
          recorded_by: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          station_ext_id?: string | null;
          operator?: string | null;
          kwh?: number | null;
          cost_krw?: number | null;
          charged_at?: string;
          recorded_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['charge_logs']['Insert']>;
        Relationships: [];
      };
      station_notes: {
        Row: {
          id: string;
          station_ext_id: string;
          family_id: string | null;
          kind: StationNoteKind;
          content: string | null;
          photo_path: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          station_ext_id: string;
          family_id?: string | null;
          kind: StationNoteKind;
          content?: string | null;
          photo_path?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['station_notes']['Insert']>;
        Relationships: [];
      };
      favorites: {
        Row: { id: string; family_id: string; station_ext_id: string; created_at: string };
        Insert: { id?: string; family_id: string; station_ext_id: string; created_at?: string };
        Update: Partial<Database['public']['Tables']['favorites']['Insert']>;
        Relationships: [];
      };
      station_facts: {
        Row: {
          id: string;
          family_id: string;
          station_ext_id: string;
          parking_fee: ParkingFee | null;
          parking_fee_note: string | null;
          charging_free_minutes: number | null;
          floor_type: FloorType | null;
          floor_level: number | null;
          extra_note: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          station_ext_id: string;
          parking_fee?: ParkingFee | null;
          parking_fee_note?: string | null;
          charging_free_minutes?: number | null;
          floor_type?: FloorType | null;
          floor_level?: number | null;
          extra_note?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['station_facts']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_family: {
        Args: { p_name: string; p_display_name?: string | null };
        Returns: Database['public']['Tables']['families']['Row'];
      };
      join_family: {
        Args: { p_code: string; p_display_name?: string | null };
        Returns: Database['public']['Tables']['families']['Row'];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
