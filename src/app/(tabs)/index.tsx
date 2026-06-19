import { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Placeholder, ScreenHeader } from '../../components/Card';
import { Gauge } from '../../components/Gauge';
import { Screen } from '../../components/Screen';
import { computeContract, type ContractStatus } from '../../lib/contract';
import { useChargeLogs, useContract, useVehicles, type Vehicle } from '../../lib/queries';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/auth';

const STATUS_COLOR: Record<ContractStatus, string> = {
  green: colors.leaf,
  amber: colors.amber,
  red: colors.terracotta,
};
const OWNERSHIP_LABEL: Record<string, string> = { own: '자가', rent: '렌트', lease: '리스' };
const km = (n: number) => `${Math.round(n).toLocaleString()} km`;
const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

function isThisMonth(iso: string, now: Date) {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function Home() {
  const { profile } = useAuth();
  const familyId = profile?.family_id ?? null;
  const { data: vehicles, isLoading } = useVehicles(familyId);
  const { data: logs } = useChargeLogs(familyId);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const month = (logs ?? []).filter((l) => isThisMonth(l.charged_at, now));
    const cost = month.reduce((s, l) => s + (l.cost_krw ?? 0), 0);
    return { count: month.length, cost };
  }, [logs]);

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="우리 차고" />
        <ActivityIndicator color={colors.terracotta} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="우리 차고" subtitle="가족 차량 한눈에 보기" />

      <Card className="mb-4">
        <Text className="text-sm text-muted">이번 달 충전</Text>
        <View className="mt-1 flex-row items-end justify-between">
          <Text className="text-2xl font-bold text-ink">{won(monthSummary.cost)}</Text>
          <Text className="text-sm text-muted">{monthSummary.count}건</Text>
        </View>
      </Card>

      {!vehicles?.length ? (
        <Placeholder note="등록된 차량이 없어요. 설정 탭에서 차량을 추가해 주세요." />
      ) : (
        vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)
      )}
    </Screen>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const { data: contract } = useContract(vehicle.id);
  const isRental = vehicle.ownership_type !== 'own';

  return (
    <Card className="mb-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-lg font-bold text-ink">{vehicle.nickname}</Text>
          {vehicle.model ? <Text className="text-sm text-muted">{vehicle.model}</Text> : null}
        </View>
        <View className="rounded-pill bg-cream px-3 py-1">
          <Text className="text-xs font-semibold text-muted">
            {OWNERSHIP_LABEL[vehicle.ownership_type] ?? vehicle.ownership_type}
          </Text>
        </View>
      </View>

      {isRental && contract ? (
        <ContractMini vehicle={vehicle} contract={contract} />
      ) : (
        <View className="mt-3 flex-row items-end justify-between">
          <Text className="text-sm text-muted">현재 주행거리</Text>
          <Text className="text-xl font-bold text-ink">{km(vehicle.current_odo_km)}</Text>
        </View>
      )}
    </Card>
  );
}

function ContractMini({
  vehicle,
  contract,
}: {
  vehicle: Vehicle;
  contract: NonNullable<ReturnType<typeof useContract>['data']>;
}) {
  const r = computeContract({
    contractDistanceKm: contract.contract_distance_km,
    startOdoKm: contract.start_odo_km,
    currentOdoKm: vehicle.current_odo_km,
    startDate: contract.start_date,
    endDate: contract.end_date,
  });
  const color = STATUS_COLOR[r.status];

  return (
    <View className="mt-3">
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-sm text-muted">오늘까지 페이스</Text>
        <Text className="text-lg font-bold" style={{ color }}>
          {Math.round(r.usagePct * 100)}%
        </Text>
      </View>
      <Gauge pct={r.usagePct} status={r.status} />
      <Text className="mt-2 text-xs text-muted">
        {r.paceRemaining >= 0
          ? `예상보다 ${km(r.paceRemaining)} 적게 · 주행 ${km(vehicle.current_odo_km)}`
          : `예상보다 ${km(-r.paceRemaining)} 많이 · 주행 ${km(vehicle.current_odo_km)}`}
      </Text>
    </View>
  );
}
