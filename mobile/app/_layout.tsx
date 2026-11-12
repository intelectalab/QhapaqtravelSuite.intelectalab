import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { onNotificationOpened, onNotificationReceived } from "../src/push";
import { AppProvider, useApp } from "../src/state/AppProvider";
import { colors } from "../src/theme";

function Gate() {
  const { session, kind, sync } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session !== "ready") return;
    const offOpened = onNotificationOpened((assignmentId) => {
      void sync();
      if (assignmentId && kind === "operator") router.push(`/servicio/${assignmentId}`);
      if (kind === "passenger") router.push("/pasajero/alertas");
    });
    const offReceived = onNotificationReceived(() => void sync());
    return () => {
      offOpened();
      offReceived();
    };
  }, [session, kind, sync, router]);

  useEffect(() => {
    if (session === "loading") return;
    const area = segments[0];
    if (session === "signed_out" && area !== "login") router.replace("/login");
    if (session !== "ready") return;
    if (kind === "passenger" && area !== "pasajero") router.replace("/pasajero");
    if (kind === "operator" && (area === "login" || area === "pasajero")) router.replace("/");
  }, [session, kind, segments, router]);

  if (session === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.side }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerTintColor: colors.accent, headerTitleStyle: { fontWeight: "700" }, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="servicio/[id]" options={{ title: "Servicio" }} />
      <Stack.Screen name="incidencia/nueva" options={{ title: "Nueva incidencia", presentation: "modal" }} />
      <Stack.Screen name="pasajero" options={{ headerShown: false }} />
      <Stack.Screen name="voucher/[code]" options={{ title: "Voucher" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}
