package com.pressreader;

import android.app.Activity;
import android.os.Bundle;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;
import android.content.Context;
import com.pressreader.PressReaderLaunchHelper;
import java.util.UUID;

public class PRLaunchKit extends CordovaPlugin {
  private PressReaderLaunchHelper pressReaderLaunchHelper;

  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
    if (action.equals("launchPressReader")) {
      Context context = this.cordova.getActivity();
      JSONObject result = new JSONObject();
      pressReaderLaunchHelper = new PressReaderLaunchHelper("d9d261747f4148aaad4d13b670a24129");
      pressReaderLaunchHelper.launchPressReaderWithGiftAccess(context, "secret_welcome1", "8898", "secret_welcome1", 24);
      System.out.println("PRESSREADER Run");
      callbackContext.success(result);
      return true;
    } else {
      return false;
    }
  }
}
