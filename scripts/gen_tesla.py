#!/usr/bin/env python3
# Google Maps 수집(raw) → 슈퍼차저만 필터 + 중복제거 + 최근접 시 지명 → TS 시드 생성
import json, math, os

HERE = os.path.dirname(__file__)
raw = json.load(open(os.path.join(HERE, 'tesla_raw.json'), encoding='utf-8'))

# 최근접 시/군/구 (좌표) — 이름 부여용
CITIES = {
 '서울':(37.5665,126.9780),'인천':(37.4563,126.7052),'수원':(37.2636,127.0286),'성남':(37.4200,127.1267),
 '용인':(37.2411,127.1776),'화성':(37.1996,126.8311),'안양':(37.3943,126.9568),'부천':(37.5034,126.766),
 '안산':(37.3219,126.8309),'평택':(36.9921,127.1129),'의왕':(37.3447,126.9683),'광명':(37.4787,126.8645),
 '군포':(37.3617,126.9352),'오산':(37.1499,127.0775),'김포':(37.6152,126.7156),'고양':(37.6584,126.832),
 '파주':(37.7599,126.78),'의정부':(37.738,127.0337),'남양주':(37.636,127.2165),'구리':(37.5943,127.1296),
 '하남':(37.5392,127.2148),'경기광주':(37.4292,127.2549),'이천':(37.2722,127.435),'여주':(37.2983,127.6372),
 '가평':(37.8315,127.5095),'안성':(37.0078,127.2797),'춘천':(37.8813,127.7298),'원주':(37.3422,127.9202),
 '강릉':(37.7519,128.8761),'속초':(38.207,128.5918),'동해':(37.5247,129.1143),'삼척':(37.4499,129.1655),
 '평창':(37.3705,128.3903),'인제':(38.0697,128.1707),'양양':(38.0754,128.6190),'영월':(37.1836,128.4617),
 '고성':(38.3806,128.4678),'대전':(36.3504,127.3845),'세종':(36.48,127.289),'천안':(36.8151,127.1139),
 '청주':(36.6424,127.489),'충주':(36.9910,127.926),'제천':(37.1326,128.191),'음성':(36.9405,127.6906),
 '진천':(36.8553,127.4355),'공주':(36.4466,127.119),'논산':(36.187,127.0986),'부여':(36.2756,126.9099),
 '보령':(36.3334,126.6128),'당진':(36.8893,126.6457),'광주':(35.1595,126.8526),'전주':(35.8242,127.148),
 '군산':(35.9676,126.7369),'익산':(35.9483,126.9576),'임실':(35.6178,127.2889),'순천':(34.9506,127.4872),
 '여수':(34.7604,127.6622),'광양':(34.9407,127.696),'목포':(34.8118,126.3922),'장흥':(34.6816,126.9072),
 '화순':(35.0645,126.9866),'부산':(35.1796,129.0756),'울산':(35.5384,129.3114),'대구':(35.8714,128.6014),
 '경주':(35.8562,129.2247),'포항':(36.019,129.3435),'김천':(36.1398,128.1135),'구미':(36.1196,128.3441),
 '안동':(36.5684,128.7294),'청도':(35.6473,128.7341),'고령':(35.7261,128.2628),'울진':(36.993,129.4),
 '진주':(35.1803,128.1076),'김해':(35.2285,128.8894),'창원':(35.2281,128.6811),'양산':(35.335,129.0379),
 '거제':(34.8806,128.6211),'함양':(35.5205,127.7253),'하동':(35.0673,127.7513),'제주':(33.4996,126.5312),
 '서귀포':(33.2541,126.56),'기장':(35.2445,129.2223),
}

def hav(a,b,c,d):
    R=6371; dl=math.radians(c-a); dn=math.radians(d-b)
    x=math.sin(dl/2)**2+math.cos(math.radians(a))*math.cos(math.radians(c))*math.sin(dn/2)**2
    return R*2*math.atan2(math.sqrt(x),math.sqrt(1-x))

def nearest_city(lat,lng):
    best=None; bd=1e9
    for nm,(cy,cx) in CITIES.items():
        d=hav(lat,lng,cy,cx)
        if d<bd: bd=d; best=nm
    return best

STORE_CATS={'테슬라 쇼룸','자동차 수리점','자동차 정비소','회사 사무실'}
def is_supercharger(it):
    t=it['title']; cat=it['cat']
    if 'Destination' in t: return False           # 데스티네이션(완속) 제외
    has_sc = ('Supercharger' in t) or ('Superchager' in t) or ('수퍼차저' in t) or ('슈퍼차저' in t)
    if not has_sc: return False
    if cat in STORE_CATS: return False             # 스토어/서비스센터 제외
    return True

# 필터 + 중복제거(약 120m)
seen=[]; out=[]
for it in raw:
    if not is_supercharger(it): continue
    lat,lng=it['lat'],it['lng']
    dup=any(hav(lat,lng,s[0],s[1])<0.12 for s in seen)
    if dup: continue
    seen.append((lat,lng))
    out.append((lat,lng))

# 같은 시 내 번호 부여
from collections import defaultdict
cnt=defaultdict(int); named=[]
for lat,lng in out:
    c=nearest_city(lat,lng); cnt[c]+=1
    named.append((c,lat,lng))
total_by=defaultdict(int)
for c,_,_ in named: total_by[c]+=1
idx=defaultdict(int); rows=[]
for c,lat,lng in named:
    idx[c]+=1
    nm = f'{c} 테슬라 슈퍼차저' if total_by[c]==1 else f'{c} 테슬라 슈퍼차저 {idx[c]}'
    rows.append((nm,lat,lng))

rows.sort(key=lambda r:(r[0]))
print(f'슈퍼차저 {len(rows)}곳 (원본 {len(raw)})')

# TS 파일 생성
lines=[]
for nm,lat,lng in rows:
    lines.append(f"  {{ nm: '{nm}', lat: {lat}, lng: {lng} }},")
body="\n".join(lines)
ts=f"""import type {{ Station }} from '../lib/queries';

// 한국 테슬라 슈퍼차저 ({len(rows)}곳) — Google Maps(2026-06) 수집 → 슈퍼차저만 필터·중복제거.
// 공공(환경부) 데이터에 없는 폐쇄망이라 별도 시드. 실시간 사용가능/기수는 비공개.
interface TeslaSeed {{ nm: string; lat: number; lng: number; }}

const SEED: TeslaSeed[] = [
{body}
];

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {{
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}}

function toStation(seed: TeslaSeed, from?: {{ lat: number; lng: number }}): Station {{
  return {{
    statId: `tesla:${{seed.nm}}`,
    statNm: seed.nm,
    addr: null,
    lat: seed.lat,
    lng: seed.lng,
    busiNm: '테슬라 슈퍼차저',
    parkingFree: false,
    available: 0,
    total: 0,
    distanceKm: from ? haversineKm(from.lat, from.lng, seed.lat, seed.lng) : null,
    isTesla: true,
  }};
}}

/** 기준 좌표에서 가까운 순으로 정렬된 테슬라 슈퍼차저 목록 */
export function teslaSuperchargersNear(from: {{ lat: number; lng: number }}): Station[] {{
  return SEED.map((s) => toStation(s, from)).sort(
    (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
  );
}}

export const TESLA_COUNT = SEED.length;
"""
open(os.path.join(HERE,'..','src','data','teslaSuperchargers.ts'),'w',encoding='utf-8').write(ts)
print('생성: src/data/teslaSuperchargers.ts')
