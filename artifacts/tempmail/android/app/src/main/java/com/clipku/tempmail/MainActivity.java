package com.clipku.tempmail;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        // Edge-to-edge di semua versi Android: WebView menggambar di balik system bar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
