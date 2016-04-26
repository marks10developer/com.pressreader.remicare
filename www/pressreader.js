var pressreader = {
  launchPR: function (params, successCallback, errorCallback) {
    var args = [params.subscriptionKey, params.siteID, params.secretID, params.giftID];
    cordova.exec(successCallback, errorCallback, 'PRLaunchKit', 'launchPressReader', args);
  }
}

cordova.addConstructor(function () {
  if (!window.plugins) {
    window.plugins = {};
  }

  window.plugins.pressreader = pressreader;
  return window.plugins.pressreader;
});
