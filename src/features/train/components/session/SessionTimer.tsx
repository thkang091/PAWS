import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { theme } from "@/constants/theme";

export const SessionTimer = ({ running, onTick }: { running: boolean; onTick: (seconds: number) => void }) => {
  const [seconds, setSeconds] = useState(0);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    onTickRef.current(seconds);
  }, [seconds]);

  return <Text style={styles.timer}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</Text>;
};

const styles = StyleSheet.create({
  timer: { color: theme.colors.primaryDark, fontSize: theme.typography.xxl, fontWeight: "900", textAlign: "center" },
});
