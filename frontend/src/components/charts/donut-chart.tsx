import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { makeStyles, spacing, useTheme } from "@/src/theme";

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

/**
 * Interactive donut chart (react-native-svg). Tap a legend row to highlight its
 * slice; the center shows the selected slice's share, or the grand total.
 */
export function DonutChart({
  data,
  size = 160,
  strokeWidth = 26,
  formatValue,
  testID,
}: {
  data: DonutDatum[];
  size?: number;
  strokeWidth?: number;
  formatValue?: (v: number) => string;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [data.length]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const fmt = formatValue ?? ((v: number) => String(v));

  let acc = 0;
  const segments = data.map((d, i) => {
    const frac = total > 0 ? d.value / total : 0;
    const dash = frac * C;
    const offset = acc;
    acc += dash;
    return { d, i, dash, offset, frac };
  });

  const sel = selected !== null ? data[selected] : null;
  const centerTop = sel ? `${Math.round((sel.value / (total || 1)) * 100)}%` : fmt(total);
  const centerSub = sel ? sel.label : "Total";

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${cx} ${cy})`}>
            <Circle cx={cx} cy={cy} r={r} stroke={colors.surfaceTertiary} strokeWidth={strokeWidth} fill="none" />
            {total > 0
              ? segments.map((s) => (
                  <Circle
                    key={s.i}
                    cx={cx}
                    cy={cy}
                    r={r}
                    stroke={s.d.color}
                    strokeWidth={selected === s.i ? strokeWidth + 6 : strokeWidth}
                    strokeDasharray={`${s.dash} ${C - s.dash}`}
                    strokeDashoffset={-s.offset}
                    strokeLinecap="butt"
                    fill="none"
                    opacity={selected === null || selected === s.i ? 1 : 0.35}
                  />
                ))
              : null}
          </G>
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit>{centerTop}</Text>
          <Text style={styles.centerLabel} numberOfLines={1}>{centerSub}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {data.map((d, i) => (
          <Pressable
            key={d.label}
            testID={`donut-legend-${i}`}
            onPress={() => setSelected((p) => (p === i ? null : i))}
            style={({ pressed }) => [styles.legendRow, pressed && styles.pressed]}
          >
            <View style={[styles.dot, { backgroundColor: d.color }]} />
            <Text style={[styles.legendLabel, selected === i && styles.legendActive]} numberOfLines={1}>{d.label}</Text>
            <Text style={styles.legendValue}>{fmt(d.value)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  centerValue: { fontSize: 20, fontWeight: "900", color: colors.onSurface },
  centerLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  legend: { flex: 1, gap: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { opacity: 0.6 },
  dot: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  legendActive: { color: colors.onSurface, fontWeight: "800" },
  legendValue: { fontSize: 13, fontWeight: "800", color: colors.onSurface, fontVariant: ["tabular-nums"] },
}));
