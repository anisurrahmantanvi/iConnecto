package com.iconnecto.app;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Replaces the push plugin's own service. Incoming-call messages (data only) ring and open a full-screen call
 * notification; everything else goes to the push plugin exactly as before.
 */
public class AppMessagingService extends FirebaseMessagingService {
  @Override
  public void onMessageReceived(RemoteMessage message) {
    Map<String, String> d = message.getData();
    if ("call".equals(d.get("kind"))) {
      CallRinger.start(this, d.get("title") != null ? d.get("title") : "Incoming call",
          d.get("body") != null ? d.get("body") : "", d.get("url") != null ? d.get("url") : "/messages");
      return;
    }
    if ("call_end".equals(d.get("kind"))) {
      CallRinger.stop(this);
      return;
    }
    PushNotificationsPlugin.sendRemoteMessage(message);
  }

  @Override
  public void onNewToken(String token) {
    PushNotificationsPlugin.onNewToken(token);
  }
}
