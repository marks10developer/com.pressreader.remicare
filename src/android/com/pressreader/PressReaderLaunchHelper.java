package com.pressreader;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.AsyncTask;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;
import android.util.Log;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * PressReader launch helper
 * Detects if PressReader is installed
 * Can launch PressReader or initiate installation
 */
public class PressReaderLaunchHelper {

    private final String mApiKey;
    private final String mSchema;
    private final String mPackageNameBase;
    private final boolean directReferral;

    /**
     * Create instance of helper with default parameter set to main PressReader application
     *
     * @param api_key PressReader API key.
     *                Can be obtained from https://developers.pressreader.com/developer
     */
    public PressReaderLaunchHelper(String api_key) {
        this(api_key, "pressreader://pressreader.com", "com.newspaperdirect.pressreader.android", true);
    }

    /**
     * Create instance of helper with customized PressReader parameters
     *
     * @param api_key        PressReader API key.
     *                       Can be obtained from https://developers.pressreader.com/developer
     * @param schema         schema to launch PressReader application
     * @param packageId      PressReader package id, used to verify found applications by schema and used for installation
     * @param directReferral bypass PressReader API server for device registration
     */
    public PressReaderLaunchHelper(String api_key, String schema, String packageId, boolean directReferral) {
        mApiKey = api_key;
        mSchema = schema;
        mPackageNameBase = packageId;
        this.directReferral = directReferral;
    }

