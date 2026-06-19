import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { confirmAsync, notify } from '../../lib/notify';
import {
  useAddVehicle,
  useDeleteVehicle,
  useUpdateDisplayName,
  useUpdateVehicle,
  useVehicles,
  type Vehicle,
} from '../../lib/queries';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/auth';
import type { OwnershipType } from '../../types/database';

const OWNERSHIP: { key: OwnershipType; label: string }[] = [
  { key: 'own', label: '자가' },
  { key: 'rent', label: '렌트' },
  { key: 'lease', label: '리스' },
];
const km = (n: number) => `${Math.round(n).toLocaleString()} km`;

export default function Settings() {
  const { profile, signOut, refreshProfile } = useAuth();
  const familyId = profile?.family_id ?? null;
  const { data: vehicles } = useVehicles(familyId);

  const { data: family } = useQuery({
    queryKey: ['family', familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select('name, invite_code')
        .eq('id', familyId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [adding, setAdding] = useState(false);

  return (
    <Screen>
      <ScreenHeader title="설정" />

      <Card className="mb-4">
        <Text className="text-sm font-semibold text-ink">가족</Text>
        <Text className="mt-1 text-lg font-bold text-ink">{family?.name ?? '—'}</Text>
        <View className="mt-3 rounded-card bg-cream px-4 py-3">
          <Text className="text-xs text-muted">초대코드 (가족 합류 시 공유)</Text>
          <Text className="mt-0.5 text-2xl font-bold tracking-widest text-terracotta">
            {family?.invite_code ?? '······'}
          </Text>
        </View>
      </Card>

      <DisplayNameCard
        current={profile?.display_name ?? ''}
        userId={profile?.id}
        onSaved={refreshProfile}
      />

      <View className="mb-2 mt-2 flex-row items-center justify-between">
        <Text className="text-base font-bold text-ink">차량 관리</Text>
        <Pressable onPress={() => setAdding((v) => !v)}>
          <Text className="text-sm font-semibold text-terracotta">{adding ? '닫기' : '+ 추가'}</Text>
        </Pressable>
      </View>

      {adding && familyId && (
        <VehicleForm
          familyId={familyId}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      )}

      {(vehicles ?? []).map((v) => (
        <VehicleItem key={v.id} vehicle={v} />
      ))}
      {!vehicles?.length && !adding && (
        <Card className="mb-4">
          <Text className="text-sm text-muted">등록된 차량이 없어요. "+ 추가"로 등록하세요.</Text>
        </Card>
      )}

      <View className="mt-2">
        <Button variant="outline" label="로그아웃" onPress={signOut} />
      </View>
    </Screen>
  );
}

function DisplayNameCard({
  current,
  userId,
  onSaved,
}: {
  current: string;
  userId?: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(current);
  const update = useUpdateDisplayName();
  const dirty = name.trim() !== current && name.trim().length > 0;

  return (
    <Card className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-ink">표시 이름</Text>
      <TextField value={name} onChangeText={setName} placeholder="예: 찬연" />
      {dirty && userId ? (
        <Button
          label="이름 저장"
          loading={update.isPending}
          onPress={async () => {
            try {
              await update.mutateAsync({ userId, displayName: name.trim() });
              onSaved();
              notify('저장 완료', '표시 이름을 변경했어요.');
            } catch (e: any) {
              notify('오류', e?.message ?? '저장 실패');
            }
          }}
        />
      ) : null}
    </Card>
  );
}

function VehicleItem({ vehicle }: { vehicle: Vehicle }) {
  const [editing, setEditing] = useState(false);
  const del = useDeleteVehicle();
  const label = OWNERSHIP.find((o) => o.key === vehicle.ownership_type)?.label ?? vehicle.ownership_type;

  if (editing) {
    return (
      <VehicleForm
        vehicle={vehicle}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <Card className="mb-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-base font-bold text-ink">{vehicle.nickname}</Text>
          <Text className="mt-0.5 text-xs text-muted">
            {label} · {km(vehicle.current_odo_km)}
            {vehicle.model ? ` · ${vehicle.model}` : ''}
          </Text>
        </View>
        <View className="flex-row gap-3">
          <Pressable onPress={() => setEditing(true)} hitSlop={6}>
            <Text className="text-sm font-semibold text-ocean">편집</Text>
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={async () => {
              const ok = await confirmAsync(
                `${vehicle.nickname} 삭제`,
                '차량과 관련된 약정·주행·충전 기록도 함께 삭제됩니다. 계속할까요?',
                '삭제',
              );
              if (!ok) return;
              try {
                await del.mutateAsync(vehicle.id);
                notify('삭제 완료', '차량을 삭제했어요.');
              } catch (e: any) {
                notify('오류', e?.message ?? '삭제 실패');
              }
            }}>
            <Text className="text-sm font-semibold text-terracotta">삭제</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

function VehicleForm({
  familyId,
  vehicle,
  onDone,
  onCancel,
}: {
  familyId?: string;
  vehicle?: Vehicle;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!vehicle;
  const [nickname, setNickname] = useState(vehicle?.nickname ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [ownership, setOwnership] = useState<OwnershipType>(vehicle?.ownership_type ?? 'own');
  const [odo, setOdo] = useState(vehicle ? String(vehicle.current_odo_km) : '');
  const [plate, setPlate] = useState(vehicle?.plate ?? '');
  const add = useAddVehicle();
  const update = useUpdateVehicle();
  const pending = add.isPending || update.isPending;

  async function submit() {
    if (!nickname.trim()) {
      notify('입력 확인', '차량 별명을 입력하세요.');
      return;
    }
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: vehicle!.id,
          nickname: nickname.trim(),
          model: model.trim() || null,
          ownershipType: ownership,
          plate: plate.trim() || null,
        });
      } else {
        await add.mutateAsync({
          familyId: familyId!,
          nickname: nickname.trim(),
          model: model.trim() || null,
          ownershipType: ownership,
          currentOdoKm: parseInt(odo, 10) || 0,
          plate: plate.trim() || null,
        });
      }
      notify('저장 완료', isEdit ? '차량 정보를 수정했어요.' : '차량을 추가했어요.');
      onDone();
    } catch (e: any) {
      notify('오류', e?.message ?? '저장 실패');
    }
  }

  return (
    <Card className="mb-3">
      <Text className="mb-3 text-base font-semibold text-ink">{isEdit ? '차량 편집' : '차량 추가'}</Text>
      <TextField label="별명" value={nickname} onChangeText={setNickname} placeholder="예: EV6" />
      <TextField label="모델 (선택)" value={model} onChangeText={setModel} placeholder="예: 기아 EV6 롱레인지" />
      <Text className="mb-1.5 text-sm font-medium text-ink">소유 형태</Text>
      <View className="mb-4 flex-row gap-2">
        {OWNERSHIP.map((o) => {
          const active = ownership === o.key;
          return (
            <Pressable
              key={o.key}
              onPress={() => setOwnership(o.key)}
              className={`flex-1 items-center rounded-card border py-2.5 ${
                active ? 'border-terracotta bg-terracotta/10' : 'border-sand'
              }`}>
              <Text className={active ? 'text-terracotta' : 'text-muted'}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!isEdit && (
        <TextField
          label="현재 주행거리 (km)"
          value={odo}
          onChangeText={setOdo}
          keyboardType="number-pad"
          placeholder="예: 12000"
        />
      )}
      <TextField label="차량 번호 (선택)" value={plate} onChangeText={setPlate} placeholder="예: 12가 3456" />
      <Button label={isEdit ? '수정 저장' : '차량 추가'} onPress={submit} loading={pending} />
      <View className="mt-3">
        <Button variant="ghost" label="취소" onPress={onCancel} />
      </View>
    </Card>
  );
}
