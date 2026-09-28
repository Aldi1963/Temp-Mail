package com.clipku.tempmail

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    @PluginMethod
    fun update(call: PluginCall) {
        val email = call.getString("email") ?: ""
        val unread = call.getInt("unread") ?: 0
        TempMailWidgetProvider.pushUpdate(context, email, unread)
        call.resolve()
    }
}