    /**
     * Check if PressReader installation found on device
     *
     * @param context current context
     * @return true if found
     */
    public boolean isPressReaderInstalled(Context context) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(mSchema));
        List<ResolveInfo> resolveInfos = context.getPackageManager().queryIntentActivities(intent, 0);
        if (resolveInfos.size() == 0) {
            return false;
        } else if (TextUtils.isEmpty(mPackageNameBase)) {
            return true;
        } else {
            for (ResolveInfo resolveInfo : resolveInfos) {
                if (resolveInfo.activityInfo.packageName.startsWith(mPackageNameBase)) {
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * Launch current PressReader installation or direct to Google Play for installation
     *
     * @param context current context
     */
    public void launchPressReader(Context context) {
        if (isPressReaderInstalled(context)) {
            context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(mSchema)));
        } else {
            context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(String.format("https://play.google.com/store/apps/details?id=%s", mPackageNameBase))));
        }
    }

    /**
     * Launch current PressReader installation or direct to Google Play for installation
     * And provide user with gift access
     *
     * @param context current context
     * @param jti     JWT ID
     * @param siteId  Site ID - obtained from PressReader
     * @param secret  Secret key  - obtained from PressReader
     * @param hours   Number of hours for gifted access
     */
    public void launchPressReaderWithGiftAccess(final Context context, String jti, String siteId, String secret, int hours) throws IllegalArgumentException {
        String token = generateToken(jti, siteId, secret, hours);
        if (!TextUtils.isEmpty(token)) {
            if (isPressReaderInstalled(context)) {
                context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(String.format("%s?jwt=%s", mSchema, URLEncoder.encode(token)))));
            } else {

                if (directReferral) {
                    Uri parse = Uri.parse(String.format("https://play.google.com/store/apps/details?id=%s&referrer=%s",
                                    mPackageNameBase,
                                    URLEncoder.encode(String.format("jwt=%s", token)))
                    );
                    context.startActivity(new Intent(Intent.ACTION_VIEW, parse));
                } else {
                    String device_id = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
                    if (TextUtils.isEmpty(device_id)) {
                        device_id = UUID.randomUUID().toString();
                    }

                    new AsyncTask<String, Void, Boolean>() {

                        private String device_id;

                        @Override
                        protected Boolean doInBackground(String... params) {
                            this.device_id = params[0];
                            return registerDeviceActivation(params[0], params[1]);
                        }

                        @Override
                        protected void onPostExecute(Boolean result) {
                            if (result) {
                                context.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(String.format("https://play.google.com/store/apps/details?id=%s&referrer=utm_source%%3D%s%%26activation_device_id%%3D%s",
                                        mPackageNameBase,
                                        "radiant_launcher",
                                        device_id))));
                            }
                        }
                    }.execute(device_id, token);
                }
            }
        }
    }

    /**
     * Register device activation at PressReader
     * Used to activate gifted access for a new installation
     *
     * @param deviceid - Some unique device identifier
     * @param token    - JWT (generate using @generateToken)
     * @return true in case
     */
    public boolean registerDeviceActivation(String deviceid, String token) {
        try {
            String json_body = String.format("{deviceId:\"%s\", giftedAccessToken:\"%s\"}", deviceid, token);
            JsonElement jsonElement = doPostRequest("https://api.pressreader.com/v1/deviceactivation/registerparameters?subscription-key=" + mApiKey, json_body);

            if (jsonElement != null) {
                Log.d(this.getClass().getSimpleName(), "Registered device_id: " + deviceid + ", response: " + jsonElement.toString());
                return true;
            }
        } catch (Throwable e) {
            System.out.println(e.getMessage());
        }
        return false;
    }

    private JsonElement doPostRequest(String url, String data) {
        HttpURLConnection conn = null;
        try {

            conn = (HttpURLConnection) new URL(url).openConnection();

            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=\"utf-8\"");
            OutputStream outputStream = conn.getOutputStream();
            OutputStreamWriter writer = new OutputStreamWriter(outputStream, "UTF-8");
            writer.write(data);
            writer.close();
            outputStream.close();

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                InputStreamReader stream = new InputStreamReader(conn.getInputStream());
                try {
                    return new JsonParser().parse(stream);
                } finally {
                    stream.close();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
        return null;
    }

    /**
     * Generate Java Web Token for gifted access
     *
     * @param jti    JWT ID
     * @param siteId Site ID - obtained from PressReader
     * @param secret Secret key  - obtained from PressReader
     * @param hours  Number of hours for gifted access
     * @return
     */
    private String generateToken(String jti, String siteId, String secret, int hours) throws IllegalArgumentException {
        if (TextUtils.isEmpty(jti)) {
            throw new IllegalArgumentException("JWT ID can not be empty");
        }
        if (TextUtils.isEmpty(siteId)) {
            throw new IllegalArgumentException("Site ID can not be empty");
        }
        if (TextUtils.isEmpty(secret)) {
            throw new IllegalArgumentException("Secret key can not be empty");
        }
        if (hours < 1) {
            throw new IllegalArgumentException("Hours can not be less then one hour");
        }
        try {
            JSONObject header = new JSONObject();
            header.put("alg", "HS256");
            header.put("typ", "JWT");

            JSONObject payload = new JSONObject();
            payload.put("iat", System.currentTimeMillis() / 1000);
            payload.put("jti", jti);
            payload.put("exp", System.currentTimeMillis() / 1000 + (60 * 60 * 24 * 1));
            payload.put("site-id", siteId);

            JSONObject giftperiod = new JSONObject();

            giftperiod.put("num-hours", hours);

            payload.put("gift-period", giftperiod);

            Mac sha256_HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secret_key = new SecretKeySpec(secret.getBytes(), "HmacSHA256");
            sha256_HMAC.init(secret_key);

            String header64 = Base64.encodeToString(header.toString().getBytes(), Base64.URL_SAFE | Base64.NO_WRAP);
            String body64 = Base64.encodeToString(payload.toString().getBytes(), Base64.URL_SAFE | Base64.NO_WRAP);
            String signature = String.format("%s.%s", header64, body64);
            String signature64 = Base64.encodeToString(sha256_HMAC.doFinal(signature.getBytes()), Base64.URL_SAFE | Base64.NO_WRAP);

            return String.format("%s.%s.%s", header64, body64, signature64);


        } catch (InvalidKeyException e) {
            e.printStackTrace();
        } catch (JSONException e){
            e.printStackTrace();
        } catch (NoSuchAlgorithmException e){
            e.printStackTrace();
        }
        return null;
    }

}
