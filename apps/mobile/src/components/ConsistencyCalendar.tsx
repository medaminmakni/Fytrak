import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { colors } from '../theme/colors';
import { toLocalDateKey } from '../utils/dateKeys';

type Props = {
  workouts: { createdAt?: any }[];
};

const DAYS_TO_SHOW = 110; // ~15 weeks
const BOX_SIZE = 12;
const GAP = 3;

export function ConsistencyCalendar({ workouts }: Props) {
  const data = useMemo(() => {
    const activity: Record<string, number> = {};
    
    workouts.forEach(w => {
      if (!w.createdAt) return;
      const date = w.createdAt.toDate ? w.createdAt.toDate() : new Date(w.createdAt);
      const key = toLocalDateKey(date);
      activity[key] = (activity[key] || 0) + 1;
    });

    const days = [];
    const today = new Date();
    
    for (let i = DAYS_TO_SHOW; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = toLocalDateKey(d);
      days.push({
        date: key,
        count: activity[key] || 0,
        dayOfWeek: d.getDay()
      });
    }
    
    // Group into weeks for column-based rendering
    const weeks = [];
    let currentWeek: any[] = [];
    
    // Pad first week if needed
    const firstDay = new Date(days[0].date).getDay();
    for(let j=0; j<firstDay; j++) currentWeek.push(null);

    days.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);
    
    return weeks;
  }, [workouts]);

  const getColor = (count: number) => {
    if (count === 0) return colors.surfaceInset;
    if (count === 1) return '#0e4429';
    if (count === 2) return '#006d32';
    if (count === 3) return '#26a641';
    return '#39d353';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>CONSISTENCY</Text>
        <View style={styles.legend}>
          <View style={[styles.box, { backgroundColor: colors.surfaceInset }]} />
          <View style={[styles.box, { backgroundColor: '#39d353' }]} />
          <Text style={styles.legendText}>LEVELS</Text>
        </View>
      </View>
      <View style={styles.calendar}>
        {data.map((week, weekIdx) => (
          <View key={weekIdx} style={styles.weekColumn}>
            {week.map((day, dayIdx) => (
              <View 
                key={dayIdx} 
                style={[
                  styles.box, 
                  day ? { backgroundColor: getColor(day.count) } : { backgroundColor: 'transparent' }
                ]} 
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceInset,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    marginStart: 4,
  },
  calendar: {
    flexDirection: 'row',
    gap: GAP,
  },
  weekColumn: {
    gap: GAP,
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: 2,
  }
});
