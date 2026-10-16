import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { BarcodeIcon, BowlFoodIcon, MagnifyingGlassIcon, PawPrintIcon, PlusIcon, XIcon } from "phosphor-react-native";

import {
  keyOf,
  lookupBarcode,
  manualProduct,
  searchDatabase,
  searchWeb,
  type Product,
  type ProductKind,
} from "@/services/productLookup";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

type Status = "idle" | "looking" | "done" | "offline";

/** Search a product by name, scan its barcode, or add it by hand. Results stream in from the database and the web. */
export const ProductPicker = ({
  kind,
  placeholder,
  chosen,
  onPick,
}: {
  kind: ProductKind;
  placeholder: string;
  /** Names already picked, shown as ticked. */
  chosen?: readonly string[];
  onPick: (product: Product) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [manual, setManual] = useState(false);
  const [scanning, setScanning] = useState(false);
  const ticket = useRef(0);

  useEffect(() => {
    const terms = query.trim();
    if (terms.length < 2) {
      ticket.current += 1;
      setResults([]);
      setStatus("idle");
      return;
    }
    const mine = ++ticket.current;
    setStatus("looking");
    const timer = setTimeout(() => {
      let pending = 2;
      let webOffline = false;
      const add = (items: readonly Product[]) => {
        if (mine !== ticket.current) return;
        setResults((current) => {
          // Stores list the same product more than once; keep one of each, by name and by id.
          const seen = new Set(current.flatMap((p) => [keyOf(p.name), p.id]));
          const fresh = items.filter((p) => {
            if (seen.has(keyOf(p.name)) || seen.has(p.id)) return false;
            seen.add(keyOf(p.name));
            seen.add(p.id);
            return true;
          });
          // Shop results lead: they have photos owners recognise.
          const merged = items[0]?.origin === "web" ? [...fresh, ...current] : [...current, ...fresh];
          return merged.slice(0, 12);
        });
      };
      const settle = () => {
        pending -= 1;
        if (pending === 0 && mine === ticket.current) setStatus(webOffline ? "offline" : "done");
      };
      setResults([]);
      void searchDatabase(terms, kind)
        .then(add)
        .catch(() => undefined)
        .finally(settle);
      void searchWeb(terms, kind)
        .then((web) => {
          if (web === "offline") webOffline = true;
          else add(web);
        })
        .finally(settle);
    }, 420);
    return () => clearTimeout(timer);
  }, [query, kind]);

  const pick = (product: Product) => {
    void Haptics.selectionAsync();
    onPick(product);
    setQuery("");
    setManual(false);
  };

  const Glyph = kind === "treat" ? PawPrintIcon : BowlFoodIcon;
  const showEmpty = status !== "looking" && query.trim().length >= 2 && results.length === 0;

  return (
    <View>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <MagnifyingGlassIcon size={iconSize.standard} color={text.tertiary} weight="bold" />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={text.tertiary}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel={placeholder}
          />
          {status === "looking" ? <ActivityIndicator size="small" color={text.secondary} /> : null}
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Scan the barcode"
          scaleTo={0.92}
          style={styles.scan}
          onPress={() => {
            void Haptics.selectionAsync();
            setScanning(true);
          }}
        >
          <BarcodeIcon size={iconSize.standard} color={text.primary} weight="bold" />
        </PressScale>
      </View>

      <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)} style={styles.results}>
        {results.map((product, index) => {
          const on = chosen?.some((name) => keyOf(name) === keyOf(product.name)) ?? false;
          return (
            <Animated.View key={product.id} entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select).delay(Math.min(index, 5) * 30)}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`${product.name}${product.store ? `, ${product.store}` : ""}`}
                accessibilityState={{ selected: on }}
                scaleTo={0.98}
                style={[styles.row, on && styles.rowOn]}
                onPress={() => pick(product)}
              >
                <View style={styles.thumb}>
                  {product.imageUrl ? (
                    <Image source={{ uri: product.imageUrl }} style={styles.thumbImage} resizeMode="contain" />
                  ) : (
                    <Glyph size={20} color={text.primary} />
                  )}
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  {product.store || product.price ? (
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[product.store, product.price].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                </View>
              </PressScale>
            </Animated.View>
          );
        })}

        {status === "offline" && results.length === 0 ? (
          <Text style={styles.note}>The product search is slow to answer right now. Scan the bag or add it yourself.</Text>
        ) : showEmpty ? (
          <Text style={styles.note}>{`Nothing found for “${query.trim()}”.`}</Text>
        ) : null}

        {manual ? (
          <ManualEntry
            kind={kind}
            initial={query.trim()}
            onAdd={(name) => pick(manualProduct(name, kind))}
            onCancel={() => setManual(false)}
          />
        ) : (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Add it yourself"
            scaleTo={0.98}
            style={styles.addOwn}
            onPress={() => {
              void Haptics.selectionAsync();
              setManual(true);
            }}
          >
            <View style={styles.addDisc}>
              <PlusIcon size={16} color={text.primary} weight="bold" />
            </View>
            <Text style={styles.addText}>{query.trim().length >= 2 ? `Add “${query.trim()}” yourself` : "Can’t find it? Add it yourself"}</Text>
          </PressScale>
        )}
      </Animated.View>

      <ScanSheet
        visible={scanning}
        kind={kind}
        onClose={() => setScanning(false)}
        onFound={(product) => {
          setScanning(false);
          pick(product);
        }}
      />
    </View>
  );
};

