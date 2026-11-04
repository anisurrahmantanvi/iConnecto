package com.iconnecto.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Foreground service that runs while a call is active. It tells Android the app is busy with a call, so the
 * microphone, the connection and the web page are not frozen when the user switches to another app.
 */
public class CallService extends Service {
  static final String CHANNEL = "call_ongoing";
  static volatile boolean active = false;
  private PowerManager.WakeLock wake;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String name = intent != null && intent.getStringExtra("name") != null ? intent.getStringExtra("name") : "Call";
    boolean video = intent != null && intent.getBooleanExtra("video", false);

    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(CHANNEL, "Ongoing call", NotificationManager.IMPORTANCE_LOW);
      ch.setDescription("Shown while a call is in progress");
      nm.createNotificationChannel(ch);
    }

    Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int piFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
    PendingIntent pi = PendingIntent.getActivity(this, 0, open, piFlags);

    int icon = getResources().getIdentifier("ic_stat_iconnecto", "drawable", getPackageName());
    if (icon == 0) icon = getApplicationInfo().icon;

    Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
    b.setSmallIcon(icon).setContentTitle(name).setContentText(video ? "Video call in progress. Tap to return." : "Call in progress. Tap to return.")
        .setOngoing(true).setContentIntent(pi).setCategory(Notification.CATEGORY_CALL);

    if (Build.VERSION.SDK_INT >= 29) {
      int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
      if (video) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
      startForeground(7001, b.build(), type);
    } else {
      startForeground(7001, b.build());
    }
    active = true;

    if (wake == null) {
      PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
      wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "iconnecto:call");
      wake.acquire(4 * 60 * 60 * 1000L);
    }
    return START_NOT_STICKY;
  }

  @Override
  public void onDestroy() {
    active = false;
    if (wake != null && wake.isHeld()) wake.release();
    wake = null;
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) { return null; }
}
