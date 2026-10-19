import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { finishCaptcha, setCaptchaHost } from "@/lib/captcha";
import { WEB_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

type PageMessage = { type: "ready" | "token" | "show" | "hide" | "error"; token?: string };

/**
 * Keeps the website's bot check page (/app-check) open in a hidden web view for lib/captcha.ts. Usually invisible the
 * whole time. When Cloudflare is unsure it asks for a tick, and the page then shows in a small card above the app.
 */
export function CaptchaHost() {
  const { t } = useTranslation();
  const view = useRef<WebView>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!WEB_URL) return;
    setCaptchaHost("loading");
    return () => setCaptchaHost("absent");
  }, []);

  if (!WEB_URL) return null;
  const pageUrl = `${WEB_URL}/app-check`;

  const onMessage = (event: WebViewMessageEvent) => {
    // Only our own page may answer.
    if (!event.nativeEvent.url.startsWith(pageUrl)) return;
    let message: PageMessage;
    try {
      message = JSON.parse(event.nativeEvent.data) as PageMessage;
    } catch {
      return;
    }
    if (message.type === "ready") {
      setCaptchaHost("ready", () => view.current?.injectJavaScript("window.vintyCheck();true;"));
    } else if (message.type === "token") {
      finishCaptcha(message.token);
    } else if (message.type === "error") {
      finishCaptcha(undefined);
    } else {
      setVisible(message.type === "show");
    }
  };

  const cancel = () => {
    setVisible(false);
    finishCaptcha(undefined);
  };

  return (
    <View
      pointerEvents={visible ? "auto" : "none"}
      className={cn(
        "absolute inset-0 items-center justify-center p-xl",
        visible ? "bg-backdrop/40" : "opacity-0",
      )}
    >
      <View className="w-full max-w-sm gap-md rounded-window bg-background p-lg">
        <Text variant="heading" className="text-center">
          {t("captcha.title")}
        </Text>
        <View className="h-20 w-full">
          <WebView
            ref={view}
            source={{ uri: pageUrl }}
            originWhitelist={["https://*", "http://*"]}
            javaScriptEnabled
            domStorageEnabled
            onMessage={onMessage}
            onError={() => setCaptchaHost("failed")}
            onHttpError={() => setCaptchaHost("failed")}
            scrollEnabled={false}
            style={{ backgroundColor: "transparent" }}
          />
        </View>
        <Button variant="ghost" onPress={cancel}>
          <Text>{t("common.cancel")}</Text>
        </Button>
      </View>
    </View>
  );
}
