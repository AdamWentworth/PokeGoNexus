import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Appearance, DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';
import { reportCrash } from '../observability/crashReporter';
import { theme } from '../ui/theme';

type MobileErrorBoundaryProps = {
  children: ReactNode;
};

type MobileErrorBoundaryState = {
  hasError: boolean;
};

export class MobileErrorBoundary extends Component<
  MobileErrorBoundaryProps,
  MobileErrorBoundaryState
> {
  state: MobileErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): MobileErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    void reportCrash('react_error_boundary', error, {
      fatal: true,
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  private retry = (): void => {
    this.setState({ hasError: false });
  };

  private reload = (): void => {
    DevSettings.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const light = Appearance.getColorScheme() === 'light';
    return (
      <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={[styles.container, light && styles.containerLight]}>
        <Text style={[styles.title, light && styles.titleLight]}>Something went wrong</Text>
        <Text style={[styles.subtitle, light && styles.subtitleLight]}>
          Please try again. If it keeps happening, reload the app.
        </Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={this.retry} style={[styles.button, styles.primary]}>
            <Text style={styles.primaryText}>Try Again</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={this.reload} style={[styles.button, styles.secondary, light && styles.secondaryLight]}>
            <Text style={[styles.secondaryText, light && styles.secondaryTextLight]}>Reload</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  containerLight: { backgroundColor: '#f8fff9' },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.title,
    fontWeight: '700',
  },
  titleLight: { color: '#173b42' },
  subtitle: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  subtitleLight: { color: '#50645f' },
  actions: { width: '100%', maxWidth: 380, flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  primary: { backgroundColor: '#2196f3' },
  primaryText: { color: '#ffffff', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: '#536467', backgroundColor: '#171f20' },
  secondaryLight: { borderColor: '#a5b3b5', backgroundColor: '#ffffff' },
  secondaryText: { color: '#ffffff', fontWeight: '900' },
  secondaryTextLight: { color: '#173b42' },
});
