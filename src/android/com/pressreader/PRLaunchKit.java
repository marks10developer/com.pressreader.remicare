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
      pressReaderLaunchHelper = new PressReaderLaunchHelper(args.getString(0));
      pressReaderLaunchHelper.launchPressReaderWithGiftAccess(context, args.getString(3), args.getString(1), args.getString(2), 24);
      System.out.println("PRESSREADER Run with arguments : " + args);
      callbackContext.success(result);
      return true;
    } else {
      return false;
    }
  }
}
