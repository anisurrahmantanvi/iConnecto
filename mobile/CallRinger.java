package com.iconnecto.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

/** Rings (looping) and shows a full-screen incoming-call notification, even when the app is closed. */
public final class CallRinger {
  private static final String CHANNEL = "call_incoming";
  private static final int NOTIF_ID = 7002;
  private static MediaPlayer player;
  private static final Handler handler = new Handler(Looper.getMainLooper());
  private static Runnable timeout;

  private CallRinger() {}

  public static synchronized void start(Context ctx, String title, String body, String url) {
    stop(ctx);
    NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel ch = new NotificationChannel(CHANNEL, "Incoming call screen", NotificationManager.IMPORTANCE_HIGH);
      ch.setSound(null, null); // the ringtone is played (looping) by CallRinger itself
      ch.enableVibration(false);
      ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      nm.createNotificationChannel(ch);
    }

    Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    open.putExtra("google.message_id", "call-" + System.currentTimeMillis());
    open.putExtra("url", url);
    open.putExtra("fromCall", true);
    int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
    PendingIntent pi = PendingIntent.getActivity(ctx, 1, open, fl);

    int icon = ctx.getResources().getIdentifier("ic_stat_iconnecto", "drawable", ctx.getPackageName());
    if (icon == 0) icon = ctx.getApplicationInfo().icon;
    Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
    b.setSmallIcon(icon).setContentTitle(title).setContentText(body).setCategory(Notification.CATEGORY_CALL)
        .setOngoing(true).setAutoCancel(true).setContentIntent(pi).setFullScreenIntent(pi, true)
        .setPriority(Notification.PRIORITY_MAX).setTimeoutAfter(35000);
    nm.notify(NOTIF_ID, b.build());

    try {
      int raw = ctx.getResources().getIdentifier("iconnecto_ring", "raw", ctx.getPackageName());
      if (raw != 0) {
        player = MediaPlayer.create(ctx, raw);
        if (player != null) {
          player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
          player.setLooping(true);
          player.start();
        }
      }
      Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
      if (v != null) {
        long[] pattern = {0, 800, 600};
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createWaveform(pattern, 0));
        else v.vibrate(pattern, 0);
      }
    } catch (Exception ignored) {}

    final Context app = ctx.getApplicationContext();
    timeout = () -> stop(app);
    handler.postDelayed(timeout, 30000);
  }

  public static synchronized void stop(Context ctx) {
    if (timeout != null) { handler.removeCallbacks(timeout); timeout = null; }
    try {
      if (player != null) { player.stop(); player.release(); }
    } catch (Exception ignored) {}
    player = null;
    try {
      Vibrator v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
      if (v != null) v.cancel();
      ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(NOTIF_ID);
    } catch (Exception ignored) {}
  }
}
