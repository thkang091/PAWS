import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedRef,
  useReducedMotion,
  useScrollViewOffset,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeftIcon } from "phosphor-react-native";

import { AnonymousAccountWarningModal } from "@/components/account/AnonymousAccountWarningModal";
import { HEADER_HEIGHT, ScrollHeader } from "@/features/profile/components/ScrollHeader";
import { PressScale } from "@/components/ui/PressScale";
import { Panel, PanelRow, glyphFor } from "@/features/profile/components/ProfilePanels";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { HoldToReset } from "@/features/profile/components/HoldToReset";
import { canReset, resetAccount } from "@/services/resetService";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useAuth } from "@/providers/AuthProvider";
import {
  bg,
  border,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

export default function ProfileSettingsScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollViewOffset(scrollRef);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { signOut } = useAuth();
  const dog = useCurrentDog();
  const account = useAccountStatus();
  const name = dog.data?.name ?? "your dog";
  // Only rows that go somewhere. Nothing here is a placeholder.
  const settingsGroups = [
    {
      label: "PAWS",
      rows: [
        { key: "notifications", title: "Notifications", hint: "Reminders, check-ins and nudges", href: "/notifications-settings" },
        { key: "account", title: "Account", hint: account.data?.isAnonymous ? "Add a way to sign in on a new phone" : "How you sign in", href: "/account/link" },
      ],
    },
    {
      label: name,
      rows: [
        { key: "data", title: "Medical record", hint: "Share a PDF with your vet", href: "/profile/health" },
        { key: "records", title: "Health records", hint: "Visits, tests and doses", href: "/care/records" },
      ],
    },
  ];

  const enter = (order: number) =>
    reduceMotion
      ? undefined
      : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + HEADER_HEIGHT, paddingBottom: insets.bottom + space.block },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        <Animated.View entering={enter(0)}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.lede}>{`The app, your account, and ${name}'s records.`}</Text>
        </Animated.View>

        {settingsGroups.map((group, groupIndex) => (
          <Animated.View key={group.label} entering={enter(1 + groupIndex)}>
            <Panel title={`${group.label}.`} size="section">
              {group.rows.map((row) => (
                <PanelRow
                  key={row.key}
                  icon={glyphFor(row.key)}
                  label={row.title}
                  sub={row.hint}
                  onPress={() => (row.href ? router.push(row.href as never) : undefined)}
                />
              ))}
            </Panel>
          </Animated.View>
        ))}

        {canReset(account.data?.email) ? (
          <Animated.View entering={enter(1 + settingsGroups.length)}>
            <HoldToReset
              name={name}
              onConfirm={async () => {
                await resetAccount();
                router.replace("/welcome");
              }}
            />
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(2 + settingsGroups.length)} style={styles.out}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            scaleTo={0.97}
            style={styles.signOut}
            onPress={() => setConfirming(true)}
          >
            <Text style={styles.signOutLabel}>Sign out</Text>
          </PressScale>
          <Text style={styles.version}>
            {account.data?.isAnonymous === false || account.data?.hasRecoverableIdentity
              ? `PAWS · ${name}'s records are saved to your account`
              : `PAWS · Link an account so ${name}'s records survive a new phone`}
          </Text>
        </Animated.View>
      </Animated.ScrollView>

      <ScrollHeader
        scrollY={scrollY}
        title="Settings"
        appearAt={insets.top + 96}
        insetTop={insets.top}
        left={
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={styles.glyphButton}
            onPress={() => router.back()}
          >
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
        }
      />

      <AnonymousAccountWarningModal
        visible={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (signingOut) return;
          setSigningOut(true);
          signOut()
            .then(() => {
              setConfirming(false);
              router.replace("/");
            })
            .catch(() => {
              setSigningOut(false);
            });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  content: { paddingHorizontal: layout.gutter },
  title: { ...type.pageTitle, color: text.primary, marginTop: space.lg },
  lede: { ...type.body, color: text.secondary, marginTop: space.sm },


  out: { marginTop: space.block, alignItems: "center", gap: space.lg },
  signOut: {
    alignSelf: "stretch",
    height: layout.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
  },
  signOutLabel: { ...type.supporting, fontWeight: "500", color: text.secondary },
  version: { ...type.caption, color: text.tertiary },

  glyphButton: {
    width: iconSize.nav,
    height: HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});
