import os
import sys
import shutil
import subprocess

script_dir = os.path.dirname(os.path.abspath(__file__))
VERSION_NAME = "1.0.1"
VERSION_CODE = 4

if os.path.exists(os.path.join(script_dir, 'POKECRAFT PE')):
    mobile_dir = script_dir
    workspace = os.path.dirname(script_dir) if os.path.basename(script_dir).lower() == 'mobile' else script_dir
    pe_dir = os.path.join(mobile_dir, 'POKECRAFT PE')
elif os.path.exists(os.path.join(script_dir, 'Mobile', 'POKECRAFT PE')):
    workspace = script_dir
    mobile_dir = os.path.join(workspace, 'Mobile')
    pe_dir = os.path.join(mobile_dir, 'POKECRAFT PE')
else:
    workspace = script_dir
    pe_dir = os.path.join(workspace, 'POKECRAFT PE')
    mobile_dir = workspace

app_dir = os.path.join(pe_dir, 'app')
main_dir = os.path.join(app_dir, 'src', 'main')
java_dir = os.path.join(main_dir, 'java', 'com', 'pokecraft', 'pe')
res_dir = os.path.join(main_dir, 'res')
assets_dir = os.path.join(main_dir, 'assets', 'www')
build_dir = os.path.join(pe_dir, 'build_temp')

java_home = r'D:\android studio\jbr'
os.environ['JAVA_HOME'] = java_home

javac = os.path.join(java_home, 'bin', 'javac.exe')
jar = os.path.join(java_home, 'bin', 'jar.exe')

sdk = r'C:\Users\anbu\AppData\Local\Android\Sdk'
build_tools = os.path.join(sdk, 'build-tools', '35.0.0')
android_jar = os.path.join(sdk, 'platforms', 'android-35', 'android.jar')
aapt2 = os.path.join(build_tools, 'aapt2.exe')
d8 = os.path.join(build_tools, 'd8.bat')
zipalign = os.path.join(build_tools, 'zipalign.exe')
apksigner = os.path.join(build_tools, 'apksigner.bat')
keystore = r'C:\Users\anbu\.android\debug.keystore'

print('=== 1. Preparing directories ===')
for d in [java_dir, os.path.join(res_dir, 'values'), os.path.join(res_dir, 'mipmap'), assets_dir, build_dir]:
    os.makedirs(d, exist_ok=True)

print('=== 2. Copying web game assets to assets/www ===')
files = [
    'index.html', 'john-emulator.css', 'john-emulator.js',
    'settings.css', 'settings.js', 'save_manager.js', 'controls_manager.js',
    'sponsor.css', 'sponsor-config.json'
]
for fl in files:
    src_mobile = os.path.join(mobile_dir, fl)
    src_root = os.path.join(workspace, fl)
    src = src_mobile if os.path.exists(src_mobile) else src_root
    if os.path.exists(src):
        shutil.copy2(src, os.path.join(assets_dir, fl))

for sub in ['src', 'assets']:
    src_sub = os.path.join(mobile_dir, sub)
    if not os.path.exists(src_sub) and os.path.exists(os.path.join(workspace, sub)):
        src_sub = os.path.join(workspace, sub)
    dst_sub = os.path.join(assets_dir, sub)
    if os.path.exists(src_sub) and os.path.abspath(src_sub) != os.path.abspath(dst_sub):
        if os.path.exists(dst_sub):
            shutil.rmtree(dst_sub)
        shutil.copytree(src_sub, dst_sub)

print('=== 3. Setting up app icon & mipmap densities ===')
icon_src = os.path.join(mobile_dir, 'PokeCraft_icon_512.png')
if not os.path.exists(icon_src):
    icon_src = os.path.join(workspace, 'PokeCraft_icon_512.png')
if os.path.exists(icon_src):
    try:
        from PIL import Image
        base_icon = Image.open(icon_src)
        densities = {
            'mipmap-mdpi': 48,
            'mipmap-hdpi': 72,
            'mipmap-xhdpi': 96,
            'mipmap-xxhdpi': 144,
            'mipmap-xxxhdpi': 192,
            'mipmap': 512
        }
        for folder, sz in densities.items():
            fdir = os.path.join(res_dir, folder)
            os.makedirs(fdir, exist_ok=True)
            res_icon = base_icon.resize((sz, sz), Image.Resampling.LANCZOS)
            res_icon.save(os.path.join(fdir, 'ic_launcher.png'), 'PNG')
            res_icon.save(os.path.join(fdir, 'ic_launcher_round.png'), 'PNG')
        print('Generated multi-density mipmaps successfully')
    except Exception as e:
        print('Pillow density generation skipped, copying default icon:', e)
        shutil.copy2(icon_src, os.path.join(res_dir, 'mipmap', 'ic_launcher.png'))
        shutil.copy2(icon_src, os.path.join(res_dir, 'mipmap', 'ic_launcher_round.png'))

print('=== 4. Generating AndroidManifest.xml & resources ===')
manifest = f'''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.pokecraft.pe"
    android:versionCode="{VERSION_CODE}"
    android:versionName="{VERSION_NAME}">

    <uses-sdk
        android:minSdkVersion="24"
        android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="PokéCRAFT PE"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:theme="@android:style/Theme.NoTitleBar.Fullscreen">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden"
            android:screenOrientation="sensor">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>'''
with open(os.path.join(main_dir, 'AndroidManifest.xml'), 'w', encoding='utf-8') as mf:
    mf.write(manifest)

