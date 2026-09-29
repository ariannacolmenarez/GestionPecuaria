package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.viewinterop.AndroidView
import androidx.webkit.WebViewAssetLoader
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      MyApplicationTheme {
        Scaffold(modifier = Modifier.fillMaxSize().testTag("main_scaffold")) { innerPadding ->
          GestionPecuariaApp(modifier = Modifier.fillMaxSize().padding(innerPadding))
        }
      }
    }
  }
}

class AndroidBridge(private val context: Context) {
  @JavascriptInterface
  fun isNativePlatform(): Boolean = true

  @JavascriptInterface
  fun getPlatform(): String = "android"

  @JavascriptInterface
  fun postMessage(message: String) {
    Log.d("GestionPecuaria", "Bridge message: $message")
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun GestionPecuariaApp(modifier: Modifier = Modifier) {
  var webViewInstance by remember { mutableStateOf<WebView?>(null) }

  BackHandler(enabled = webViewInstance?.canGoBack() == true) {
    webViewInstance?.goBack()
  }

  AndroidView(
    modifier = modifier.testTag("gestion_pecuaria_webview"),
    factory = { ctx ->
      val assetLoader = WebViewAssetLoader.Builder()
        .setDomain("localhost")
        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(ctx))
        .build()

      WebView(ctx).apply {
        layoutParams = ViewGroup.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        setBackgroundColor(Color.parseColor("#0f172a")) // slate-900

        settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
          databaseEnabled = true
          allowFileAccess = true
          allowContentAccess = true
          useWideViewPort = true
          loadWithOverviewMode = true
          setSupportZoom(false)
          builtInZoomControls = false
          displayZoomControls = false
          mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
          cacheMode = WebSettings.LOAD_DEFAULT
        }

        addJavascriptInterface(AndroidBridge(ctx), "androidBridge")

        webChromeClient = object : WebChromeClient() {
          override fun onConsoleMessage(message: android.webkit.ConsoleMessage?): Boolean {
            Log.d("GestionPecuariaJS", "${message?.message()} -- From line ${message?.lineNumber()} of ${message?.sourceId()}")
            return true
          }
        }

        webViewClient = object : WebViewClient() {
          @SuppressLint("WebViewClientOnReceivedSslError")
          override fun onReceivedSslError(
            view: WebView?,
            handler: android.webkit.SslErrorHandler?,
            error: android.net.http.SslError?
          ) {
            handler?.proceed()
          }

          override fun onReceivedError(
            view: WebView?,
            request: WebResourceRequest?,
            error: android.webkit.WebResourceError?
          ) {
            super.onReceivedError(view, request, error)
            Log.e("GestionPecuaria", "WebView Error: ${error?.description} for ${request?.url}")
          }

          override fun shouldInterceptRequest(
            view: WebView?,
            request: WebResourceRequest?
          ): WebResourceResponse? {
            val url = request?.url ?: return null
            val host = url.host ?: ""

            if (host == "localhost" || host == "appassets.androidplatform.net" || host == "127.0.0.1") {
              var path = url.path ?: ""
              if (path.isEmpty() || path == "/") {
                path = "/index.html"
              }
              val cleanPath = when {
                path.startsWith("/assets/public/") -> path.removePrefix("/assets/public/")
                path.startsWith("/public/") -> path.removePrefix("/public/")
                path.startsWith("/") -> path.removePrefix("/")
                else -> path
              }
              val assetPath = "public/$cleanPath"
              try {
                val stream = ctx.assets.open(assetPath)
                val mimeType = when {
                  cleanPath.endsWith(".html") -> "text/html"
                  cleanPath.endsWith(".js") || cleanPath.endsWith(".mjs") -> "application/javascript"
                  cleanPath.endsWith(".css") -> "text/css"
                  cleanPath.endsWith(".png") -> "image/png"
                  cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg") -> "image/jpeg"
                  cleanPath.endsWith(".svg") -> "image/svg+xml"
                  cleanPath.endsWith(".json") -> "application/json"
                  cleanPath.endsWith(".woff2") -> "font/woff2"
                  cleanPath.endsWith(".woff") -> "font/woff"
                  cleanPath.endsWith(".ttf") -> "font/ttf"
                  else -> "application/octet-stream"
                }
                val headers = mapOf(
                  "Access-Control-Allow-Origin" to "*",
                  "Access-Control-Allow-Methods" to "GET, OPTIONS",
                  "Access-Control-Allow-Headers" to "*"
                )
                return WebResourceResponse(mimeType, "UTF-8", 200, "OK", headers, stream)
              } catch (_: Exception) {
                if (!cleanPath.contains(".")) {
                  try {
                    val fallback = ctx.assets.open("public/index.html")
                    return WebResourceResponse("text/html", "UTF-8", fallback)
                  } catch (_: Exception) {}
                }
              }
            }
            return assetLoader.shouldInterceptRequest(url)
          }

          override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
            super.onPageStarted(view, url, favicon)
            view?.evaluateJavascript(
              """
              window.Capacitor = window.Capacitor || {};
              window.Capacitor.isNativePlatform = function() { return true; };
              window.Capacitor.getPlatform = function() { return 'android'; };
              window.Capacitor.Plugins = window.Capacitor.Plugins || {};
              """.trimIndent(),
              null
            )
          }

          override fun onPageFinished(view: WebView?, url: String?) {
            super.onPageFinished(view, url)
            view?.evaluateJavascript(
              """
              window.Capacitor = window.Capacitor || {};
              window.Capacitor.isNativePlatform = function() { return true; };
              window.Capacitor.getPlatform = function() { return 'android'; };
              """.trimIndent(),
              null
            )
          }
        }

        loadUrl("https://localhost/index.html")
        webViewInstance = this
      }
    }
  )
}

@Composable
fun Greeting(name: String, modifier: Modifier = Modifier) {
  Text(text = "Hello $name!", modifier = modifier)
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
  MyApplicationTheme { Greeting("Android") }
}
