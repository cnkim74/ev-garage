import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'outline' | 'ghost';

const base = 'flex-row items-center justify-center rounded-card px-5 py-4';
const byVariant: Record<Variant, string> = {
  primary: 'bg-terracotta',
  outline: 'border border-sand bg-transparent',
  ghost: 'bg-transparent',
};
const textByVariant: Record<Variant, string> = {
  primary: 'text-cream',
  outline: 'text-ink',
  ghost: 'text-terracotta',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${base} ${byVariant[variant]} ${isDisabled ? 'opacity-50' : 'active:opacity-80'}`}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#f4f1ea' : '#c75b39'} />
      ) : (
        <Text className={`text-base font-semibold ${textByVariant[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
