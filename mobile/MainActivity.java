package com.iconnecto.app;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Draws the app edge to edge (behind the status bar, camera notch and gesture bar) and tells the web page how much
 * room to leave through the CSS variables --sat (top) and --sab (bottom).
 */
public class MainActivity extends BridgeActivity {
  private final Handler handler = new Handler(Looper.getMainLooper());
  private String script = "";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().setStatusBarColor(Color.TRANSPARENT);
    getWindow().setNavigationBarColor(Color.TRANSPARENT);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      getWindow().getAttributes().layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }

    boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
        == Configuration.UI_MODE_NIGHT_YES;
    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    controller.setAppearanceLightStatusBars(!night);
    controller.setAppearanceLightNavigationBars(!night);

    final View content = findViewById(android.R.id.content);
    final float density = getResources().getDisplayMetrics().density;
    ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
      Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
      // Keep the page above the on-screen keyboard (chat and comment boxes).
      content.setPadding(0, 0, 0, ime.bottom);
      float top = bars.top / density;
      float bottom = ime.bottom > 0 ? 0 : bars.bottom / density;
      script = "document.documentElement.style.setProperty('--sat','" + top + "px');"
          + "document.documentElement.style.setProperty('--sab','" + bottom + "px');";
      inject();
      return insets;
    });
    ViewCompat.requestApplyInsets(getWindow().getDecorView());

    // The page loads after the first insets pass, so repeat the injection for a few seconds.
    int[] delays = {400, 1200, 2500, 5000};
    for (int d : delays) handler.postDelayed(this::inject, d);
  }

  @Override
  public void onResume() {
    super.onResume();
    inject();
  }

  private void inject() {
    if (script.isEmpty() || getBridge() == null) return;
    WebView web = getBridge().getWebView();
    if (web != null) web.post(() -> web.evaluateJavascript(script, null));
  }
}
