package com.clipku.tempmail

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class TempMailWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val email = prefs.getString(KEY_EMAIL, DEFAULT_EMAIL) ?: DEFAULT_EMAIL
        val unread = prefs.getInt(KEY_UNREAD, 0)
        val views = buildViews(context, email, unread)
        for (id in appWidgetIds) {
            appWidgetManager.updateAppWidget(id, views)
        }
    }

    companion object {
        private const val PREFS = "TempMailWidget"
        private const val KEY_EMAIL = "email"
        private const val KEY_UNREAD = "unread"
        private const val DEFAULT_EMAIL = "Belum ada alamat"

        /** Dipanggil dari WidgetBridgePlugin setiap ada perubahan. */
        fun pushUpdate(context: Context, email: String, unread: Int) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_EMAIL, email)
                .putInt(KEY_UNREAD, unread)
                .apply()
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(
                ComponentName(context, TempMailWidgetProvider::class.java)
            )
            val views = buildViews(context, email, unread)
            for (id in ids) {
                mgr.updateAppWidget(id, views)
            }
        }

        private fun buildViews(context: Context, email: String, unread: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_temp_mail)
            views.setTextViewText(R.id.widget_email, email)
            views.setTextViewText(R.id.widget_unread, unread.toString())
            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_MAIN
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val pi = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            views.setOnClickPendingIntent(R.id.widget_root, pi)
            return views
        }
    }
}
