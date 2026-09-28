import { Capacitor, registerPlugin } from "@capacitor/core";

const WidgetBridge = registerPlugin<{
  update(o: { email: string; unread: number }): Promise<void>;
}>("WidgetBridge");

export async function pushWidgetData(email: string, unread: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetBridge.update({ email, unread });
  } catch {
    /* abaikan */
  }
}
