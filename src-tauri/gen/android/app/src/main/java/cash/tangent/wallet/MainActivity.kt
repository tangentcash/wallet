package cash.tangent.wallet

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.WindowInsets
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    // Bridge used by the web app (core/app.tsx syncSystemBars) to tint the
    // status/navigation bars + their icons when the in-app theme changes.
    webView.addJavascriptInterface(SystemBarsBridge(this, webView), "TangentNative")
    // Avoid a white flash between the system splash and the web splash:
    // paint the webview surface with the same background the splashes use.
    webView.setBackgroundColor(
      resources.getColor(R.color.splash_background, theme)
    )
  }
}

private fun insetsBottomPx(insets: WindowInsets): Int =
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
    insets.getInsets(WindowInsets.Type.navigationBars()).bottom
  else
    @Suppress("DEPRECATION")
    insets.systemWindowInsetBottom

internal fun pushBottomInset(webView: WebView, px: Int) {
  val cssPx = px / webView.resources.displayMetrics.density
  webView.evaluateJavascript(
    "document.documentElement.style.setProperty('--android-inset-bottom', '${cssPx}px')",
    null
  )
}

class SystemBarsBridge(private val activity: Activity, private val webView: WebView) {
  @JavascriptInterface
  fun setSystemBars(dark: Boolean) {
    activity.runOnUiThread {
      val window = activity.window
      // Match the app surface (--bg in src/main.css). Ignored on API 35+ where
      // bars are forced transparent, but corrects 26-34.
      val bg = if (dark) Color.parseColor("#0B0D0C") else Color.parseColor("#F2F4F3")
      @Suppress("DEPRECATION")
      window.statusBarColor = bg
      @Suppress("DEPRECATION")
      window.navigationBarColor = bg
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        // Edge-to-edge: stop the system painting its own scrim over the nav bar.
        window.isNavigationBarContrastEnforced = false
      }
      // The actual fix: white icons/pill on the dark surface, black on light.
      val controller = WindowCompat.getInsetsController(window, activity.window.decorView)
      controller.isAppearanceLightStatusBars = !dark
      controller.isAppearanceLightNavigationBars = !dark
      // The web app calls this on startup — piggyback the current bottom inset
      // so CSS is correct even before the first insets dispatch lands.
      activity.window.decorView.rootWindowInsets?.let {
        pushBottomInset(webView, insetsBottomPx(it))
      }
    }
  }
}
