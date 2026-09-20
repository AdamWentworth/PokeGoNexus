import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  FRIENDSHIP_DAMAGE_BONUS,
  MEGA_ALLY_DAMAGE_BONUS,
} from '@pokemongonexus/app-core/raid-model';
import type {
  NativeRaidAttackerLevel,
  NativeRaidBossMovesetMode,
  NativeRaidDodgeStrategy,
  NativeRaidFriendship,
  NativeRaidMegaAlly,
  NativeRaidPartyPower,
  NativeRaidPartyPowerStrategy,
  NativeRaidSettings,
  NativeRaidShadowBossMode,
} from '../../features/tools/nativeBattleModels';
import { NATIVE_BATTLE_TYPES } from '../../features/tools/nativeBattleModels';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

type Props = {
  collapsible?: boolean;
  includeAttackerLevel?: boolean;
  includeBossControls?: boolean;
  includeMonteCarloOption?: boolean;
  includeRelobbyControls?: boolean;
  includeShadowControls?: boolean;
  onChange: (settings: NativeRaidSettings) => void;
  onShadowBossModeChange?: (mode: NativeRaidShadowBossMode) => void;
  onShadowRaidChange?: (enabled: boolean) => void;
  selectedBossIsShadowRaid?: boolean;
  settings: NativeRaidSettings;
  shadowBossMode?: NativeRaidShadowBossMode;
  shadowMechanicsEnabled?: boolean;
  shadowRaid?: boolean;
};

type Choice<T extends string | number> = { label: string; value: T };

