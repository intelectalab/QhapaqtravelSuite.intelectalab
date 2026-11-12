import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

export async function pushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("servicios", { name: "Servicios", importance: Notifications.AndroidImportance.HIGH });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    const id = projectId();
    if (!granted || !id) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  } catch {
    return null;
  }
}

export function onNotificationOpened(handler: (assignmentId: string | null) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { assignment_id?: unknown } | undefined;
    handler(typeof data?.assignment_id === "string" ? data.assignment_id : null);
  });
  return () => subscription.remove();
}

export function onNotificationReceived(handler: () => void): () => void {
  const subscription = Notifications.addNotificationReceivedListener(() => handler());
  return () => subscription.remove();
}
