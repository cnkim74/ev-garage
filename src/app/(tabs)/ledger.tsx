import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { confirmAsync, notify } from '../../lib/notify';
import {
  useAddChargeLog,
  useChargeLogs,
  useDeleteChargeLog,
  useVehicles,
  type ChargeLog,
} from '../../lib/queries';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/auth';

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const pad = (n: number) => String(n).padStart(2, '0');
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function Ledger() {
  const { profile } = useAuth();
  const familyId = profile?.family_id ?? null;
  const { data: logs, isLoading } = useChargeLogs(familyId);
  const { data: vehicles } = useVehicles(familyId);

  const stats = useMemo(() => computeStats(logs ?? []), [logs]);

  return (
    <Screen>
      <ScreenHeader title="충전 가계부" subtitle="이번 달 충전비 · kWh · 평균 단가" />

      {isLoading ? (
        <ActivityIndicator color={colors.terracotta} />
      ) : (
        <>
          <Card className="mb-4">
            <Text className="text-sm text-muted">이번 달</Text>
            <Text className="mt-1 text-3xl font-bold text-ink">{won(stats.month.cost)}</Text>
            <View className="mt-3 flex-row justify-between">
              <Stat label="충전량" value={`${stats.month.kwh.toFixed(1)} kWh`} />
              <Stat label="평균 단가" value={stats.month.kwh > 0 ? `${Math.round(stats.month.cost / stats.month.kwh)}원/kWh` : '—'} />
              <Stat label="횟수" value={`${stats.month.count}회`} />
            </View>
          </Card>

          <Card className="mb-4">
            <Text className="mb-3 text-sm font-semibold text-ink">최근 6개월</Text>
            <MonthlyBars data={stats.months} />
          </Card>

          {stats.operators.length > 0 && (
            <Card className="mb-4">
              <Text className="mb-2 text-sm font-semibold text-ink">사업소별 합계</Text>
              {stats.operators.map((o, i) => (
                <View
                  key={o.name}
                  className={`flex-row justify-between py-2 ${i > 0 ? 'border-t border-sand' : ''}`}>
                  <Text className="text-sm text-ink">{o.name}</Text>
                  <Text className="text-sm font-semibold text-ink">{won(o.cost)}</Text>
                </View>
              ))}
            </Card>
          )}

          <RecentList logs={logs ?? []} />

          <AddChargeForm vehicles={vehicles ?? []} recordedBy={profile?.id} />
        </>
      )}
    </Screen>
  );
}

function RecentList({ logs }: { logs: ChargeLog[] }) {
  const del = useDeleteChargeLog();
  if (logs.length === 0) return null;
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <Card className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-ink">최근 기록</Text>
      {logs.slice(0, 20).map((l, i) => (
        <View
          key={l.id}
          className={`flex-row items-center justify-between py-2.5 ${
            i > 0 ? 'border-t border-sand' : ''
          }`}>
          <View className="flex-1 pr-2">
            <Text className="text-sm text-ink">
              {fmtDate(l.charged_at)} · {l.operator?.trim() || '기타'}
            </Text>
            <Text className="mt-0.5 text-xs text-muted">
              {l.kwh != null ? `${l.kwh} kWh` : '—'}
              {l.cost_krw != null ? ` · ${won(l.cost_krw)}` : ''}
            </Text>
          </View>
          <Pressable
            hitSlop={6}
            onPress={async () => {
              const ok = await confirmAsync(
                '충전 기록 삭제',
                `${fmtDate(l.charged_at)} ${l.operator?.trim() || '기타'} 기록을 삭제할까요?`,
                '삭제',
              );
              if (!ok) return;
              try {
                await del.mutateAsync(l.id);
                notify('삭제 완료', '충전 기록을 삭제했어요.');
              } catch (e: any) {
                notify('오류', e?.message ?? '삭제 실패');
              }
            }}>
            <Text className="text-sm font-semibold text-terracotta">삭제</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs text-muted">{label}</Text>
      <Text className="mt-1 text-base font-bold text-ink">{value}</Text>
    </View>
  );
}

interface MonthBucket {
  key: string;
  label: string;
  cost: number;
}

function computeStats(logs: ChargeLog[]) {
  const now = new Date();
  const inMonth = (l: ChargeLog) => {
    const d = new Date(l.charged_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const monthLogs = logs.filter(inMonth);
  const month = {
    cost: monthLogs.reduce((s, l) => s + (l.cost_krw ?? 0), 0),
    kwh: monthLogs.reduce((s, l) => s + (l.kwh ?? 0), 0),
    count: monthLogs.length,
  };

  // 최근 6개월 버킷
  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `${d.getMonth() + 1}월`, cost: 0 });
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const l of logs) {
    const d = new Date(l.charged_at);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idx.get(k);
    if (i != null) months[i].cost += l.cost_krw ?? 0;
  }

  // 사업소별
  const opMap = new Map<string, number>();
  for (const l of logs) {
    const name = l.operator?.trim() || '기타';
    opMap.set(name, (opMap.get(name) ?? 0) + (l.cost_krw ?? 0));
  }
  const operators = [...opMap.entries()]
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost);

  return { month, months, operators };
}