const ChoiceRow = <T extends string | number>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Choice<T>[];
  value: T;
}) => {
  const light = useNativeColorScheme() === 'light';
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, light && styles.mutedLight]}>{label}</Text>
      <View accessibilityLabel={label} style={styles.choices}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={[styles.choice, light && styles.choiceLight, selected && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, light && styles.textLight, selected && styles.choiceTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export const NativeRaidSettingsPanel = ({
  collapsible = false,
  includeAttackerLevel = true,
  includeBossControls = false,
  includeMonteCarloOption = false,
  includeRelobbyControls = true,
  includeShadowControls = false,
  onChange,
  onShadowBossModeChange,
  onShadowRaidChange,
  selectedBossIsShadowRaid = false,
  settings,
  shadowBossMode = 'subdued',
  shadowMechanicsEnabled = false,
  shadowRaid = false,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const [open, setOpen] = useState(!collapsible);
  const openStartedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!collapsible || !open || openStartedAtRef.current == null) return;
    markNativeUiPerformanceAfterPaint('raid_battle_settings_painted', openStartedAtRef.current);
    openStartedAtRef.current = null;
  }, [collapsible, open]);
  const update = <K extends keyof NativeRaidSettings>(key: K, value: NativeRaidSettings[K]) => {
    if (settings[key] === value) return;
    onChange({ ...settings, [key]: value });
  };
  const customSettingCount = [
    includeAttackerLevel && settings.attackerLevel !== '50.0',
    settings.friendship !== 'none',
    settings.megaAllyBonus !== 'none',
    settings.partyPower !== 'none',
    Boolean(settings.weatherBoostedType),
    includeRelobbyControls && settings.relobbySeconds !== 10,
    includeBossControls && settings.dodgeStrategy !== 'none',
    includeBossControls && settings.bossMovesetMode !== 'expected',
    includeShadowControls && shadowMechanicsEnabled,
  ].filter(Boolean).length;
  const fields = (
    <View accessibilityLabel="Ranking settings" style={[styles.panel, light && styles.panelLight]}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>BATTLE SETTINGS</Text>
        <Text style={[styles.title, light && styles.textLight]}>Ranking conditions</Text>
      </View>
      {includeAttackerLevel ? <ChoiceRow<NativeRaidAttackerLevel>
        label="Attacker level"
        onChange={(value) => update('attackerLevel', value)}
        options={['40.0', '50.0', '51.0'].map((value) => ({ label: `Level ${value.replace('.0', '')}`, value: value as NativeRaidAttackerLevel }))}
        value={settings.attackerLevel}
      /> : null}
      <ChoiceRow<NativeRaidFriendship>
        label="Friendship"
        onChange={(value) => update('friendship', value)}
        options={[
          { label: `No friendship (${FRIENDSHIP_DAMAGE_BONUS.none.toFixed(2)}x)`, value: 'none' },
          { label: `Good (${FRIENDSHIP_DAMAGE_BONUS.good.toFixed(2)}x)`, value: 'good' },
          { label: `Great (${FRIENDSHIP_DAMAGE_BONUS.great.toFixed(2)}x)`, value: 'great' },
          { label: `Ultra (${FRIENDSHIP_DAMAGE_BONUS.ultra.toFixed(2)}x)`, value: 'ultra' },
          { label: `Best (${FRIENDSHIP_DAMAGE_BONUS.best.toFixed(2)}x)`, value: 'best' },
        ]}
        value={settings.friendship}
      />
      <ChoiceRow<NativeRaidMegaAlly>
        label="Mega ally"
        onChange={(value) => update('megaAllyBonus', value)}
        options={[
          { label: `No Mega ally (${MEGA_ALLY_DAMAGE_BONUS.none.toFixed(1)}x)`, value: 'none' },
          { label: `Mega ally (${MEGA_ALLY_DAMAGE_BONUS.general.toFixed(1)}x)`, value: 'general' },
          { label: `Matching Mega (${MEGA_ALLY_DAMAGE_BONUS.matching.toFixed(1)}x)`, value: 'matching' },
        ]}
        value={settings.megaAllyBonus}
      />
      <ChoiceRow<NativeRaidPartyPower>
        label="Party Power"
        onChange={(value) => update('partyPower', value)}
        options={[
          { label: 'No Party Power', value: 'none' }, { label: 'Party of 2', value: 'party2' },
          { label: 'Party of 3', value: 'party3' }, { label: 'Party of 4', value: 'party4' },
        ]}
        value={settings.partyPower}
      />
      {includeBossControls && settings.partyPower !== 'none' ? (
        <ChoiceRow<NativeRaidPartyPowerStrategy>
          label="Party Power timing"
          onChange={(value) => update('partyPowerStrategy', value)}
          options={[
            { label: 'Activate as soon as ready', value: 'immediate' },
            { label: 'Use on next Charged Attack', value: 'next-charged' },
            { label: 'Save for strongest Charged Attack', value: 'strongest-charged' },
            { label: 'Manual timing (no automatic use)', value: 'manual' },
          ]}
          value={settings.partyPowerStrategy}
        />
      ) : null}
      {includeRelobbyControls ? <ChoiceRow<number>
        label="Relobby delay"
        onChange={(value) => update('relobbySeconds', value)}
        options={[0, 5, 10, 15, 20].map((value) => ({ label: value === 0 ? 'No delay' : `${value} seconds`, value }))}
        value={settings.relobbySeconds}
      /> : null}
      <ChoiceRow<string>
        label="Weather boost"
        onChange={(value) => update('weatherBoostedType', value)}
        options={[
          { label: 'No weather boost', value: '' },
          ...NATIVE_BATTLE_TYPES.map((value) => ({ label: value.charAt(0).toUpperCase() + value.slice(1), value })),
        ]}
        value={settings.weatherBoostedType}
      />
      {includeBossControls ? (
        <>
          <ChoiceRow<NativeRaidDodgeStrategy>
            label="Dodging"
            onChange={(value) => update('dodgeStrategy', value)}
            options={[
              { label: 'No dodging', value: 'none' },
              { label: 'Charged attacks', value: 'charged' },
            ]}
            value={settings.dodgeStrategy}
          />
          <ChoiceRow<NativeRaidBossMovesetMode>
            label="Boss behavior"
            onChange={(value) => update('bossMovesetMode', value)}
            options={[
              { label: 'Expected across legal movesets', value: 'expected' },
              ...(includeMonteCarloOption ? [{ label: 'Monte Carlo distribution (32+ trials)', value: 'monte-carlo' } as const] : []),
              { label: 'Favorable incoming moveset', value: 'favorable' },
              { label: 'Hostile incoming moveset', value: 'hostile' },
            ]}
            value={settings.bossMovesetMode}
          />
        </>
      ) : null}
      {includeShadowControls ? (
        <View style={[styles.shadowSection, light && styles.shadowSectionLight]}>
          <View style={styles.shadowHeading}>
            <Text style={styles.shadowEyebrow}>SHADOW RAID</Text>
            <Text style={[styles.shadowCopy, light && styles.mutedLight]}>Compare the enraged boss with its subdued state.</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: selectedBossIsShadowRaid, selected: shadowMechanicsEnabled }} disabled={selectedBossIsShadowRaid} onPress={() => onShadowRaidChange?.(!shadowRaid)} style={[styles.shadowToggle, shadowMechanicsEnabled && styles.choiceActive, selectedBossIsShadowRaid && styles.disabled]}><Text style={[styles.choiceText, shadowMechanicsEnabled && styles.choiceTextActive]}>{selectedBossIsShadowRaid ? 'Shadow raid data' : 'Shadow raid'}</Text></Pressable>
          {shadowMechanicsEnabled ? <ChoiceRow<NativeRaidShadowBossMode>
            label="Shadow boss state"
            onChange={(value) => onShadowBossModeChange?.(value)}
            options={[{ label: 'Subdued', value: 'subdued' }, { label: 'Enraged', value: 'enraged' }]}
            value={shadowBossMode}
          /> : null}
        </View>
      ) : null}
    </View>
  );
  if (!collapsible) return fields;
  return (
    <View style={[styles.collapsible, light && styles.panelLight]}>
      <Pressable accessibilityLabel="Battle settings" accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => { if (!open) openStartedAtRef.current = Date.now(); setOpen((current) => !current); }} style={styles.collapsibleToggle}>
        <Text style={styles.collapsibleIcon}>☷</Text><View style={styles.collapsibleCopy}><Text style={[styles.collapsibleTitle, light && styles.textLight]}>Battle settings</Text><Text style={[styles.collapsibleMeta, light && styles.mutedLight]}>{customSettingCount === 0 ? 'Standard conditions' : `${customSettingCount} custom setting${customSettingCount === 1 ? '' : 's'}`}</Text></View><Text style={[styles.collapsibleChevron, light && styles.textLight]}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open ? fields : null}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { gap: 13, borderWidth: 1, borderColor: '#355052', borderRadius: 13, padding: 12, backgroundColor: '#101819' },
  panelLight: { borderColor: '#b9cdcd', backgroundColor: '#fff' },
  heading: { gap: 2 },
  eyebrow: { color: '#2fd6d0', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#fff', fontSize: 17, fontWeight: '900' },
  field: { gap: 6 },
  fieldLabel: { color: '#a7b8b9', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  choice: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: '#465658', borderRadius: 999, paddingHorizontal: 11, backgroundColor: '#20292a' },
  choiceLight: { borderColor: '#b8c8c8', backgroundColor: '#eef4f4' },
  choiceActive: { borderColor: '#2fd6d0', backgroundColor: '#45dbc4' },
  choiceText: { color: '#dce8e8', fontSize: 10, fontWeight: '900' },
  choiceTextActive: { color: '#071214' },
  shadowSection: { gap: 8, borderWidth: 1, borderColor: '#7f5da8', borderRadius: 11, padding: 9, backgroundColor: '#271936' },
  shadowSectionLight: { backgroundColor: '#f5edff' },
  shadowHeading: { gap: 2 },
  shadowEyebrow: { color: '#d8b7ff', fontSize: 8, fontWeight: '900', letterSpacing: .9 },
  shadowCopy: { color: '#cbb5df', fontSize: 9.5, lineHeight: 13 },
  shadowToggle: { minHeight: 36, alignSelf: 'flex-start', justifyContent: 'center', borderWidth: 1, borderColor: '#7f5da8', borderRadius: 999, paddingHorizontal: 12, backgroundColor: '#3b2750' },
  disabled: { opacity: .55 },
  collapsible: { overflow: 'hidden', borderWidth: 1, borderColor: '#355052', borderRadius: 11, backgroundColor: '#172223' },
  collapsibleToggle: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  collapsibleIcon: { color: '#50ddd4', fontSize: 18 },
  collapsibleCopy: { minWidth: 0, flex: 1 },
  collapsibleTitle: { color: '#fff', fontSize: 12, fontWeight: '900' },
  collapsibleMeta: { color: '#9fb1b2', fontSize: 8.5 },
  collapsibleChevron: { color: '#fff', fontSize: 12, fontWeight: '900' },
  textLight: { color: '#142629' },
  mutedLight: { color: '#657879' },
});
