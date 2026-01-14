import React from 'react';
import {Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle} from 'react-native';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      backgroundColor: '#1976d2',
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#1976d2',
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    destructive: {
      backgroundColor: '#d32f2f',
    },
  };

  const sizeStyles: Record<string, ViewStyle> = {
    default: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    sm: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    lg: {
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    icon: {
      padding: 12,
    },
  };

  const textVariantStyles: Record<string, TextStyle> = {
    default: {
      color: '#ffffff',
    },
    outline: {
      color: '#1976d2',
    },
    ghost: {
      color: '#1976d2',
    },
    destructive: {
      color: '#ffffff',
    },
  };

  const textSizeStyles: Record<string, TextStyle> = {
    default: {
      fontSize: 16,
    },
    sm: {
      fontSize: 14,
    },
    lg: {
      fontSize: 18,
    },
    icon: {
      fontSize: 16,
    },
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({pressed}) => [
        styles.button,
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#1976d2' : '#ffffff'} />
      ) : (
        <Text style={[styles.text, textVariantStyles[variant], textSizeStyles[size]]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
