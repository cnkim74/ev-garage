import { Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

export function TextField({
  label,
  hint,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View className="mb-4">
      {label ? <Text className="mb-1.5 text-sm font-medium text-ink">{label}</Text> : null}
      <TextInput
        placeholderTextColor="#8a857b"
        className="rounded-card border border-sand bg-white/70 px-4 py-3.5 text-base text-ink"
        {...props}
      />
      {hint ? <Text className="mt-1 text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}
