/**
 * The bot check page for the phone app (packages/shared/src/captcha.ts). The app opens it in a hidden web view, because
 * Cloudflare's check only runs in a web page on a website address it knows. The app calls window.vintyCheck() and gets
 * messages back: "ready", "token" (with the answer), "show" and "hide" (Cloudflare wants a tick, the app shows the view),
 * and "error". Not a page for people, so no language and no layout.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>html,body{margin:0;background:transparent}#check{display:flex;justify-content:center;padding:16px}</style>
</head>
<body>
<div id="check"></div>
<script>
(function () {
  var siteKey = ${JSON.stringify(SITE_KEY)};
  var widgetId = null;
  function send(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
  }
  window.vintyCheck = function () {
    if (!window.turnstile || widgetId === null) return send({ type: "error" });
    window.turnstile.reset(widgetId);
    window.turnstile.execute(document.getElementById("check"));
  };
  window.onTurnstileLoad = function () {
    if (!siteKey) return send({ type: "error" });
    widgetId = window.turnstile.render(document.getElementById("check"), {
      sitekey: siteKey,
      execution: "execute",
      appearance: "interaction-only",
      callback: function (token) { send({ type: "hide" }); send({ type: "token", token: token }); },
      "error-callback": function () { send({ type: "hide" }); send({ type: "error" }); },
      "expired-callback": function () { send({ type: "error" }); },
      "before-interactive-callback": function () { send({ type: "show" }); },
      "after-interactive-callback": function () { send({ type: "hide" }); }
    });
    send({ type: "ready" });
  };
})();
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad" async defer></script>
</body>
</html>`;

export function GET() {
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
