import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { notify } from '../../lib/notify';
import {
  useAddStationNote,
  useFavorites,
  useStationFacts,
  useStationNotes,
  useToggleFavorite,
  useUpsertStationFacts,
  type StationFacts,
} from '../../lib/queries';
import { colors } from '../../lib/theme';
import type { FloorType, ParkingFee } from '../../types/database';
import { useAuth } from '../../providers/auth';

const FEE_LABEL: Record<ParkingFee, string> = { free: '무료', paid: '유료', conditional: '조건부' };
const FEE_COLOR: Record<ParkingFee, string> = {
  free: colors.leaf,
  paid: colors.terracotta,
  conditional: colors.amber,
};

function floorText(f: StationFacts): string | null {
  if (!f.floor_type) return null;
  const base = f.floor_type === 'underground' ? '지하' : '지상';
  return f.floor_level != null ? `${base} ${f.floor_level}층` : base;
}

export default function StationDetail() {
  const params = useLocalSearchParams<{
    id: string;
    nm?: string;
    addr?: string;
    busi?: string;
    avail?: string;
    total?: string;
    free?: string;
    dist?: string;
  }>();
  const stationId = params.id;
  const { profile } = useAuth();
  const familyId = profile?.family_id ?? null;

  const favsQ = useFavorites(familyId);
  const toggleFav = useToggleFavorite(familyId);
  const faved = favsQ.data?.has(stationId) ?? false;

  const avail = Number(params.avail ?? 0);
  const total = Number(params.total ?? 0);
  const availColor = avail > 0 ? colors.leaf : total > 0 ? colors.amber : colors.muted;

  return (
    <Screen>
      <ScreenHeader title={params.nm || '충전소'} subtitle={params.addr || undefined} />

      <Card className="mb-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-muted">실시간 사용가능</Text>
            <Text className="mt-1 text-2xl font-bold" style={{ color: availColor }}>
              {avail}/{total}대
            </Text>
            <Text className="mt-1 text-xs text-muted">
              {params.busi || '—'}
              {params.dist ? ` · ${params.dist}km` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => familyId && toggleFav.mutate({ stationExtId: stationId, on: !faved })}
            hitSlop={8}
            className="items-center">
            <Text className="text-3xl" style={{ color: faved ? colors.amber : colors.muted }}>
              {faved ? '★' : '☆'}
            </Text>
            <Text className="text-[11px] text-muted">즐겨찾기</Text>
          </Pressable>
        </View>
      </Card>

      <FactsSection stationId={stationId} familyId={familyId} updatedBy={profile?.id} />
      <NotesSection stationId={stationId} familyId={familyId} createdBy={profile?.id} />
    </Screen>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View className="flex-row items-center justify-between border-t border-sand py-2.5">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="text-sm font-semibold" style={{ color: color ?? colors.ink }}>
        {value}
      </Text>
    </View>
  );
}

