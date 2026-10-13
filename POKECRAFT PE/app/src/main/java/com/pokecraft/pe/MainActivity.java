package com.pokecraft.pe;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private WebView webView;
    private long lastBackPressTime = 0;
    private Toast exitToast;

    public class AndroidBridge {
        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finishAndRemoveTask();
                }
            });
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(ms);
                    }
                }
            } catch (Exception e) {
                Log.w("PokeCraft", "Vibration failed: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void setOrientation(final String mode) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if ("portrait".equalsIgnoreCase(mode)) {
                            setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                        } else if ("landscape".equalsIgnoreCase(mode)) {
                            setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
                        } else {
                            setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR);
                        }
                    } catch (Exception e) {
                        Log.e("PokeCraft", "Orientation change failed: " + e.getMessage());
                    }
                }
            });
        }

        @JavascriptInterface
        public void openBrowser(final String url) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        Log.e("PokeCraft", "Failed to open browser: " + e.getMessage());
                    }
                }
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        setContentView(webView);

        hideSystemUI();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidHost");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage msg) {
                Log.d("PokeCraftJS", msg.message() + " [" + msg.sourceId() + ":" + msg.lineNumber() + "]");
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    Uri uri = Uri.parse(url);
                    String host = uri.getHost();
                    if (!"localhost".equalsIgnoreCase(host) && !"appassets.androidplatform.net".equalsIgnoreCase(host)) {
                        try {
                            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, uri);
                            startActivity(intent);
                            return true;
                        } catch (Exception e) {
                            Log.e("PokeCraft", "Failed to launch external URL: " + e.getMessage());
                        }
                    }
                }
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    return shouldOverrideUrlLoading(view, request.getUrl().toString());
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Log.e("PokeCraft", "WebView Error: " + errorCode + " - " + description + " URL: " + failingUrl);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if ("localhost".equals(host) || "appassets.androidplatform.net".equals(host)) {
                    String path = uri.getPath();
                    if (path == null || path.isEmpty() || "/".equals(path)) {
                        path = "index.html";
                    }
                    if (path.startsWith("/")) path = path.substring(1);
                    try {
                        InputStream is = null;
                        try {
                            is = getAssets().open("www/" + path);
                        } catch (Exception ex1) {
                            is = getAssets().open(path);
                        }
                        String mime = getMime(path);
                        String encoding = (mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json")) ? "UTF-8" : null;
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        headers.put("Access-Control-Allow-Methods", "GET, OPTIONS");
                        headers.put("Access-Control-Allow-Headers", "*");
                        if ("index.html".equals(path)) {
                            headers.put("Cache-Control", "no-cache");
                        } else {
                            headers.put("Cache-Control", "public, max-age=31536000, immutable");
                        }
                        return new WebResourceResponse(mime, encoding, 200, "OK", headers, is);
                    } catch (Exception e) {
                        Map<String, String> errHeaders = new HashMap<>();
                        errHeaders.put("Access-Control-Allow-Origin", "*");
                        errHeaders.put("Cache-Control", "no-cache");
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", errHeaders, new ByteArrayInputStream(new byte[0]));
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        webView.loadUrl("http://localhost/index.html");
    }

    private String getMime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".mp3")) return "audio/mpeg";
        if (path.endsWith(".ogg")) return "audio/ogg";
        if (path.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
    }

    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUI();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
            webView.evaluateJavascript("try { if (window.__pauseAppAudio) window.__pauseAppAudio(); } catch(e){}", null);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
            webView.evaluateJavascript("try { if (window.__resumeAppAudio) window.__resumeAppAudio(); } catch(e){}", null);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
            webView.evaluateJavascript("try { if (window.__pauseAppAudio) window.__pauseAppAudio(); } catch(e){}", null);
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            try {
                webView.evaluateJavascript("try { if (window.__pauseAppAudio) window.__pauseAppAudio(); } catch(e){}", null);
                webView.loadUrl("about:blank");
                webView.stopLoading();
                webView.setWebChromeClient(null);
                webView.setWebViewClient(null);
                webView.destroy();
                webView = null;
            } catch (Exception e) {
                Log.e("PokeCraft", "Error destroying webView: " + e.getMessage());
            }
        }
        super.onDestroy();
        android.os.Process.killProcess(android.os.Process.myPid());
    }

    @Override
    public void onBackPressed() {
        long now = System.currentTimeMillis();
        if (now - lastBackPressTime < 2000) {
            if (exitToast != null) exitToast.cancel();
            finishAndRemoveTask();
            return;
        }

        if (webView != null) {
            webView.evaluateJavascript(
                "(function() {" +
                "  if (window.__closeModals && window.__closeModals()) return 'closed';" +
                "  return 'none';" +
                "})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value == null || !value.contains("closed")) {
                            lastBackPressTime = System.currentTimeMillis();
                            exitToast = Toast.makeText(MainActivity.this, "Press BACK again to exit PokéCRAFT PE", Toast.LENGTH_SHORT);
                            exitToast.show();
                        }
                    }
                }
            );
        } else {
            super.onBackPressed();
        }
    }
}