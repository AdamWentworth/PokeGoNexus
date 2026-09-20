import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  NativeHomeOnboardingProgress,
  NativeHomeOnboardingTask,
} from '../features/home/nativeHomeDashboardModel';
import { NativeUiIcon, type NativeUiIconName } from './NativeUiIcon';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  displayName: string;
  light: boolean;
  onDismiss: () => void;
  onNavigate: (path: string) => void;
  progress: NativeHomeOnboardingProgress;
};

const taskIcons: Record<NativeHomeOnboardingTask['id'], NativeUiIconName> = {
  collection: 'diamond',
  wanted: 'heart',
  trade: 'trade',
  connect: 'search',
};

export const NativeHomeOnboarding = ({
  displayName,
  light,
  onDismiss,
  onNavigate,
  progress,
}: Props) => {
  const percent = Math.round((progress.completed / progress.total) * 100);
  const dismiss = () => {
    const startedAt = Date.now();
    onDismiss();
    markNativeUiPerformanceAfterPaint('home_onboarding_dismiss_result_painted', startedAt);
  };

  return (
    <View
      accessibilityLabel={`${progress.completed} of ${progress.total} setup milestones complete`}
      style={[styles.root, light && styles.rootLight]}
      testID="native-home-onboarding"
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>WELCOME, {displayName.toLocaleUpperCase()}</Text>
        <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>
          Let’s make your account useful.
        </Text>
        <Text style={[styles.lead, light && styles.mutedLight]}>
          Start with the collection you already know. We’ll reveal the trading workflow as you build it.
        </Text>
        <View style={styles.progressCopy}>
          <Text style={[styles.progressText, light && styles.mutedLight]}>
            <Text style={[styles.progressStrong, light && styles.textLight]}>{progress.completed} of {progress.total}</Text> milestones complete
          </Text>
          <Text style={[styles.progressPercent, light && styles.textLight]}>{percent}%</Text>
        </View>
        <View style={[styles.progressTrack, light && styles.progressTrackLight]}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
      </View>

      <View accessibilityRole="list" style={styles.tasks}>
        {progress.tasks.map((task, index) => (
          <View
            accessibilityRole="summary"
            key={task.id}
            style={[
              styles.task,
              light && styles.taskLight,
              task.complete && styles.taskComplete,
              task.complete && light && styles.taskCompleteLight,
            ]}
          >
            <View style={[styles.taskNumber, task.complete && styles.taskNumberComplete]}>
              <Text style={[styles.taskNumberText, task.complete && styles.taskNumberTextComplete]}>
                {task.complete ? '✓' : index + 1}
              </Text>
            </View>
            <View style={[styles.taskGlyph, light && styles.taskGlyphLight]}>
              <NativeUiIcon color="#299cf5" name={taskIcons[task.id]} size={20} />
            </View>
            <View style={styles.taskCopy}>
              <Text style={[styles.taskTitle, light && styles.textLight]}>{task.title}</Text>
              <Text style={[styles.taskDescription, light && styles.mutedLight]}>{task.description}</Text>
            </View>
            {task.complete ? (
              <View style={[styles.doneBadge, light && styles.doneBadgeLight]}>
                <Text style={styles.doneText}>Done</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="link"
                onPress={() => onNavigate(task.to)}
                style={({ pressed }) => [styles.taskAction, pressed && styles.pressed]}
              >
                <Text style={styles.taskActionText}>{task.action}</Text>
                <Text style={styles.taskActionArrow}>›</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="link"
          onPress={() => onNavigate('/getting-started')}
          style={({ pressed }) => [styles.guideLink, pressed && styles.pressed]}
        >
          <Text style={[styles.guideLinkText, light && styles.guideLinkTextLight]}>Read the complete guide</Text>
          <Text style={[styles.guideLinkArrow, light && styles.guideLinkTextLight]}>›</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={dismiss}
          style={({ pressed }) => [styles.dashboardButton, pressed && styles.pressed]}
        >
          <Text style={styles.dashboardButtonText}>Open trainer dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { overflow: 'hidden', borderWidth: 1, borderColor: '#324c52', borderRadius: 18, backgroundColor: '#12191b' },
  rootLight: { borderColor: '#bfd3d1', backgroundColor: '#ffffff' },
  intro: { gap: 8, padding: 18, paddingBottom: 16 },
  eyebrow: { color: '#299cf5', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#f8fcfd', fontSize: 28, fontWeight: '900', letterSpacing: -0.6, lineHeight: 32 },
  lead: { maxWidth: 680, color: '#aab8bb', fontSize: 14, lineHeight: 20 },
  progressCopy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 },
  progressText: { color: '#aab8bb', fontSize: 12 },
  progressStrong: { color: '#f8fcfd', fontWeight: '900' },
  progressPercent: { color: '#f8fcfd', fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 99, backgroundColor: '#283436' },
  progressTrackLight: { backgroundColor: '#dfe9e8' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: '#299cf5' },
  tasks: { borderTopWidth: 1, borderTopColor: '#324045' },
  task: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2d393d', backgroundColor: '#0d1214' },
  taskLight: { borderBottomColor: '#dae5e3', backgroundColor: '#f8fbfa' },
  taskComplete: { backgroundColor: '#0e211b' },
  taskCompleteLight: { backgroundColor: '#ecf8f3' },
  taskNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#253034' },
  taskNumberComplete: { backgroundColor: '#35c984' },
  taskNumberText: { color: '#d8e3e5', fontSize: 12, fontWeight: '900' },
  taskNumberTextComplete: { color: '#071511' },
  taskGlyph: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#172a3a' },
  taskGlyphLight: { backgroundColor: '#e3f1fb' },
  taskGlyphText: { color: '#299cf5', fontSize: 20, fontWeight: '900' },
  taskCopy: { minWidth: 0, flex: 1, gap: 3 },
  taskTitle: { color: '#f8fcfd', fontSize: 13, fontWeight: '900' },
  taskDescription: { color: '#9eadaf', fontSize: 10, lineHeight: 14 },
  doneBadge: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#28795c', borderRadius: 99, backgroundColor: '#123d30' },
  doneBadgeLight: { backgroundColor: '#dff5eb' },
  doneText: { color: '#35c984', fontSize: 10, fontWeight: '900' },
  taskAction: { minHeight: 42, maxWidth: 104, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#299cf5' },
  taskActionText: { flexShrink: 1, color: '#06131c', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  taskActionArrow: { color: '#06131c', fontSize: 19, fontWeight: '900' },
  footer: { gap: 10, padding: 14 },
  guideLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  guideLinkText: { color: '#b7c5c7', fontSize: 12, fontWeight: '900' },
  guideLinkTextLight: { color: '#31555a' },
  guideLinkArrow: { color: '#b7c5c7', fontSize: 20, fontWeight: '900' },
  dashboardButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#299cf5' },
  dashboardButtonText: { color: '#06131c', fontSize: 13, fontWeight: '900' },
  textLight: { color: '#183c40' },
  mutedLight: { color: '#587174' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