function FactsSection({
  stationId,
  familyId,
  updatedBy,
}: {
  stationId: string;
  familyId: string | null;
  updatedBy?: string;
}) {
  const { data: facts, isLoading } = useStationFacts(familyId, stationId);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <ActivityIndicator color={colors.terracotta} />;

  if (editing || !facts) {
    return (
      <FactsForm
        stationId={stationId}
        familyId={familyId}
        updatedBy={updatedBy}
        initial={facts}
        onDone={() => setEditing(false)}
        onCancel={facts ? () => setEditing(false) : undefined}
      />
    );
  }

  const feeValue = facts.parking_fee
    ? FEE_LABEL[facts.parking_fee] + (facts.parking_fee_note ? ` · ${facts.parking_fee_note}` : '')
    : '정보 없음';
  const floor = floorText(facts);

  return (
    <Card className="mb-4">
      <Text className="text-base font-bold text-ink">도착 난이도</Text>
      <View className="mt-2">
        <Row
          label="주차비"
          value={feeValue}
          color={facts.parking_fee ? FEE_COLOR[facts.parking_fee] : colors.muted}
        />
        <Row
          label="충전 중 무료"
          value={facts.charging_free_minutes != null ? `${facts.charging_free_minutes}분` : '—'}
        />
        <Row label="위치" value={floor ?? '정보 없음'} />
      </View>
      {facts.extra_note ? (
        <Text className="mt-2 text-sm text-ink">{facts.extra_note}</Text>
      ) : null}
      <View className="mt-3">
        <Button variant="outline" label="정보 수정" onPress={() => setEditing(true)} />
      </View>
    </Card>
  );
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View className="mb-4 flex-row gap-2">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className={`flex-1 items-center rounded-card border py-2.5 ${
              active ? 'border-terracotta bg-terracotta/10' : 'border-sand'
            }`}>
            <Text className={active ? 'text-terracotta' : 'text-muted'}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FactsForm({
  stationId,
  familyId,
  updatedBy,
  initial,
  onDone,
  onCancel,
}: {
  stationId: string;
  familyId: string | null;
  updatedBy?: string;
  initial?: StationFacts | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [fee, setFee] = useState<ParkingFee | null>(initial?.parking_fee ?? null);
  const [feeNote, setFeeNote] = useState(initial?.parking_fee_note ?? '');
  const [freeMin, setFreeMin] = useState(
    initial?.charging_free_minutes != null ? String(initial.charging_free_minutes) : '',
  );
  const [floorType, setFloorType] = useState<FloorType | null>(initial?.floor_type ?? null);
  const [floorLevel, setFloorLevel] = useState(
    initial?.floor_level != null ? String(initial.floor_level) : '',
  );
  const [extra, setExtra] = useState(initial?.extra_note ?? '');
  const upsert = useUpsertStationFacts();

  async function submit() {
    if (!familyId) {
      notify('오류', '가족 정보가 필요합니다.');
      return;
    }
    const fm = freeMin.trim() ? parseInt(freeMin, 10) : null;
    const fl = floorLevel.trim() ? parseInt(floorLevel, 10) : null;
    try {
      await upsert.mutateAsync({
        familyId,
        stationExtId: stationId,
        parkingFee: fee,
        parkingFeeNote: feeNote.trim() || null,
        chargingFreeMinutes: Number.isFinite(fm as number) ? fm : null,
        floorType,
        floorLevel: Number.isFinite(fl as number) ? fl : null,
        extraNote: extra.trim() || null,
        updatedBy,
      });
      notify('저장 완료', '도착 난이도 정보가 저장됐어요.');
      onDone();
    } catch (e: any) {
      notify('오류', e?.message ?? '저장에 실패했습니다.');
    }
  }

  return (
    <Card className="mb-4">
      <Text className="mb-3 text-base font-bold text-ink">도착 난이도 입력</Text>

      <Text className="mb-1.5 text-sm font-medium text-ink">주차비</Text>
      <Seg
        options={[
          { key: 'free', label: '무료' },
          { key: 'paid', label: '유료' },
          { key: 'conditional', label: '조건부' },
        ]}
        value={fee}
        onChange={(v) => setFee(v as ParkingFee)}
      />
      {fee && fee !== 'free' ? (
        <TextField
          label="요금·조건 (선택)"
          value={feeNote}
          onChangeText={setFeeNote}
          placeholder="예: 시간당 1,000원 / 충전 시 2시간 무료"
        />
      ) : null}

      <TextField
        label="충전 중 무료시간 (분, 선택)"
        value={freeMin}
        onChangeText={setFreeMin}
        keyboardType="number-pad"
        placeholder="예: 30"
      />

      <Text className="mb-1.5 text-sm font-medium text-ink">위치</Text>
      <Seg
        options={[
          { key: 'ground', label: '지상' },
          { key: 'underground', label: '지하' },
        ]}
        value={floorType}
        onChange={(v) => setFloorType(v as FloorType)}
      />
      <TextField
        label="층수 (선택)"
        value={floorLevel}
        onChangeText={setFloorLevel}
        keyboardType="number-pad"
        placeholder="예: 2 (지하 2층이면 지하 선택 + 2)"
      />

      <TextField
        label="자유 메모 (선택)"
        value={extra}
        onChangeText={setExtra}
        placeholder="예: 게이트 좁음, B구역 안쪽"
        multiline
      />

      <Button label="저장" onPress={submit} loading={upsert.isPending} />
      {onCancel ? (
        <View className="mt-3">
          <Button variant="ghost" label="취소" onPress={onCancel} />
        </View>
      ) : null}
    </Card>
  );
}

function NotesSection({
  stationId,
  familyId,
  createdBy,
}: {
  stationId: string;
  familyId: string | null;
  createdBy?: string;
}) {
  const { data: notes } = useStationNotes(stationId);
  const [content, setContent] = useState('');
  const add = useAddStationNote();

  async function submit() {
    if (!content.trim()) {
      notify('입력 확인', '메모 내용을 입력하세요.');
      return;
    }
    try {
      await add.mutateAsync({
        stationExtId: stationId,
        familyId,
        kind: 'tip',
        content: content.trim(),
        createdBy,
      });
      setContent('');
      notify('등록 완료', '현장 메모가 추가됐어요.');
    } catch (e: any) {
      notify('오류', e?.message ?? '저장에 실패했습니다.');
    }
  }

  return (
    <Card>
      <Text className="text-base font-bold text-ink">현장 메모</Text>
      <Text className="mb-2 text-xs text-muted">가족이 함께 남기는 자유 메모예요.</Text>
      {(notes ?? []).map((n, i) => (
        <View key={n.id} className={`pt-2 ${i > 0 ? 'mt-1 border-t border-sand' : ''}`}>
          <Text className="text-sm text-ink">{n.content}</Text>
        </View>
      ))}
      <View className="mt-3">
        <TextField
          value={content}
          onChangeText={setContent}
          placeholder="예: 입구 차단기 번호판 인식, 야간 어두움"
          multiline
        />
        <Button label="메모 추가" onPress={submit} loading={add.isPending} />
      </View>
    </Card>
  );
}
