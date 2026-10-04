import { useEffect, useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Interactive bar chart (react-native-svg). Tap a bar to select it; the
 * selected value is shown in a floating tooltip above the bars.
 */
export function BarChart({
  data,
  height = 180,
  formatValue,
  testID,
}: {
  data: BarDatum[];
  height?: number;
  formatValue?: (v: number) => string;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (data.length) setSelected(data.length - 1);
  }, [data.length]);

  const topPad = 30; // room for tooltip
  const labelH = 22;
  const plotH = height - topPad - labelH;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const gap = n > 0 ? Math.min(16, Math.max(6, width * 0.035)) : 0;
  const barW = n > 0 && width > 0 ? Math.max(8, (width - gap * (n - 1)) / n) : 0;
  const fmt = formatValue ?? ((v: number) => String(v));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const sel = selected !== null ? data[selected] : null;
  const selX = selected !== null ? selected * (barW + gap) + barW / 2 : 0;
  const tooltipW = 110;
  const tipLeft = Math.min(Math.max(0, selX - tooltipW / 2), Math.max(0, width - tooltipW));

  return (
    <View onLayout={onLayout} style={{ height }} testID={testID}>
      {width > 0 && n > 0 ? (
        <>
          <Svg width={width} height={height}>
            <Line x1={0} y1={topPad + plotH} x2={width} y2={topPad + plotH} stroke={colors.border} strokeWidth={1} />
            {data.map((d, i) => {
              const bh = Math.max(2, (d.value / max) * plotH);
              const x = i * (barW + gap);
              const y = topPad + plotH - bh;
              const active = selected === i;
              return (
                <Rect key={i} x={x} y={y} width={barW} height={bh} rx={6} fill={active ? colors.brandPrimary : colors.brandTertiary} />
              );
            })}
          </Svg>

          {/* tooltip */}
          {sel ? (
            <View style={[styles.tooltip, { left: tipLeft, width: tooltipW }]} pointerEvents="none">
              <Text style={styles.tooltipValue} numberOfLines={1}>{fmt(sel.value)}</Text>
            </View>
          ) : null}

          {/* touch overlays + x labels */}
          <View style={styles.overlay} pointerEvents="box-none">
            {data.map((d, i) => {
              const x = i * (barW + gap);
              return (
                <Pressable
                  key={i}
                  testID={`bar-${i}`}
                  onPress={() => setSelected(i)}
                  style={{ position: "absolute", left: x, top: 0, width: barW, height: height - labelH }}
                />
              );
            })}
            {data.map((d, i) => {
              const x = i * (barW + gap);
              return (
                <Text
                  key={`l-${i}`}
                  style={[styles.xLabel, { left: x, width: barW, bottom: 0 }, selected === i && styles.xLabelActive]}
                  numberOfLines={1}
                >
                  {d.label}
                </Text>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  xLabel: { position: "absolute", textAlign: "center", fontSize: 11, color: colors.muted, fontWeight: "600" },
  xLabelActive: { color: colors.brandPrimary, fontWeight: "800" },
  tooltip: {
    position: "absolute",
    top: 0,
    backgroundColor: colors.onSurface,
    borderRadius: radius.md,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  tooltipValue: { color: colors.surfaceSecondary, fontSize: 12, fontWeight: "800" },
}));
