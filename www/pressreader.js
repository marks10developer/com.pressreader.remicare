var pressreader = {
  launchPR: function (successCallback, errorCallback) {
    cordova.exec(successCallback, errorCallback, 'PRAppLaunchKit', 'launchPR', []);
  }
}

cordova.addConstructor(function () {
  if (!window.plugins) {
    window.plugins = {};
  }

  window.plugins.pressreader = pressreader;
  return window.plugins.pressreader;
});
