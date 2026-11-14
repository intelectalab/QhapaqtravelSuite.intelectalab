import * as Linking from "expo-linking";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { UpgradeInfo } from "../api/upgrade";
import { APP_VERSION } from "../config";
import { colors, font, space } from "../theme";
import { Button } from "./components";

export function UpdateRequired({ info }: { info: UpgradeInfo }) {
  const storeUrl = info.storeUrl;
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.wrap}>
        <View style={styles.mark}>
          <Text style={styles.markText}>KC</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Actualiza la app</Text>
          <Text style={styles.body}>{info.message}</Text>
          <Text style={styles.meta}>
            Tienes la versión {APP_VERSION}
            {info.minVersion ? ` · mínima ${info.minVersion}` : ""}
          </Text>
          {storeUrl ? <Button label="Ir a la tienda" icon="download-outline" onPress={() => void Linking.openURL(storeUrl)} testID="update-store" /> : <Text style={styles.meta}>Pide el enlace de descarga a tu agencia.</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.side },
  wrap: { flex: 1, justifyContent: "center", padding: space.xl, gap: space.xl },
  mark: { alignSelf: "center", width: 64, height: 64, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  markText: { fontSize: 22, fontWeight: "800", color: colors.accent },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: space.xl, gap: space.md },
  title: { fontSize: font.title, fontWeight: "800", color: colors.fg },
  body: { fontSize: font.body, color: colors.fg2, lineHeight: 22 },
  meta: { fontSize: font.small, color: colors.fg3 },
});
