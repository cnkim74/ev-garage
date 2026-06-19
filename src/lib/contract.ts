/**
 * 렌트/리스 약정거리 계산 — "연간 약정거리 + 경과 기간(계약일→오늘)" 기준.
 *
 * 핵심 개념:
 *  - 입력 distanceKm 는 **연간 약정 주행거리**(km/년).
 *  - 오늘까지 허용량(allowedToDate) = 연간약정 × 경과일수 / 365.
 *  - 약정 사용률(usagePct) = 실제 주행 / 오늘까지 허용량.
 *      · 100% = 페이스에 딱 맞음, 초과면 너무 많이 탄 것.
 *  - 만료 시 초과 예상 = 현재 페이스를 계약 만료까지 유지했을 때
 *      전체 약정(연간약정 × 총기간/365) 대비 초과 km.
 *
 * 순수 함수로 두어 단위 테스트와 화면 재사용이 쉽도록 한다.
 *
 * ⚠️ 법적 안전장치: 위약금 "금액"은 절대 단정하지 않는다.
 *    초과는 거리(km) 추정치로만 표기하고, 정산은 계약서 확인을 안내한다.
 */

export type ContractStatus = 'green' | 'amber' | 'red';

export interface ContractInput {
  contractDistanceKm: number; // 연간 약정 주행거리 (km/년)
  startOdoKm: number; // 계약 시작 시 주행거리
  currentOdoKm: number; // 현재(최신) 주행거리
  startDate: Date | string; // 계약 시작일
  endDate: Date | string; // 계약 만료일
  today?: Date; // 기준일(기본: 현재)
}

export interface ContractResult {
  used: number; // 계약 시작 후 실제 누적 주행
  annualLimitKm: number; // 연간 약정거리 (입력값)
  allowedToDate: number; // 오늘까지 허용 주행거리 (연간약정 × 경과일/365)
  usagePct: number; // 사용률 = used / allowedToDate (1 초과 가능)
  paceRemaining: number; // allowedToDate - used (양수=페이스 여유, 음수=페이스 초과)

  elapsedDays: number;
  remainingDays: number;
  totalDays: number;

  currentDailyAvg: number; // 현재 일평균 (km/일)
  targetDailyAvg: number; // 적정 일평균 = 연간약정 / 365 (km/일)

  totalAllowanceKm: number; // 전체 약정 한도 = 연간약정 × 총기간/365
  projectedEndOdo: number; // 만료 시 예상 주행거리
  projectedOverage: number; // >0 이면 만료 시 전체 약정 초과 예상 (km)

  status: ContractStatus;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** 일 단위 차이 (소수 없이 내림). a→b */
export function daysBetween(a: Date | string, b: Date | string): number {
  const diff = (toDate(b).getTime() - toDate(a).getTime()) / MS_PER_DAY;
  return Math.floor(diff);
}

export function computeContract(input: ContractInput): ContractResult {
  const today = input.today ?? new Date();

  const annualLimitKm = input.contractDistanceKm;
  const used = input.currentOdoKm - input.startOdoKm;

  const elapsedDays = Math.max(daysBetween(input.startDate, today), 1);
  const remainingDays = Math.max(daysBetween(today, input.endDate), 1);
  const totalDays = Math.max(daysBetween(input.startDate, input.endDate), 1);

  // 오늘까지 허용량(연간약정을 경과일에 비례 배분) 기준 사용률
  const allowedToDate = (annualLimitKm * elapsedDays) / DAYS_PER_YEAR;
  const usagePct = allowedToDate > 0 ? used / allowedToDate : 0;
  const paceRemaining = allowedToDate - used;

  // 일평균 페이스
  const currentDailyAvg = used / elapsedDays;
  const targetDailyAvg = annualLimitKm / DAYS_PER_YEAR;

  // 만료 시 전체 약정 대비 초과 예상
  const totalAllowanceKm = (annualLimitKm * totalDays) / DAYS_PER_YEAR;
  const projectedEndOdo = input.currentOdoKm + currentDailyAvg * remainingDays;
  const projectedTotalUsed = projectedEndOdo - input.startOdoKm;
  const projectedOverage = projectedTotalUsed - totalAllowanceKm;

  // 상태색: 오늘까지 페이스 기준
  let status: ContractStatus;
  if (usagePct <= 0.9) status = 'green';
  else if (usagePct <= 1.0) status = 'amber';
  else status = 'red';

  return {
    used,
    annualLimitKm,
    allowedToDate,
    usagePct,
    paceRemaining,
    elapsedDays,
    remainingDays,
    totalDays,
    currentDailyAvg,
    targetDailyAvg,
    totalAllowanceKm,
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
  // projectedOverage <= 0 이므로 전체 약정 대비 여유 = -projectedOverage
  const km = Math.round(Math.max(-result.projectedOverage, 0));
  return `현재 페이스 유지 시 약정 내 종료 예상 (전체 약정 대비 여유 약 ${km.toLocaleString()} km)`;
}
