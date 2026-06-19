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
  useStationNotes,
  useToggleFavorite,
  type StationNote,
  type StationNoteKind,
} from '../../lib/queries';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/auth';

const KINDS: { key: StationNoteKind; label: string; hint: string }[] = [
  { key: 'parking', label: '주차', hint: '주차비 · 셀프/회차 시간' },
  { key: 'access', label: '진입', hint: '지하 몇 층 · 진입 게이트' },
  { key: 'tip', label: '꿀팁', hint: '기타 도움말' },
];

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

  const notesQ = useStationNotes(stationId);
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
        {params.free ? (
          <View className="mt-3 self-start rounded-pill bg-leaf/10 px-3 py-1">
            <Text className="text-xs text-leaf">주차비 무료</Text>
          </View>
        ) : null}
      </Card>

      <Text className="mb-2 text-base font-bold text-ink">도착 난이도</Text>
      <Text className="mb-3 text-xs text-muted">
        가족이 함께 채우는 현장 정보예요. 주차비·회차·지하 층·진입 팁을 남겨주세요.
      </Text>

      {notesQ.isLoading ? (
        <ActivityIndicator color={colors.terracotta} />
      ) : (
        KINDS.map((k) => (
          <KindSection key={k.key} kind={k} notes={(notesQ.data ?? []).filter((n) => n.kind === k.key)} />
        ))
      )}

      <AddNote stationId={stationId} familyId={familyId} createdBy={profile?.id} />
    </Screen>
  );
}

function KindSection({
  kind,
  notes,
}: {
  kind: { key: StationNoteKind; label: string; hint: string };
  notes: StationNote[];
}) {
  return (
    <Card className="mb-3">
      <Text className="text-sm font-semibold text-ink">{kind.label}</Text>
      <Text className="mb-2 text-xs text-muted">{kind.hint}</Text>
      {notes.length === 0 ? (
        <Text className="text-sm text-muted">아직 메모가 없어요.</Text>
      ) : (
        notes.map((n, i) => (
          <View
            key={n.id}
            className={`pt-2 ${i > 0 ? 'mt-1 border-t border-sand' : ''}`}>
            <Text className="text-sm text-ink">{n.content}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

function AddNote({
  stationId,
  familyId,
  createdBy,
}: {
  stationId: string;
  familyId: string | null;
  createdBy?: string;
}) {
  const [kind, setKind] = useState<StationNoteKind>('parking');
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
        kind,
        content: content.trim(),
        createdBy,
      });
      setContent('');
      notify('등록 완료', '도착 난이도 메모가 추가됐어요.');
    } catch (e: any) {
      notify('오류', e?.message ?? '저장에 실패했습니다.');
    }
  }

  return (
    <Card className="mt-1">
      <Text className="mb-3 text-base font-semibold text-ink">메모 추가</Text>
      <View className="mb-3 flex-row gap-2">
        {KINDS.map((k) => {
          const active = k.key === kind;
          return (
            <Pressable
              key={k.key}
              onPress={() => setKind(k.key)}
              className={`flex-1 items-center rounded-card border py-2 ${
                active ? 'border-terracotta bg-terracotta/10' : 'border-sand'
              }`}>
              <Text className={active ? 'text-terracotta' : 'text-muted'}>{k.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextField
        value={content}
        onChangeText={setContent}
        placeholder="예: 지하 2층, 주차 30분 무료, 진입 게이트 좁음"
        multiline
      />
      <Button label="메모 추가" onPress={submit} loading={add.isPending} />
    </Card>
  );
}
