package com.pressreader;

import android.app.Activity;
import android.util.Log;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;

import android.content.Context;

public class PRLaunchKit extends CordovaPlugin {

  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
    if (action.equals("launchPressReader")) {
      Context context = this.cordova.getActivity().getApplicationContext();

      JSONObject result = new JSONObject();
      
      result.put("mnc", 1);
      Log.d("TAG", "Message");
      callbackContext.success(result);

      return true;
    } else {
      return false;
    }
  }
}