const ManualEntry = ({
  kind,
  initial,
  onAdd,
  onCancel,
}: {
  kind: ProductKind;
  initial: string;
  onAdd: (name: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initial);
  const ready = name.trim().length >= 2;
  return (
    <Animated.View entering={FadeIn.duration(motion.duration.select)} style={styles.manual}>
      <Text style={styles.manualLabel}>{kind === "treat" ? "Treat name" : "Food name, as it reads on the bag"}</Text>
      <TextInput
        style={styles.manualInput}
        value={name}
        onChangeText={setName}
        placeholder={kind === "treat" ? "Training bites" : "Brand and formula"}
        placeholderTextColor={text.tertiary}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => ready && onAdd(name)}
        accessibilityLabel={kind === "treat" ? "Treat name" : "Food name"}
      />
      <View style={styles.manualActions}>
        <PressScale accessibilityRole="button" accessibilityLabel="Cancel" scaleTo={0.96} style={styles.manualQuiet} onPress={onCancel}>
          <Text style={styles.manualQuietText}>Cancel</Text>
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Add"
          disabled={!ready}
          scaleTo={0.96}
          style={[styles.manualAdd, !ready && styles.manualAddOff]}
          onPress={() => onAdd(name)}
        >
          <Text style={styles.manualAddText}>Add</Text>
        </PressScale>
      </View>
    </Animated.View>
  );
};

const BARCODES = ["ean13", "ean8", "upc_a", "upc_e"] as const;

/** Point the camera at the barcode; PAWS looks the number up and hands back the product. */
const ScanSheet = ({
  visible,
  kind,
  onClose,
  onFound,
}: {
  visible: boolean;
  kind: ProductKind;
  onClose: () => void;
  onFound: (product: Product) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [permission, request] = useCameraPermissions();
  const [state, setState] = useState<"scanning" | "looking" | "missing">("scanning");
  const busy = useRef(false);

  useEffect(() => {
    if (!visible) return;
    busy.current = false;
    setState("scanning");
    if (permission && !permission.granted && permission.canAskAgain) void request();
  }, [visible, permission, request]);

  const onScan = (code: string) => {
    if (busy.current) return;
    busy.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setState("looking");
    void lookupBarcode(code, kind).then((product) => {
      if (product) onFound(product);
      else {
        setState("missing");
        setTimeout(() => {
          busy.current = false;
          setState("scanning");
        }, 2200);
      }
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.scanScreen}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: [...BARCODES] }}
            onBarcodeScanned={state === "scanning" ? (result) => onScan(result.data) : undefined}
          />
        ) : null}
        <View style={[styles.scanTop, { paddingTop: insets.top + space.sm }]}>
          <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.scanClose} onPress={onClose}>
            <XIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
        </View>
        <View style={styles.scanFrame} pointerEvents="none" />
        <View style={[styles.scanFoot, { paddingBottom: insets.bottom + space.xl }]}>
          <Text style={styles.scanText}>
            {!permission?.granted
              ? "Camera access is off. Turn it on in Settings, or search by name."
              : state === "looking"
                ? "Looking it up"
                : state === "missing"
                  ? "Not found. Try again or search by name."
                  : "Point at the barcode on the bag"}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    height: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: border.soft,
  },
  input: { flex: 1, ...type.body, color: text.primary, paddingVertical: 0 },
  scan: { width: 52, height: 52, borderRadius: radius.input, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },

  results: { marginTop: space.md, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  rowOn: { borderColor: accent.deep, backgroundColor: accent.soft },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImage: { width: "88%", height: "88%" },
  rowCopy: { flex: 1 },
  rowName: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowMeta: { ...type.caption, color: text.tertiary, marginTop: 2 },
  note: { ...type.supporting, color: text.secondary, paddingVertical: space.sm },

  addOwn: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1, borderStyle: "dashed", borderColor: border.strong },
  addDisc: { width: 32, height: 32, borderRadius: 16, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  addText: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },

  manual: { padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle, gap: space.sm },
  manualLabel: { ...type.caption, fontWeight: "600", color: text.secondary },
  manualInput: { height: 48, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: bg.canvas, ...type.body, color: text.primary },
  manualActions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm, marginTop: space.xs },
  manualQuiet: { height: 40, paddingHorizontal: space.lg, justifyContent: "center" },
  manualQuietText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  manualAdd: { height: 40, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: accent.deep, justifyContent: "center" },
  manualAddOff: { backgroundColor: border.soft },
  manualAddText: { ...type.supporting, fontWeight: "700", color: text.primary },

  scanScreen: { flex: 1, backgroundColor: "#000" },
  scanTop: { paddingHorizontal: layout.gutter },
  scanClose: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  scanFrame: { alignSelf: "center", marginTop: "40%", width: "78%", height: 150, borderRadius: radius.card, borderWidth: 3, borderColor: accent.deep },
  scanFoot: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingHorizontal: layout.gutter },
  scanText: { ...type.body, fontWeight: "600", color: text.inverse, textAlign: "center" },
});
