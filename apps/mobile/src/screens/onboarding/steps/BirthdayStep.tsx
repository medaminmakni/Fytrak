import React, { useState, useRef } from 'react';
import { View, StyleSheet, Animated, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { OnboardingHeader } from '../../../components/OnboardingHeader';
import { Typography } from '../../../components/Typography';
import { PrimaryButton } from '../../../components/Button';

const ITEM_HEIGHT = 60;
const PICKER_HEIGHT = 300;
const INDICATOR_TOP = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

interface BirthdayStepProps {
  onNext: (date: string) => void;
  onBack: () => void;
}

export function BirthdayStep({ onNext, onBack }: BirthdayStepProps) {
  const currentYear = new Date().getFullYear();
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(2000);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const daysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth(month, year) }, (_, i) => i + 1);
  const years = Array.from({ length: 101 }, (_, i) => (currentYear - 100) + i);

  const initialYearIdx = years.indexOf(2000);

  const renderPicker = (data: any[], current: any, onChange: (v: any) => void, flex: number, label: string, initialIdx: number) => (
    <View style={[styles.pickerCol, { flex }]}>
      <Typography variant="label" color={colors.textDim} style={styles.colLabel}>{label}</Typography>
      <View style={styles.pickerWrapper}>
        <View style={styles.indicator} pointerEvents="none" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: initialIdx * ITEM_HEIGHT }}
          onScroll={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
            if (data[index] !== undefined) onChange(data[index]);
          }}
          scrollEventThrottle={16}
        >
          <View style={{ height: INDICATOR_TOP }} />
          {data.map((item, idx) => (
            <View key={idx} style={styles.item}>
              <Typography variant="h2" color={current === item ? '#fff' : '#333'} style={current === item ? styles.activeItem : {}}>{item}</Typography>
            </View>
          ))}
          <View style={{ height: INDICATOR_TOP }} />
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader onBack={onBack} progress={40} />
      <View style={styles.content}>
        <Typography variant="h1">Your Birthday</Typography>
        <Typography variant="subtitle" style={styles.subtitleSub}>Help us provide accurate health metrics.</Typography>

        <View style={styles.dateDisplay}>
          <Typography variant="metric">{months[month-1]} {day}, {year}</Typography>
        </View>

        <View style={styles.pickersContainer}>
          {renderPicker(months, months[month-1], (v) => setMonth(months.indexOf(v) + 1), 1.2, "Month", 0)}
          {renderPicker(days, day, setDay, 0.8, "Day", 0)}
          {renderPicker(years, year, setYear, 1.2, "Year", initialYearIdx)}
        </View>
      </View>
      <View style={styles.footer}>
        <PrimaryButton title="Continue" icon="arrow-forward" onPress={() => onNext(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 40 },
  subtitleSub: { marginTop: 10 },
  dateDisplay: { marginTop: 30, backgroundColor: '#161616', paddingVertical: 15, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  pickersContainer: { flex: 1, flexDirection: 'row', marginTop: 30, gap: 10 },
  pickerCol: { height: PICKER_HEIGHT },
  colLabel: { textAlign: 'center', marginBottom: 8 },
  pickerWrapper: { flex: 1, backgroundColor: '#0A0A0A', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  indicator: { position: 'absolute', top: INDICATOR_TOP, left: 8, right: 8, height: ITEM_HEIGHT, backgroundColor: '#161616', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  activeItem: { fontSize: 26 },
  footer: { padding: 24, paddingBottom: 40 },
});
