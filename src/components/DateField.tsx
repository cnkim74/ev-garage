import React, { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

// 네이티브에서만 로드 (웹 번들에서 실행되지 않음)
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function parse(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
}

/**
 * 날짜 입력 — 직접 입력(YYYY-MM-DD) + 달력 선택 둘 다 지원.
 * 웹: 브라우저 기본 날짜 선택기, 네이티브: OS 캘린더(@react-native-community/datetimepicker).
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <View className="mb-4">
      {label ? <Text className="mb-1.5 text-sm font-medium text-ink">{label}</Text> : null}
      <View className="flex-row items-stretch gap-2">
        <View className="flex-1">
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#8a857b"
            autoCapitalize="none"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            className="rounded-card border border-sand bg-white/70 px-4 py-3.5 text-base text-ink"
          />
        </View>
        <CalendarButton value={value} onChange={onChange} />
      </View>
      {hint ? <Text className="mt-1 text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}

function CalendarButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false); // 항상 호출(훅 순서 보존). 웹에선 미사용.

  if (Platform.OS === 'web') {
    // react-native-web 은 react-dom 기반이라 raw <input type="date"> 사용 가능
    return React.createElement('input', {
      type: 'date',
      value: isYmd(value) ? value : '',
      onChange: (e: any) => onChange(e.target.value),
      'aria-label': '날짜 선택',
      style: {
        border: '1px solid #e9e4d8',
        borderRadius: 12,
        padding: '0 12px',
        background: 'rgba(255,255,255,0.7)',
        color: '#2b2a27',
        fontSize: 16,
        fontFamily: 'inherit',
      },
    });
  }

  return (
    <>
      <Pressable
        onPress={() => setShow(true)}
        className="items-center justify-center rounded-card border border-sand bg-white/70 px-4 active:opacity-80">
        <Text className="text-lg">📅</Text>
      </Pressable>
      {show && DateTimePicker && (
        <DateTimePicker
          value={parse(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_e: unknown, d?: Date) => {
            setShow(false);
            if (d) onChange(fmt(d));
          }}
        />
      )}
    </>
  );
}
