package com.iconnecto.app;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app start and stop the call foreground service. */
@CapacitorPlugin(name = "CallKeeper")
public class CallKeeperPlugin extends Plugin {
  @PluginMethod
  public void start(PluginCall call) {
    try {
      Intent i = new Intent(getContext(), CallService.class);
      i.putExtra("name", call.getString("name", "Call"));
      i.putExtra("video", Boolean.TRUE.equals(call.getBoolean("video", false)));
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i);
      else getContext().startService(i);
      call.resolve();
    } catch (Exception e) {
      call.reject(e.getMessage());
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    try {
      getContext().stopService(new Intent(getContext(), CallService.class));
      call.resolve();
    } catch (Exception e) {
      call.reject(e.getMessage());
    }
  }
}