with open(os.path.join(res_dir, 'values', 'strings.xml'), 'w', encoding='utf-8') as sf:
    sf.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">PokéCRAFT PE</string>\n</resources>')

main_java = '''package com.pokecraft.pe;

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
}'''
with open(os.path.join(java_dir, 'MainActivity.java'), 'w', encoding='utf-8') as jf:
    jf.write(main_java)

print('=== 5. Compiling resources with aapt2 ===')
compiled_res = os.path.join(build_dir, 'compiled_res.zip')
if os.path.exists(compiled_res):
    os.remove(compiled_res)
subprocess.check_call([aapt2, 'compile', '--dir', res_dir, '-o', compiled_res])

print('=== 6. Linking APK package with aapt2 ===')
manifest_file = os.path.join(main_dir, 'AndroidManifest.xml')
gen_java_dir = os.path.join(build_dir, 'gen')
os.makedirs(gen_java_dir, exist_ok=True)
unaligned_apk = os.path.join(build_dir, 'app-unaligned.apk')

subprocess.check_call([
    aapt2, 'link',
    '-I', android_jar,
    '--manifest', manifest_file,
    '--min-sdk-version', '24',
    '--target-sdk-version', '34',
    '--java', gen_java_dir,
    '-o', unaligned_apk,
    '--auto-add-overlay',
    compiled_res
])

print('=== 7. Compiling Java with javac ===')
classes_dir = os.path.join(build_dir, 'classes')
os.makedirs(classes_dir, exist_ok=True)

java_files = [os.path.join(java_dir, 'MainActivity.java')]
for root, dirs, fls in os.walk(gen_java_dir):
    for f in fls:
        if f.endswith('.java'):
            java_files.append(os.path.join(root, f))

subprocess.check_call([javac, '-source', '8', '-target', '8', '-cp', android_jar, '-d', classes_dir] + java_files)

print('=== 8. Compiling classes to DEX with d8 ===')
dex_dir = os.path.join(build_dir, 'dex')
os.makedirs(dex_dir, exist_ok=True)
class_files = []
for root, dirs, fls in os.walk(classes_dir):
    for f in fls:
        if f.endswith('.class'):
            class_files.append(os.path.join(root, f))

subprocess.check_call([d8, '--min-api', '24', '--lib', android_jar, '--output', dex_dir] + class_files)

print('=== 9. Injecting classes.dex and assets with forward slashes ===')
dex_src = os.path.join(dex_dir, 'classes.dex')
import zipfile
with zipfile.ZipFile(unaligned_apk, 'a') as zf:
    zf.write(dex_src, 'classes.dex', compress_type=zipfile.ZIP_DEFLATED)
    for root, dirs, fls in os.walk(assets_dir):
        for f in fls:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, assets_dir).replace('\\', '/')
            archive_name = 'assets/www/' + rel_path
            zf.write(full_path, archive_name, compress_type=zipfile.ZIP_DEFLATED)

print('=== 10. Zipaligning APK ===')
aligned_apk = os.path.join(build_dir, 'app-aligned.apk')
if os.path.exists(aligned_apk):
    os.remove(aligned_apk)
subprocess.check_call([zipalign, '-p', '-f', '4', unaligned_apk, aligned_apk])

print('=== 11. Signing APK with apksigner ===')
final_apk = os.path.join(mobile_dir, 'PokeCraft-PE.apk')
if os.path.exists(final_apk):
    os.remove(final_apk)

subprocess.check_call([
    apksigner, 'sign',
    '--ks', keystore,
    '--ks-key-alias', 'androiddebugkey',
    '--ks-pass', 'pass:android',
    '--key-pass', 'pass:android',
    '--out', final_apk,
    aligned_apk
])

# APK output strictly stays inside Mobile directory
# (Clean directory separation: no root pollution)

# Clean up temporary build artifacts (saves >100MB disk space)
try:
    shutil.rmtree(build_dir, ignore_errors=True)
    for ext in ['.idsig']:
        for d in [mobile_dir, workspace]:
            p = os.path.join(d, 'PokeCraft-PE.apk' + ext)
            if os.path.exists(p):
                os.remove(p)
except Exception:
    pass

sz = os.path.getsize(final_apk) / (1024 * 1024)
print('==========================================')
print(f'SUCCESS! APK GENERATED: {final_apk}')
print(f'File Size: {sz:.2f} MB')
print('==========================================')

print('=== 12. Generating Versioned Pocket Edition Backup Zip ===')
backup_dir = os.path.join(workspace, 'Backup')
os.makedirs(backup_dir, exist_ok=True)
old_v102 = os.path.join(backup_dir, 'PokeCraft_Pocket_Edition_v1.0.2.zip')
if os.path.exists(old_v102):
    try: os.remove(old_v102)
    except Exception: pass
backup_zip_path = os.path.join(backup_dir, f'PokeCraft_Pocket_Edition_v{VERSION_NAME}.zip')
try:
    with zipfile.ZipFile(backup_zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as bzf:
        for root, dirs, fls in os.walk(mobile_dir):
            if 'build_temp' in root or '.git' in root:
                continue
            for f in fls:
                fpath = os.path.join(root, f)
                rpath = os.path.join('Mobile', os.path.relpath(fpath, mobile_dir)).replace('\\', '/')
                bzf.write(fpath, rpath)
    bz_sz = os.path.getsize(backup_zip_path) / (1024 * 1024)
    print(f'BACKUP SAVED: {backup_zip_path} ({bz_sz:.2f} MB)')
except Exception as bex:
    print(f'Backup warning: {bex}')