function MonthlyBars({ data }: { data: MonthBucket[] }) {
  const max = Math.max(...data.map((m) => m.cost), 1);
  return (
    <View className="flex-row items-end justify-between" style={{ height: 130 }}>
      {data.map((m) => {
        const h = Math.max((m.cost / max) * 96, m.cost > 0 ? 6 : 2);
        return (
          <View key={m.key} className="flex-1 items-center">
            <Text className="mb-1 text-[10px] text-muted">
              {m.cost > 0 ? `${Math.round(m.cost / 1000)}k` : ''}
            </Text>
            <View
              className="w-6 rounded-t-md"
              style={{ height: h, backgroundColor: m.cost > 0 ? colors.terracotta : colors.sand }}
            />
            <Text className="mt-1 text-xs text-muted">{m.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AddChargeForm({ vehicles, recordedBy }: { vehicles: { id: string; nickname: string }[]; recordedBy?: string }) {
  const [vehicleId, setVehicleId] = useState<string | undefined>();
  const [kwh, setKwh] = useState('');
  const [cost, setCost] = useState('');
  const [operator, setOperator] = useState('');
  const [date, setDate] = useState(todayYmd());
  const add = useAddChargeLog();

  useEffect(() => {
    if (!vehicleId && vehicles.length) setVehicleId(vehicles[0].id);
  }, [vehicles, vehicleId]);

  async function submit() {
    if (!vehicleId) {
      notify('차량 없음', '먼저 차량을 등록해 주세요.');
      return;
    }
    const kwhNum = kwh.trim() ? parseFloat(kwh) : null;
    const costNum = cost.trim() ? parseInt(cost, 10) : null;
    if (kwhNum == null && costNum == null) {
      notify('입력 확인', 'kWh 또는 비용 중 하나는 입력하세요.');
      return;
    }
    try {
      await add.mutateAsync({
        vehicleId,
        kwh: kwhNum,
        costKrw: costNum,
        operator: operator.trim() || null,
        chargedAt: date || null,
        recordedBy,
      });
      setKwh('');
      setCost('');
      setOperator('');
      notify('기록 완료', '충전 기록이 추가됐어요.');
    } catch (e: any) {
      notify('오류', e?.message ?? '저장에 실패했습니다.');
    }
  }

  return (
    <Card>
      <Text className="mb-3 text-base font-semibold text-ink">충전 기록 추가</Text>

      {vehicles.length > 1 && (
        <View className="mb-4 flex-row flex-wrap gap-2">
          {vehicles.map((v) => {
            const active = v.id === vehicleId;
            return (
              <Pressable
                key={v.id}
                onPress={() => setVehicleId(v.id)}
                className={`rounded-pill border px-4 py-2 ${active ? 'border-terracotta bg-terracotta/10' : 'border-sand'}`}>
                <Text className={active ? 'text-terracotta' : 'text-muted'}>{v.nickname}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View className="flex-row gap-2">
        <View className="flex-1">
          <TextField label="충전량 (kWh)" value={kwh} onChangeText={setKwh} keyboardType="decimal-pad" placeholder="예: 42.5" />
        </View>
        <View className="flex-1">
          <TextField label="비용 (원)" value={cost} onChangeText={setCost} keyboardType="number-pad" placeholder="예: 12000" />
        </View>
      </View>
      <TextField label="사업소 (선택)" value={operator} onChangeText={setOperator} placeholder="예: 환경부, 테슬라, EVSIS" />
      <DateField label="충전일" value={date} onChange={setDate} />
      <Button label="기록 추가" onPress={submit} loading={add.isPending} />
    </Card>
  );
}
