import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { Gauge } from '../../components/Gauge';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { computeContract, overageNotice, type ContractStatus } from '../../lib/contract';
import {
  scanFromCamera,
  scanFromLibrary,
  scanFromPdf,
  type ScanResult,
} from '../../lib/contractScan';
import { notify } from '../../lib/notify';
import {
  useAddOdoReading,
  useContract,
  useUpsertContract,
  useVehicles,
  type RentContract,
  type Vehicle,
} from '../../lib/queries';
import { colors } from '../../lib/theme';
import { useAuth } from '../../providers/auth';

const STATUS_COLOR: Record<ContractStatus, string> = {
  green: colors.leaf,
  amber: colors.amber,
  red: colors.terracotta,
};

const km = (n: number) => `${Math.round(n).toLocaleString()} km`;

export default function Contract() {
  const { profile } = useAuth();
  const familyId = profile?.family_id ?? null;
  const { data: vehicles, isLoading } = useVehicles(familyId);

  const [selectedId, setSelectedId] = useState<string | undefined>();

  // 차량 로드되면 기본 선택: 첫 rent/lease 차량, 없으면 첫 차량
  useEffect(() => {
    if (!vehicles?.length) return;
    if (selectedId && vehicles.some((v) => v.id === selectedId)) return;
    const rental = vehicles.find((v) => v.ownership_type !== 'own');
    setSelectedId((rental ?? vehicles[0]).id);
  }, [vehicles, selectedId]);

  const selected = useMemo(
    () => vehicles?.find((v) => v.id === selectedId),
    [vehicles, selectedId],
  );

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="약정거리" />
        <ActivityIndicator color={colors.terracotta} />
      </Screen>
    );
  }

  if (!vehicles?.length) {
    return (
      <Screen>
        <ScreenHeader title="약정거리" subtitle="등록된 차량이 없어요" />
        <Card>
          <Text className="text-base text-muted">
            먼저 설정 탭에서 차량을 등록하면 약정거리를 관리할 수 있어요.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="약정거리" subtitle="남은 여유 · 일평균 페이스 · 만료 예상" />

      {vehicles.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pb-3">
          {vehicles.map((v) => {
            const active = v.id === selectedId;
            return (
              <Pressable
                key={v.id}
                onPress={() => setSelectedId(v.id)}
                className={`rounded-pill border px-4 py-2 ${
                  active ? 'border-terracotta bg-terracotta/10' : 'border-sand'
                }`}>
                <Text className={active ? 'text-terracotta' : 'text-muted'}>{v.nickname}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selected && <VehicleContract key={selected.id} vehicle={selected} recordedBy={profile?.id} />}
    </Screen>
  );
}

function VehicleContract({ vehicle, recordedBy }: { vehicle: Vehicle; recordedBy?: string }) {
  const { data: contract, isLoading } = useContract(vehicle.id);
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <ActivityIndicator color={colors.terracotta} />;
  }

  // 자가 차량: 약정 개념 없음 → 주행거리만
  if (vehicle.ownership_type === 'own') {
    return (
      <View>
        <Card className="mb-4">
          <Text className="text-sm text-muted">자가 차량</Text>
          <Text className="mt-1 text-3xl font-bold text-ink">{km(vehicle.current_odo_km)}</Text>
          <Text className="mt-1 text-sm text-muted">약정거리 제한이 없는 차량이에요.</Text>
        </Card>
        <OdoUpdater vehicle={vehicle} recordedBy={recordedBy} />
      </View>
    );
  }

  // 약정 미등록 또는 수정 모드 → 입력 폼
  if (!contract || editing) {
    return (
      <ContractForm
        vehicle={vehicle}
        initial={contract}
        onSaved={() => setEditing(false)}
        onCancel={contract ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <View>
      <ContractSummary vehicle={vehicle} contract={contract} />
      <View className="mb-4">
        <Button variant="outline" label="약정 정보 수정" onPress={() => setEditing(true)} />
      </View>
      <OdoUpdater vehicle={vehicle} recordedBy={recordedBy} />
    </View>
  );
}

function ContractSummary({ vehicle, contract }: { vehicle: Vehicle; contract: RentContract }) {
  const r = computeContract({
    contractDistanceKm: contract.contract_distance_km,
    startOdoKm: contract.start_odo_km,
    currentOdoKm: vehicle.current_odo_km,
    startDate: contract.start_date,
    endDate: contract.end_date,
  });
  const color = STATUS_COLOR[r.status];
  const pctText = `${Math.round(r.usagePct * 100)}%`;
  const overage = r.projectedOverage > 0;

  return (
    <View>
      <Card className="mb-4">
        <View className="mb-2 flex-row items-end justify-between">
          <Text className="text-sm text-muted">오늘까지 페이스</Text>
          <Text className="text-3xl font-bold" style={{ color }}>
            {pctText}
          </Text>
        </View>
        <Gauge pct={r.usagePct} status={r.status} />
        <View className="mt-3 flex-row justify-between">
          <Text className="text-sm text-muted">
            실제 {km(r.used)} / 예상 {km(r.allowedToDate)}
          </Text>
          <Text className="text-sm font-semibold" style={{ color }}>
            {r.paceRemaining >= 0
              ? `예상보다 ${km(r.paceRemaining)} 적게`
              : `예상보다 ${km(-r.paceRemaining)} 많이`}
          </Text>
        </View>
        <Text className="mt-1 text-xs text-muted">
          연간 약정 {km(r.annualLimitKm)} 기준 · 계약 시작 후 {r.elapsedDays}일 경과
        </Text>
      </Card>

      <Card className="mb-4">
        <View className="flex-row justify-between">
          <View>
            <Text className="text-xs text-muted">현재 일평균</Text>
            <Text className="mt-1 text-xl font-bold text-ink">{km(r.currentDailyAvg)}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted">적정 일평균</Text>
            <Text className="mt-1 text-xl font-bold text-ink">{km(r.targetDailyAvg)}</Text>
          </View>
          <View>
            <Text className="text-xs text-muted">남은 기간</Text>
            <Text className="mt-1 text-xl font-bold text-ink">{r.remainingDays}일</Text>
          </View>
        </View>
      </Card>

      <Card className="mb-4" >
        <View
          className="rounded-card px-4 py-3"
          style={{ backgroundColor: `${color}1A` }}>
          <Text className="text-sm font-semibold" style={{ color }}>
            {overage ? '초과 위험' : '여유 있음'}
          </Text>
          <Text className="mt-1 text-sm text-ink">{overageNotice(r)}</Text>
        </View>
      </Card>
    </View>
  );
}

function OdoUpdater({ vehicle, recordedBy }: { vehicle: Vehicle; recordedBy?: string }) {
  const [value, setValue] = useState('');
  const addOdo = useAddOdoReading();

  async function submit() {
    const odo = parseInt(value, 10);
    if (!Number.isFinite(odo) || odo <= 0) {
      notify('입력 확인', '현재 주행거리(km)를 숫자로 입력하세요.');
      return;
    }
    if (odo < vehicle.current_odo_km) {
      notify('확인', `현재 기록(${km(vehicle.current_odo_km)})보다 작은 값이에요. 다시 확인해 주세요.`);
      return;
    }
    try {
      await addOdo.mutateAsync({ vehicleId: vehicle.id, odoKm: odo, recordedBy });
      setValue('');
      notify('기록 완료', `주행거리를 ${km(odo)}로 갱신했어요.`);
    } catch (e: any) {
      notify('오류', e?.message ?? '저장에 실패했습니다.');
    }
  }

  return (
    <Card>
      <Text className="text-sm font-semibold text-ink">주행거리 갱신</Text>
      <Text className="mt-1 text-xs text-muted">현재 기록: {km(vehicle.current_odo_km)}</Text>
      <View className="mt-3">
        <TextField
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder={`예: ${vehicle.current_odo_km + 100}`}
        />
        <Button label="갱신하기" onPress={submit} loading={addOdo.isPending} />
      </View>
    </Card>
  );
}

function ContractForm({
  vehicle,
  initial,
  onSaved,
  onCancel,
}: {
  vehicle: Vehicle;
  initial?: RentContract | null;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [distance, setDistance] = useState(
    initial ? String(initial.contract_distance_km) : '',
  );
  const [startOdo, setStartOdo] = useState(
    String(initial ? initial.start_odo_km : vehicle.current_odo_km),
  );
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [scanning, setScanning] = useState(false);
  const upsert = useUpsertContract();

  const dateOk = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());

  async function runScan(picker: () => Promise<ScanResult | null>) {
    setScanning(true);
    try {
      const r = await picker();
      if (!r) return; // 사용자가 취소
      if (!r.found) {
        notify('인식 실패', '계약서에서 약정 정보를 찾지 못했어요. 직접 입력해 주세요.');
        return;
      }
      if (r.contract_distance_km != null) setDistance(String(r.contract_distance_km));
      if (r.start_odo_km != null) setStartOdo(String(r.start_odo_km));
      if (r.start_date) setStartDate(r.start_date);
      if (r.end_date) setEndDate(r.end_date);
      const summary = [
        r.contract_distance_km != null ? `약정 ${r.contract_distance_km.toLocaleString()}km` : null,
        r.start_date && r.end_date ? `${r.start_date} ~ ${r.end_date}` : null,
        r.operator ? r.operator : null,
      ]
        .filter(Boolean)
        .join(' · ');
      notify('자동 입력 완료', `${summary || '값을 채웠어요'}\n\n계약서와 맞는지 확인 후 저장하세요.`);
    } catch (e: any) {
      notify('오류', e?.message ?? '계약서 인식에 실패했습니다.');
    } finally {
      setScanning(false);
    }
  }

  async function submit() {
    const dist = parseInt(distance, 10);
    const sOdo = parseInt(startOdo, 10);
    if (!Number.isFinite(dist) || dist <= 0) {
      notify('입력 확인', '약정 한도(km)를 숫자로 입력하세요. 예: 50000');
      return;
    }
    if (!dateOk(startDate) || !dateOk(endDate)) {
      notify('입력 확인', '날짜는 YYYY-MM-DD 형식으로 입력하세요. 예: 2026-01-15');
      return;
    }
    if (endDate.trim() < startDate.trim()) {
      notify('입력 확인', '만료일이 시작일보다 빠릅니다.');
      return;
    }
    try {
      await upsert.mutateAsync({
        vehicleId: vehicle.id,
        contractDistanceKm: dist,
        startOdoKm: Number.isFinite(sOdo) ? sOdo : 0,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
      });
      notify('저장 완료', '약정 정보가 저장됐어요. 게이지가 바로 표시됩니다.');
      onSaved?.();
    } catch (e: any) {
      notify('오류', e?.message ?? '저장에 실패했습니다.');
    }
  }

  return (
    <Card>
      <Text className="text-base font-semibold text-ink">{vehicle.nickname} 약정 정보 입력</Text>
      <Text className="mb-3 mt-1 text-xs text-muted">
        연간 약정거리와 계약 기간을 입력하면 계약일부터 오늘까지의 페이스를 계산해 드려요.
      </Text>

      <View className="mb-4 rounded-card border border-sand bg-cream p-3">
        <Text className="text-sm font-semibold text-ink">📄 계약서로 자동 입력</Text>
        <Text className="mb-3 mt-1 text-xs text-muted">
          계약서 사진이나 PDF를 올리면 약정 한도·기간을 자동으로 채워드려요.
        </Text>
        {scanning ? (
          <View className="flex-row items-center justify-center py-2">
            <ActivityIndicator color={colors.terracotta} />
            <Text className="ml-2 text-sm text-muted">계약서 인식 중…</Text>
          </View>
        ) : (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button variant="outline" label="카메라" onPress={() => runScan(scanFromCamera)} />
            </View>
            <View className="flex-1">
              <Button variant="outline" label="갤러리" onPress={() => runScan(scanFromLibrary)} />
            </View>
            <View className="flex-1">
              <Button variant="outline" label="PDF" onPress={() => runScan(scanFromPdf)} />
            </View>
          </View>
        )}
      </View>

      <TextField
        label="연간 약정 주행거리 (km/년)"
        value={distance}
        onChangeText={setDistance}
        keyboardType="number-pad"
        placeholder="예: 20000"
        hint="1년 기준 약정거리예요. 계약서가 '총 약정'만 표기하면 ÷ 계약연수 로 환산해 입력."
      />
      <TextField
        label="계약 시작 시 주행거리 (km)"
        value={startOdo}
        onChangeText={setStartOdo}
        keyboardType="number-pad"
        placeholder="예: 0"
        hint="계약 시작 시점의 주행거리예요. 보통 0 또는 인수 시 값."
      />
      <DateField
        label="계약 시작일"
        value={startDate}
        onChange={setStartDate}
        hint="직접 입력하거나 달력에서 선택하세요."
      />
      <DateField label="계약 만료일" value={endDate} onChange={setEndDate} />
      <Button
        label={initial ? '약정 정보 저장' : '약정 등록'}
        onPress={submit}
        loading={upsert.isPending}
      />
      {onCancel && (
        <View className="mt-3">
          <Button variant="ghost" label="취소" onPress={onCancel} />
        </View>
      )}
    </Card>
  );
}
