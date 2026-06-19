/**
 * 렌트/리스 약정거리 계산 — PROJECT_BRIEF.md §3 의 로직을 그대로 구현.
 * 순수 함수로 두어 단위 테스트와 화면 재사용이 쉽도록 한다.
 *
 * ⚠️ 법적 안전장치: 위약금 "금액"은 절대 단정하지 않는다.
 *    초과 예상은 거리(km) 추정치로만 표기하고, 정산은 계약서 확인을 안내한다.
 */

export type ContractStatus = 'green' | 'amber' | 'red';

export interface ContractInput {
  contractDistanceKm: number; // 약정 한도 (예: 50000)
  startOdoKm: number; // 계약 시작 시 주행거리
  currentOdoKm: number; // 현재(최신) 주행거리
  startDate: Date | string; // 계약 시작일
  endDate: Date | string; // 계약 만료일
  today?: Date; // 기준일(기본: 현재)
}

export interface ContractResult {
  used: number; // 약정 기간 누적 주행
  remaining: number; // 남은 여유 (음수면 이미 초과)
  usedPct: number; // 0~1+ (사용 비율)
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  currentDailyAvg: number; // 현재 페이스 (km/일)
  safeDailyAvg: number; // 안전 페이스 (km/일)
  projectedEndOdo: number; // 만료 시 예상 주행거리
  projectedOverage: number; // >0 이면 만료 시 초과 예상 (km)
  status: ContractStatus;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** 일 단위 차이 (소수 없이 내림, 최소 0). a→b */
export function daysBetween(a: Date | string, b: Date | string): number {
  const diff = (toDate(b).getTime() - toDate(a).getTime()) / MS_PER_DAY;
  return Math.floor(diff);
}

export function computeContract(input: ContractInput): ContractResult {
  const today = input.today ?? new Date();

  const used = input.currentOdoKm - input.startOdoKm;
  const remaining = input.contractDistanceKm - used;
  const usedPct =
    input.contractDistanceKm > 0 ? used / input.contractDistanceKm : 0;

  const totalDays = Math.max(daysBetween(input.startDate, input.endDate), 1);
  const elapsedDays = Math.max(daysBetween(input.startDate, today), 1);
  const remainingDays = Math.max(daysBetween(today, input.endDate), 1);

  const currentDailyAvg = used / elapsedDays;
  const safeDailyAvg = remaining / remainingDays;

  const projectedEndOdo = input.currentOdoKm + currentDailyAvg * remainingDays;
  const projectedOverage =
    projectedEndOdo - (input.startOdoKm + input.contractDistanceKm);

  let status: ContractStatus;
  if (currentDailyAvg <= safeDailyAvg * 0.9) status = 'green';
  else if (currentDailyAvg <= safeDailyAvg) status = 'amber';
  else status = 'red';

  return {
    used,
    remaining,
    usedPct,
    totalDays,
    elapsedDays,
    remainingDays,
    currentDailyAvg,
    safeDailyAvg,
    projectedEndOdo,
    projectedOverage,
    status,
  };
}

/** 만료 시 초과 예상 안내 문구 (위약금 단정 금지) */
export function overageNotice(result: ContractResult): string {
  if (result.projectedOverage > 0) {
    const km = Math.round(result.projectedOverage);
    return `만료 시 약 +${km.toLocaleString()} km 초과 예상 (추정치이며 위약금·정산은 계약서를 확인하세요)`;
  }
  const km = Math.round(Math.max(result.remaining, 0));
  return `현재 페이스 유지 시 약정 내 종료 예상 (여유 약 ${km.toLocaleString()} km)`;
}
