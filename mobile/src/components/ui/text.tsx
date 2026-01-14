import React from 'react';
import {Text as RNText, StyleSheet, TextProps as RNTextProps} from 'react-native';

interface TextProps extends RNTextProps {
  variant?: 'default' | 'heading' | 'subheading' | 'caption' | 'body';
}

export function Text({children, variant = 'default', style, ...props}: TextProps) {
  return (
    <RNText style={[styles.base, styles[variant], style]} {...props}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: '#212121',
  },
  default: {
    fontSize: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subheading: {
    fontSize: 20,
    fontWeight: '600',
  },
  caption: {
    fontSize: 12,
    color: '#757575',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});
