/*
 Contains extenders and utility methods for existing JS types.
 */

(function arrayExtenders() {

    'use strict';

    if (!Array.prototype.spExt) Array.prototype.spExt = {};

    /**
     * Joins all elements of an array into a string.
     * if any of these elements ends with {separator} - methods omits additional {separator} between it and next item.
     * @param {array} arr - array of items.
     * @param {string} separator - Specifies a string to separate each element of the array.
     * The separator is converted to a string if necessary.
     * If omitted, the array elements are separated with a comma.
     * @example
     * // returns '1,2,3'
     * combine('1,', '2,', 3)
     * @returns {string} contains all array elements separated with {separator}.
     */
    function join(arr, separator) {
        if (!arr || !Array.isArray(arr)) throw new Error('Array object is required.');
        if (arr.length === 0) return '';
        if (!separator) separator = ',';

        var i = 0;

        function producer(el) {
            if (el.endsWith(separator)) return el;
            if (el.startsWith(separator)) el = el.substr(el.indexOf(separator) + 1);
            i = i + 1;
            if (i >= arr.length) return el; // do not add separator to the last element.
            return el + separator;
        }

        return arr.map(producer).join('');
    }

    Array.prototype.spExt.join = join;
})();

angular
    .module('sp.utils', ['sp.utils.url']);

/*
 Contains utility methods to work with URLs.
 */
angular
    .module('sp.utils.url', [])
    .constant('sp.utils.url', {

        /**
         * Combines parts of url using / as a join symbol.
         * if any of url parts ends with /, methods tolerates this (i.e. does not add / between this and next part).
         * @param {...string} parts - parts of the url need to be combined.
         * @example
         * // returns 'http://google.com/part1/part2'
         * combine('http://google.com', 'part1', 'part2')
         * @returns {string} a string representation of URL.
         */
        combine: function (/*parts*/) {
            'use strict';

            var args = Array.prototype.slice.call(arguments);
            return Array.prototype.spExt.join(args, '/');
        }
    });


(function (_) {

    'use strict';

    // https://gist.github.com/furf/3208381

    //

    /**
     * Get/set the value of a nested property
     * @param {*} obj - object to traverse.
     * @param {string} key - key name or path to set or get the value
     * @param {*} value - value to set.
     * @example
     *
     *  var obj = {
     *  a: {
     *        b: {
     *          c: {
     *            d: ['e', 'f', 'g']
     *          }
     *        }
     *      }
     *   };
     *
     *    Get deep value
     *    _.deep(obj, 'a.b.c.d[2]'); // 'g'
     *
     *    Set deep value
     *    _.deep(obj, 'a.b.c.d[2]', 'george');
     *
     *    _.deep(obj, 'a.b.c.d[2]'); // 'george'
     * @returns {*} - value if setter used. nothing - otherwise
     */
    function deep(obj, key, value) {

        if (!obj) throw new Error('Obj is required.');
        if (!key) throw new Error('key is required.');

        var keys = key.replace(/\[(["']?)([^\1]+?)\1?\]/g, '.$2').replace(/^\./, '').split('.'),
            root,
            i = 0,
            n = keys.length;

        // Set deep value
        if (arguments.length > 2) {

            root = obj;
            n--;

            while (i < n) {
                key = keys[i++];
                obj = obj[key] = _.isObject(obj[key]) ? obj[key] : {};
            }

            obj[keys[i]] = value;

            value = root;

        // Get deep value
        } else {
            /* jshint noempty:false */
            while ((obj = obj[keys[i++]]) !== null && i < n) {}
            value = i < n ? void 0 : obj;
        }

        return value;
    }

    _.mixin({ 'deep': deep });


})(_);

/*
 * Simple wrapper of Hammer.js that allows to use it as a service within an angular app.
 * Requires [Hammer.js](http://eightmedia.github.io/hammer.js/), tested with `~2.0.2`.
*/
(function (window, angular, hammer) {

    'use strict';

    if (!hammer) throw new Error('Hammer is required.');

    angular.module('sp.utils')
        .factory('prHammer', function () {
            return hammer;
        });

})(window, window.angular, window.Hammer);

(function (window, angular, Hammer) {

    'use strict';

    if (!Hammer) throw new Error('Hammer is required.');

    angular.module('sp.utils')
        .factory('$hammer', function () {

            return function(elem, options) { return new Hammer(elem, options); };
        });

    angular.module('sp.utils')
        .factory('$hammerInvariants', function () {

            return Hammer;
        });

    angular.module('sp.utils')
        .factory('$hammerManager', function () {

            return function(elem, options) {
                return new Hammer.Manager(elem, options);
            };
        });



})(window, window.angular, window.Hammer);

angular.module('pr.utils.angular', [])
    .factory('pr.utils.angularAdapter', ['$q',
        function ($q) {

            'use strict';

            /**
             * Returns function, that appends func invocation to current scope $$postDigest queue
             * @param {Object} scope Angular Scope object.
             * @param {Function} func Function which invocation is appended to postDigest.
             * @returns Decorated function.
            */
            function postDigestPushDecorator(scope, func) {
                return function() {
                    var self = this, args = arguments;
                    scope.$$postDigest(function prAdapterPostDigestWrapper() {
                        func.apply(self, args);
                    });
                };
            }

            return {
                /**
                 * Returns wrapper function that executes original function on the nearest $scope $$postDigest stage.
                 * @param {Object} scope Angular Scope object.
                 * @param {Function} fn Function which execution is deferred.
                 * @param {Number} priority Empirical priority of the function execution (the bigger, the lower).
                 * @returns wrapped function that executes original function on $$postDigest.
                 * @remarks
                 *      Technically this is a hack, because external code is not supposed to use internal queue starts with $$ prefix
                 *      However sometimes it's necessary to execute some code only after $digest.
                 *      Use carefully.
                */
                deferDigest: function deferDigest(scope, fn, priority) {

                    if (!angular.isObject(scope) || !scope.$$postDigest) throw new Error('scope object is required');
                    if (!angular.isFunction(fn)) throw new Error('Cannot defer non function');

                    if (!angular.isNumber(priority)) priority = 0;
                    else priority = parseInt(priority);

                    return function deferDigestWrapper() {
                        var self = this,
                            args = arguments,
                            dfd = $q.defer();

                        var appendSequence = function() {
                            $q.when(fn.apply(self, args))
                                .then(function(res) {
                                    dfd.resolve(res);
                                });
                        };

                        do {
                            appendSequence = postDigestPushDecorator(scope, appendSequence);
                            priority--;
                        } while (priority >= 0);

                        appendSequence();

                        return dfd.promise;
                    };
                }
            };
        }
    ]);

angular
    .module('sp.shell', ['sp.common',
        'sp.configuration',
        'sp.account',
        'sp.sidebar',
        'sp.catalog',
        'sp.settings',
        'sp.smartflow',
        'sp.content',
        'pr.issues'
    ])
    .config(['$stateProvider', '$locationProvider', 'sp.configuration.templatesStoreProvider', 'sp.common.areasCatalogProvider',
        function shellConfig($stateProvider, $locationProvider, tStore, areasCatalog) {

            'use strict';

            var areas = areasCatalog.getAreas();

            $stateProvider
                .state('shell', {
                    abstract: true,
                    views: {
                        topbar: {
                            templateProvider: tStore.getTemplateService('shell.topbar')
                        },
                        sidebar: {
                            templateProvider: tStore.getTemplateService('shell.sidebar')
                        }
                    }
                })
                .state('shell.container', {
                    views: areas
                });

            $locationProvider.html5Mode(true);
        }])
    .run(['$state', '$rootScope', function ($state) {

        'use strict';

        $state.go('smartflow');
    }]);

angular
    .module('sp.account', ['sp.common', 'sp.configuration', 'sp.network', 'sp.account.internal', 'ui.router'])
    .config(['$stateProvider', '$httpProvider',
        'sp.common.invariants',
        'sp.account.internal.tokenHttpInterceptorProvider',
        'sp.configuration.templatesStoreProvider',
        'sp.common.areasCatalogProvider',
        function spAuthConfiguration($stateProvider, $httpProvider, invariants, tokenInterceptor, templatesStore, areasCatalog) {

            'use strict';

            areasCatalog.registerShellArea({
                'topbar-accountInfo': {
                    templateProvider: templatesStore.getTemplateService('account.topbar'),
                    controller: 'sp.account.topbar.controller'
                }
            });


            $stateProvider
                .state('signin', {
                    url: '/account/signin',
                    parent: 'shell.container',
                    views: {
                        '@': {
                            templateProvider: templatesStore.getTemplateService('Account.Signin'),
                            controller: 'sp.account.signin.controller as ctrl',
                            resolve: {
                                configuration: ['sp.configuration.configuration', function (configuration) {
                                    return configuration.load();
                                }]
                            }
                        }
                    }
                });

            tokenInterceptor.enableInterceptionFor(invariants.server.servicesUrl);

            $httpProvider.interceptors.push('sp.account.internal.tokenHttpInterceptor');
        }
    ]);


angular
    .module('sp.account')
    .factory('sp.account.authenticationService', ['$q',
        'sp.account.internal.authenticationProvider',
        'sp.account.authorizationTicket',
        'sp.common.eventBus',
        'sp.account.events',
        'sp.common.events',
        'sp.account.internal.userAuthenticationStorage',
        'sp.account.internal.tokenDescriptor',
        function authenticationService($q, authenticationProvider, authorizationTicket, eventBus, accountEvents,
                                       commonEvents, authStorage, TokenDescriptor) {

            'use strict';

            /**
             * Raises event indicate that account has been changed.
             * @param {string} token - new authentication token.
             */
            function afterAccountChanged(token) {
                eventBus.publish(accountEvents.AFTER_ACCOUNT_CHANGED, { token: token });
                eventBus.publish(commonEvents.ON_NEEDS_RELOAD);
            }

            /**
             * Sends request to server in order to authenticate user.
             * @param {object} info - authentication information.
             * @param {string} info.username - user name.
             * @param {string} info.password - user password.
             * @param {boolean} info.autoLogin - if true, user will be logged automatically next time.
             * @returns {promise} promise object, when fulfilled contains {TokenDescriptor} instance.
             */
            function signin(info) {

                if (!info) throw new Error('Info parameter is required.');
                if (!info.username)  throw new Error('Info.username parameter is required.');
                if (!info.password)  throw new Error('Info.password parameter is required.');

                eventBus.publish(accountEvents.BEFORE_ACCOUNT_CHANGED);

                function ticketReceivedHandler(ticket) {
                    var token = ticket.token(),
                        authInfo = angular.extend({ token: token }, info);

                    return authenticationProvider
                        .authenticateUser(authInfo)
                        .then(function userAuthenticated(userAuthenticatedInfo) {

                            var newToken = userAuthenticatedInfo.token,
                                persistentAuthTicket = userAuthenticatedInfo.persistentAuthTicket,
                                profileTicket = userAuthenticatedInfo.profileTicket,
                                authTicket = userAuthenticatedInfo.authTicket;

                            authStorage.save(profileTicket, authTicket, persistentAuthTicket);

                            afterAccountChanged(newToken);

                            return new TokenDescriptor({ token: newToken });
                        });
                }

                return authorizationTicket
                    .load()
                    .then(ticketReceivedHandler);
            }

            /**
             * Proceeds authentication if user enabled auto-login, and persistent information is available
             * @returns {promise} - promise, when fulfilled contains {TokenDescriptor} instance.
             */
            function loginIfCredentialsWereStored() {

                var credentials = authStorage.get();

                if (credentials.persistentAuthTicket) {

                    eventBus.publish(accountEvents.BEFORE_ACCOUNT_CHANGED);

                    return authenticationProvider
                        .authenticateByTicket(credentials.persistentAuthTicket)
                        .then(function userAuthenticatedHandler(userAuthenticatedInfo) {

                            var newToken = userAuthenticatedInfo.token;

                            afterAccountChanged(newToken);

                            return new TokenDescriptor(userAuthenticatedInfo);
                        });
                }
                return authorizationTicket.load();
            }

            /**
             * Signouts current user.
             * @returns {Promise} - when fulfilled contains new token information.
             */
            function signout() {
                eventBus.publish(accountEvents.BEFORE_ACCOUNT_CHANGED);
                authStorage.clear();

                return authenticationProvider
                    .deauthenticateUser()
                    .then(function signoutCompleted(tokenInfo) {
                        afterAccountChanged(tokenInfo.token);

                        return new TokenDescriptor(tokenInfo);
                    });
            }


            return {
                signinUser: signin,
                proceedAutoLogin: loginIfCredentialsWereStored,
                signoutUser: signout
            };

        }]);

angular
    .module('sp.account')
    .controller('sp.account.signin.controller', ['sp.account.authenticationService',

        function signInController(authenticationService) {
            'use strict';

            this.username = 'alexanderk@newspaperdirect.com';
            this.password = '123456';

            this.signin = function signin() {
                authenticationService
                    .signinUser({ username: this.username, password: this.password, autoLogin: true });
            };

        }]);

angular
    .module('sp.account')
    .controller('sp.account.topbar.controller', ['$scope', 'sp.account.user', 'sp.account.authenticationService',


        function accountTopBarController($scope, user, authenticationService) {
            'use strict';

            function socialInfoChanged(socialInfo) {
                $scope.nickName = socialInfo && socialInfo.nickName;
                $scope.isAuthenticated = user.isAuthenticated();

                $scope.isLoading = false;
            }

            function checkAuthentication(newVal, oldVal) {
                if (newVal === oldVal) return;
                $scope.isLoading = true;

                if (newVal) {
                    // user has been authenticated
                    user.loadSocialInfo().then(socialInfoChanged);
                }
                else {
                    // user signed out
                    socialInfoChanged(null);
                }
            }

            $scope.$watch(user.isAuthenticated, checkAuthentication);
            $scope.signout = function proceedSignout() {
                authenticationService.signoutUser();
            };

            // since $watch will run when newVal === oldVal, we need to
            // initialize scope by calling checkAuthentication manually.
            checkAuthentication(user.isAuthenticated(), undefined);
        }]);


angular
    .module('sp.account')
    .constant('sp.account.events', {
        /**
         * Triggers before account is changed.
         */
        BEFORE_ACCOUNT_CHANGED: 'sp.account.events.beforeAccountChanged',
        /**
         * Triggers immediately after account has been changed.
         */
        AFTER_ACCOUNT_CHANGED: 'sp.account.events.afterAccountChanged'
    });

angular
    .module('sp.account')
    .factory('sp.account.authorizationTicket', [
        'sp.account.internal.confirmCookiesProvider',
        'sp.common.promiseCache',
        'sp.account.events',
        'sp.account.internal.tokenDescriptor',
        'sp.account.internal.userAuthenticationStorage',
        'sp.account.internal.authenticationProvider',
        function (authorizationProvider, promiseCache, events, TokenDescriptor, authStorage, authenticationProvider) {

            'use strict';


            /**
             * loads new ticket from authorization provider.
             * @returns {promise} object, when fulfilled contains {TicketDescriptor} instance
             */
            function loadNewTicket() {

                function ticketLoadedHandler(data) {
                    return new TokenDescriptor(data);
                }

                // if there were persistent data stored
                // use it to authenticate user.
                var credentials = authStorage.get();

                if (credentials.persistentAuthTicket) {

                    return authenticationProvider
                        .authenticateByTicket(credentials.profileTicket, credentials.persistentAuthTicket)
                        .then(function userAuthenticatedHandler(userAuthenticatedInfo) {

                            var newToken = userAuthenticatedInfo.token;

                            return new TokenDescriptor({ token: newToken });
                        });
                }

                return authorizationProvider
                    .loadTicket()
                    .then(ticketLoadedHandler);
            }

            // api
            return {
                load: promiseCache('sp.account.authorizationTicket', loadNewTicket, {
                    invalidationEvtName: events.AFTER_ACCOUNT_CHANGED,
                    newValFn: function(ticketInfo) {
                        return new TokenDescriptor(ticketInfo);
                    }
                })
            };
        }
    ]);

angular
    .module('sp.account')
    .factory('sp.account.user', [
        'sp.account.internal.userSocialInfoProvider',
        'sp.account.internal.userAuthenticationStorage',
        'sp.common.eventBus',
        'sp.account.events',
        function (provider, storage, eventBus, accountEvents) {

            'use strict';

            /**
             * Indicates that currently user is proceeding through authentication process.
             * @type {number}
             */
            var isAuthenticating = 0;

            eventBus.subscribe(accountEvents.BEFORE_ACCOUNT_CHANGED, function beforeAccountChanged() {
                isAuthenticating = 1;
            });

            eventBus.subscribe(accountEvents.AFTER_ACCOUNT_CHANGED, function afterAccountChanged() {
                isAuthenticating = 0;
            });

            /**
             * Initializes a new instance of {UserSocialSettings} class.
             * @param {!object} data - raw data, received from server.
             * @param {!string} data.Email - user email.
             * @param {!string} data.NickName - user nick name.
             * @param {!string} data.PhotoUrl - user photo url.
             * @constructor
             */
            function UserSocialSettings(data) {

                if (!data) throw new Error('Data is required parameter.');
                if (!data.Email) throw new Error('Data.Email is required.');
                if (!data.NickName) throw new Error('Data.NickName is required.');
                if (!data.PhotoUrl) throw new Error('Data.PhotoUrl is required.');

                this.email = data.Email;
                this.nickName = data.NickName;
                this.photoUrl = data.PhotoUrl;

                Object.freeze(this);
            }

            /**
             * Returns current user social information.
             * Throws error if current user is not authenticated.
             * @param {?object} userInfoSettings - user info configuration settings.
             * @param {?number} userInfoSettings.photoWidth - desired user photo width
             * (if not set, small size (28px) will be requested.
             * @param {?number} userInfoSettings.photoHeight - desired user photo height
             * (if not set, small size (28px) will be requested.
             * @returns {promise} object, when fulfilled contains {UserSocialSettings} instance.
             */
            function getCurrentUserSocialInfo(userInfoSettings) {

                function userInfoSettingsLoadedHandler(response) {
                    return new UserSocialSettings(response.data);
                }

                var defaults = { photoWidth: 28, photoHeight: 28 },
                    settings = userInfoSettings || {},
                    width = settings.photoWidth || defaults.photoWidth,
                    height = settings.photoHeight || defaults.photoHeight;
                return provider
                    .load({ width: width, height: height })
                    .then(userInfoSettingsLoadedHandler);
            }


            /**
             * Checks whether current user is authenticated.
             * @returns {boolean} - true, if authenticated, otherwise false.
             */
            function isAuthenticated() {
                // we need additional field isAuthenticating
                // because site services will place cookies BEFORE authentication process ends
                // so storage.authenticationDataExists() will return true event user is not authenticated yet.
                return !!(storage.authenticationDataExists() && !isAuthenticating);
            }

            // api
            return {
                loadSocialInfo: getCurrentUserSocialInfo,
                isAuthenticated: isAuthenticated
            };
        }
    ]);

angular.module('sp.account.internal', ['sp.common', 'ivpusic.cookie']);

angular
    .module('sp.account.internal')
    .provider('sp.account.internal.tokenHttpInterceptor', [function tokenHttpInterceptorProvider () {

        'use strict';

        var ignoreExact = {},
            enabledArr = [];

        function needsInterception(config) {

            if (!config) return false;
            if (ignoreExact[config.url]) return false;

            for (var i = 0, len = enabledArr.length; i < len; i++) {
                if (config.url.indexOf(enabledArr[i]) > -1) return true;
            }

            return false;
        }

        return {
            /**
             * Disables interception for particular url. Url must be exact matched.
             * @param {string} url - url, when requested interceptors will not be called.
             */
            disableInterceptionFor: function (url) {
                if (!url) throw new Error('Url is required parameter.');
                ignoreExact[url] = 1;
            },
            /**
             * Enables interception for particular url. Url could be a part of full url.
             * @param {string} url - url, when requested interceptors will be called.
             */
            enableInterceptionFor: function (url) {
                if (!url) throw new Error('Url is required parameter.');

                enabledArr.push(url);
            },

            $get: ['$q', '$injector', function ($q, $injector) {

                return {
                    'request': function (config) {

                        if (!needsInterception(config)) return $q.when(config);

                        var defer = $q.defer(),
                            configCopy = angular.copy(config);

                        // each request sends to server needs accessToken parameter.
                        // following code adds it.
                        $injector.invoke(['sp.account.authorizationTicket', function (authTicket) {

                            authTicket.load().then(function authTicketLoaded(ticket) {
                                var token = ticket.encodedToken();
                                if (!configCopy.params) configCopy.params = {};
                                configCopy.params.accessToken = token;
                                defer.resolve(configCopy);
                            });

                        }]);
                        return defer.promise;
                    }
                };
            }]


        };
    }]);

/**
 * Provider to load authorization information.
 * For internal sp.core module usage only.
 */
angular
    .module('sp.account.internal')
    .provider('sp.account.internal.confirmCookiesProvider',
        ['sp.account.internal.tokenHttpInterceptorProvider', 'sp.common.invariants', 'sp.utils.url',
        function (interceptorProvider, invariants, urlUtils) {

            'use strict';

            var confirmCookiesUrl = urlUtils.combine(invariants.baseUrl, 'authentication', 'confirmCookies');

            interceptorProvider.disableInterceptionFor(confirmCookiesUrl);


            return {
                $get: ['sp.common.httpService', function authorizationProviderGet(httpService) {

                    /**
                     * Processes response received from authorization service confirm cookies method.
                     * @param {object} response - angular response object.
                     * @returns {object} - authorization data container.
                     */
                    function confirmCookiesSuccessHandler(response) {
                        return response.data._preload.auth;
                    }

                    /**
                     * Retrieves new ticket from server.
                     * @returns {promise} object, when fulfilled contains {TicketDescriptor} instance
                     */
                    function loadTicket() {
                        return httpService
                            .get(confirmCookiesUrl)
                            .then(confirmCookiesSuccessHandler);
                    }

                    // api
                    return {
                        loadTicket: loadTicket
                    };

                }]
            };

        }]);


angular
    .module('sp.account.internal')
    .provider('sp.account.internal.authenticationProvider', [

        'sp.account.internal.tokenHttpInterceptorProvider', 'sp.network.apiProvider',

        function authenticationProvider(httpInterceptor, apiProvider) {

            'use strict';

            var serviceGetter;
            var NEW_TICKET_URL = 'spapi/tickets',
                AUTHORIZE_TICKET_SITE_URL = 'smartphone/auth/signin',
                DEAUTHORIZE_TICKET_SITE_URL = 'smartphone/auth/signout',
                AUTHORIZE_TICKET_SERVER_URL = 'spapi/ticketsauthorization',
                DEAUTHORIZE_TICKET_SERVER_URL = AUTHORIZE_TICKET_SERVER_URL,
                PD_ANONYMOUS_PROFILE_HEADER = 'X-PD-AProfile',
                PD_PROFILE_HEADER = 'X-PD-Profile',
                PD_TICKET_HEADER = 'X-PD-Ticket',
                PD_AUTH_HEADER = 'X-PD-Auth',
                PD_PERSISTENT_AUTH_HEADER = 'X-PD-PAuth',
                PD_TOKEN_HEADER = 'X-PD-Token';

            httpInterceptor.disableInterceptionFor(apiProvider.getServerUrl(AUTHORIZE_TICKET_SERVER_URL));


            serviceGetter = ['$q', 'sp.network.api', function authenticationProvider($q, api) {

                /**
                 * Request server for a new authentication ticket.
                 * @param {object} authConf - authentication information.
                 * @param {string} authConf.username - user name.
                 * @param {string} authConf.password - user password.
                 * @param {string} authConf.token - current authorization token.
                 * @param {Boolean?} authConf.autoLogin - if true, user will be logged automatically in the next sessions.
                 * @returns {promise} - a promise object, when fulfilled contains
                 */
                function getAuthTicket(authConf) {
                    var params = {
                            token: authConf.token
                        },
                        data = {
                            username: authConf.username,
                            password: authConf.password
                        };

                    function authenticationSucceededHandler(response) {
                        var headersFn = response.headers;

                        return {
                            ticket: headersFn(PD_TICKET_HEADER),
                            autoLogin: authConf.autoLogin
                        };
                    }

                    return api
                        .server
                        .post(NEW_TICKET_URL, { params: params, data: data })
                        .then(authenticationSucceededHandler);
                }

                /**
                 * Authorizes received ticket and returns a promise with new authorization tickets.
                 * @param {!object} ticketInfo - ticket information.
                 * @param {!string} ticketInfo.ticket - ticket.
                 * @param {boolean} ticketInfo.autoLogin - if true, user will be logged automatically in the next sessions.
                 * @returns {promise} - promise object when fulfilled contains following data:
                 * {!string} profileTicket - profile ticket.
                 * {!string} authTicket - authentication ticket.
                 * {?string} persistentTicket - persistent authentication ticket (only if autoLogin was set to true).
                 */
                function authorizeTicketsOnSite(ticketInfo) {

                    if (!ticketInfo.ticket) throw new Error('Token was not received from tokens service.');

                    function ticketAuthorizedHandler(response) {
                        var headersFn = response.headers,
                            profileToken = headersFn(PD_PROFILE_HEADER),
                            authToken = headersFn(PD_AUTH_HEADER),
                            persistentAuthTicket = ticketInfo.autoLogin && headersFn(PD_PERSISTENT_AUTH_HEADER);

                        return {
                            profileTicket: profileToken,
                            authTicket: authToken,
                            persistentAuthTicket: persistentAuthTicket
                        };
                    }

                    return api.site.post(AUTHORIZE_TICKET_SITE_URL, {
                        data: {
                            // todo: token or ticket?
                            token: ticketInfo.ticket,
                            enableAutoLogin: ticketInfo.autoLogin
                        }
                    }).then(ticketAuthorizedHandler);
                }

                /**
                 * Authorises ticket on server and returns a promise with new authorization token;
                 * @param {!object} ticketInfo - ticket information.
                 * @param {?string} ticketInfo.profileTicket - profile ticket.
                 * @param {?string} ticketInfo.authTicket - authentication ticket.
                 * @param {?string} ticketInfo.persistentTicket - persistent authentication ticket.
                 * @param {?string} ticketInfo.anonymousProfileTicket - anonymous authentication ticket.
                 * @returns {promise} - a promise object when fulfilled contains the following data:
                 * {!string} token - new authorization token.
                 * {!string} profileTicket - profile ticket.
                 * {!string} authTicket - authentication ticket.
                 * {?string} persistentAuthTicket - persistent authentication ticket.
                 */
                function authorizeTicketOnServer(ticketInfo) {

                    function ticketsAuthorizedHandler(response) {
                        var headersFn = response.headers,
                            token = headersFn(PD_TOKEN_HEADER);

                        return {
                            token: token,
                            profileTicket: ticketInfo.profileTicket,
                            authTicket: ticketInfo.authTicket,
                            persistentAuthTicket: ticketInfo.persistentAuthTicket,
                            anonymousProfileTicket: ticketInfo.anonymousProfileTicket
                        };
                    }

                    var tickets = [];
                    if (ticketInfo.profileTicket) tickets.push(ticketInfo.profileTicket);
                    if (ticketInfo.authTicket) tickets.push(ticketInfo.authTicket);
                    if (ticketInfo.anonymousProfileTicket) tickets.push(ticketInfo.anonymousProfileTicket);
                    if (ticketInfo.persistentAuthTicket) tickets.push(ticketInfo.persistentAuthTicket);

                    if (tickets.length === 0) throw new Error('Authentication process has not received any token from server.');

                    return api.server.post(AUTHORIZE_TICKET_SERVER_URL, {
                        data: {
                            tickets: tickets
                        }
                    }).then(ticketsAuthorizedHandler);
                }

                /**
                 * Sends request to server in order to authenticate user.
                 * @param {object} authConf - authentication information.
                 * @param {string} authConf.username - user name.
                 * @param {string} authConf.password - user password.
                 * @param {string} authConf.token - current authorization token.
                 * @param {Boolean?} authConf.autoLogin - if true, user will be logged automatically in the next sessions.
                 * @returns {promise} - promise object, when fulfilled contains the following data
                 * {!string} token - new authorization token.
                 * {!string} profileTicket - profile ticket.
                 * {!string} authTicket - authentication ticket.
                 * {?string} persistentAuthTicket - persistent authentication ticket.
                 *
                 */
                function authenticateUser(authConf) {
                    return getAuthTicket(authConf)
                        .then(authorizeTicketsOnSite)
                        .then(authorizeTicketOnServer);
                }


                /**
                 * Authenticates user by authentication ticket.
                 * @param {!string} profileTicket - profile ticket.
                 * @param {!string} persistentAuthTicket - authentication ticket.
                 * @returns {promise} - promise object, when fulfilled contains the following data
                 * {!string} token - new authorization token.
                 */
                function authenticateUserByTicket(profileTicket, persistentAuthTicket) {

                    if (!profileTicket) throw new Error('Profile ticket is required.');
                    if (!persistentAuthTicket) throw new Error('Persistent ticket is required.');

                    function ticketAuthorizedHandler(response) {
                        var headersFn = response.headers,
                            token = headersFn(PD_TOKEN_HEADER);

                        return {
                            token: token
                        };
                    }

                    return api.server.post(AUTHORIZE_TICKET_SERVER_URL, {
                        data: {
                            tickets: [profileTicket, persistentAuthTicket]
                        }
                    }).then(ticketAuthorizedHandler);
                }


                function deauthorizeTicketOnServer() {
                    return api.server.delete(DEAUTHORIZE_TICKET_SERVER_URL);
                }

                function deauthorizeTicketOnSite() {

                    function ticketDeauthorized(response) {
                        var headersFn = response.headers,
                            anonymousProfileTicket = headersFn(PD_ANONYMOUS_PROFILE_HEADER);

                        return { anonymousProfileTicket: anonymousProfileTicket };
                    }

                    return api.site.post(DEAUTHORIZE_TICKET_SITE_URL).then(ticketDeauthorized);
                }


                /**
                 * Sends requests to deauthenticate current user.
                 * @returns {promise} - promise object, when fulfilled contains the following data
                 * {!string} token - new authorization token.
                 */
                function deauthenticateUser() {

                    return deauthorizeTicketOnServer()
                        .then(deauthorizeTicketOnSite)
                        .then(authorizeTicketOnServer);
                }

                return {
                    authenticateUser: authenticateUser,
                    authenticateByTicket: authenticateUserByTicket,
                    deauthenticateUser: deauthenticateUser
                };
            }];

            return {
                $get: serviceGetter
            };
        }
    ]);

angular
    .module('sp.account.internal')
    .factory('sp.account.internal.userAuthenticationStorage', ['ipCookie', function(cookieManager) {

        'use strict';

        var PROFILE_COOKIE_NAME = 'Profile',
            AUTH_COOKIE_NAME = 'PDAuth',
            PERSISTENT_AUTH_COOKIE_NAME = 'PDPAuth';


        function safeAddCookie(cookieName, cookieVal, opts) {
            if (encodeURIComponent(cookieManager(cookieName)) === encodeURIComponent(cookieVal)) return;

            cookieManager(cookieName, cookieVal, opts);
        }

        /**
         * Saves authentication data
         * @param {!string} profileTicket - profile ticket.
         * @param {!string} authTicket - authentication ticket.
         * @param {?string} persistentAuthTicket - persistent authentication ticket.
         */
        function saveAuthenticationSettings(profileTicket, authTicket, persistentAuthTicket) {

            if (!profileTicket) throw new Error('ProfileTicket is required.');
            if (!authTicket) throw new Error('AuthTicket is required.');

            // if there are already cookies with the same names and values - skip addition
            safeAddCookie(PROFILE_COOKIE_NAME, profileTicket, { expires: 365 * 30 /* 30 years */ });
            safeAddCookie(AUTH_COOKIE_NAME, authTicket);

            if (persistentAuthTicket) {
                safeAddCookie(PERSISTENT_AUTH_COOKIE_NAME, persistentAuthTicket, { expires: 30 /* days */ });
            }
        }

        /**
         * Returns authentication data for current user.
         * @returns {{profileTicket: string, authTicket: string, persistentAuthTicket: ?string}}
         */
        function getAuthenticationSettings() {
            var profileTicket = cookieManager(PROFILE_COOKIE_NAME),
                authTicket = cookieManager(AUTH_COOKIE_NAME),
                persistentAuthTicket = cookieManager(PERSISTENT_AUTH_COOKIE_NAME);

            return {
                profileTicket: profileTicket,
                authTicket: authTicket,
                persistentAuthTicket: persistentAuthTicket
            };
        }

        /**
         * Removes all previously stored authentication settings.
         */
        function clearAuthenticationSettings() {
            cookieManager.remove(PROFILE_COOKIE_NAME);
            cookieManager.remove(AUTH_COOKIE_NAME);
            cookieManager.remove(PERSISTENT_AUTH_COOKIE_NAME);
        }

        /**
         * Checks whether authentication data was previously saved.
         * @returns {boolean} - true, if user has authentication, otherwise false.
         */
        function isAuthenticationDataExists() {
            return !!cookieManager(PERSISTENT_AUTH_COOKIE_NAME);
        }


        return {
            save: saveAuthenticationSettings,
            get: getAuthenticationSettings,
            clear: clearAuthenticationSettings,
            authenticationDataExists: isAuthenticationDataExists
        };

    }]);

angular
    .module('sp.account.internal')
    .factory('sp.account.internal.tokenDescriptor', function tokenDescriptor() {

        'use strict';

        /**
         * This function creates a new instance of token descriptor -
         * an immutable object contains authorization ticket information.
         * @param {object} tokenInfo - authorization data.
         * @param {string} tokenInfo.Token - token data.
         * @constructor
         */
        function TokenDescriptor(tokenInfo) {

            if (!tokenInfo) throw new Error('tokenInfo is required parameter.');
            if (!tokenInfo.Token && !tokenInfo.token) throw new Error('tokenInfo.Token is required.');

            var token = tokenInfo.Token || tokenInfo.token,
                encodedToken = encodeURIComponent(token);

            this.token = function getToken() {
                return token;
            };
            /**
             * Converts token string to URL-safe format using {encodeURIComponent} function
             * @returns {string} URL-safe representation of token string
             */
            this.encodedToken = function getEncodedToken() {
                return encodedToken;
            };
        }



        return TokenDescriptor;
    });

angular
    .module('sp.account.internal')
    .factory('sp.account.internal.userSocialInfoProvider', ['sp.network.api', function(api) {

        'use strict';

        /**
         * returns a promise with user social info.
         * @param {!object} userPhotoSettings - user avatar's settings.
         * @param {!number} userPhotoSettings.width - user photo width.
         * @param {!number} userPhotoSettings.height - user photo height.
         * @returns {promise} promise object when fulfilled contains user social info data.
         */
        function getUserSocialInfo(userPhotoSettings) {
            if (!userPhotoSettings) throw new Error('UserPhotoSettings is required parameter.');

            var width = parseInt(userPhotoSettings.width, 10),
                height = parseInt(userPhotoSettings.height, 10);

            if (!width || isNaN(width)) throw new Error('UserPhotoSettings.width is required and must be an integer.');
            if (!height || isNaN(height)) throw new Error('UserPhotoSettings.height is required and must be an integer.');

            return api.server.get('/social/getusersocialinfo', { params: {
                photoWidth: width,
                photoHeight: height,
                photoMode: 1
            }});
        }


        return {
            load: getUserSocialInfo
        };
    }]);

angular.module('sp.network', ['sp.common', 'sp.configuration']);

angular
    .module('sp.network')
    .provider('sp.network.api', ['sp.common.invariants', 'sp.utils.url', function apiProvider(invariants, urlUtils) {

        'use strict';

        var serverUrl = invariants.server.servicesUrl,
            siteUrl = invariants.baseUrl,
            docServerUrl = invariants.server.docServerUrl;

        var serviceGetter = ['$q', 'sp.common.httpService', 'sp.configuration.configuration',
            function api($q, httpService, configuration) {

                /**
                 * Executes a request via {httpService} and returns a promise contained server response.
                 * @param {string} method - http method (GET/POST)
                 * @param {string} url - url to request.
                 * @param {object} conf - request configuration. see {httpService} for description.
                 * @returns {promise} - a promise object;
                 */
                function request(method, url, conf) {
                    return httpService[method](url, conf);
                }

                /**
                 * Creates new {Api} instance.
                 * @param {object|promise} hostOrPromise - string host value or promise when resolved contains host value.
                 * @constructor
                 */
                function Api(hostOrPromise) {

                    this.host = function hostGetter() {
                        return $q.when(hostOrPromise);
                    };
                }

                /**
                 * Executes a POST request to server.
                 * @param {string} partialUrl - url related to {host}
                 * @param {object} conf - request configuration. see {httpService} for description.
                 * @returns {promise} - a promise object.
                 */
                Api.prototype.post = function post(partialUrl, conf) {

                    return this.host().then(function hostNameResolvedHandler(hostName) {
                        var url = urlUtils.combine(hostName, partialUrl);

                        return request('post', url, conf);
                    });
                };

                /**
                 * Executes a GET request to server.
                 * @param {string} partialUrl - url related to {host}
                 * @param {object} conf - request configuration. see {httpService} for description.
                 * @returns {promise} - a promise object.
                 */
                Api.prototype.get = function get(partialUrl, conf) {

                    return this.host().then(function hostNameResolvedHandler(hostName) {
                        var url = urlUtils.combine(hostName, partialUrl);

                        return request('get', url, conf);
                    });
                };


                /**
                 * Executes a DELETE request to server.
                 * @param {string} partialUrl - url related to {host}
                 * @param {object} conf - request configuration. see {httpService} for description.
                 * @returns {promise} - a promise object.
                 */
                Api.prototype.delete = function httpDelete(partialUrl, conf) {

                    return this.host().then(function hostNameResolvedHandler(hostName) {
                        var url = urlUtils.combine(hostName, partialUrl);

                        return request('delete', url, conf);
                    });
                };

                /**
                 * Executes a PUT request to server.
                 * @param {string} partialUrl - url related to {host}
                 * @param {object} conf - request configuration. see {httpService} for description.
                 * @returns {promise} - a promise object.
                 */
                Api.prototype.put = function httpPut(partialUrl, conf) {

                    return this.host().then(function hostNameResolvedHandler(hostName) {
                        var url = urlUtils.combine(hostName, partialUrl);

                        return request('put', url, conf);
                    });
                };

                Api.prototype.jsonp = function httpJsonp(partialUrl, conf) {
                    return this.host().then(function hostNameResolvedHandler(hostName) {
                        var url = urlUtils.combine(hostName, partialUrl);

                        return request('jsonp', url, conf);
                    });
                };


                return {
                    site: (new Api(siteUrl)),
                    server: (new Api(serverUrl)),
                    docServer: (new Api(docServerUrl)),
                    profile: function (profileName) {

                        var defer = $q.defer();

                        configuration
                            .load()
                            .then(function configLoadedHandler(configData) {
                                var profile = configData.settings.get('services')[profileName];

                                if (!profile.cdnProfile) throw new Error('No service configuration found for ' + profileName);
                                var cdnProfile = configData.settings.get('cdnProfiles')[profile.cdnProfile];
                                if (!cdnProfile) throw new Error('No CDN profile found for ' + profileName);

                                var path = siteUrl;
                                if (path.indexOf('://') > 0) {
                                    path = path.substr(path.indexOf('/', 8));
                                }
                                if (path[0] === '/') {
                                    path = path.substr(1);
                                }
                                var host = urlUtils.combine(cdnProfile.baseUrl, path, profileName);

                                defer.resolve(host);
                            }, function configFailedHandler() {
                                defer.reject(new Error('Configuration load error. Cannot retrieve profile ' + profileName));
                            });


                        return new Api(defer.promise);
                    }
                };
            }];

        return {

            /**
             * Returns complete url to the server service
             * @param {?string} serviceUrl - url to the service.
             * @example
             *  // returns http://<server_url>/a/b
             *  apiProvider.getServerUrl('/a/b');
             * @returns {string} - server service url.
             */
            getServerUrl: function (serviceUrl) {
                serviceUrl = serviceUrl || '';

                return urlUtils.combine(serverUrl, serviceUrl);
            },

            $get: serviceGetter
        };

    }]);



angular
    .module('sp.configuration', ['sp.common', 'sp.configuration.internal']);


/*
 Contains class for storing templates.
 Do not use it directly, use configuration service instead. It will return this class as a field of itself.
 */

angular
    .module('sp.configuration')
    .factory('sp.configuration.templates', function templatesFactory() {

        'use strict';

        /**
         * Initializes a new {Templates} instance - immutable class provides access to templates.
         * @param data - raw templates received from server.
         * @constructor
         * @readonly
         */
        function Templates(data) {
            if (!data) throw new Error('data is required.');
            Object.freeze(data);

            /**
             * Retrieves template by its identifier.
             * @param id - template identifier
             * @returns {?string} - template text.
             */
            this.get = function (id) {
                if (!id) throw new Error('Id is required.');

                var template = data[id];
                if (!template) return null;

                // it seems template is returned in a wrapper.
                // todo - do it once
                /*jshint -W054 */
                var fn = new Function('__w', 'return ' + template);
                template = fn(angular.identity);

                // at the moment we calculate template html each time it's been requested.
                // this prevents data object from being corrupted outside of the class.
                // So we do not need to use angular.copy or Object.freeze
                // BUT when this behaviour will be fixed, Freeze or copying protection must be used.
                return template;

            };
        }

        return Templates;
    });

/*
 Contains class for storing configuration settings.
 Do not use it directly, use configuration service instead. It will return this class as a field of itself.
 */
angular
    .module('sp.configuration')
    .factory('sp.configuration.settings', function SettingsFactory() {

        'use strict';

        /**
         * Initializes a new instance - immutable object provides methods to obtain configuration settings.
         * @param {object} data - configuration data received from server.
         * @constructor
         * @readonly
         */
        function Settings(data) {
            if (!data) throw new Error('Data is required parameter.');

            Object.freeze(data);

            /**
             * Tries to extract configuration parameter by the specified path.
             * if no such path exists returns undefined.
             * @param {string} path - configuration path, i.e. ui.FeedSettings.Categories
             * @returns {?object} - configuration value.
             */
            this.get = function settingsGetter(path) {
                if (!path) throw new Error('Path is required parameter.');

//                var paths = path.split('.');
//                var config = data;
//                for (var i = 0, len = paths.length; i < len; ++i) {
//                    var name = paths[i];
//                    if (config && name in config) config = config[name];
//                    else return null;
//                }

                var config = _.deep(data, path);
                if (!angular.isDefined(config)) return (void 0);

                return Object.isFrozen(config) ? config : Object.freeze(config);
            };
        }

       /**
         * Returns service configuration by the specified {serviceName} parameter.
         * @param {string} serviceName - name of the service.
         * @returns {?object} - configuration value.
         */
        Settings.prototype.getServiceConf = function (serviceName) {
            if (!serviceName) throw new Error('ServiceName is required parameter.');

            var serviceConf = this.get('services')[serviceName];
            if (!serviceConf) return null;

            return angular.copy(serviceConf);
        };

        /**
         * Returns a CDN profile by the specified {cdnProfileName} parameter.
         * returns undefined if cannot find such configuration.
         * @param {string} cdnProfileName - name of the CDN profile.
         * @returns {?object} - configuration value or undefined if no such CDN profile exists.
         */
        Settings.prototype.getCdnProfile = function (cdnProfileName) {
            if (!cdnProfileName) throw new Error('ServiceName is required parameter.');

            var cdnProfile = this.get('cdnProfiles')[cdnProfileName];
            if (!cdnProfile) return null;

            return angular.copy(cdnProfile);
        };

        return Settings;
    });

/*
 Contains class for storing resources.
 Do not use it directly, use configuration service instead. It will return this class as a field of itself.
 */
angular
    .module('sp.configuration')
    .factory('sp.configuration.resources', function resourcesFactory() {

        'use strict';

        /**
         * Initializes a new {Resources} instance - immutable class provides access to resources.
         * @param data - raw resources received from server.
         * @readonly
         * @constructor
         */
        function Resources(data) {
            if (!data) throw new Error('data is required.');
            Object.freeze(data);

            /**
             * Retrieves resource by its identifier.
             * @param id - resource identifier
             * @returns {?string} - resource value.
             */
            this.get = function (id) {
                if (!id) throw new Error('Id is required.');
                var val = data[id];
                if (!val) return null;
                return val;
            };
        }

        return Resources;
    });

/* Contains configuration service */
angular
    .module('sp.configuration')
    .factory('sp.configuration.configuration', [
        '$q',
        'sp.configuration.internal.resourcesProvider',
        'sp.configuration.internal.settingsProvider',
        'sp.configuration.internal.resourcesRequestFactory',
        'sp.common.promiseCache',
        'sp.configuration.settings',
        'sp.configuration.resources',
        'sp.configuration.templates',
        'sp.common.events',
        function ($q, resourceProvider, settingsProvider, resourceRequestFactory, promiseCache,
                  Settings, Resources, Templates, commonEvents) {


            'use strict';

            // resources and templates can be cached for all time.
            var resourcesCache,
                templatesCache;

            /**
             * Initializes a new instance - immutable object, a container to config, resources and templates services.
             * @param settings - an instance of {Settings} class.
             * @param resources - an instance of {Resources} class.
             * @param templates - an instance of {Templates} class.
             * @constructor
             */
            function Configuration(settings, resources, templates) {
                if (!settings) throw new Error('Settings is a required parameter.');
                if (!resources) throw new Error('Resources is a required parameter.');
                if (!templates) throw new Error('Templates is a required parameter.');

                // we do not need to wrap these fields by functions
                // because it is impossible to instantiate config, resources and template classes
                // they can be corrupted by replacing though, but it is almost impossible to do by mistake.
                this.settings = settings;
                this.resources = resources;
                this.templates = templates;
            }

            /**
             * Loads new configuration information.
             * @returns {promise} - a promise, when fulfilled returns an instance of {Configuration} file.
             */
            function loadNew() {

                function loadSettings() {
                    return settingsProvider
                        .load()
                        .then(function spSettingsLoadedHandler(settingsData) {
                            return new Settings(settingsData);
                        });
                }

                function loadResourcesAndTemplates(settings) {

                    if (resourcesCache && templatesCache) {
                        return $q.when({ settings: settings, templates: templatesCache, resources: resourcesCache });
                    }

                    var request = resourceRequestFactory.create(settings);

                    return resourceProvider
                        .load(request)
                        .then(function resourcesAndTemplatesLoadedHandler(resData) {

                            resourcesCache = new Resources(resData.res);
                            templatesCache = new Templates(resData.templates);

                            return {
                                settings: settings,
                                templates: templatesCache,
                                resources: resourcesCache
                            };
                        });
                }

                function createConfiguration(conf) {
                    return new Configuration(conf.settings, conf.resources, conf.templates);
                }

                return loadSettings()
                    .then(loadResourcesAndTemplates)
                    .then(createConfiguration);
            }

            return {
                load: promiseCache('sp.configuration.configuration', loadNew, {
                    invalidationEvtName: commonEvents.ON_NEEDS_RELOAD
                })
            };
        }
    ]);

angular
    .module('sp.configuration')
    .provider('sp.configuration.templatesStore', [
        function templatesStore() {

            'use strict';

            function _confLoadedCallback(invariants, $http, $templateCache, urlUtils, $log) {
                return function (configuration, templateName, conf) {
                    var tName = conf.absName ?
                        templateName :
                        invariants.views.templatesPrefix + '.' + templateName;

                    var template = configuration.templates.get(tName);
                    if (template) return template;

                    // transform template name v7.<app>.<module>.<view>
                    // to path /module/view
                    var path = tName.replace(invariants.views.templatesPrefixRegex, '').split('.').join('/'),
                        url = urlUtils.combine(invariants.views.baseUrl, path + '.html');

                    // todo: use highly level service
                    return $http.get(url, { cache: $templateCache }).then(function success(response) {
                        $log.debug('View \'' + tName + '\' is loaded from local folder by path \'' + path + '\'');
                        return response.data;
                    });
                };

            }

            return {

                /**
                * Performs a lookup process to locate a template by it's unique name.
                * @param {string} templateName - name of the template.
                * @param {object} conf - template loading configuration.
                * @param {boolean} conf.absName - if set to true, {templateName} will be treated as absolute name.
                * @example
                *
                * // if configuration is set as follows
                * // invariants.views.baseUrl = 'v7.client.smartphone'
                *
                * // will try to load template v7.client.smartphone.catalog.details
                *
                * return store.getTemplate('catalog.details');
                *
                * // will try to load template v8.client.smartphone.account.details
                * return store.getTemplate('v8.client.smartphone.account.details', { absName: true });
                *
                * @returns {[object]} a function to be invoked via {$injector} service. When function is invoked
                * it returns a promise which, when fulfilled, contains template html text.
                */
                getTemplateService: function getTemplateService(templateName, conf) {

                    return ['sp.configuration.configuration', 'sp.common.invariants', '$http', '$templateCache', 'sp.utils.url', '$log',
                        function templateResolver(configurationService, invariants, $http, $templateCache, urlUtils, $log) {

                            // todo: merge this invocation with the one in getTemplate method.
                            return configurationService.load()
                                    .then(function (configuration) {
                                        conf = conf || {};
                                        var callback = _confLoadedCallback(invariants, $http, $templateCache, urlUtils, $log);
                                        return callback(configuration, templateName, conf);
                                    });
                        }];
                },
                $get: ['sp.configuration.configuration', 'sp.common.invariants', '$http', '$templateCache', 'sp.utils.url', '$log',
                        function (configurationService, invariants, $http, $templateCache, urlUtils, $log) {

                            return {
                                /**
                                * Gets templates by it's unique name.
                                * @param {string} templateName - name of the template.
                                * @param {object} conf - template loading configuration.
                                * @param {boolean} conf.absName - if set to true, {templateName} will be treated as absolute name.
                                * @returns returns a promise which, when fulfilled, contains template html text.
                                */
                                getTemplate: function getTemplate(templateName, conf) {
                                    return configurationService.load()
                                            .then(function (configuration) {
                                                conf = conf || {};
                                                var callback = _confLoadedCallback(invariants, $http, $templateCache, urlUtils, $log);
                                                return callback(configuration, templateName, conf);
                                            });
                                }
                            };
                        }]
            };
        }
    ]);


angular
    .module('sp.configuration.ui', ['sp.configuration']);


angular
    .module('sp.configuration.ui')
    .directive('uiSpRes', ['sp.configuration.configuration', 'sp.common.events',
        function resDirective(configuration, commonEvents) {

        'use strict';


        //
        // At the moment I think this directive should not support value changing
        // because usually we would like to watch if resource is changed (for example, if user changes
        // display language, all resource identifiers keep the same but they value should be re-evaluated)
        //

        function link(scope, element, attrs) {

            var resId = attrs.uiSpRes;

            function updateText() {
                configuration.load().then(function(config) {
                    var resVal = config.resources.get(resId);
                    element.html(resVal);
                });
            }


            resId = scope.$eval(resId) || resId;

            // common way to react on changes is to use scope.watch(configuration.load())
            // but in case if there are many scopes watches on something
            // application becomes unresponsive and slow because each time something happened
            // all watches have to be recalculated.
            // so we use our special global event for that
            scope.spSubscribeToEvent(commonEvents.ON_NEEDS_RELOAD, function onNeedsReload() {
                updateText();
            });

            updateText();

        }


        return {
            restrict: 'A',
//            scope: {
//              resName: '=uiSpRes'
//            },
            link: link
        };
    }]);

/* global $ */
angular
    .module('sp.configuration.ui')
    .factory('sp.configuration.ui.proximity', ['$q', '$compile', '$document', '$rootScope', /*'sp.configuration.templatesStore',*/
        function proximityBuffer($q, $compile, $document, $rootScope /*, tStore*/) {

            'use strict';

            //var loadBuffer = tStore.getTemplate('smartflow.feed')
            //                .then(function (t) {
            //                    var buf = angular.element(t);
            //                    var linkFn = $compile(buf);
            //                    linkFn(referenceContent);
            //                    buf.empty();
            //                    buf.css({
            //                        position: 'absolute',
            //                        top: '-10000px',
            //                        left: '-10000px',

            //                    })
            //                });

            function getSizeById(container, key) {
                var e = container.find('#' + key);
                return {
                    height: e.height(),
                    width: e.width()
                };
            }

            var reference = $rootScope.$new(true);

            var loadBuffer = $q.when('<div class="scroller" id="__pb_ref__scroller">' +
                                        '<article id="__pb_ref__entry" class="entry">' +
                                            '<div class="art-content"><p id="__pb_ref__line">ABC</p><div>' +
                                        '</article>' +
                                     '</div>')  // TODO: read from template
                                .then(function (t) {
                                    var buf = angular.element(t);
                                    buf.css({
                                        position: 'absolute',
                                        top: '-10000px',
                                        left: '-10000px',

                                    });
                                    var link = $compile(buf);
                                    return link(reference, function (cloned) {
                                        $document.find('body').append(cloned);
                                    });
                                });

            var basis = loadBuffer
                            .then(function (container) {
                                var line = getSizeById(container, '__pb_ref__line');
                                var visualMargin = line.height * 0; // TODO: move to constant.
                                var rawMaxHeight = $(window).outerHeight() - visualMargin;
                                var entryHeight = Math.max(rawMaxHeight - rawMaxHeight % line.height, visualMargin);

                                var res = {
                                    line: line,
                                    entry: {
                                        height: entryHeight,
                                        width: line.width
                                    }
                                };

                                window.__basis = res;
                                return res;
                            });
            var remote = loadBuffer
                            .then(function (buffer) {
                                return {
                                    scroller: buffer
                                };
                            });

            return {
                getBasis: function () {
                    return basis;
                },
                getRemote: function () {
                    return remote;
                }
            };
        }]);
/**
 * Created by alexanderk on 9/15/2014.
 */
angular
    .module('sp.configuration')
    .factory('sp.configuration.imageServersPool', ['sp.configuration.configuration', function (conf) {

        'use strict';

        var i = 0; // current increment


        function getNext() {

            return conf
                .load()
                .then(function (conf) {

                    var servers = conf.settings.get('imageServers.pages'),
                        server = servers[i++ % servers.length];
//                    console.log('getting next server. current count ' + (i-1) + ', server = ' + server);
                    return server;
                });
        }

        return {
            get: getNext
        };
    }]);

angular
    .module('sp.configuration.internal', ['sp.common']);

/**
 * Provider to load configuration settings information.
 * For internal sp.core module usage only.
 */
angular
    .module('sp.configuration.internal')
    .factory('sp.configuration.internal.settingsProvider', [
        'sp.utils.url', 'sp.common.invariants', 'sp.common.httpService',
        function spSettingsProvider(spUrlUtils, spClientConfiguration, spHttpService) {

            'use strict';

            /**
             * Processes response received from configuration service.
             * @param {object} response - angular response object.
             * @returns {object} configuration data.
             */
            function configLoadedSuccessHandler(response) {
                return response.data.config;
            }

            /**
             * Requests new configuration set from server.
             * @returns {promise} - when fulfilled returns configuration data.
             */
            function load() {
//                if (!token) throw new Error('token is required parameter.');

                var url = spUrlUtils.combine(spClientConfiguration.server.servicesUrl, 'config');
                return spHttpService.get(url).then(configLoadedSuccessHandler);
            }

            // api
            return {
                load: load
            };
        }
    ]);


/**
 * Provider to load resources and templates information.
 * For internal sp.core module usage only.
 */
angular
    .module('sp.configuration.internal')
    .factory('sp.configuration.internal.resourcesProvider', [
        'sp.utils.url', 'sp.common.invariants', 'sp.common.httpService',
        function spResProvider(spUrlUtils, spClientConfiguration, spHttpService) {

            'use strict';

            /**
             * Loads resources from server.
             * @param conf - arguments to be passed to server. all values are required.
             * @param {string} conf.url - URL of a CDN server where resources server is located.
             * @param {number} conf.id - an identifier.
             * @param {string} conf.locale - resources locale.
             * @param {number} conf.ts - resources timestamp.
             * @param {number} conf.version - resources version.
             * @returns {promise} - when fulfilled contains result of the execution.
             */
            function load(conf) {

                function resourcesLoadedSuccessHandler(response) {
                    return response.data;
                }

                if (!conf)            throw new Error('Params is required.');
                if (!conf.url)        throw new Error('Params.url is required.');
                if (!conf.id)         throw new Error('Params.id is required.');
                if (!conf.locale)     throw new Error('Params.locale is required.');
                if (!conf.ts)         throw new Error('Params.ts is required.');
                if (!conf.version)    throw new Error('Params.version is required.');

                var requestConf = {
                        params: {
                            id: conf.id,
                            locale: conf.locale,
                            ts: conf.ts,
                            version: conf.version,
                            skipProcessing: true
                        }
                    },
                    url = spUrlUtils.combine(spClientConfiguration.server.servicesUrl, 'res');
//                    url = spUrlUtils.combine(conf.url, spClientConfiguration.server.getRelativeServicesPath(), 'res');


                return spHttpService
                    .jsonp(url, requestConf)
                    .then(resourcesLoadedSuccessHandler);
            }

            return {
                load: load
            };
        }
    ]);


/*
    Service to create a valid request to resource service.
 */
angular
    .module('sp.configuration.internal')
    .factory('sp.configuration.internal.resourcesRequestFactory', function resourcesRequestFactory() {

        'use strict';

        /**
         * Creates a new instance of {ResourceRequest}.
         * @param params - resource request parameters.
         * @param {number} params.id        - identifier.
         * @param {string} params.locale    - locale.
         * @param {number} params.ts        - timestamp.
         * @param {string} params.url       - url to request.
         * @constructor
         */
        function ResourceRequest(params) {
            this.id = params.id;
            this.locale = params.locale;
            this.ts = params.ts;
            this.version = 2;
            this.url = params.url;
        }

        /**
         * Creates a new resource service request parameters.
         * @param {Settings} settings - an instance of settings service
         * @returns {ResourceRequest} - an object describes request to the resource server.
         */
        function create(settings) {
            var serviceConf = settings.getServiceConf('res'),
                cdnProfile = settings.getCdnProfile(serviceConf.cdnProfile),
                url = cdnProfile.baseUrl,
                resConfig = settings.get('res');

            return new ResourceRequest({
                id: resConfig.id,
                locale: resConfig.locale,
                ts: resConfig.ts,
                url: url
            });
        }


        return {
            create: create
        };
    });

angular.module('sp.catalog.internal', ['sp.network']);

angular
    .module('sp.catalog.internal')
    .factory('sp.catalog.internal.catalogProvider', ['sp.network.api',
        function catalogProvider(api) {

            'use strict';

            var catalogUrl = 'catalog';

            /**
             * Loads new catalog from server.
             * @returns {Promise} - promise object, when fulfilled contains new catalog data.
             */
            function load() {

                function catalogReceivedHandler(response) {
                    return response.data;
                }

                return api.server
                    .get(catalogUrl)
                    .then(catalogReceivedHandler);
            }

            return {
                load: load
            };

        }]);

angular
    .module('sp.catalog', ['sp.catalog.internal', 'ui.router', 'sp.configuration'])
    .config(['$stateProvider', 'sp.configuration.templatesStoreProvider',
        function catalogConfiguration($stateProvider, templatesStore) {

            'use strict';

            $stateProvider
                .state('catalog', {
                    url: '/catalog',
                    parent: 'shell.container',
                    views: {
                        '@': {
                            templateProvider: templatesStore.getTemplateService('Catalog.Catalog')
                        }
                    },
                    resolve: {
                        catalog: ['sp.catalog.catalog', function (catalog) {
                            return catalog.load();
                        }]
                    }
                })
                .state('catalog.countries', {
                    url: '/countries',
                    templateProvider: templatesStore.getTemplateService('Catalog.Countries'),
                    controller: 'sp.catalog.countries.controller as ctrl'
                })
                .state('catalog.country', {
                    url: '/countries/{country}',
                    templateProvider: templatesStore.getTemplateService('Catalog.Country'),
                    controller: 'sp.catalog.country.controller as ctrl'
                })
                .state('catalog.languages', {
                    url: '/languages',
                    templateProvider: templatesStore.getTemplateService('Catalog.Languages'),
                    controller: 'sp.catalog.languages.controller as ctrl'
                })
                .state('catalog.language', {
                    url: '/languages/{language}',
                    templateProvider: templatesStore.getTemplateService('Catalog.Language'),
                    controller: 'sp.catalog.language.controller as ctrl'
                });
        }]);



angular
    .module('sp.catalog')
    .factory('sp.catalog.catalog', ['sp.catalog.internal.catalogProvider',
        'sp.common.promiseCache',
        'sp.common.events',
        function catalog(catalogProvider, promiseCache, commonEvents) {

            'use strict';


            function CatalogBuilder(newspapers, categories) {
                this.newspapers = newspapers;
                this.categories = categories;

                this.catalog = {
                    categories: {},
                    newspapers: {},
                    newspapersCount: 0
                };
            }

            CatalogBuilder.prototype.locateCategory = function locateCategory(categoryName) {
                for (var i = 0, len = this.categories.length; i < len; i++) {
                    if (this.categories[i].id === categoryName) return this.categories[i];
                }

                throw new Error('Cannot find category ' + categoryName);
            };

            CatalogBuilder.prototype.addNewspaper = function addNewspaper(newspaper) {
                this.catalog.newspapers[newspaper.cid] = newspaper;
                this.catalog.newspapersCount++;
            };

            CatalogBuilder.prototype.buildCategoriesByCountry = function buildCategoriesByCountry() {
                var countriesCategory = this.locateCategory('Countries');
                var categoriesByCountry = this.catalog.categories.byCountry = [];
                for (var i = 0, len = countriesCategory.cc.length; i < len; i++) {
                    var newCategory = countriesCategory.cc[i];
                    newCategory.newspapers = [];

                    // resolve newspapers and add reference to them to the new category.
                    for (var j = 0, newspaperLength = newCategory.cn.length; j < newspaperLength; j++) {
                        var newspaperIdx = newCategory.cn[j],
                            newspaper = this.newspapers[newspaperIdx];

                        if (!this.catalog.newspapers[newspaper.cid]) {
                            this.addNewspaper(newspaper);
                        }
                        newCategory.newspapers.push(newspaper);
                    }

                    delete newCategory.cn; // it seems we do not need this array after creation
                    categoriesByCountry.push(newCategory);
                }

                return this;
            };

            CatalogBuilder.prototype.buildCategoriesByLanguage = function buildCategoriesByCountry() {
                var countriesCategory = this.locateCategory('Languages');
                var categoriesByLanguage = this.catalog.categories.byLanguage = [];

                for (var i = 0, len = countriesCategory.cc.length; i < len; i++) {
                    var newCategory = countriesCategory.cc[i];
                    newCategory.newspapers = [];

                    // resolve newspapers and add reference to them to the new category.
                    for (var j = 0, newspaperLength = newCategory.cn.length; j < newspaperLength; j++) {
                        var newspaperIdx = newCategory.cn[j],
                            newspaper = this.newspapers[newspaperIdx];

                        if (!this.catalog.newspapers[newspaper.cid]) {
                            this.addNewspaper(newspaper);
                        }
                        newCategory.newspapers.push(newspaper);
                    }

                    delete newCategory.cn; // it seems we do not need this array after creation
                    categoriesByLanguage.push(newCategory);
                }

                return this;
            };


            /**
             * Initializes new instance of {Catalog} instance.
             * @param data - server catalog data.
             * @constructor
             */
            function Catalog(data) {
                var builder = new CatalogBuilder(data.newspapers, data.categories);
                builder
                    .buildCategoriesByCountry()
                    .buildCategoriesByLanguage();

                this.categories = builder.catalog.categories;
                this.newspapers = builder.catalog.newspapers;
                this.newspapersCount = builder.catalog.newspapersCount;
            }

            /**
             * Loads new catalog data.
             * @returns {Promise} - promise object, when fulfilled contains {Catalog} instance.
             */
            function load() {
                function catalogLoadedHandler(data) {
                    return new Catalog(data);
                }

                return catalogProvider
                    .load()
                    .then(catalogLoadedHandler);
            }

            return {
                load: promiseCache('sp.catalog.catalog', load, {
                    invalidationEvtName: commonEvents.ON_NEEDS_RELOAD
                })
            };
        }]);

angular
    .module('sp.catalog')
    .factory('sp.catalog.catalogViewModel', ['sp.catalog.catalog', 'sp.common.promiseCache', 'sp.common.events',
        function catalogViewModel(catalog, promiseCache, commonEvents) {

            'use strict';


            /**
             * Initializes a new instance of {CatalogViewModel}.
             * @param {Catalog} catalog - instance of catalog class.
             * @constructor
             */
            function CatalogViewModel(catalog) {
                angular.extend(this, catalog);
                this.categories.byCountry.unshift({ name: 'All Publications' });
            }

            /**
             * Loads new catalog view model.
             * @returns {Promise} - when fulfilled contains {CatalogViewModel} instance.
             */
            function load() {

                function catalogLoadedHandler(catalog) {
                    return new CatalogViewModel(catalog);
                }

                return catalog
                    .load()
                    .then(catalogLoadedHandler);
            }


            return {
                load: promiseCache('sp.catalog.catalogViewModel', load, {
                    invalidationEvtName: commonEvents.ON_NEEDS_RELOAD
                })
            };

        }]);

angular
    .module('sp.catalog')
    .controller('sp.catalog.countries.controller', function viewByCountriesController(catalog) {

        'use strict';

        this.countries = catalog.categories.byCountry;
    });

angular
    .module('sp.catalog')
    .controller('sp.catalog.country.controller', function viewCountryController(catalog, $stateParams) {

        'use strict';

        var countryParam = $stateParams.country;
        if (countryParam === 'all') {
            // all newspapers requested
            this.newspapers = catalog.newspapers;
            this.newspapersCount = catalog.newspapersCount;
        } else {
            var countryId = parseInt(countryParam, 10);
            if (isNaN(countryId)) throw new Error('Country identifier should be a valid number.');

            this.newspapers = catalog.categories.byCountry[countryId].newspapers;
            this.newspapersCount = this.newspapers.length;
        }
    });


angular
    .module('sp.catalog')
    .controller('sp.catalog.languages.controller', function viewByLanguagesController(catalog) {

        'use strict';

        this.languages = catalog.categories.byLanguage;
    });

angular
    .module('sp.catalog')
    .controller('sp.catalog.language.controller', function viewLanguageController(catalog, $stateParams) {

        'use strict';

        var languageParam = $stateParams.language;
        if (languageParam === 'all') {
            // all newspapers requested
            this.newspapers = catalog.newspapers;
            this.newspapersCount = catalog.newspapersCount;
        } else {
            var languageId = parseInt(languageParam, 10);
            if (isNaN(languageId)) throw new Error('Language identifier should be a valid number.');

            this.newspapers = catalog.categories.byLanguage[languageId].newspapers;
            this.newspapersCount = this.newspapers.length;
        }
    });



angular
    .module('sp.settings.internal', ['sp.common', 'sp.configuration']);


angular
    .module('sp.settings.internal')
    .factory('sp.settings.internal.monitorsProvider', ['sp.network.api', 'sp.utils.url', function monitorsProvider(api, urlUtils) {

        'use strict';

        var url = 'spapi/monitors';


        /**
         * Loads new monitors data from server.
         * @returns {Promise} - when fulfilled contains monitors data.
         */
        function load() {

            function monitorsLoadedHandler(response) {
                return response.data;
            }

            return api.server
                .get(url)
                .then(monitorsLoadedHandler);
        }

        /**
         * Saves the specified monitor
         * @param {object} monitor - monitor data.
         * @param {number} monitor.id - monitor id.
         * @param {string} monitor.frequencyHours - new monitor notification frequency.
         */
        function save(monitor) {

            var saveUrl = urlUtils.combine(url, monitor.id.toString());

            return api.server.put(saveUrl, { data: monitor });
        }



        return {
            load: load,
            save: save
        };
    }]);

angular
    .module('sp.settings.internal')
    .factory('sp.settings.internal.userSettingsProvider', ['sp.network.api', 'sp.utils.url',
        function userSettingsProvider(api, urlUtils) {

        'use strict';

        var url = 'user/settings';


        /**
         * Loads new settings data from server.
         * @returns {Promise} - when fulfilled contains monitors data.
         */
        function load() {

            function settingsLoadedHandler(response) {
                return response.data;
            }

            return api.server
                .get(url)
                .then(settingsLoadedHandler);
        }

        /**
         * Saves the specified setting
         * @param {object} setting - setting data.
         * @param {number} setting.key - setting key.
         * @param {string} setting.value - setting value.
         */
        function save(setting) {

            var saveUrl = urlUtils.combine(url, 'merge'),
                data = {};
            data[setting.key] = setting.value;
            return api.server.post(saveUrl, { data: data });
        }

        return {
            load: load,
            save: save
        };
    }]);

angular
    .module('sp.settings.internal')
    .factory('sp.settings.internal.userNewspapersProvider', ['sp.network.api', 'sp.utils.url',
        function userNewspapersProvider(api, urlUtils) {

            'use strict';

            var url = 'spapi/mynewspapers';


            /**
             * Loads new user newspapers data from server.
             * @returns {Promise} - when fulfilled contains user newspapers data.
             */
            function load() {

                function userNewspapersLoaded(response) {
                    return response.data;
                }

                return api.server
                    .get(url)
                    .then(userNewspapersLoaded);
            }

            /**
             * Saves the specified user newspaper
             * @param {object} userNewspaper - user newspaper data.
             * @param {string} userNewspaper.cid - newspaper cid.
             * @param {boolean} userNewspaper.enableAlert - should newspaper alert be enabled/disabled?
             */
            function save(userNewspaper) {

                var saveUrl = urlUtils.combine(url, userNewspaper.cid),
                    data = { enableAlert: userNewspaper.alertEnabled };

                return api.server.put(saveUrl, { data: data });
            }


            return {
                load: load,
                save: save
            };
        }]);


angular
    .module('sp.settings.internal')
    .factory('sp.settings.internal.bookmarksProvider', ['sp.network.api', 'sp.utils.url', function bookmarksProvider(api) {

        'use strict';

        var url = 'spapi/bookmarks/stats';


        /**
         * Loads new bookmarks statistics data from server.
         * @returns {Promise} - when fulfilled contains statistics data.
         */
        function loadStats() {

            function bookmarksLoadedHandler(response) {
                return response.data;
            }

            return api.server
                .get(url)
                .then(bookmarksLoadedHandler);
        }



        return {
            loadStats: loadStats
        };
    }]);

angular
    .module('sp.settings.internal')
    .factory('sp.settings.internal.labelsProvider', ['sp.network.api',
        function userSettingsProvider(api) {

            'use strict';

            var url = 'spapi/labels';

            /**
             * Creates a new label with the specified name.
             * @param {string} labelName - label name.
             * @returns {Promise} - promise from api service.
             */
            function createNew(labelName) {
                var data = {
                        labelName: labelName
                    };

                // todo - new label id is passed through Location header.
                return api.server.put(url, { data: data });
            }

            /**
             * Saves the specified label
             * @param {string} labelId - label identifier.
             * @param {string} labelName - label name.
             * @returns {Promise} - promise from api service.
             */
            function save(labelId, labelName) {

                var data = {
                    labelId: labelId,
                    labelName: labelName
                };

                return api.server.post(url, { data: data });
            }

            return {
                createNew: createNew,
                save: save
            };
        }]);


angular
    .module('sp.settings', ['sp.common', 'sp.configuration', 'sp.catalog', 'sp.settings.internal', 'ui.router', 'sp.configuration.ui'])
    .config(['sp.configuration.templatesStoreProvider', '$stateProvider', function (templatesStore, $stateProvider) {

        'use strict';

        $stateProvider
            .state('settings', {
                url: '/settings',
                parent: 'shell.container',
                abstract: true,
                views: {
                    '@': {
                        templateProvider: templatesStore.getTemplateService('Settings.Settings')
                    }
                },
                resolve: {
                    notificationFrequencies: ['sp.settings.notificationFrequencyViewModelFactory', function (viewModel) {
                        return viewModel.createAll();
                    }]
                }
            })
            .state('settings.emailAlerts', {
                url: '/emailAlerts',
                templateProvider: templatesStore.getTemplateService('Settings.EmailAlerts'),
                controller: 'sp.settings.emailAlerts.controller as ctrl',
                resolve: {
                    monitors: ['sp.settings.monitors', function (monitors) {
                        return monitors.load();
                    }],
                    userSettings: ['sp.settings.userSettings', function (settings) {
                        return settings.load();
                    }],
                    issueAlerts: ['sp.settings.userNewspapers', function (userNewspapers) {
                        return userNewspapers.load();
                    }]
                }
            })
            .state('settings.emailAlert', {
                url: '/emailAlerts/{monitorId}',
                templateProvider: templatesStore.getTemplateService('Settings.EmailAlert'),
                controller: 'sp.settings.emailAlert.controller as ctrl',
                resolve: {
                    monitors: ['sp.settings.monitors', function (monitors) {
                        return monitors.load();
                    }],
                    hours: ['sp.settings.hoursViewModelFactory', function (viewModel) {
                        return viewModel.createAll();
                    }]
                }
            })
            .state('settings.manageBookmarks', {
                url: '/manageBookmarks',
                templateProvider: templatesStore.getTemplateService('Settings.ManageBookmarks'),
                controller: 'sp.settings.manageBookmarks.controller as ctrl',
                resolve: {
                    bookmarkStats: ['sp.settings.bookmarks', function (bookmarks) {
                        console.log('trying to resolve');
                        return bookmarks.loadStats();
                    }]
                }
            });

    }]);

angular
    .module('sp.settings')
    .factory('sp.settings.monitors', ['sp.settings.internal.monitorsProvider', 'sp.common.promiseCache', 'sp.common.events',
        function monitors(monitorsProvider, promiseCache, commonEvents) {

            'use strict';


            /**
             * Creates a new instance of {Monitor} class.
             * @param {object} data - monitor data.
             * @param {string|number} data.id - monitor identifier.
             * @constructor
             */
            function Monitor(data) {
                if (!data) throw new Error('Data is required.');
                if (!data.id) throw new Error('id property is required.');
                var id = parseInt(data.id, 10);
                if (isNaN(id)) throw new Error('id property should be an integer or system should be able to convert it to an integer.');

                if (!angular.isDefined(data.active)) throw new Error('active property is required.');
                if (!data.searchTerm) throw new Error('searchTerm property is required.');
                if (!angular.isDefined(data.frequencyHours)) throw new Error('frequencyHours property is required.');

                Object.defineProperty(this, 'id', { value : id,
                    writable : false,
                    enumerable : true,
                    configurable : false});
                Object.defineProperty(this, 'searchTerm', { value : data.searchTerm,
                    writable : false,
                    enumerable : true,
                    configurable : false});

                this.active = data.active;
                this.frequencyHours = data.frequencyHours;

                this.$save = function () {
                    var res = monitorsProvider.save(this);

                    return res;
                };
                Object.seal(this); // do not remove this. You don't need to add properties to model. If you need to
                                   // display something additional on view - make a copy or (better) create a view model.
            }

            /**
             * Loads new monitors data from provider.
             * @returns {Promise} - when fulfilled contains an array of {Monitors} class.
             */
            function load() {

                function monitorsLoadedHandler(monitors) {
                    if (!monitors) throw new Error('Monitors service has returned no data.');
                    if (!angular.isArray(monitors)) throw new Error('Monitors service has returned wrong data - an array is required.');
                    return monitors.map(function producer(monitorData) {
                        return new Monitor(monitorData);
                    });
                }

                return monitorsProvider.load().then(monitorsLoadedHandler);
            }


            return {
                load: promiseCache('sp.settings.monitors', load, {
                    invalidationEvtName: commonEvents.ON_NEEDS_RELOAD
                })
            };

        }]);

angular
    .module('sp.settings')
    .factory('sp.settings.subscriptions', function ($q) {

        'use strict';

        // TODO now it is a fake. use a real service.


        /**
         * Loads new subscription data.
         * @returns {Promise} - when fulfilled contains a fake object with property isFree set to true
         */
        function load() {
            return $q.when({ isFree: true });
        }

        return {
            load: load
        };
    });

angular
    .module('sp.settings')
    .factory('sp.settings.userSettings', ['sp.settings.internal.userSettingsProvider', 'sp.common.promiseCache', 'sp.common.events',
        function monitors(settingsProvider, promiseCache, commonEvents) {

            'use strict';



            /**
             * Creates a new instance of {Settings} class.
             * @param {object} data - monitor data.
             * @param {string|number} data.id - monitor identifier.
             * @constructor
             */
            function Settings(data) {
                if (!data) throw new Error('Data is required.');
                if (typeof data !== 'object' || angular.isArray(data)) throw new Error('Settings service has returned something that is not an object.');

                angular.extend(this, data);

                // todo - bulk save?

                this.$save = function (key) {
                    if (key === null || !angular.isDefined(key)) throw new Error('Key is required.');
                    if (!angular.isDefined(this.UserSettings[key])) throw new Error('Settings does not contain key - ' + key + '.');
                    var value = this.UserSettings[key];

                    settingsProvider.save({ key: key, value: value });
                };

                Object.seal(this); // do not remove this. You don't need to add properties to model. If you need to
                // display something additional on view - make a copy or (better) create a view model.
            }

            function load() {

                function settingsLoadedHandler(settings) {
                    if (!settings) throw new Error('Settings service has returned no data.');

                    return new Settings(settings);
                }

                return settingsProvider.load().then(settingsLoadedHandler);
            }


            return {
                load: promiseCache('sp.settings.settings', load, {
                    invalidationEvtName: commonEvents.ON_NEEDS_RELOAD
                })
            };

        }]);

angular
    .module('sp.settings')
    .factory('sp.settings.userNewspapers', ['sp.settings.internal.userNewspapersProvider',
        'sp.common.promiseCache', 'sp.common.events',
        function (provider, promiseCache, commonEvents) {

            'use strict';

            /**
             * Creates a new instance of {UserNewspaper} class.
             * @param {object} data - user newspaper data.
             * @param {string} data.cid - newspaper cid.
             * @constructor
             */
            function UserNewspaper(data) {

                if (!data) throw new Error('Data is required.');
                if (!data.cid) throw new Error('cid property is required.');
                if (!data.title) throw new Error('title property is required.');
                if (!angular.isDefined(data.alert)) throw new Error('alert property is required.');

                Object.defineProperty(this, 'cid', {
                    value : data.cid,
                    writable : false,
                    enumerable : true,
                    configurable : false
                });

                Object.defineProperty(this, 'title', {
                    value : data.title,
                    writable : false,
                    enumerable : true,
                    configurable : false
                });

                this.alertEnabled = data.alert;

                this.$save = function saveUserNewspaper() {

                    return provider.save(this);
                };

                Object.seal(this); // do not remove this. You don't need to add properties to model. If you need to
                // display something additional on view - make a copy or (better) create a view model.

            }

            /**
             * Loads new user newspapers data from provider.
             * @returns {Promise} - when fulfilled contains an array of {Monitors} class.
             */
            function load() {

                function newspapersLoadedHandler(userNewspapers) {

                    if (!userNewspapers) throw new Error('User Newspapers service has returned no data.');
                    if (!angular.isArray(userNewspapers)) throw new Error('User Newspapers service has returned wrong data - an array is required.');
                    return userNewspapers.map(function producer(userNewspaperData) {
                        return new UserNewspaper(userNewspaperData);
                    });
                }

                return provider.load().then(newspapersLoadedHandler);

            }

            return {
                load: promiseCache('sp.settings.userNewspapers', load, {
                    invalidationEvtName: commonEvents.ON_NEEDS_RELOAD
                })
            };
        }]);

angular
    .module('sp.settings')
    .factory('sp.settings.Labels', ['sp.settings.internal.labelsProvider', function (labelsProvider) {

        'use strict';

        function LabelItem(labelItemData) {
            angular.extend(this, labelItemData);
        }

        /**
         * Saves label changes to server.
         * @returns {Promise} - promise from api service.
         */
        LabelItem.prototype.$save = function saveLabel() {

            return labelsProvider.save(this.id, this.name);
        };

        /**
         * Initializes a new instance of {Labels} class
         * @constructor
         */
        function Labels(labelsData) {

            this.$create = function (labelName) {
                this.items.push({ name: labelName });

                return labelsProvider.createNew(labelName);
            };
            this.items = [];

            for (var i = 0, len = labelsData.length; i < len; i++) {
                var labelItem = new LabelItem(labelsData[i]);
                this.items.push(labelItem);
            }

        }

        return Labels;
    }]);

angular
    .module('sp.settings')
    .factory('sp.settings.bookmarks', ['sp.settings.internal.bookmarksProvider',
        'sp.common.promiseCache', 'sp.common.events',
        'sp.settings.Labels',
        'sp.configuration.configuration', '$q',
        function bookmarks(bookmarksProvider, promiseCache, commonEvents, Labels, configuration, $q) {

            'use strict';

            var statsProperties =
                { allCount: {}, oppositCount: {}, otherCount: {}, supportCount: {},
                    sharing: { props: ['id', 'count'], noCopy: true },
                    labels: { props: ['id', 'count', 'customId', 'name', 'isPublic'], noCopy: true } },
                SHARING_SETTINGS_NAME = 'ui.FavoritesMenu.Bookmarks';

            /**
             * Creates a new instance of {BookmarksStatistics} class.
             * @param {object} config - an instance of configuration service.
             * @param {object} data - bookmark statistics data.
             * @constructor
             */
            function BookmarksStatistics(config, data) {
                if (!data) throw new Error('Data is required.');

                var that = this,
                    sharingSettings = config.settings.get(SHARING_SETTINGS_NAME);


                angular.forEach(statsProperties, function (val, name) {

                    if (angular.isUndefined(data[name])) {
                        throw new Error(name + ' is required.');
                    }
                    if (val.props) {
                        if (!angular.isArray(data[name])) throw new Error(name + ' property should be an array.');

                        for (var i = 0, len = data[name].length; i < len; i++) {
                            var current = data[name][i];
                            for (var j = 0, jLen = val.props.length; j < jLen; j++) {
                                var prop = val.props[j];
                                if (angular.isUndefined(current[prop])) throw new Error(name + '.' + prop + ' is required.');
                            }
                        }
                    }
                    if (!(!!val.noCopy)) {
                        that[name] = data[name];
                    }
                });


                // proceed through labels
                this.labels = new Labels(data.labels);

                // proceed through sharing
                this.sharing = [];
                for (var i = 0, len = data.sharing.length; i < len; i++) {

                    var id = data.sharing[i].id,
                        count = data.sharing[i].count,
                        sharingSetting = _.find(sharingSettings, { id: id });

                    if (angular.isUndefined(sharingSetting)) throw new Error('Sharing title for ' + id + ' not found.');

                    this.sharing.push({
                        id: id,
                        count: count,
                        title: sharingSetting.title
                    });
                }

                Object.freeze(this.sharing);
                Object.freeze(this); // do not remove this. You don't need to add properties to model. If you need to
                // display something additional on view - make a copy or (better) create a view model.
            }

            /**
             * Loads new monitors data from provider.
             * @returns {Promise} - when fulfilled contains an instance of {BookmarksStatistics}
             */
            function loadStats() {

                function statsLoadedHandler(promises) {

                    var statsData = promises[0],
                        config = promises[1];

                    if (!statsData) throw new Error('Bookmarks service has returned no data.');
                    if (typeof statsData !== 'object' || angular.isArray(statsData)) throw new Error('Bookmarks service has returned something that is not an object.');

                    return new BookmarksStatistics(config, statsData);
                }

                return $q.all([bookmarksProvider.loadStats(), configuration.load()]).then(statsLoadedHandler);
            }


            return {
                loadStats: promiseCache('sp.settings.bookmarks', loadStats, {
                    invalidationEvtName: commonEvents.ON_NEEDS_RELOAD
                })
            };

        }]);


angular
    .module('sp.settings')
    .factory('sp.settings.notificationFrequencyViewModelFactory', ['sp.settings.subscriptions', 'sp.configuration.configuration',
        '$q',
        function (subscriptions, configuration, $q) {

            'use strict';

            /**
             * Initializes a new {NotificationFrequencyViewModel} instance.
             * @param {object} data - notification frequency data.
             * @param {string} data.resourceName - notification frequency display name resource.
             * @param {boolean} data.allowsTimeAdjustment - can user adjust time for this notification frequency?.
             * @constructor
             */
            function NotificationFrequencyViewModel(data) {
//            this.frequency = data.frequency;
                this.resourceName = data.resourceName;
                this.allowsTimeAdjustment = data.allowsTimeAdjustment;
                Object.freeze(this);
            }

            var notificationFrequencies = [
                {
                    frequency: 1024,
                    viewModel: new NotificationFrequencyViewModel({
                        resourceName: 'EmailAlerts.Page.Frequency.Off',
                        allowsTimeAdjustment: false
                    }),
                    paidOnly: false
                },
                {
                    frequency: 24,
                    viewModel: new NotificationFrequencyViewModel({
                        resourceName: 'SearchMonitorPanel.HoursOnesDay',
                        allowsTimeAdjustment: true
                    }),
                    paidOnly: false
                },
                {
                    frequency: 48,
                    viewModel: new NotificationFrequencyViewModel({
                        resourceName: 'SearchMonitorPanel.HoursEveryOtherDay',
                        allowsTimeAdjustment: true
                    }),
                    paidOnly: false
                },
                {
                    frequency: 0,
                    viewModel: new NotificationFrequencyViewModel({
                        resourceName: 'SearchMonitorPanel.HoursAsItHappend',
                        allowsTimeAdjustment: false
                    }),
                    paidOnly: true
                }
            ];

            /**
             * Creates a set of notification frequencies view models.
             * @returns {Promise} - when fulfilled contains an immutable object of view models.
             */
            function createAll() {

                function subscriptionsLoadedHandler(promisesArr) {

                    var subscription = promisesArr[0],
                        configuration = promisesArr[1],
                        notifications = {};

                    for (var i = 0, len = notificationFrequencies.length; i < len; i++) {
                        var notificationFrequency = notificationFrequencies[i];

                        if (!notificationFrequency.paidOnly || !subscription.isFree) {
                            notifications[notificationFrequency.frequency] = {
                                allowsTimeAdjustment: notificationFrequency.viewModel.allowsTimeAdjustment,
                                name: configuration.resources.get(notificationFrequency.viewModel.resourceName)
                            };
                        }
                    }
                    return Object.freeze(notifications);
                }


                return $q
                    .all([subscriptions.load(), configuration.load()])
                    .then(subscriptionsLoadedHandler);

            }

            return {
                createAll: createAll
            };
        }]);

angular
    .module('sp.settings')
    .factory('sp.settings.hoursViewModelFactory', ['sp.configuration.configuration', function (configuration) {

        'use strict';

        var TIMEFORMAT_RESOURCE_NAME = 'SearchMonitorPanel.ShowDeliveryTime';

        /**
         * Creates a new {HourViewModel} instance
         * @param {object} data - hours data
         * @param {int} data.value - int representation of an hour (from 1 to 23)
         * @param {string} timeFormat - 12/24 time format.
         * @constructor
         */
        function HourViewModel(data, timeFormat) {
            var value = data.value,
                name;

            if (parseInt(timeFormat, 10) === 12) {
                var suffix = value > 11 ? 'PM' : 'AM',
                    displayedHour = value === 0 ? 12 : (value > 12 ? value - 12 : value);

                name = displayedHour + ':00 ' + suffix;
            } else {
                name = value + ':00';
            }

            this.name = name;
            Object.freeze(this);
        }

        /**
         * Creates a set of hours view models.
         * @returns {Promise} - when fulfilled contains an immutable object of view models.
         */
        function createAll() {

            function configurationLoadedHandler(cfg) {
                var timeFormat = cfg.resources.get(TIMEFORMAT_RESOURCE_NAME),
                    items = {};

                for (var i = 0; i < 24; i++) {
                    items[i] = new HourViewModel({value: i}, timeFormat);
                }

                return Object.freeze(items);
            }

            return configuration
                .load()
                .then(configurationLoadedHandler);
        }

        return {
            createAll: createAll
        };
    }]);

angular
    .module('sp.settings')
    .controller('sp.settings.emailAlerts.controller', function (monitors, notificationFrequencies, userSettings, issueAlerts) {

        'use strict';

        this.myTopics = {
            monitors: monitors,
            notificationFrequencies: notificationFrequencies
        };

        this.issueAlerts = issueAlerts;

        this.settings = userSettings;
        this.settingUpdated = function(setting) {
            userSettings.$save(setting);
        };
    });

angular
    .module('sp.settings')
    .controller('sp.settings.emailAlert.controller', function ($stateParams, monitors, notificationFrequencies) {

        'use strict';

        var monitorId = parseInt($stateParams.monitorId, 10),
            monitor;

        for (var i = 0, len = monitors.length; i < len; i++) {
            if (monitors[i].id === monitorId) {
                monitor = monitors[i];
                break;
            }
        }

        this.monitor = monitor;
        this.notificationFrequencies = notificationFrequencies;
        this.save = function () {
            this.monitor.$save();
        };
    });

angular
    .module('sp.settings')
    .controller('sp.settings.manageBookmarks.controller', function (bookmarkStats) {

        'use strict';

        this.bookmarkStats = bookmarkStats;
    });

angular
    .module('sp.sidebar', ['sp.common', 'sp.configuration', 'ui.router'])
    .config(['$stateProvider', 'sp.common.areasCatalogProvider', 'sp.configuration.templatesStoreProvider',
        function ($stateProvider, areasCatalog, tStore) {

        'use strict';

        areasCatalog.registerShellArea({
            'sidebar-menu': {
                templateProvider: tStore.getTemplateService('sidebar.menu')
            }
        });
    }]);

angular.module('sp.content.internal', ['sp.network']);
angular
    .module('sp.content.internal')
    // TODO: convert to angular provider to allow enable/disable on config stage
    .factory('sp.content.internal.articlesCache', ['$cacheFactory',
        function articlesCacheProvider($cacheFactory) {

            'use strict';
            
            /**
             * Cache stub scaffolds cache interface.
             * Used in case caching is disabled.
             * @constructor
            */
            function CacheStub(){

            }
            CacheStub.prototype.get = function() { return undefined; };
            CacheStub.prototype.put = function(key, value) { return value; };
            CacheStub.prototype.info = function() { return {id:'article__cache__stub', size: 0}; };
            CacheStub.prototype.remove = function() { return undefined; };
            CacheStub.prototype.removeAll = function() { return undefined; };
            CacheStub.prototype.destroy = function() { return undefined; };

            
            var ARTICLES_CAHCE_KEY = 'articles__cache',
                ARTICLE_KEY_DELIMETER = '|';
            var _cacheEnabled = false,
                _cache = _cacheEnabled ? $cacheFactory(ARTICLES_CAHCE_KEY) : new CacheStub();

            /**
             * Builds keys for article depends on parameters it was loaded with.
             * Each key complies the following scheme: Id|[config.isHyphenated|][article.Language]
             * @params {object} article - article object.
             * @params {object} config - config object.
             * @params {boolean} config.isHyphenated - indicates wether atricle was requested in hyphenated fromat, or not.
             * @returns {array} - array of keys.
            */
            function buildCacheKeys(article, config) {
                // TODO: less stricted version should return empty key array.
                if (!article) throw new Error('article parameter is required.');
                if (!config) throw new Error('config parameter is required.');
                
                var keysRaw = [[article.id]];
                
                // TODO: here, if article.id != article.articleId article can be stored with both article.id and article.articleId as a key part.
                //       However, at least article.StartBlockIdx should be set to 0 for article object with article.articleId key part.
                //       Some additional properties might also be changed for that article object.
/*
                var copy = (article.id === article.articleId) ? angular.copy(keysRaw) : [];
                
                keysRaw.forEach(function(keyParts){
                    keyParts.push(article.articleId);
                    // TODO: check if keys with part "Id|ArticleId..." are ever reached.
                });
                keysRaw.push.apply(keysRaw, copy);
*/
                if (config.isHyphenated !== undefined) {
                    keysRaw.forEach(function(keyParts) {
                        keyParts.push(config.isHyphenated);
                    });
                }

                var copy = (article.Language === article.OriginalLanguage) ? angular.copy(keysRaw) : [];
                keysRaw.forEach(function(keyParts) {
                    keyParts.push(article.Language);
                });
                keysRaw.push.apply(keysRaw, copy);

                return keysRaw.map(function(keyParts){
                    return keyParts.join(ARTICLE_KEY_DELIMETER);
                });
            }

            /**
             * Builds key based on article id and config
             * @params {number} id - article id.
             * @params {object} config - config object.
             * @params {boolean} config.isHyphenated - indicates wether atricle was requested in hyphenated fromat, or not.
             * @params {string} config.language - language the article being requested with.
             * @returns {string} - key.
            */
            function getCacheKey(id, config) {
                if (!id) throw new Error('Id can`t be null.');
                if (!config) throw new Error('Config can`t be null.');

                var keyParts = [id];
                if (config.isHyphenated !== undefined) keyParts.push(config.isHyphenated);
                if (config.language) keyParts.push(config.language);

                return keyParts.join(ARTICLE_KEY_DELIMETER);
            }
            
            function put(article, config) {
                // TODO: check policy, cache might not throw an exception, it might return undefined
                if (!article) throw new Error('article parameter is required.');
                if (!config) throw new Error('config parameter is required.');

                // TODO: implement policy: in online mode only full article should be cached, in offline - previewes might me stored as well.
                if (article.ArticleType !== 0) return article;
                var keys = buildCacheKeys(article, config);

                keys.forEach(function (key){
                    _cache.put(key, article);
                });
                return article;
            }
            
            function get(id, config) {
                // TODO: check policy, cache might not throw an exception, it might return undefined
                if (!id) throw new Error('id parameter is required.');
                if (!config) throw new Error('config parameter is required.');

                var key = getCacheKey(id, config);
                return _cache.get(key);
            }

            function remove(article, config) {
                // TODO: check policy, cache might not throw an exception, it might return undefined
                if (!article) throw new Error('article parameter is required.');
                if (!config) throw new Error('config parameter is required.');
                
                var keys  = buildCacheKeys(article, config);
                keys.forEach(function (key){
                    _cache.remove(key);
                });
            }
            
            return {
                put: put,
                get: get,
                info: function() { return _cache.info(); },
                remove: remove,
                removeAll: function() { return _cache.removeAll(); },
                destroy: function() { return _cache.destroy(); },
            };
        }]
    );
angular.module('sp.content', ['sp.network', 'sp.common','sp.content.internal', 'sp.smartflow.providers']);
// TODO: "pages" should be loaded and cached by separate provider
(function(angular) {

    'use strict';

    var PROVIDER_NAME = 'sp.content.articlesProvider';

    angular
        .module('sp.content')
        .provider(PROVIDER_NAME, ['sp.content.contentType', 'sp.smartflow.providers.contentProviderRepositoryProvider',
            function articlesProviderConfig(contentType, smartflowContentProviderRepository) {

                smartflowContentProviderRepository.registerProvider(PROVIDER_NAME, [contentType.articlePreview, contentType.regularArticle]);

                return {
                    $get: ['$q', 'sp.network.api', 'sp.common.dataTransformation', 'sp.content.internal.articlesCache',
                        function articlesProvider($q, api, dto, articlesCache) {

                            // todo: implement debug logging
                            //var __debug__enable__ = false;

                            var _getItemsUrl = 'articles/GetItems';

                            var defaultConfig = {
                                pages: null,
                                comment: 'LatestByAll',
                                options: 1, // todo: read this property from config;
                                viewType: null,
                                bookmark: null,
                                language: null,
                                commentsProfileId: null,
                            };

                            /**
                             * Converts server response into conventional format
                            */
                            function articlesReceivedHandler(response) {
                                var contentMap = {};
                                (response.data.Articles || []).forEach(function (c) {
                                    // TODO: this data transformation should be removed if the server responds with correct json (camelCase, first low character)
                                    dto.camelCaseIt(c);
                                    contentMap[c.id] = c;
                                });
                                return contentMap;
                            }

                            /**
                             * Caches loaded content
                            */
                            function cacheContent(config, loadedContent) {
                                // TODO: here advanced cache policy might be applied, based on content and config.
                                angular.forEach(loadedContent, function(artContent) {
                                    articlesCache.put(artContent, config);
                                });
                                return loadedContent;
                            }

                            /**
                             * Gets several articles from cache and loads those which are not cached.
                             * @params {?object} config - object to configure request state.
                             * @params {?string} config.comment - // TODO: check the purpose of the parameter
                             * @params {?number} config.options - 1: include extended info for articles' blocks.
                             * @params {?string} config.viewType - viewType name.
                             * @params {?string} config.language - articles' language.
                             * @params {?string} config.bookmark - // TODO: check the purpose of the parameter
                             * @params {?array} ids - array of articles ids to request.
                             * @params {?array} pages - articles' pages to request.
                             * @returns {promise} - promise fulfilled when request is completed.
                            */

                            function getOrLoad(config, ids, pages) {
                                var requestConfig = defaultConfig;
                                if (typeof config === 'object') {
                                    angular.forEach(config, function(value, key) {
                                        requestConfig[key] = value;
                                    });
                                }
                                ids = ids || [];
                                pages = pages || [];

                                if (ids.length === 0 && pages.length === 0) return $q.when({ articles: [], pages: [] }); // todo: or throw an exception here.

                                var requestParams = {
                                    comment: requestConfig.comment,
                                    options: requestConfig.options,
                                    viewType: requestConfig.viewType,
                                    language: requestConfig.language,
                                    bookmark: requestConfig.bookmark,
                                    CommentsProfileId: requestConfig.commentsProfileId,
                                    IsHyphenated: requestConfig.isHyphenated
                                };

                                var idsToLoad = [],
                                    cachedArticles = {};

                                ids.forEach(function(id) {
                                    var cachedValue = articlesCache.get(id, config);
                                    if (cachedValue === undefined) {
                                        // article is not cached yet
                                        idsToLoad.push(id);
                                    } else {
                                        cachedArticles[cachedValue.Id] = cachedValue;
                                    }
                                });

                                var def;
                                if (idsToLoad.length > 0 || pages.length > 0) {
                                    // need to load some content
                                    requestParams.articles = idsToLoad.join(',');
                                    def = api.server
                                        .get(_getItemsUrl, { params: requestParams })
                                        .then(articlesReceivedHandler);
                                } else {
                                    def = $q.when({ articles: [], pages: [] });
                                }
                                return def.then(cacheContent.bind(undefined, config));
                            }

                            return {
                                /**
                                 * Loades content field for each of entry passed.
                                 * @params {?object} config - config object.
                                 * @params {?array} entries - collection of entries.
                                 * @returns promise fulfilled with loaded entry collection.
                                */
                                load: function(config, entries) {
                                    if (!entries) entries = [];

                                    return getOrLoad(config, entries.map(function(e) { return e.getKey(); }))
                                        .then(function(loadedContent) {
                                            entries.forEach(function(e) {
                                                // TODO: possible use entry.setContent method or smth.
                                                e.content = loadedContent[e.getKey()];
                                            });
                                            return entries;
                                        });
                                }
                            };
                        }]
                };
            }
        ]);

})(angular);
'use strict';

angular
    .module('sp.content')
    .constant('sp.content.contentType', {
        regularArticle: 0,
        articlePreview: 1,
        regularPage: 2,
        lastVisit: 3,
        searchBar: 4,
        myLastTitles: 5,
        replies: 6,
        initBlock: 7,
        //breakingnews: 8,
        //title: 9,
        leftBar: 10,
        monitors: 11,
        profile: 12,
        opinion: 13,
        homeBlock: 14
    });
angular
    .module('sp.statistics', ['sp.network', 'sp.common', 'pr.smartflow.common']);

/**
 * Attention, this provider only sends newsfeed history and sets received tokens to feed entries.
 * GetHistory reguest is sent by newsfeedProvider.
*/
angular
    .module('sp.statistics')
    .factory('sp.statistics.historyProvider', [
        '$q',
        'sp.network.api',
        'sp.common.eventBus',
        'sp.common.dataTransformation',
        function historyProvider($q, api, eventBus, dto) {

            'use strict';

            var addHistoryUrl = 'TopNewsFeed/AddHistory';

            var historyQueue = [];

            // TODO: set up on config stage
            var QUEUE_MAX_LEN = 5;

            /**
             * Sends one or several feed items into history
             * @params {?array|?object} metas - array or single metadata to add into history
            */
            function sendHistory(historyMetas) {
                if (historyMetas === null || historyMetas === undefined) throw new Error('metas parameter is required.');
                if (!angular.isArray(historyMetas)) historyMetas = [historyMetas];

                // TODO: this data transformation should be removed if the server accepts correct json (camelCase, first low character)
                dto.uglifyIt(historyMetas);

                return api.server
                    .post(addHistoryUrl, { data: historyMetas });
            }


            function addHistory(entries) {
                if (!angular.isArray(entries)) return [];

                var targetEntries = (entries || []).filter(function (entry) {
                    if (!entry || !entry.meta) return false;
                    return !entry.meta.leftToken && !entry.meta.rightToken;
                });

                if (targetEntries.length === 0) return $q.when([]);

                return sendHistory(targetEntries.map(function (e) {
                        return {
                            id: e.meta.id,
                            type: e.meta.type,
                            data: angular.copy(e.meta.data),
                        };
                    }))
                    .then(function (response) {
                        // TODO: due to the angular json parsing behavior https://github.com/angular/angular.js/issues/1448 
                        //       server response is not parsed as a json and passed as is. Trim quotes.
                        //       Temporary!!!
                        var token = response.data.match(/\w+/)[0] || response.data;
                        targetEntries.forEach(function (entry) {
                            entry.meta.leftToken = entry.meta.rightToken = token;
                        });
                        return targetEntries;
                    });
            }

            function enqueueHistory(queue, entries) {
                if (!angular.isArray(queue)) throw new Error('queue must be an Array');
                if (!angular.isArray(entries)) entries = [entries];
                queue.push.apply(queue, entries);
                return queue;
            }

            function handleQueue(queue, addImmediate) {
                return queue.length >= QUEUE_MAX_LEN || addImmediate ?
                    addHistory(queue)
                    .then(function ( /*modifiedEntries*/) {
                        queue.splice(0);
                        //console.info('history sent', modifiedEntries, 'queue flushed');
                        return queue;
                    }, function (err) {
                        console.warn('addHistory failed, current queue', queue, err);
                    }) :
                    $q.when(queue);
            }

            return {
                startListen: function (event) {

                    // todo: check if already subscribed.
                    //eventBus.subscribe(event, function(evt, args) {
                    //    return addHistory(args.entries);
                    //});
                    eventBus.subscribe(event, function (evt, args) {
                        enqueueHistory(historyQueue, args.entries);
                        handleQueue(historyQueue);
                    });
                },
                addImmediate: function (entries) {
                    enqueueHistory(historyQueue, entries);
                    handleQueue(historyQueue, true);
                },
                enqueueHistory: enqueueHistory
            };
        }
    ]);


angular.module('sp.smartflow.internal', ['sp.configuration']);

angular
    .module('sp.smartflow.internal')
    .factory('sp.smartflow.internal.utils', [
        function smartflowInternalUtilsFactory() {

            'use strict';

            return {
                /**
                 * Creates a new object with has the same properties as src object and values taken from ether ext object if it has one, or src.
                 * @params {Object} src Source object where property names are taken from.
                 * @params {Object} ext Extending object. Properties defined in both source end extending objects are taken from ext.
                 *
                 * @example
                 *
                 * ```js
                 * var combined = createAlike({a:1, b:2}, {b:3});
                 * combined // {a:1, b:3}
                 * ```
                 *
                 * @returns New combined object.
                */
                createAlike: function(src, ext) {
                    if (!angular.isObject(src)) src = {};
                    if (!angular.isObject(ext)) ext = {};
                    return Object.keys(src)
                        .reduce(function(alikeCopy, key) {
                            alikeCopy[key] = ext.hasOwnProperty(key) ? ext[key] : src[key];
                            return alikeCopy;
                        }, {});
                }
            };
        }
    ]);

// TODO: add copy method for all types
/**
 * Provides factory methods for objects which represent size and positions
*/
angular
    .module('sp.smartflow.internal')
    .factory('sp.smartflow.internal.dimensions', [
        function dimensionsFactory() {

            'use strict';

            var utilites = (function () {

                function parsePair(first, second, propList) {
                    if (angular.isArray(first)) return first;

                    var parsed;
                    if (angular.isObject(first) && angular.isArray(propList)) {
                        parsed = propList.map(function (propName) {
                            return first[propName];
                        });
                    } else {
                        parsed = [first, second];
                    }
                    return parsed;
                }

                return {
                    parsePair: parsePair,
                };
            })();

            // Shared property descriptors and definitions.
            var sharedPropertiesAgenda = (function (utils) {

                // TODO: add method which calculates relative complement and difference
                var definitions = {
                    equalityComparer: function (props) {
                        return {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            value: function singleDimensionEqual(another) {
                                var self = this;
                                return angular.isObject(another) && props.reduce(function (res, prop) {
                                    return res && self[prop] === another[prop];
                                }, true);
                            }
                        };
                    },
                    length: function (props) {
                        return {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            get: function () {
                                return Math.abs(this[props[1]] - this[props[0]]);
                            }
                        };
                    },
                    overlapping: function (props) {
                        return {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            value: function singleDimensionOverlap(first, second) {
                                var parsed = utils.parsePair(first, second, props);
                                var anotherFirstVal = parsed[0], anotherSecondVal = parsed[1];

                                if (!angular.isNumber(anotherFirstVal) || !angular.isNumber(anotherSecondVal)) return false;

                                var result;
                                if (this[props[1]] < this[props[0]]) { // inverted placement
                                    result = this[props[0]] >= anotherSecondVal && this[props[1]] <= anotherFirstVal;
                                } else {
                                    result = this[props[0]] <= anotherSecondVal && this[props[1]] >= anotherFirstVal;
                                }
                                return result;
                            }
                        };
                    },
                    commonSetter: function (props) {
                        return {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            value: function oneDimensionSetter(start, end) {
                                var parsed = utils.parsePair(start, end, props);
                                this[props[0]] = parsed[0];
                                this[props[1]] = parsed[1];
                                return this;
                            }
                        };
                    },
                    moving: function (props) {
                        return {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            value: function singleDimensionMove(distance) {
                                var self = this;
                                props.forEach(function (prop) {
                                    self[prop] += distance;
                                });
                                return this;
                            }
                        };
                    },
                    intersection: function (props, CTOR) {
                        return {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            value: function singleDimensionIntersection(another) {
                                if (!this.overlap(another)) return null;

                                var normalPlacement = this[props[1]] >= this[props[0]],
                                    сompareStart = normalPlacement ? Math.max : Math.min,
                                    compareEnd = normalPlacement ? Math.min : Math.max;
                                return new CTOR(
                                    сompareStart(this[props[0]], another[props[0]]),
                                    compareEnd(this[props[1]], another[props[1]])
                                );
                            }
                        };
                    },
                    difference: function (props, CTOR) {
                        return {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            value: function singleDimensionDifference(another) {

                                function gte(left, right) {
                                    return left > right;
                                }

                                function ls(left, right) {
                                    return left < right;
                                }

                                var normalPlacement = this[props[1]] >= this[props[0]],
                                    compare = normalPlacement ? ls : gte;

                                var difference = [];
                                if (compare(this[props[0]], another[props[0]])) {
                                    difference.push(new CTOR(this[props[0]], another[props[0]]));
                                }
                                if (compare(another[props[1]], this[props[1]])) {
                                    difference.push(new CTOR(another[props[1]], this[props[1]]));
                                }

                                return difference.length > 0 ? difference : null;
                            }
                        };

                    },
                    midpoint: function (props) {
                        return {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            get: function () {
                                return (this[props[0]] + this[props[1]]) / 2;
                            }
                        };
                    },
                    ownNumeric: function (prop, valueHolder) {
                        return {
                            //configurable: false
                            //writable: false,
                            enumerable: true,
                            get: function ownNumericGet() {
                                return valueHolder[prop];
                            },
                            set: function ownNumericSet(value) {
                                if (!angular.isNumber(value)) throw new Error('Cannot set non numeric value');
                                valueHolder[prop] = value;
                            }
                        };
                    }
                };

                var descriptors = {
                    isEqual: function (props) {
                        return {
                            isEqual: definitions.equalityComparer(props)
                        };
                    },
                    overlap: function (props) {
                        return {
                            overlap: definitions.overlapping(props)
                        };
                    },
                    setter: function (props) {
                        return {
                            set: definitions.commonSetter(props)
                        };
                    },
                    move: function (props) {
                        return {
                            move: definitions.moving(props)
                        };
                    },
                    intersection: function(props, constructor) {
                        return {
                            intersection: definitions.intersection(props, constructor)
                        };
                    },
                    difference: function (props, constructor) {
                        return {
                            difference: definitions.difference(props, constructor)
                        };
                    },
                    midpoint: function (props) {
                        return {
                            midpoint: definitions.midpoint(props)
                        };
                    },
                    ownNumericMany: function (props, valueHolder) {
                        return props.reduce(function (desc, prop) {
                            desc[prop] = definitions.ownNumeric(prop, valueHolder);
                            return desc;
                        }, {});
                    }
                };

                descriptors.common = function (props, constructor) {
                    return angular.extend({},
                        this.isEqual(props),
                        this.overlap(props),
                        this.setter(props),
                        this.move(props),
                        this.midpoint(props),
                        this.intersection(props, constructor),
                        this.difference(props, constructor)
                    );
                };

                return {
                    descriptors: descriptors,
                    definitions: definitions
                };
            })(utilites);

            /**
             * Creates object which represents size.
             * @constructor
             * @param {Array.<number>|Object.<number>|number} width Provides width value or composite data.
             * @param {number} height Provides height value.
            */
            var SizeCTOR = (function (props, agenda) {

                function Size( /*width, height*/) {
                    var values = {};
                    Object.defineProperties(this, agenda.descriptors.ownNumericMany(props, values));
                    Object.seal(this);
                    this.set.apply(this, arguments);
                }

                Size.prototype = Object.create(Object.prototype);

                Object.defineProperties(Size.prototype, angular.extend({},
                        agenda.descriptors.setter(props),
                        agenda.descriptors.isEqual(props))
                );

                // Custom properties
                Object.defineProperties(Size.prototype, {
                    isHigher: {
                        //configurable: false
                        //writable: false,
                        //enumerable:false,
                        value: function (another) {
                            return !!angular.isObject(another) && this.height > another.height;
                        }
                    },
                    isWider: {
                        //configurable: false
                        //writable: false,
                        //enumerable:false,
                        value: function (another) {
                            return !!angular.isObject(another) && this.width > another.width;
                        }
                    }
                });

                Object.freeze(Size.prototype);

                return Size;

            })(['width', 'height'], sharedPropertiesAgenda);

            var VPosition = (function (props, agenda) {

                /**
                 * Creates object which represent vertical position.
                 * @constructor
                 * @param {Array.<number>|Object.<number>|number} bottom Provides bottom value or composite data.
                 * @param {number} top Provides top value.
                */
                function VerticalPosition( /* left, right */) {
                    var values = {};
                    Object.defineProperties(this, agenda.descriptors.ownNumericMany(props, values));
                    Object.seal(this);
                    this.set.apply(this, arguments);
                }

                VerticalPosition.prototype = Object.create(Object.prototype);

                // Equality and overlapping compareres, common setter.
                Object.defineProperties(VerticalPosition.prototype, agenda.descriptors.common(props, VerticalPosition));

                // Custom properties
                Object.defineProperties(VerticalPosition.prototype, {
                    height: agenda.definitions.length(props),
                });

                Object.freeze(VerticalPosition.prototype);

                return VerticalPosition;
            })(['bottom', 'top'], sharedPropertiesAgenda);


            var HPosition = (function (props, agenda) {

                /**
                 * Creates object which represents horisontal position.
                 * @constructor
                 * @param {Array.<number>|Object.<number>|number} left Provides left value or composite data.
                 * @param {number} right Provides right value.
                */
                function HorisontalPosition( /* left, right */) {
                    var values = {};
                    Object.defineProperties(this, agenda.descriptors.ownNumericMany(props, values));
                    Object.seal(this);
                    this.set.apply(this, arguments);
                }

                HorisontalPosition.prototype = Object.create(Object.prototype);

                // Equality and overlapping compareres, common setter.
                Object.defineProperties(HorisontalPosition.prototype, agenda.descriptors.common(props, HorisontalPosition));

                // Custom properties
                Object.defineProperties(HorisontalPosition.prototype, {
                    width: agenda.definitions.length(props),
                });

                Object.freeze(HorisontalPosition.prototype);

                return HorisontalPosition;
            })(['left', 'right'], sharedPropertiesAgenda);


            /**
             * Creates object which represents position.
             * @constructor
             * @param {Array.<number>|Object.<number>|number} top Provides top value or composite data, that may contain all coordinates or top-bottom coordinates.
             * @param {Array.<number>|Object.<number>|number} bottom Provides bottom value or composite data, that may contain left-right coordinates.
             * @param {number} left Provides left value.
             * @param {number} right Provides right value.
            */
            var PositionCTOR = (function (props, agenda, utils) {

                function Position( /* top, bottom, left, right */) {
                    var values = {};
                    Object.defineProperties(this, agenda.descriptors.ownNumericMany(props, values));
                    Object.seal(this);
                    this.set.apply(this, arguments);
                }

                Position.prototype = Object.create(Object.prototype);

                Object.defineProperties(Position.prototype, angular.extend({},
                        {
                            set: {
                                //configurable: false
                                //writable: false,
                                //enumerable:false,
                                value: function positionSetter(top, bottom, left, right) {
                                    var composite = top,
                                        parsedPair,
                                        t,
                                        b,
                                        l,
                                        r;
                                    if (angular.isArray(composite)) {
                                        t = composite[0];
                                        b = composite[1];
                                        if (composite.length <= 2) {
                                            if (angular.isObject(bottom)) {
                                                parsedPair = utils.parsePair(bottom, null, props.slice(2));
                                                l = parsedPair[0];
                                                r = parsedPair[1];
                                            } else {
                                                l = bottom;
                                                r = left;
                                            }
                                        } else {
                                            l = composite[2];
                                            r = composite[3];
                                        }
                                    } else if (angular.isObject(composite)) {
                                        t = composite[props[0]];
                                        b = composite[props[1]];
                                        if (composite.hasOwnProperty(props[2]) || composite.hasOwnProperty(props[3])) {
                                            l = composite[props[2]];
                                            r = composite[props[3]];
                                        } else {
                                            if (angular.isObject(bottom)) {
                                                parsedPair = utils.parsePair(bottom, null, props.slice(2));
                                                l = parsedPair[0];
                                                r = parsedPair[1];
                                            } else {
                                                l = bottom;
                                                r = left;
                                            }
                                        }
                                    } else {
                                        t = top;
                                        b = bottom;
                                        l = left;
                                        r = right;
                                    }

                                    this.top = t;
                                    this.bottom = b;
                                    this.left = l;
                                    this.right = r;

                                    return this;
                                }
                            }
                        },
                        agenda.descriptors.isEqual(props)
                    )
                );

                return Position;
            })(['top', 'bottom', 'left', 'right'], sharedPropertiesAgenda, utilites);

            function preserveInstanceDecorator(ctor, fn) {
                return function preserveInstance() {
                    if (arguments.length === 1 && arguments[0] instanceof ctor) {
                        return arguments[0];
                    }
                    return fn.apply(this, arguments);
                };
            }

            return {
                /**
                 * Returns sealed object which represents size
                 *
                 * @param {Array.<number>|Object.<number>|number} width Provides width value or composite data.
                 * @param {number} height Provides height value.
                 *
                 * @example
                 *
                 * ```js
                 * var size = factory.size(10, 20);
                 * var sizeFromArray = factory.size([10, 20]);
                 * var sizeFromObject = factory.size({ width: 10, height: 20 });
                 * ```
                 *
                 * @returns size object
                */
                size: preserveInstanceDecorator(SizeCTOR, function (width, height) {
                    return new SizeCTOR(width, height);
                }),

                /**
                 * Returns sealed object which represens vertical position
                 *
                 * @param {Array.<number>|Object.<number>|number} bottom Provides bottom value or composite data.
                 * @param {number} top Provides top value.
                 *
                 * @example
                 *
                 * ```js
                 * var vCoords = factory.verticalPosition(10, 20);
                 * var vCoordsFromArray = factory.verticalPosition([10, 20]);
                 * var vCoordsFromObject = factory.verticalPosition({ bottom: 10, top: 20 });
                 * ```
                 *
                 * @returns vertical position object
                */
                verticalPosition: preserveInstanceDecorator(VPosition, function (bottom, top) {
                    return new VPosition(bottom, top);
                }),

                /**
                 * Returns sealed object which represents horisontal position
                 *
                 * @param {Array.<number>|Object.<number>|number} left Provides left value or composite data.
                 * @param {number} right Provides right value.
                 *
                 * @example
                 *
                 * ```js
                 * var hCoords = factory.horisontalPosition(10, 20);
                 * var hCoordsFromArray = factory.horisontalPosition([10, 20]);
                 * var hCoordsFromObject = factory.horisontalPosition({ left: 10, right: 20 });
                 * ```
                 *
                 * @returns horisontal position object
                */
                horisontalPosition: preserveInstanceDecorator(HPosition, function (left, right) {
                    return new HPosition(left, right);
                }),

                /**
                 * Returns sealed object which represents position.
                 *
                 * @param {Array.<number>|Object.<number>|number} top Provides top value or composite data, that may contain all coordinates or top-bottom coordinates.
                 * @param {Array.<number>|Object.<number>|number} bottom Provides bottom value or composite data, that may contain left-right coordinates.
                 * @param {number} left Provides left value.
                 * @param {number} right Provides right value.
                 *
                 * @example
                 *
                 * ```js
                 * var position = factory.position(10, 20, 0, 15);
                 * var coordsFromArray = factory.position([10, 20, 0, 15]);
                 * var coordsFromObject = factory.position({ top: 10, bottom: 20, left: 0, right: 15 });
                 * var coordsFromObjectArray = factory.position({ top: 10, bottom: 20 }, [0, 15]);
                 * ```
                 * @returns object represents coordinates
                */
                position: preserveInstanceDecorator(PositionCTOR, function (top, bottom, left, right) {
                    return new PositionCTOR(top, bottom, left, right);
                })
            };
        }
    ]);
angular
    .module('sp.smartflow.internal')
    .factory('sp.smartflow.internal.qualifyStrategy', [
        function StrategyFactory() {

            'use strict';

            /**
             * @constructor
            */
            function ConcreteStrategy(qualify, exec) {
                if (angular.isFunction(qualify)) this.qualify = qualify;
                if (angular.isFunction(exec)) this.exec = exec;
            }

            ConcreteStrategy.prototype = Object.create(Object.prototype, {
                constructor: {
                    value: ConcreteStrategy
                },
                qualify: {
                    writable: true,
                    value: angular.noop
                },
                exec: {
                    writable: true,
                    value: angular.noop
                },
            });

            function QualifiedStrategy() {
                if (angular.isFunction(arguments[0]) && angular.isFunction(arguments[1])) {
                    this.push(arguments[0], arguments[1]);
                    return;
                }
                this.push.apply(this, arguments);
            }

            (function() {

                function parseArgs(args) {
                    var concrete;
                    if (angular.isFunction(args[0])) {
                        concrete = [new ConcreteStrategy(args[0], args[1])];
                    } else {
                        concrete = Array.prototype.slice.call(args);
                    }
                    if (_.any(concrete, function(a) { return !(a instanceof ConcreteStrategy); })) {
                        throw new Error('Invalid arguments');
                    }
                    return concrete;
                }

                QualifiedStrategy.prototype = Object.create(Array.prototype, {
                    noopStrategy: {
                        value: new ConcreteStrategy(function() { return true; })
                    },
                    execQualified: {
                        value: function qualifiedStrategyExec() {
                            var self = this,
                                args = arguments;
                            return (self.find(function(st) { return st.qualify.apply(self, args); }) || self.noopStrategy)
                                .exec.apply(self, arguments);
                        }
                    },
                    push: {
                        value: function() {
                            return Array.prototype.push.apply(this, parseArgs(arguments));
                        }
                    },
                    unshift: {
                        value: function() {
                            return Array.prototype.unshift.apply(this, parseArgs(arguments));
                        }
                    },
                    insertAt: {
                        value: function(qualify, exec, index) {
                            var concrete, i;
                            if (qualify instanceof ConcreteStrategy) {
                                concrete = qualify;
                                i = exec;
                            } else {
                                concrete = new ConcreteStrategy(qualify, exec);
                                i = index;
                            }
                            if (!Number.isInteger(i)) throw new Error('Invalid arguments');

                            return Array.prototype.splice.apply(this, [i, 0, concrete]);
                        }
                    }
                });
                QualifiedStrategy.prototype.constructor = QualifiedStrategy;
            })();

            return {
                concrete: function(qualify, exec) {
                    return new ConcreteStrategy(qualify, exec);
                },
                make: function() {
                    var st = new QualifiedStrategy();
                    st.push.apply(st, arguments);
                    return st;
                }
            };
        }
    ]);
/// Temporary not in use

//// TODO: use promiseCache service

///**
// * Represents physical dimensions of reference elements used for articles (possibly not only them) layout building.
// * Gets the dimentions from pr-basis-directive.
// * Provides Basis object by async method 'get'.
//*/
//angular
//    .module('sp.smartflow.internal')
//    .factory('sp.smartflow.internal.basis', ['$q', 'sp.smartflow.internal.dimensions', /*'sp.common.eventBus', */
//        function ($q, dimensions /*, eventBus*/) {

//            'use strict';

//            //var alignToLine = true,
//            //    alignToLineProps = ['blockMax'];

//            var alignToLine = {
//                blockMax: true,
//                column: false
//            };

//            function isZeroBasis(b) {
//                var res = true;
//                angular.forEach(b, function (val) {
//                    res = res && val.width === 0 && val.height === 0;
//                });
//                return res;
//            }

//            /**
//             * Represents the set of physical sizes
//             * @constructor
//            */
//            function Basis() {
//                this.update.apply(this, arguments);
//            }

//            angular.extend(Basis.prototype, {
//                isEqual: function (other) {
//                    if (!angular.isObject(other)) return false;

//                    var res = true;

//                    // TODO: if new basis contains different properties set then current, this checking does not work
//                    // TODO: take that into consideration
//                    angular.forEach(this, function (size, name) {
//                        res = res && size.isEqual(other[name]);
//                    });
//                    return res;
//                },
//                update: function (infos) {
//                    (infos || []).forEach(function (rawInfo) {

//                        var name, rawSize;
//                        name = rawSize = null;
//                        if (angular.isArray(rawInfo)) {
//                            name = rawInfo[0];
//                            rawSize = rawInfo[1];
//                        } else if (angular.isObject(rawInfo)) {
//                            name = rawInfo.name;
//                            rawSize = rawInfo.size;
//                        }

//                        if (!angular.isString(name)) throw new Error('Cannot update basis with data provided');

//                        this[name] = dimensions.size(rawSize);

//                    }, this);

//                    if (angular.isObject(this.line)) {
//                        var lineHeight = this.line.height;
//                        angular.forEach(alignToLine, function (shouldAlign, propName) {
//                            var basisItem = this[propName];
//                            if (angular.isObject(basisItem) && shouldAlign) {
//                                basisItem.height -= basisItem.height % lineHeight;
//                            }
//                        }, this);
//                    }
//                },
//            });

//            var basis = null;

//            var basisChangedHandlers = [];
//            function onBasisChanged(handler) {
//                basisChangedHandlers.push(handler);
//            }

//            function basisChanged(b) {
//                window.__b = b;
//                basisChangedHandlers.forEach(function (h) {
//                    h.call(undefined, b);
//                });
//            }

//            return {
//                update: function (args) {
//                    try {
//                        var newBasis = new Basis(args);

//                        // TODO: figure out why sometimes basis directive sends all zero sizes; for now skip such updates
//                        // TODO: seems like it measures a detached element
//                        if (isZeroBasis(newBasis)) {
//                            console.info('attempting to update basis with only zero values');
//                            return;
//                        }
//                        if (newBasis.isEqual(basis)) {
//                            console.info('attempting to update basis with equal one');
//                            return;
//                        }

//                        basis = newBasis;
//                        basisChanged(basis);
//                    } catch (e) {
//                        console.info('error while updating basis', e, args);
//                    } 

//                },

//                /**
//                 * Gets current sizes of reference elements.
//                 * @returns promise fulfilled with Object.<string, Size>.
//                */
//                get: function () {
//                    var dfd = $q.defer();
//                    if (angular.isObject(basis)) {
//                        dfd.resolve(basis);
//                    } else {
//                        onBasisChanged(function (b) {
//                            dfd.resolve(b);
//                        });
//                    }
//                    return dfd.promise;
//                }
//            };
//        }
//    ]);

/**
 * Provides factory method for object representing 
*/
angular
    .module('sp.smartflow.internal')
    .factory('sp.smartflow.internal.scrollerEmplacement', ['sp.smartflow.internal.dimensions',
            function scrollerEmplacement(dimensions) {

                'use strict';

                var DIRECTION = Object.seal({
                    UP: '__up',
                    DOWN: '__down',
                    HALT: '__halt'
                });

                function ScrollerPosition(bayCoords, pailCoords /*, virtualBayCoords */) {
                    this.pail = this.bay = this.virtualBay = this.lastPosition = null;
                    //if (!angular.isObject(bayCoords)) throw new Error('bayCoords is required and must be on Object ar Array');
                    //if (!angular.isObject(pailCoords)) throw new Error('pailCoords is required and must be on Object ar Array');
                    if (!angular.isObject(bayCoords)) bayCoords = [0, 0];
                    if (!angular.isObject(pailCoords)) pailCoords = [0, 0];

                    this.update(bayCoords, pailCoords /*, virtualBayCoords */);
                }

                ScrollerPosition.prototype = Object.create(Object.prototype, {
                    getTopDistance: {
                        //configurable: false
                        //writable: false,
                        //enumerable:false,
                        value: function () {
                            if (!this.bay || !this.pail) return NaN;
                            return this.bay.top - this.pail.top;
                        }
                    },
                    getBottomDistance: {
                        //configurable: false
                        //writable: false,
                        //enumerable:false,
                        value: function () {
                            if (this.bay && this.pail) return this.pail.bottom - this.bay.bottom;
                            return NaN;
                        }
                    },
                    getDirection: {
                        //configurable: false
                        //writable: false,
                        //enumerable:false,
                        value: function () {
                            if (!this.lastPosition || !this.bay) return DIRECTION.HALT;  // TODO: consider changing behavior pattern: call like this might throw exception


                            var direction, bayOffset, pailOffset;

                            bayOffset = this.bay.top - this.lastPosition.bay.top;
                            pailOffset = this.pail.top - this.lastPosition.pail.top;

                            if (bayOffset - pailOffset === 0) {
                                direction = DIRECTION.HALT;
                            } else if (bayOffset - pailOffset > 0) {
                                direction = DIRECTION.DOWN;
                            } else {
                                direction = DIRECTION.UP;
                            }

                            return direction;
                        }
                    },
                    update: {
                        //configurable: false
                        //writable: false,
                        //enumerable:false,
                        //TODO: change arguments order bayPosition <-> pailPosition
                        value: function (bayPosition, pailPosition, virtualBayPosition) {
                            if (!bayPosition && !pailPosition && !virtualBayPosition) return;

                            this.lastPosition = angular.copy(this);
                            this.lastPosition.lastPosition = null;

                            if (bayPosition instanceof ScrollerPosition) {
                                this.bay = bayPosition.bay;
                                this.virtualBay = bayPosition.virtualBay;
                                this.pail = bayPosition.pail;
                                return;
                            }

                            if (angular.isObject(bayPosition)) {
                                this.bay = dimensions.verticalPosition(bayPosition);
                            }
                            if (angular.isObject(pailPosition)) {
                                this.pail = dimensions.verticalPosition(pailPosition);
                            }
                            // TODO: tempororay
                            this.virtualBay = dimensions.verticalPosition(this.bay.bottom + this.bay.height * 2, this.bay.top - this.bay.height);
                            //if (angular.isObject(virtualBayPosition)) {
                            //    this.virtualBay = dimensions.verticalRange(virtualBayPosition);
                            //}
                        }
                    },

                });

                return {
                    DIRECTION: DIRECTION,
                    position: function (bayCoords, pailCoords, virtualBayCoords) {
                        return Object.seal(new ScrollerPosition(bayCoords, pailCoords, virtualBayCoords));
                    }
                };
            }
    ]);

angular.module('pr.smartflow.common', []);
/**
 * Smartflow related events
*/
angular
    .module('pr.smartflow.common')
    .constant('pr.smartflow.common.events', {

        /**
         * Triggers when some entries changed their status
        */
        ON_ENTRY_STATE_CHANGED: 'pr.smartflow.common.events.onEntryStateChanged',

        ON_FEED_VISIBLE_ZONE_CHANGED: 'pr.smartflow.common.events.onFeedVisibleZoneChanged',

        ON_ENTRY_VISUAL_STATE_CHANGED: 'pr.smartflow.common.events.onEntryVisualStateChanged',
    });

angular
    .module('pr.smartflow.common')
    .constant('pr.smartflow.common.entryStates', {
        DETACHED: 'est_detached',
        ACTIVE: 'est_active',
        VISIBLE: 'est_visible',
        POTENTIALLY_VISIBLE: 'est_pot_visible',
        INVISIBLE: 'est_invisible'
    });
angular
    .module('pr.smartflow.common')
    .factory('pr.smartflow.common.entry', ['pr.smartflow.common.entryStates',
                function entryFactory(ENTRY_STATES) {

                    'use strict';

                    var defaults = (function() {
                        return {
                            getType: function() {
                                return this.meta.type;
                            },
                            getKey: function() {
                                return this.meta.id;
                            }
                        };
                    })();

                    function stateCheck(fn) {
                        return function() {
                            if (!this.meta) throw new Error('No metadata');
                            return fn.apply(this, arguments);
                        };
                    }

                    function Entry(meta, content, status) {
                        this.meta = meta;
                        this.content = content;
                        this.state = /* this.status = */ status || ENTRY_STATES.DETACHED;
                        this.location = {};
                    }

                    Entry.prototype = Object.create(Object.prototype, {
                        getType: {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            value: stateCheck(function () {
                                return angular.isFunction(this.meta.getType) ? this.meta.getType() : defaults.getType.call(this);
                            })
                        },
                        getKey: {
                            //configurable: false
                            //writable: false,
                            //enumerable:false,
                            value: stateCheck(function () {
                                return angular.isFunction(this.meta.getKey) ? this.meta.getKey() : defaults.getKey.call(this);
                            })
                        },
                    });

                    return {
                        make: function (meta, content, status) {
                            if (!angular.isObject(meta)) throw new Error('Metadata is required.');

                            if (angular.isObject(meta.content)) content = meta.content;

                            // Do not use meta.content by any means!
                            //delete meta.content;

                            //return Object.seal(new Entry(meta, content));
                            return new Entry(meta, content, status);
                        }
                    };
                }]);
angular
    .module('pr.smartflow.common')
    .factory('pr.smartflow.common.metadata', [
        function metadataFactory() {

        	'use strict';

            function Meta(source) {
                var instance = Object.create(Meta.prototype);
                angular.extend(instance, source || {});
                return instance;
            }

            Object.defineProperties(Meta.prototype, {
                constructor: Meta,
                getType: {
                    //configurable: false
                    //writable: false,
                    //enumerable:false,
                    value: function () {
                        return this.type;
                    }
                },
                getKey: {
                    //configurable: false
                    //writable: false,
                    //enumerable:false,
                    value: function () {
                        return this.id;
                    }
                }
            });
            
            // TODO: implement
            // function MetaBuffer(maxCapacity) {
            //     var buffer = [];

            // }

            return {
                make: function(sourceData, getTypeFn, getKeyFn) {
                    var instance = new Meta(sourceData);
                    if (angular.isFunction(getTypeFn)) instance.getType = getTypeFn;
                    if (angular.isFunction(getKeyFn)) instance.getKey = getKeyFn;
                    return instance;
                }
                // makeBuffer: function(maxCapacity) {
                //     return new MetaBuffer(maxCapacity || _defaultCapacity);
                // }
            };
        }
]);
// TODO: consider placing this module outside smartflow
(function (angular) {

    'use strict';

    angular
        .module('sp.smartflow.meta', [
            'sp.network',
            'sp.common',
            'sp.configuration',
            'sp.smartflow.internal',
            'sp.smartflow.providers',
            'pr.smartflow.common'
        ])
        .config([
            '$provide',

            function ($provide) {
                $provide.decorator('sp.smartflow.meta.newsfeedProvider', [
                    '$delegate',
                    'sp.smartflow.meta.groups',

                    function ($delegate, newsfeedGroupInterceptor) {
                        return newsfeedGroupInterceptor.decorate($delegate);
                    }
                ]);
            }
        ]);
})(angular);

// angular
    // .module('sp.smartflow.meta')
    // .factory('sp.smartflow.meta.issueProvider', [/*'$q', 'sp.network.api',*/ 'sp.smartflow.providers.metaProviderRepository',
        // function issueProvider(/*$q, api,*/ smartflowMetaProviderRepository) {

            // 'use strict';

            // // todo: implement
        
            // // todo: move provider name into a variable
            // // todo: define the key which provider should be registered with

            // smartflowMetaProviderRepository.registerProvider('sp.smartflow.meta.issueProvider', 'issue');

            // return {
                // loadNext: function() {},
                // loadPrevious: function() {},
            // };
        // }
// ]);
(function(angular) {

    'use strict';

    var PROVIDER_NAME = 'sp.smartflow.meta.newsfeedProvider';
    angular
        .module('sp.smartflow.meta')
        .provider(PROVIDER_NAME, [
            'sp.smartflow.providers.metaProviderRepositoryProvider',

            function newsfeedProvider(metaProviderRepository) {


                var _debug = false;

                // todo: specify key
                metaProviderRepository.registerProvider(PROVIDER_NAME, 'newsfeed');

                return {
                    $get: [
                        '$q',
                        'sp.smartflow.internal.utils',
                        'sp.smartflow.meta.newsfeedSource',
                        'sp.smartflow.meta.newsfeedDirection',
                        'pr.smartflow.common.metadata',

                        function($q, internalUtils, newsfeedSource, DIRECTION, metadataFactory) {

                        var LOAD_ATTEMPTS_MAX = 3,
                            _metaListBuffer = window.__mb = [],
                            _defaultConfig = {
                                requestedAmount: 20,
                                maxItems: 20,
                                viewType: 'topnews',
                                lang: 'en',
                                cleaned: false,
                                reset: false,
                            };

                        /**
                         * Appends/prepends filtered addition array to buffer array.
                         * @params {?Array.<Meta>} buffer - array to merge into.
                         * @params {?Array.<Meta>} addition - array to merge with.
                         * @params {DIRECTION} side - side to merge from.
                         * @returns {number} amount of added elements.
                        */
                        function mergeBuff(buffer, addition, side) {

                            if (!angular.isNumber(side)) throw new Error('side parameter is required and must be a number.');
                            if (!angular.isArray(buffer)) return buffer; // Assuming buffer pointer can't be modified in any case.
                            if (!addition || addition.length === 0) return 0;

                            // TODO: build a persisted hash map and update it whenever the buffer is changed
                            var bufferHashMap = buffer.reduce(function(map, current) {
                                map[current.getKey()] = true;
                                return map;
                            }, {});

                            var filteredAddition = addition.reduce(function(filtered, current) {
                                if(!bufferHashMap[current.getKey()]) {
                                    bufferHashMap[current.getKey()] = true;
                                    filtered.push(current);
                                }
                                return filtered;
                            }, []);

                            if (DIRECTION.isForward(side)) { // Merge from right
                                buffer.push.apply(buffer, filteredAddition);
                            } else { // Merge from left
                                buffer.unshift.apply(buffer, filteredAddition);
                            }
                            return filteredAddition.length;
                        }

                        /**
                         * Loads no fewer then {config.neededAmount} items from {source} with the necessary amount of retries.
                         * @params {array} buffer - an array to add loaded items to.
                         * @params {FeedSource|HistorySource} source - source to load items from.
                         * @params {object} config - config object.
                         * @params {DIRECTIOIN} config.direction - indicates whether to load next or previous items.
                         * @params {number>0} config.neededAmount - how many items should be loaded.
                         * @params {?number>0} config.maxItems - how many should be requested from source at the first attempt.
                         * @returns {promise} promise fulfilled with merged buffer.
                        */
                        function load(buffer, source, config) {
                            if (!angular.isNumber(config.direction)) throw new Error('config.direction parameter is required');
                            if (!angular.isNumber(config.neededAmount)) throw new Error('config.neededAmount parameter is required');

                            // We don`t want to ask server for fewer then {_defaultConfig.maxItems} amount of items.
                            if (!angular.isNumber(config.maxItems)) {
                                config.maxItems = Math.max(config.neededAmount, _defaultConfig.maxItems);
                            }

                            // complete config
                            if (!angular.isNumber(config.attempt)) config.attempt = 1;
                            if (!angular.isNumber(config.loadedAmount)) config.loadedAmount = 0;

                            var loadCfg = internalUtils.createAlike(_defaultConfig, config);
                            return (config.direction >= 0 ? source.loadNext : source.loadPrevious)(loadCfg)
                                        .then(function(loadedItems) {
                                            return (loadedItems || []).map(function(item) {
                                                // Custom getKey and getType function might be used here.
                                                // Create Meta objects with default getKey and getType
                                                return metadataFactory.make(item);
                                            });
                                        })
                                        .then(function (metas) {
                                            if (_debug) console.info('newsfeed provider:', 'loaded', metas.length);
                                            var newAmount = mergeBuff(buffer, metas, config.direction);
                                            config.loadedAmount += newAmount;
                                            if (_debug) console.info('newsfeed provider:', 'after merge', newAmount);

                                            if (config.loadedAmount >= config.neededAmount || config.attempt >= LOAD_ATTEMPTS_MAX) {
                                                return buffer;
                                            } else {
                                                config.maxItems *= 2;
                                                config.attempt++;

                                                if (_debug) console.info('newsfeed provider:', ' loading attempt', config.attempt);

                                                return load(buffer, source, config);
                                            }
                                        });
                        }

                        /**
                         * Gets from buffer or loads from server newsfeed metas.
                         * @params {array} buffer - metas buffer.
                         * @params {DIRECTIOIN} direction - indicates whether to load next or previous items.
                         * @params {object} config - config object.
                         * @params {?number} config.requestedAmount - how many metas to get.
                         * @returns {promise} promise object fulfilled with array of loaded metas
                        */
                        function getOrLoad(buffer, direction, config) {
                            if (!angular.isArray(buffer)) throw new Error('buffer parameter is required and must be an Array.');
                            if (!angular.isNumber(direction)) throw new Error('direction parameter is required.');
                            if (!angular.isObject(config)) throw new Error('config parameter is required.');

                            var offset = _.findIndex(buffer, function (a) { return a.getKey() === config.entryId; }),
                                requestedAmount = angular.isNumber(config.requestedAmount) ? config.requestedAmount : _defaultConfig.requestedAmount,
                                remainAmount = DIRECTION.isForward(direction) ?
                                                offset < 0 ? 0 : buffer.length - (offset + 1) :
                                                Math.max(offset, 0);

                            var loadPromise;
                            if (remainAmount < requestedAmount) { // Need to load additional metas
                                var source = newsfeedSource.get(config);
                                if (source === undefined) throw new Error('The newsfeed source can not be determined based on config given');

                                if (offset === -1) buffer.length = 0; // Flush buffer   // TODO: check if the call of buffer.splice(0) is better.

                                var oldBufLen = buffer.length,
                                    params = angular.copy(config);
                                params.direction = DIRECTION.isForward(direction) ? DIRECTION.FORWARD : DIRECTION.BACKWARD;
                                params.neededAmount = requestedAmount - remainAmount;

                                loadPromise = load(buffer, source, params)
                                                .then(function(mergedBuf) {
                                                    var data = { buffer: mergedBuf };
                                                    if (DIRECTION.isForward(direction)) {
                                                        data.offset = offset;
                                                    } else {
                                                        data.offset = (offset === -1) ? mergedBuf.length : mergedBuf.length - oldBufLen + offset;
                                                    }
                                                    return data;
                                                });
                            } else {
                                loadPromise = $q.when({ buffer: buffer, offset: offset });
                            }

                            return loadPromise
                                    .then(function(data) {
                                        var startIndex, endIndex;
                                        if (DIRECTION.isForward(direction)) {
                                            if (data.offset === -1) {
                                                startIndex = 0;
                                            } else {
                                                startIndex = data.offset + (config.include ? 0 : 1);
                                            }
                                            //startIndex = data.offset;
                                            endIndex = Math.min(data.buffer.length, requestedAmount + startIndex);
                                        } else {
                                            if (data.offset === -1) {
                                                endIndex = Math.min(data.buffer.length, requestedAmount);
                                                startIndex = 0;
                                            } else {
                                                endIndex = data.offset + (config.include ? 1 : 0);
                                                startIndex = Math.max(0, endIndex - requestedAmount);
                                            }
                                        }
                                        return data.buffer.slice(startIndex, endIndex);
                                    });
                        }

                        return {

                            /**
                             * Loads following metadatas.
                             * @params {object} config - config object.
                             * @params {?number} config.requestedAmount - how many metas to load.
                             * @params {?number} config.maxItems - how many metas to request from service. Do not use it unless you know what you are doing.
                             * @params {?string} config.entryId - current position in the feed.
                             * @params {?string} config.token - current position token.
                             * Check _defaultConfig for more config options.
                             * @returns promise fulfilled with loaded metadatas.
                            */
                            loadNext: getOrLoad.bind(undefined, _metaListBuffer, DIRECTION.FORWARD),

                            /**
                             * Loads preceding metadatas
                             * @params {object} config - config object.
                             * @params {?number} config.requestedAmount - how many metas to load.
                             * @params {?number} config.maxItems - how many metas to request from service. Do not use it unless you know what you are doing.
                             * @params {?string} config.entryId - current position in the feed.
                             * @params {?string} config.token - current position token.
                             * Check _defaultConfig for more config options.
                             * @returns promise fulfilled with loaded metadatas.
                            */
                            loadPrevious: getOrLoad.bind(undefined, _metaListBuffer, DIRECTION.BACKWARD)
                        };
                    }]
                };
            }
        ]);
})(angular);
// todo: uncomment only necessary types
angular
    .module('sp.smartflow.meta')
    .constant('sp.smartflow.meta.type', {
        //'regularArticle': 0,
        ARTICLE_PREVIEW: 1,
        //'regularPage': 2,
        //'lastVisit': 3,
        //'searchBar': 4,
        //'myLastTitles': 5,
        //'replies': 6,
        INIT_BLOCK: 7,
        //'leftBar': 10,
        //'monitors': 11,
        //'profile': 12,
        //'opinion': 13,
        //'homeBlock': 14
        GROUP_HEADER: 22
    });
angular
    .module('sp.smartflow.meta')
    .constant('sp.smartflow.meta.groupType', {
        HEADLINES: 0,
        INTERESTING: 1,
        USERS: 2,
        MORE_NEWS_CLUSTER: 3,
        READERS_CHOICE: 4,
        SINCE_YOUR_LAST_VISIT: 5,
        CATEGORY: 6,
        TOPIC: 7,
        USER_SECTION: 8,
        UNKNOWN: -1
    });
'use strict';

angular
    .module('sp.smartflow.meta')
    .constant('sp.smartflow.meta.newsfeedDirection', {
        FORWARD: 1,
        BACKWARD: -1,
        isForward: function(dir) {
            return dir >= 0;
        }
    });
angular
    .module('sp.smartflow.meta')
    .factory('sp.smartflow.meta.newsfeedSource', [
        'sp.network.api', 'sp.smartflow.meta.newsfeedDirection', 'sp.common.dataTransformation',
        function newsfeedSource(api, DIRECTION, dto) {

            'use strict';

            function mergeConfig(sourceConfig, extendConfig) {
                var resultConfig = {};
                angular.forEach(sourceConfig, function (value, key) {
                    resultConfig[key] = (extendConfig[key] === null || typeof extendConfig[key] === 'undefined') ? value : extendConfig[key];
                });
                return resultConfig;
            }

            function HistorySource() {
                this.loadNext = this.loadNext.bind(this);
                this.loadPrevious = this.loadPrevious.bind(this);
            }

            HistorySource.prototype.url = 'TopNewsFeed/GetHistory';
            HistorySource.prototype.defaultConfig = {
                token: null,
                dir: null,
                maxItems: 20,
                cleaned: true // TODO: determine the purpose of this parameter.
            };
            HistorySource.prototype.load = function (config) {
                var requestParams = mergeConfig(this.defaultConfig, config);
                return api.server
                    .get(this.url, { params: requestParams })
                    .then(function (response) {
                            var loadedItems = response.data.Items || [];

                            // TODO: this data transformation should be removed if the server responds with correct json (camelCase, first low character)
                            loadedItems.forEach(function (d) {
                                dto.camelCaseIt(d);
                            });

                            // TODO: find better way to store this tokens
                            loadedItems.forEach(function (item) {
                                item.leftToken = response.data.MinToken;
                                item.rightToken = response.data.MaxToken;
                            });
                            return loadedItems;
                        }
                        // function (error) {
                        // // TODO: add retry.
                        // }
                    );
            };
            HistorySource.prototype.loadNext = function (config) {
                if (!angular.isObject(config)) throw new Error('config parameter is required and must be an object.');

                config.dir = DIRECTION.FORWARD;
                return this.load(config)
                    .then(function (loadedItems) {

                        if (loadedItems && loadedItems.length !== 0) return loadedItems;

                        // The history end reached. Request newsfeed.
                        var feedSource = new FeedSource();
                        return feedSource.loadNext(config);
                    });
            };
            HistorySource.prototype.loadPrevious = function (config) {
                if (!angular.isObject(config)) throw new Error('config parameter is required and must be an object.');

                if (config.token === undefined) config.token = ''; // TODO: remove if token became an optional param for corresponding action
                config.dir = DIRECTION.BACKWARD;

                return this.load(config);
            };

            function FeedSource() {
                this.loadNext = this.loadNext.bind(this);
                this.loadPrevious = this.loadPrevious.bind(this);
            }

            FeedSource.prototype.url = 'TopNewsFeed/GetFeed';
            FeedSource.prototype.defaultConfig = {
                maxItems: 20,
                cleaned: null, //TODO: determine the purpose of this parameter.
                reset: null //TODO: determine the purpose of this parameter.
            };
            FeedSource.prototype.loadNext = function (config) {
                if (!angular.isObject(config)) throw new Error('config parameter is required and must be an object.');

                var requestParams = mergeConfig(this.defaultConfig, config);

                return api.server.get(this.url, { params: requestParams })
                    .then(function (response) {
                        var loadedItems = response.data || [];

                        // TODO: this data transformation should be removed if the server responds with correct json (camelCase, first low character)
                        loadedItems.forEach(function (d) {
                            dto.camelCaseIt(d);
                        });
                        return loadedItems;
                    });
            };
            FeedSource.prototype.loadPrevious = function (config, buffer) {
                var history = new HistorySource();
                return history.loadPrevious(config, buffer);
            };

            /**
         * Returns the source depends on config passed.
         * @params {!object} config - config object.
         * Returns either feed or history server entry point.
        */
            function getSource(config) {
                if (!angular.isObject(config)) return undefined;
                if (config.token !== undefined || config.dir === DIRECTION.BACKWARD) return new HistorySource();
                return new FeedSource();
            }

            return {
                get: getSource
            };

        }
    ]);
angular
    .module('sp.smartflow.meta')
    .factory('sp.smartflow.meta.groups', [
        '$q',
        'sp.smartflow.meta.type',
        'sp.smartflow.meta.groupType',
        'pr.smartflow.common.metadata',
        'sp.configuration.configuration',

        function newsfeedGroupDecorator($q, META_TYPE, GROUP_TYPE, metadata, configuration) {

            'use strict';

            var _debug = true;


            // The group header meta might contain only raw data like type and name, received from server.
            // The group title (from resources of whatever) and other data might be
            // loaded by content provider as it is done for articles.
            // In this case all logic which involves resources should me moved to that content provider.

            // TODO: create factory which creates real group headers metadata
            function makeGroupHeaderMeta(type, name /*, locale*/) {
                var groupHeaderMeta = metadata.make({ type: META_TYPE.GROUP_HEADER });
                setGroupTitleAsync(groupHeaderMeta, type, name /*, locale*/);
                return groupHeaderMeta;
            }

            function setGroupTitleAsync(destination, type, name) {

                if (type === null || type === GROUP_TYPE.USERS) {
                    destination.name = name;
                    return $q.when(destination);
                }

                var resourceName;
                switch (type) {
                    //case GROUP_TYPE.HEADLINES:
                    //    // 'clustered': group title, resource name is "Important.Title"
                    //    break;
                    //case GROUP_TYPE.MORE_NEWS_CLUSTER:
                    //    // 'clustered': group title, resource name is "MoreNews.Title"
                    //    break;
                case GROUP_TYPE.INTERESTING:
                    resourceName = 'Interesting.Title';
                    break;
                case GROUP_TYPE.SINCE_YOUR_LAST_VISIT:
                    resourceName = 'SinceLastVisit.Title';
                    break;
                default:
                    resourceName = ['Newsfeed', 'Groups', name, 'Title'].join('.');
                    break;
                }
                return configuration.load()
                    .then(function(config) {
                        destination.name = config.resources.get(resourceName) || name;
                        return destination;
                    });
            }

            function groupHeadersInjectDecorator(original) {
                return function injectGroupHeaders() {
                    return $q.when(original.apply(this, arguments))
                        .then(function (loadedMetas) {
                            var res = [],
                                currentMeta,
                                lastGroupName;

                            while (loadedMetas.length > 0) {
                                currentMeta = loadedMetas.shift();
                                if (META_TYPE.ARTICLE_PREVIEW === currentMeta.getType()) {
                                    var currentData = currentMeta.data || {};
                                    if (lastGroupName && lastGroupName !== currentData.groupName) {
                                        var groupHeaderMeta = makeGroupHeaderMeta(currentData.groupType, currentData.groupName);
                                        res.push(groupHeaderMeta);
                                        if (_debug) console.info('Group header inserted', groupHeaderMeta);
                                    }
                                    lastGroupName = currentData.groupName;
                                }
                                res.push(currentMeta);
                            }
                            return res;
                        });
                };
            }

            return {
                decorate: function (originalProvider) {

                    function createPropDescription(propName) {
                        var originalPropDesc = Object.getOwnPropertyDescriptor(originalProvider, propName);
                        if (!originalPropDesc) throw new Error(propName + ' is not an own property');
                        return {
                            configurable: originalPropDesc.configurable,
                            writable: originalPropDesc.writable,
                            enumerable: originalPropDesc.enumerable,
                            value: groupHeadersInjectDecorator(originalProvider[propName])
                        };
                    }

                    var decorated = Object.create(originalProvider, {
                        loadNext: createPropDescription('loadNext'),
                        loadPrevious: createPropDescription('loadPrevious')
                    });
                    return decorated;
                }
            };
        }
    ]);

angular.module('sp.smartflow.providers', []);

angular
    .module('sp.smartflow.providers')
    .provider('sp.smartflow.providers.contentProviderRepository', [
        function smartflowContentProviderRepositoryProvider() {

            'use strict';

            var _registeredProviders = {};

            function register(map, provider, keys) {
                if(typeof map !== 'object') map = {};
                if (!angular.isArray(keys)) keys = [keys];

                keys.forEach(function(key) {
                    //if (registeredProviders[key] !== undefined) {}   // todo: provider has already been registered
                    map[key] = provider;
                });
            }
            
            return {
                registerProvider: register.bind(undefined, _registeredProviders),
                $get: ['$injector', '$q', function contentProviderRepository($injector, $q) {

                    var dummyContentProvider = (function () {
                        function load (config, entries){
                            entries.forEach(function(entry) {
                                entry.content = {
                                    text: 'Loaded as a stub for type ' + entry.meta.Type,
                                };
                            });
                            return $q.when(entries);
                        }

                        return {
                            load: load
                        };
                    })();

                    return {
                        getProvider: function(key) {
                            var providerName = _registeredProviders[key];
                            if (providerName === undefined) {
                                return dummyContentProvider;
                            } // TODO: provider is not registered
                            return $injector.get(providerName);
                        }

                    };
                }]
            };
        }
    ]);

angular
    .module('sp.smartflow.providers')
    .provider('sp.smartflow.providers.metaProviderRepository', [
        function metaProviderRepositoryProvider() {

            'use strict';

            var _registeredProviders = {};

            function register(map, provider, keys) {
                if(typeof map !== 'object') map = {};
                if (! (keys instanceof Array)) keys = [keys];

                keys.forEach(function(key) {
                    //if (registeredProviders[key] !== undefined) {}   // todo: provider has already been registered
                    map[key] = provider;
                });
            }

            return {
                registerProvider: register.bind(undefined, _registeredProviders),
                $get: ['$injector', function metaProviderRepository($injector /*($q*/) {

                    // var dummyMetaProvider = (function () {
                        // function load (direction, limit){
                            // var metas = [];
                            // var length = Math.floor(Math.random() * limit);
                            // for (var i = 0; i< length; i++) {
                                // metas.push({
                                    // Id: Math.floor(Math.random() * 100 * limit),
                                    // Type: 'dummy',
                                    // direction: direction
                                // });
                            // }
                            // return $q.when(metas);
                        // }

                        // return {
                            // loadNext: load.bind(this, 'next', 20),
                            // loadPrevious: load.bind(this, 'previous', 10)
                        // };
                    // })();


                    return {
                        has: function (key) {
                            return key in _registeredProviders;
                        },
                        getProvider: function(key) {
                            var providerName = _registeredProviders[key];
                            //if (providerName === undefined) {} // todo: provider is not registered
                            return $injector.get(providerName);
                        }
                    };
                }]
            };
        }
    ]);

angular.module('sp.smartflow.ui', ['classy', 'sp.configuration', 'pr.utils.angular', 'sp.smartflow.meta', 'sp.utils', 'sp.smartflow.internal', 'pr.smartflow.common']);

///// Temporary not in use

///**
// * Directive emulates infinite vertical scrolling experience in both directions.
// * @element ANY
// * @param {element} prVerticalScroller Scroll containrer. $window if not element passed.
// * @param {expression} getPrevious Function call which is invoked for loading more content from above.
// * @param {expression} getNext Function call which is invoked for loading more content from below.
// * @param {number} distance Number representing how close the borders of the element must be to the borders of the scroller container before the loading of additional content is triggered.
// * @example
// *
// *  <div class="scroller" pr-vertical-scroller="entries" up="loadPrevious()" down="loadNext()" distance="1">
//        <div ng-repeat="entry in entries" pr-vertical-scroller-item="entry">...</div>
// *  </div>
// *
//*/
//angular
//    .module('sp.smartflow.ui')
//    .directive('prVerticalScroller', [
//        '$q',
//        '$timeout',
//        '$window',
//        'sp.smartflow.internal.scrollerEmplacement',
//        function ($q, $timeout, $window, scrollerEmplacement) {

//            'use strict';

//            var wndw = angular.element($window);

//            var _debug = false;

//            function getPosition(bayElm, pailElm) {
//                if (!angular.isObject(bayElm)) throw new Error('bayElm parameter is required');
//                if (!angular.isObject(pailElm)) throw new Error('pailElm parameter is required');

//                var bayTop, pailTop;
//                if (bayElm === wndw) {
//                    bayTop = bayElm.scrollTop();
//                    pailTop = pailElm.offset().top;
//                } else {
//                    //bayTop = bayElm.scrollTop() + bayElm.offset().top;
//                    bayTop = bayElm.offset().top;
//                    pailTop = pailElm.offset().top;
//                }
//                var bayPosition = [bayTop + bayElm.height(), bayTop],
//                    pailPosition = [pailTop + pailElm.height(), pailTop];

//                window.p = pailElm;
//                window.b = bayElm;
//                return scrollerEmplacement.position(bayPosition, pailPosition);
//            }

//            function findAnchor(elms, position) {
//                return (elms || []).reduce(function(best, child) {
//                    var childEl = angular.element(child);
//                    var delta = childEl.offset().top - position.bay.top;
//                    if (Math.abs(delta) <= Math.abs(best.visibleOffset)) {
//                        best.visibleOffset = delta;
//                        best.element = childEl;
//                    }
//                    return best;
//                }, { visibleOffset: Infinity, element: undefined });
//            }

//            return {
//                restrict: 'A',
//                scope: {
//                    getNext: '&',
//                    getPrevious: '&',
//                    distance: '=',
//                    //disableLoading: '=',
//                    needsRecycle: '=',
//                    recycle: '&',
//                    container: '=prVerticalScroller'
//                },
//                //priority: 90,
//                //transclude: true,
//                //templateUrl: 'templates/smartflow/verticalScroller.html',
//                controller: function($scope /* , $element, $attrs */) {
//                    $scope.items = [];
//                    $scope.position = window._sp = scrollerEmplacement.position();

//                    this.getPosition = function() {
//                        return $scope.position;
//                    };

//                    this.positionChanged = _.throttle(function () {
//                        $scope.items
//                            .forEach(function(info) {
//                                (info.callback || angular.noop)($scope.position);
//                            });
//                    }, 200);

//                    this.transitTo = function(itemInfo, callacks) {

//                        if (!itemInfo.element || !$scope.container) return; // + warning

//                        var elm = itemInfo.element;

//                        var top = elm.offset().top;
//                        $scope.container.scrollTop($scope.container.scrollTop() + top);

//                        (callacks || []).forEach(function(fn) {
//                            (angular.isFunction(fn) ? fn : angular.noop).call(undefined, elm);
//                        });

//                        //$scope.container.animate({
//                        //    scrollTop: $scope.container.scrollTop() + top
//                        //}, '200', 'swing', function() {
//                        //    (callacks || []).forEach(function(fn) {
//                        //        fn.call(undefined, elm);
//                        //    });
//                        //});
//                    };

//                    this.addItem = function(info) {
//                        $scope.items.push(info);
//                    };
//                    this.removeItem = function(info) {
//                        var index = $scope.items.lastIndexOf(info);
//                        if (index >= 0) $scope.items.splice(index, 1);
//                    };

//                },
//                link: function(scope, element, attr, ctrl) {

//                    // TODO: Safari Mobile bug (description could be find here: https://devforums.apple.com/message/885616#885616):
//                    //       css property "-webkit-overflow-scrolling: touch" causes touch events to stop being fired properly
//                    //       here is an workaround for that. Sould be removed if the problem has gone.
//                    document.getElementById('_mainScrollerWr').addEventListener('touchstart', function() { });

//                    var container,
//                        scrollDistance,
//                        position = scope.position,
//                        anchor;

//                    scrollDistance = 0;
//                    anchor = null;
//                    scope.loading = false;

//                    var onBottomReachedQueue = [], 
//                        onBottomReached = function(fn) {
//                            onBottomReachedQueue.push(fn);
//                        };
//                    onBottomReached(function() {
//                        if (!scope.needsRecycle) return;
//                        scope.recycle();
//                    });

//                    var trackPosition = function(/* evt */) {

//                        position.update(getPosition(container, element));
//                        ctrl.positionChanged();
//                        if (_debug) console.info('scroller position updated', position);
                        
//                        if (_debug) anchor && anchor.element && anchor.element.removeClass('sc-anchor');    /* jshint ignore:line */
//                        anchor = findAnchor(scope.items.map(function(info) { return info.element; }), position);
//                        if (_debug) anchor && anchor.element && anchor.element.addClass('sc-anchor');   /* jshint ignore:line */
//                        if (_debug) console.info('current anchor', anchor);
//                    };

//                    var trackLoading = _.throttle(function(/* evt */) {

//                        // TODO: both functions might be moved to the outer scope.

//                        function loadContentSuccess(message){
//                            return function loadContentSuccessHandler(loadedEntries) {
//                                if (_debug) console.info(message || 'content request success', loadedEntries);  
//                                return loadedEntries;
//                            };
//                        }

//                        function loadContentError(message){
//                            return function loadContentErrorHandler(err){
//                                // TODO: add real error handling here
//                                if(_debug) console.info(message || 'content request failed', err);
//                                return err;
//                            };
//                        }

//                        function loadEndHandler() {
//                            scope.loading = false;
//                            //preserveAnchorPosition();
//                        }

//                        if (scope.loading) return;

//                        var loadFn, getDistanceFn, onLoadSuccess, onLoadError, onAfterLoad;
//                        if (position.getDirection() === scrollerEmplacement.DIRECTION.UP) {
//                            getDistanceFn = function() {
//                                return position.getTopDistance();
//                            };
//                            loadFn = scope.getPrevious;
//                            onLoadSuccess = loadContentSuccess('previous entries got');
//                            onLoadError = loadContentError('getPrevious failed');
//                            onAfterLoad = loadEndHandler;
//                        } else {
//                            getDistanceFn = function() {
//                                return position.getBottomDistance();
//                            };
//                            loadFn = scope.getNext;
//                            onLoadSuccess = loadContentSuccess('next entries got');
//                            onLoadError = loadContentError('getNext failed');
//                            onAfterLoad = loadEndHandler;
//                        }

//                        if (getDistanceFn() > scrollDistance * position.bay.height) return;

//                        if (scope.disableLoading) {
//                            console.warn('should load, but disabled');
//                            return;
//                        }


//                        scope.loading = true;
//                        $q.when(loadFn())
//                            .then(onLoadSuccess, onLoadError)
//                            .finally(onAfterLoad);
//                    }, 200);

//                    var preserveAnchorPosition = function(callback) {
//                        if (_debug) console.info('adjustment planned', anchor);
//                        scope.$$postDigest(function() {
//                            // The scroller is supposed to be used with ng-repeat directive,
//                            // since ng-repeat uses $animate.leave to remove DOM elements, they are actually removed on $$postDigest
//                            // and because ng-repeat is a child directive for the scroller directive,
//                            // this handler is executed before all remove handlers sheduled by ng-repeat are,
//                            // so we need to adjust scrolling position after all of the elements have been actually removed from DOM.
//                            // Dirty hack and I know it.
//                            scope.$$postDigest(function() {
//                                //scope.loading = false;
//                                if (_debug) console.info('adjustment ready', anchor, container);

//                                if (!angular.isObject(anchor) || anchor.element === undefined) return;
//                                var offsetTop = anchor.element.offset().top;
                                
//                                container.scrollTop(container.scrollTop() + offsetTop - anchor.visibleOffset); 
//                                if (_debug) console.info('adjustment done', anchor, container);
                                
//                                anchor = null;

//                                if(angular.isFunction(callback)) callback();
//                            });
//                        });
//                    };

//                    var blockScrolling = function() {
//                        container.addClass('sc-blocked');
//                        scope.scrollBlocked = true;
//                    };
//                    var releaseScrolling = function() {
//                        container.removeClass('sc-blocked');
//                        scope.scrollBlocked = false;
//                    };

//                    var toggleScrolling = function() {
//                        container.toggleClass('sc-blocked');
//                    };

//                    var bindContainer = function (newCont) {
                        
//                        if (container != null) {    /* jshint ignore:line */
//                            container.off('scroll', trackPosition);
//                            container.off('scroll', trackLoading);
//                        }

//                        container = (typeof newCont.last === 'function' && newCont !== wndw) ? newCont.last() : newCont;
//                        if (_debug) window._c = container;

//                        if (container != null) {    /* jshint ignore:line */
//                            container.on('scroll', trackPosition);
//                            container.on('scroll', trackLoading);
//                        }
//                    };

//                    var handleDistance = function (v) {
//                        return scrollDistance = parseInt(v, 10) || 0;   /* jshint ignore:line */
//                    };

//                    var handleContainer = function (c) {
//                        if (!c || c.length === 0) return;

//                        c = angular.element(c);
//                        bindContainer(c);
//                    };

//                    bindContainer(wndw);

//                    handleDistance(scope.distance);
//                    handleContainer(scope.container);

//                    //scope.$watchCollection('items', function (collection) {
//                     //    if (_debug) console.info('scroller items watcher', collection);
//                    //    preserveAnchorPosition();
//                    //});

//                    scope.$watch('distance', handleDistance);
//                    scope.$watch('container', handleContainer);

//                    scope.$watch('needsRecycle', function(val, old) {
//                        if (val) {
//                            console.info('recycle invoked', old, '->', val);
//                            scope.recycle();
//                        }
//                    });

//                    scope.$on('$destroy', function () {
//                        container.off('scroll', trackPosition);
//                        container.off('scroll', trackLoading);
//                    });

//                    //var childScope = scope.$new();
//                    //$transclude(childScope, function(clone) {
//                    //    debugger;
//                    //});

//                    //$timeout(function () { scrollHandler(); }, 0);
//                    $timeout(function() {
//                        scope.$$postDigest(function() {
//                            //scrollHandler();
//                            //container.scrollTop(0);
//                        });
//                    }, 0);

//                }
//            };
//        }
//    ]);

//angular
//    .module('sp.smartflow.ui')
//    .directive('prVerticalScrollerItem', [
//        'sp.smartflow.internal.dimensions',
//        //'sp.smartflow.meta.types',
//        //'sp.common.eventBus',
//        //'pr.smartflow.common.events',
//        //'pr.smartflow.common.entryStates',
//        function(dimensions /*, metaTypes, eventBus, SM_EVENTS, ENTRY_STATES*/) {

//            'use strict';

//            return {
//                require: '^prVerticalScroller',
//                //controller: function($scope, $element) {
                    
//                //    //var updateItemState = function() {
//                //    //    console.info('onActive item callback');
//                //    //    $element.css('background', 'red');
//                //    //    if ($scope.item) $scope.item.state = ENTRY_STATES.ACTIVE;
//                //    //};
//                //    //$scope.onStateChangedQueue = [];

//                //    //$scope.types = metaTypes;
//                //    //$scope.currentState = ENTRY_STATES.DETACHED;

//                //    //this.onStateChanged = function(callback) {
//                //    //    if (angular.isFunction(callback))
//                //    //        $scope.onStateChangedQueue.push(callback);
//                //    //};
//                //},
//                link: function(scope, element, attrs, scrollerCtrl) {

//                    var position = null;

//                    var updatePosition = function(currentPosition) {
//                        var top = element.offset().top;
//                        var bottom = top + element.height();
//                        if (!angular.isObject(currentPosition)) {
//                            currentPosition = dimensions.verticalPosition(bottom, top);
//                        } else {
//                            currentPosition.set(bottom, top);
//                        }
//                        return currentPosition;
//                    };

//                    var getState = function(itemPosition, scrollerPosition) {
//                        if (itemPosition.overlap(scrollerPosition.bay))
//                            return 'visible';

//                        if (position.overlap(scrollerPosition.virtualBay))
//                            return 'potentially visible';

//                        return 'invisible';
//                    };

//                    var info = {
//                        scope: scope,
//                        element: element,
//                        callback: function positionChangedHandler() {

//                            position = updatePosition(position);
//                            //var oldState = scope.currentState;

//                            scope.currentState = getState(position, scrollerCtrl.getPosition());
//                            //if (scope.currentState !== oldState) {
//                            //    scope.onStateChangedQueue.forEach(function(fn) {
//                            //        fn.call(undefined, scope.currentState, oldState);
//                            //    });
//                            //}
//                            if (!scope.$$phase) scope.$apply();
//                        }
//                    };

//                    scrollerCtrl.addItem(info);

//                    position = updatePosition();

//                    scope.currentState = getState(position, scrollerCtrl.getPosition());

//                    //scrollerCtrl.onPositionChanged(positionChangedHandler);

//                    element.on('click', function(/* evt */) {
//                        //console.info('scroller item click', evt);
//                        //scrollerCtrl.transitTo(info);
//                    });

//                    scope.$on('$destroy', function () {
//                        scrollerCtrl.removeItem(info);
//                    });
//                }
//            };
//        }
//    ]);

angular
    .module('sp.smartflow.ui')
    .directive('scContainer', [
        '$q',
        '$window',
        'sp.smartflow.ui.scContainer.proxy',
        function ($q, $window, scContainer) {

            'use strict';

            /* var _debug = true; */

            return {
                restrict: 'A',
                controller: function ($scope, $element /* , $attrs */) {

                    // TODO: temporary, fix container height to keep mobile browser bars shown.
                    $element
                        .addClass('sc-cont-fixed')
                        .height(angular.element($window).outerHeight(true));

                    angular.extend(this, scContainer.createProxy($element, $scope));
                },
                link: function (scope, element /* , attrs, ctrl */) {

                    // TODO: Safari Mobile bug (description could be find here: https://devforums.apple.com/message/885616#885616):
                    //       css property "-webkit-overflow-scrolling: touch" causes touch events to stop being fired properly
                    //       here is an workaround for that. Sould be removed if the problem has gone.
                    element[0].addEventListener('touchstart', function () {});
                }
            };
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.scContainer.proxy', [
        '$q',
        '$timeout',
        '$rootScope',
        'pr.utils.angularAdapter',
        'sp.smartflow.internal.dimensions',
        'sp.common.eventBus',
        'pr.smartflow.common.events',


        function scContainerFactory($q, $timeout, $rootScope, angularAdapter, dimensions, eventBus, SM_EVENTS) {

            'use strict';

            var _debug = true;

            var _dataKey = '_sc_container_data';


            function immediateTimeoutDecorator(fn) {
                return function() {
                    var self = this, args = Array.prototype.slice.call(arguments);
                    return $timeout(function() {
                        return fn.apply(self, args);
                    }, 0);
                };
            }

            function ScContainerProxy(element, scope) {

                var positionUpdateQueue = [],
                    lastPosition,
                    currentPosition,
                    DIRECTION = {
                        HALT: 'sc_HALT',
                        DOWN: 'sc_DOWN',
                        UP: 'sc_UP'
                    };

                var calcPosition = function() {
                    var offset = element.offset(),
                        top = element.scrollTop() + (offset ? offset.top : 0);

                    //var pos = dimensions.verticalPosition(top + element.height(), top);
                    //if (_debug) console.info('scConteiner position height()', pos.top, pos.bottom);

                    // TODO: Temporary use innerHeight here due to jQuery bug with window height calculation in mobile Safari
                    var height = element[0].innerHeight || element.height();
                    var pos = dimensions.verticalPosition(top + height, top);

                    //if (_debug) console.info('scConteiner position calculated', pos.top, '<|--|', pos.bottom);

                    return pos;
                };

                var updatePosition = function() {
                    lastPosition = currentPosition;
                    currentPosition = calcPosition();
                };

                var refreshPosition = function() {
                    lastPosition = currentPosition = calcPosition();
                };

                var getDirection = function() {
                    var dir;
                    if (currentPosition.top > lastPosition.top) dir = DIRECTION.DOWN;
                    else if (currentPosition.top < lastPosition.top) dir = DIRECTION.UP;
                    else dir = DIRECTION.HALT;
                    return dir;
                    //return currentPosition.bottom >= lastPosition.bottom ? DIRECTION.DOWN : DIRECTION.UP;
                };

                lastPosition = currentPosition = calcPosition();

                var scrollHandler = _.throttle(function (evt) {

                    updatePosition();

                    if (_debug) {
                        console.info('scContainer scroll handler', evt,
                            'top', lastPosition.top, '->', currentPosition.top,
                            'bottom', lastPosition.bottom, '->', currentPosition.bottom,
                            'at', (new Date()).toISOString());
                    }

                    return $q.all(positionUpdateQueue.reduce(function (buf, fn) {
                            var res = (angular.isFunction(fn) ? fn : angular.noop)(currentPosition, lastPosition);
                            buf.push($q.when(res));
                            return buf;
                        }, []))
                        .then(function (res) {
                            eventBus.publish(SM_EVENTS.ON_FEED_VISIBLE_ZONE_CHANGED, { oldZone: lastPosition, zone: currentPosition });
                            return res;
                        });
                }, 200);

                var moveHandler = function(offset, callback, alignment) {

                    //TODO: because of chrome innerHeight update timeout while showing browser top bar
                    currentPosition = calcPosition();

                    var correctedOffset;

                    switch (alignment) {
                        case 'center':
                            correctedOffset = Math.floor(offset - currentPosition.height / 2);
                            break;
                        case 'bottom':
                            correctedOffset = Math.floor(offset - currentPosition.height);
                            break;
                        default:
                            //'top'
                            correctedOffset = offset;
                    }

                    if (_debug) console.info('scContainer is moving', element.scrollTop(), '->', correctedOffset);


                    // TODO: some browers do not update scrollTop instantly, in order to calc visible zones correctly, scrolling is delayed
                    $timeout(function () { element.scrollTop(correctedOffset); }, 0);
                    //element.scrollTop(correctedOffset);


                    if (angular.isFunction(callback)) return callback(currentPosition, lastPosition);

                    //element.animate(
                    //    { scrollTop: offset },
                    //    '200',
                    //    'swing',
                    //    function() {
                    //        if (angular.isFunction(callback)) callback(currentPosition, lastPosition);
                    //    });

                    return null;
                };

                element.on('scroll', scrollHandler);

                this.scope = scope;
                this.DIRECTION = DIRECTION;
                this.getPosition = function() {
                    return currentPosition;
                };
                this.getDirection = getDirection;
                this.onPositionUpdate = function(fn) {
                    positionUpdateQueue.push(fn);
                };
                this.offPositionUpdate = function(fn) {
                    var index = positionUpdateQueue.indexOf(fn);
                    if (index > 0) positionUpdateQueue.splice(index, 1);
                };

                this.move = function() {
                    return (scope.$$phase || (scope.$root || {}).$$phase ?
                        angularAdapter.deferDigest(this.scope, moveHandler, 1) :
                        moveHandler).apply(this, arguments);
                };

                this.freezePosition = function() {
                    element
                        .off('scroll', scrollHandler)
                        .addClass('sc-blocked');


                    if (_debug) {
                        console.info('scContainer freeze',
                            'current:', currentPosition.top, '<|--|', currentPosition.bottom,
                            'last:', lastPosition.top, '<|--|', lastPosition.bottom/* , 'item amount', $('.entry').length */);
                    }
                };
                this.releasePosition = function(forceRefresh) {
                    element
                        .on('scroll', scrollHandler)
                        .removeClass('sc-blocked');

                    if (forceRefresh) {
                        // IOS Safari returns correct scrollTop value only after a small delay from the last reflow
                        (true /* TODO: determine if IOS Safari */ ?
                            immediateTimeoutDecorator(refreshPosition) :
                            refreshPosition)();
                    }

                    if (_debug) {
                        console.info('scContainer released',
                            'current:', currentPosition.top, '<|--|', currentPosition.bottom,
                            'last:', lastPosition.top, '<|--|', lastPosition.bottom/* , 'item amount', $('.entry').length */);
                    }
                };

                var dispose = function() {
                    element
                        .off('scroll', scrollHandler)
                        .removeClass('sc-blocked')
                        .removeData(_dataKey);

                    positionUpdateQueue.length = 0;

                    if (_debug) console.info('ScContainerManager disposed on', element);
                };
                this.scope.$on('$destroy', function() {
                    dispose();
                });
            }

            function wrapElement(element) {
                if (!element.length || !element.scrollTop || !element.data) return angular.element(element);
                return element;
            }

            return {
                createProxy: function(element, scope) {
                    if (!angular.isObject(element)) throw new Error('Element is required.');
                    if (!angular.isObject(scope)) throw new Error('Scope is required.');

                    var wrappedEl = wrapElement(element);
                    if (angular.isObject(wrappedEl.data(_dataKey))) {
                        // manager on this element already exists
                        throw new Error('Element already has ScContainer proxy.');
                    }
                    var proxy = new ScContainerProxy(wrappedEl, scope);
                    wrappedEl.data(_dataKey, proxy);
                    return proxy;
                },
                getProxy: function(element) {
                    return wrapElement(element).data(_dataKey);
                }
            };
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .directive('scItem', [
        '$window',
        'pr.utils.angularAdapter',
        'sp.smartflow.internal.dimensions',
        'sp.common.eventBus',
        'pr.smartflow.common.events',
        'pr.smartflow.common.entryStates',
        'sp.smartflow.ui.scContainer.proxy',

        function ($window, angularAdapter, dimensions, eventBus, SM_EVENTS, ENTRY_STATES, scContainer) {

            'use strict';

            //var _debug = true;

            var stateCssMap = {};
            stateCssMap[ENTRY_STATES.VISIBLE] = 'sc-state-visible';
            stateCssMap[ENTRY_STATES.POTENTIALLY_VISIBLE] = 'sc-state-p-visible';
            stateCssMap[ENTRY_STATES.INVISIBLE] = 'sc-state-invisible';
            stateCssMap.list = _.reduce(stateCssMap, function(result, val) {
                return result.concat(result.length > 0 ? ' ' : '', val);
            }, '');


            function calcPosition(element) {
                var top = element.position().top;
                return dimensions.verticalPosition(top + element.height(), top);
            }

            function calcState(itemPosition, containerPosition) {
                var state;
                if (containerPosition.overlap(itemPosition)) {
                    state = ENTRY_STATES.VISIBLE;
                } else {
                    state = ENTRY_STATES.INVISIBLE;
                }
                return state;
            }

            function linkFn(scope, element, attrs, injectable) {

                var containerCtrl = injectable || scContainer.getProxy($window);
                var entry, itemPosition;

                if (!containerCtrl) throw new Error('sc-container (or proxy) is required');

                function trackItemPosition(containerPosition) {
                    if (!entry || !containerPosition) return;   // TODO: + warning

                    if (entry.state === ENTRY_STATES.ACTIVE) return;

                    itemPosition = calcPosition(element);

                    var oldState = entry.state;
                    entry.state = calcState(itemPosition, containerPosition);

                    entry.location.offset = containerPosition.top - itemPosition.top;

                    if (oldState !== entry.state) {
                        eventBus.publish(SM_EVENTS.ON_ENTRY_STATE_CHANGED, { entry: entry, oldState: oldState });
                    }
                }

                element.click(function() {
                    itemPosition = calcPosition(element);
                    containerCtrl.move(itemPosition.midpoint, null, 'center');
                });

                scope.$watch(attrs.scItemState, function (itemState/*, oldItemState*/) {
                    if (itemState === ENTRY_STATES.ACTIVE) {
                        angularAdapter.deferDigest(scope, function () {
                            itemPosition = calcPosition(element);
                            var offset = itemPosition.top;
                            if (entry.location && entry.location.offset) {
                                offset += entry.location.offset;
                            }
                            containerCtrl.move(offset);
                            entry.state = ENTRY_STATES.VISIBLE;
                        })();
                    }

                    element.removeClass(stateCssMap.list);
                    element.addClass(stateCssMap[itemState]);
                });

                scope.$watch(attrs.scItem, function (e) {
                    entry = e;
                    angularAdapter.deferDigest(scope, function () {
                        trackItemPosition(containerCtrl.getPosition());
                    })();
                });

                containerCtrl.onPositionUpdate(trackItemPosition);
                scope.$on('$destroy', function () {
                    containerCtrl.offPositionUpdate(trackItemPosition);
                });
            }

            return {
                restrict: 'A',
                require: '^?scContainer',
                link: linkFn,
            };
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .directive('sc', [
        '$q',
        '$window',
        '$rootScope',
        'pr.utils.angularAdapter',
        'sp.smartflow.internal.dimensions',
        'sp.smartflow.internal.qualifyStrategy',
        'sp.smartflow.ui.scContainer.proxy',
        function ($q, $window, $rootScope, angularAdapter, dimensions, qualifyStrategy, scContainer) {

            'use strict';

            var _debug = true;

            return {
                restrict: 'A',
                require: ['sc', '^?scContainer'],
                scope: {
                    blockOnEdge: '=scBlockOnEdge',
                    getNext: '&scGetNext',
                    getPrevious: '&scGetPrev',
                    bottomReached: '&scBottomReached',
                    topReached: '&scTopReached'
                },
                controller: function($scope, $element/* , $attrs */) {

                    function getPosition() {
                        var top = $element.scrollTop();
                        return dimensions.verticalPosition(top + $element.height(), top);
                    }

                    this.getPosition = getPosition;
                },
                link: function(scope, element, attrs, injectables) {

                    // helper decorators
                    var transactionPending = false;
                    function transactionDecorator(fn) {
                        return function() {
                            if (transactionPending) {
                                if (_debug) console.info('call attempt while pending', fn);
                                return null;
                            }
                            transactionPending = true;
                            var res = fn.apply(this, arguments);
                            $q.when(res)
                                .finally(function() {
                                    transactionPending = false;
                                });
                            return res;
                        };
                    }

                    var adjustmentPending = false;
                    function positionAdjustDecorator(fn) {
                        return function() {

                            if (adjustmentPending) return null;
                            adjustmentPending = true;

                            var oldHeight = scCtrl.getPosition().height,
                                oldContPos = containerCtrl.getPosition();

                            return $q.when(fn.apply(this, arguments))
                                .then(angularAdapter.deferDigest(scope, function(result) {
                                    var newHeight = scCtrl.getPosition().height,
                                        distance = newHeight - oldHeight;
                                    if (distance !== 0) containerCtrl.move(oldContPos.top + distance);

                                    if (_debug) console.info('position adjusted', oldHeight, '->', newHeight, distance);

                                    adjustmentPending = false;

                                    return result;
                                }, 1));
                        };
                    }

                    function boundReachedDecorator(fn, continueFn) {
                        return function boundReached() {
                            var self = this, args = Array.prototype.slice.call(arguments);
                            var deferRes;
                            if (scope.blockOnEdge) {
                                containerCtrl.freezePosition();
                                deferRes = $q.when(fn.apply(self, args))
                                    .then(angularAdapter.deferDigest(scope, function (result) {
                                        containerCtrl.releasePosition();
                                        return result;
                                    }, 1));
                            } else {
                                deferRes = $q.when(fn.apply(self, args));
                            }
                            return deferRes
                                .then(function () {
                                    return $q.when(continueFn.apply(self, args));
                                });
                        };
                    }

                    var scCtrl = injectables[0], containerCtrl;

                    // if no scroller container provided, create container proxy on window element
                    if (!injectables[1]) {
                        var containerScope = $rootScope.$new();
                        containerCtrl = scContainer.createProxy($window, containerScope);

                        scope.$on('$destroy', function () {
                            containerScope.$destroy();
                        });
                    } else {
                        containerCtrl = injectables[1];
                    }

                    var topRangeEntered = transactionDecorator(positionAdjustDecorator(scope.getPrevious));
                    scope.$watch('getPrevious', function(getPrevious) {
                        topRangeEntered = transactionDecorator(positionAdjustDecorator(getPrevious));
                    });

                    var onBottomRangeEntered = transactionDecorator(scope.getNext);
                    scope.$watch('getNext', function(getNext) {
                        onBottomRangeEntered = transactionDecorator(getNext);
                    });

                    var topReachedHandler = boundReachedDecorator(scope.topReached, topRangeEntered);
                    var bottomReachedHandler = boundReachedDecorator(scope.bottomReached, onBottomRangeEntered);

                    var upStrategy = qualifyStrategy.make(
                        // TopReached strategy
                        qualifyStrategy.concrete(
                            function (containerPosition, position) {
                                return containerPosition.top - position.top <= 1;
                            },
                            function () {
                                if (_debug) console.info('TopReached strategy qualified');
                                return topReachedHandler.apply(this, arguments);
                            }
                        ),

                        // TopRangeEntered strategy
                        qualifyStrategy.concrete(
                            function (containerPosition, position) {
                                // TODO: range distance might be set up through directive attributes
                                return containerPosition.top - position.top <= containerPosition.height;
                            },
                            function () {
                                if (_debug) console.info('TopRangeEntered strategy qualified');
                                return topRangeEntered.apply(this, arguments);
                            }
                        ));

                    var downStrategy = qualifyStrategy.make(
                        // BottomReached strategy
                        qualifyStrategy.concrete(
                            function (containerPosition, position) {
                                return position.bottom - containerPosition.bottom <= 1;
                            },
                            function () {
                                if (_debug) console.info('BottomReached strategy qualified');
                                return bottomReachedHandler.apply(this, arguments);
                            }
                        ),

                        // BottomRangeEntered strategy
                        qualifyStrategy.concrete(
                            function (containerPosition, position) {
                                // TODO: range distance might be set up through directive attributes
                                return position.bottom - containerPosition.bottom <= containerPosition.height;
                            },
                            function () {
                                if (_debug) console.info('BottomRangeEntered strategy qualified');
                                return onBottomRangeEntered.apply(this, arguments);
                            }
                        ));

                    containerCtrl.onPositionUpdate(function trackPosition(containerPosition, oldContainerPosition) {

                        var position = scCtrl.getPosition(),
                        direction = containerCtrl.getDirection();

                        if (_debug) {
                            console.info('sc onPositionUpdate: sc position', position.top, '<|--|', position.bottom);
                            console.info('sc onPositionUpdate:',
                                'scContainer position', containerPosition.top, '<|--|', containerPosition.bottom,
                                'old', oldContainerPosition.top, '<|--|', oldContainerPosition.bottom,
                                'direction', direction);
                        }

                        if (direction === containerCtrl.DIRECTION.HALT) {
                            if (_debug) console.info('scroll direction HALT skipped');
                            return null;
                        }

                        return (direction === containerCtrl.DIRECTION.DOWN ? downStrategy : upStrategy)
                            .execQualified(containerPosition, position);
                    });

                }
            };
        }
    ]);

/**
 * Measures reference element used as basis for article (possibly not only them) layout building.
 * Dont use it unless you understand, what you are doing!!
*/
angular
    .module('sp.smartflow.ui')
    .directive('prSmartflowBasis', [
        '$window',
        'sp.smartflow.internal.dimensions',
        function($window, dimensions) {

            'use strict';

            var _debug = true;

            var refs = {
                //entry: '#__pb_ref__entry',
                column: '#__pb_ref__col',
                blockMax: '#__pb_ref__block',
                line: '#__pb_ref__line'
            };

            function getSize(elm) {
                return dimensions.size(Math.floor(elm.width()), Math.floor(elm.height()));
            }

            return {
                restrict: 'A',
                scope: {
                    basis: '=prSmartflowBasis',
                    viewportPart: '=prBasisPart'
                },
                link: function(scope, element/* , attrs */) {

                    var wndw = angular.element($window);

                    var updateBasis = function updateBasisHandler(vpPart) {
                        var oldBasis = angular.copy(scope.basis);
                        var windowPart = (parseInt(vpPart) || 100) / 100;
                        element.height(Math.floor($window.innerHeight * windowPart));

                        _.forEach(refs, function(id, propName) {
                            scope.basis[propName] = getSize(element.find(id));
                        });

                        scope.basis.blockMax.height -= scope.basis.blockMax.height % scope.basis.line.height;

                        if (_debug) console.info('basis updated', oldBasis, '->', scope.basis);
                        if (_debug) window.__b = scope.basis;
                    };

                    var sizeChangedHandler = _.debounce(function(/* evt */) {
                        // TODO: consider browsers quirks of handling orientationchange event
                        updateBasis(scope.viewportPart);
                        if (!scope.$$phase && !scope.$root.$$phase) scope.$apply();
                    }, 100);

                    // TODO: tracking window.innerHeight is only needed for IOS devices;
                    (true /* TODO: determine if IOS Safari */ ?
                        function() {
                            var innerHeightWatcher = {
                                last: $window.innerHeight,
                                watchFn: function() {
                                    return $window.innerHeight;
                                },
                                listenerFn: function(inner, oldInner) {
                                    if (Math.abs(inner - oldInner) <= 1) return;
                                    sizeChangedHandler();
                                    if (_debug) console.info('basis window innerHeight watcher', oldInner, '->', inner);
                                }
                            };
                            function innerHeightDigest() {
                                var newVal = innerHeightWatcher.watchFn(),
                                    oldVal = innerHeightWatcher.last;
                                if (newVal !== oldVal) innerHeightWatcher.listenerFn(newVal, oldVal);
                                innerHeightWatcher.last = newVal;
                            }
                            var timerId = setInterval(innerHeightDigest, 100);
                            scope.$on('$destroy', function() {
                                clearInterval(timerId);
                            });
                        } : angular.noop)();

                    wndw.on('resize orientationchange', sizeChangedHandler);
                    scope.$watch('viewportPart', updateBasis);
                    scope.$on('$destroy', function() {
                        wndw.off('resize', sizeChangedHandler);
                        wndw = null;
                    });
                }
            };
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .directive('prEntry', [
        'sp.smartflow.meta.type',

        function(META_TYPE) {

            'use strict';

            return {
                restrict: 'A',
                templateUrl: 'entry.html',
                scope: {
                    entry: '=prEntry',
                    basis: '=prArtBasis',
                    state: '=prState'
                },
                controller: function($scope/* , $element, $attrs */) {
                    $scope.META_TYPE = META_TYPE;
                },
                link: function(/* scope, element, attrs */) {
                }
            };
        }]);



// TODO: history manipulations should be sc-item or pr-entry directive responsibility

angular
    .module('sp.smartflow.ui')
    .directive('prFeedArticle', [
        'pr.smartflow.common.entryStates',
        'pr.smartflow.common.events',
        'sp.smartflow.ui.layoutType',
        'sp.common.eventBus',

        function(ENTRY_STATES, SM_EVENTS, LAYOUT_TYPE, eventBus) {

            'use strict';

            var _debug = false;

            return {
                restrict: 'A',
                templateUrl: 'feedArticle.html',
                scope: {
                    article: '=prFeedArticle',
                    state: '=prState',
                    artBasis: '=prArtBasis'
                },
                controller: function($scope) {
                    $scope.columnAmount = 0;
                    $scope.layoutType = LAYOUT_TYPE.PREVIEW;
                    $scope.preview = true;
                    $scope.canBeExpanded = true;
                },
                link: function(scope/* , element, attrs */) {

                    scope.$watch('state', function(state, oldState) {
                        if (_debug) console.info('attrs.state watcher', oldState, '->', state);
                        if (state === ENTRY_STATES.INVISIBLE && (oldState === ENTRY_STATES.VISIBLE || oldState === ENTRY_STATES.POTENTIALLY_VISIBLE)) {
                            // item moved out of visible zone
                            // make layout to shrink to a single column
                            if (scope.layoutType === LAYOUT_TYPE.EXPANDED) {
                                scope.layoutType = LAYOUT_TYPE.SHRINKED;
                            }
                        } else if (state === ENTRY_STATES.VISIBLE && oldState !== ENTRY_STATES.VISIBLE) {
                            // item moved into visible zone
                            eventBus.publish(SM_EVENTS.ON_ENTRY_STATE_CHANGED, { entries: scope.article });
                        }
                    });

                    scope.expand = function(evt) {
                        console.info('expand click', evt);
                        scope.preview = false;
                        scope.layoutType = LAYOUT_TYPE.EXPANDED;
                        scope.canBeExpanded = false;
                    };

                },

            };
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .directive('prArtPreview', [
        'sp.smartflow.internal.dimensions',
        'sp.smartflow.internal.qualifyStrategy',

        function ArticlePreviewDirective(dimensions, strategyFactory) {

            'use strict';

            var _debug = false;

            function hasImages(article) {
                return article.content.images && article.content.images.length > 0;
            }

            /**
             * Creates simple title model.
             * @param {!Object} article Article source object.
             *        {!Object} article.content Article content object.
             * @returns {Object} New title model object.
            */
            function getTitleModel(article) {
                return {
                    title: article.content.title,
                    subtitle: article.content.subtitle,
                    byline: article.content.byline,
                    issueTitle: article.content.issue.title,
                    issueDate: article.content.issue.shortDateString,
                    issueId: article.content.issue.id,
                    similarsCount: article.content.similarsCount,
                    pageName: article.content.pageName
                };
            }

            /**
             * Creates simple image model.
             * @param {!Object} article Article source object.
             * @param {!Object} article Article source object.
             * @returns {Object} New title model object.
            */
            function getImageModel(article, basis) {

                function getScale(needed, original) {
                    var MAX_SCALE = 4;  // TODO: to config
                    return Math.round(Math.min(needed / original, MAX_SCALE) * 100);
                }

                function heightComparer(a, b) {
                    return (Math.abs(a.size.height - basis.blockMax.height / 3) > Math.abs(b.size.height - basis.blockMax.height / 3));
                }

                function widthFilter(img) {
                    return basis.line.width - img.size.width < 10;
                }

                function heightFilter(img) {
                    return (img.size.height <= basis.blockMax.height - basis.line.height * 2) &&
                        (img.size.height >= basis.line.height * 2);
                }

                if (!hasImages(article)) return null;

                var images = article.content.images;
                var models = images.map(function(imgData) {
                    var scale = getScale(basis.line.width, imgData.width);
                    return {
                        size: dimensions.size(Math.floor(imgData.width * scale / 100), Math.floor(imgData.height * scale / 100)),
                        src: imgData.url + '&scale=' + scale,
                        byline: imgData.byline,
                        caption: (imgData.text || {}).text,
                        //origin: imgData
                    };
                });

                models = models.filter(widthFilter).filter(heightFilter);

                if (models.length === 0) return null;

                models.sort(heightComparer);
                return models[0];
            }

            function linkFn(scope/* , element, attrs */) {

                function updateExpandAvailability() {
                    var article = scope.article;

                    if (!scope.title) scope.expandAvailable = true;

                    if (hasImages(article) && (!scope.image || article.content.images.length > 1)) {
                        scope.expandAvailable = true;
                    }
                    var textBlocks = article.content.blocks || [];
                    if (textBlocks.length > 0 && (!scope.textBlock || textBlocks.length > 1)) {
                        scope.expandAvailable = true;
                    }
                    return scope.expandAvailable;
                }

                var builders = {
                    stock: function fullBuild(basis) {

                        var article = scope.article;

                        scope.title = getTitleModel(article);

                        var image = getImageModel(article, basis);
                        if (image) {
                            scope.image = image;
                            scope.imageStyle = {
                                width: image.size.width,
                                height: image.size.height
                            };
                        }

                        if (article.content.blocks && (!image || image.size.height < basis.blockMax.height / 5)) {
                            scope.textBlock = article.content.blocks[0];
                            scope.textBlockStyle = {
                                'max-height': basis.line.height * 5
                            };
                        }
                        updateExpandAvailability();
                    },
                    tidyUp: function(basis, oldBasis) {
                        var image = scope.image;

                        if (!image) return;

                        if (basis.blockMax.isWider(oldBasis.blockMax)) {
                            delete scope.imageStyle['max-width'];
                            scope.imageStyle['margin-left'] = scope.imageStyle['margin-right'] = 'auto';
                        } else {
                            delete scope.imageStyle['margin-left'];
                            delete scope.imageStyle['margin-right'];
                            scope.imageStyle['max-width'] = basis.blockMax.width;
                        }
                    }
                };

                var widthChangeConcreteStrategy = strategyFactory.concrete(
                    function basisWidthChanged(basis, oldBasis) {
                        var result = _.reduce(basis, function(changed, fragment, fragmentName) {
                            return changed || fragment.width !== (oldBasis[fragmentName] || {}).width;
                        }, false);

                        if (_debug && result) console.info('art preview widthChangeStrategy qualified', oldBasis, '->', basis);

                        return result;
                    },
                    builders.tidyUp
                ),
                sufficientHeightDiffConcreteStrategy = strategyFactory.concrete(
                    function basisHeightChanged(basis, oldBasis) {
                        var insignificantPart = 0.2; // TODO: to config
                        var result = Math.abs(basis.blockMax.height - oldBasis.blockMax.height) / basis.blockMax.height > insignificantPart;

                        if (_debug && result) console.info('art preview sufficientHeightDiffStrategy qualified', oldBasis, '->', basis);

                        return result;
                    },
                    builders.stock
                );
                var strategy = strategyFactory.make(widthChangeConcreteStrategy, sufficientHeightDiffConcreteStrategy);

                scope.$watch('basis', function(basis, oldBasis) {
                    if (_debug) console.info('article preview basis watcher', oldBasis, '->', basis);
                    strategy.execQualified(basis, oldBasis);
                }, true);

                builders.stock(scope.basis);
            }

            return {
                restrict: 'A',
                templateUrl: 'articlePreview.html',
                transclude: true,
                scope: {
                    article: '=prArtPreview',
                    basis: '=prArtBasis',
                    expandAvailable: '=prArtCanExpand'
                },
                link: linkFn
            };
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .directive('prArtFull', [
        'sp.smartflow.internal.dimensions',
        'sp.smartflow.internal.qualifyStrategy',
        'sp.smartflow.ui.layoutType',

        'sp.smartflow.ui.articleModel',
        'sp.smartflow.ui.articleColumnLayout',

        function(dimensions, qualifyStrategy, LAYOUT_TYPE, articleModel, articleColumnLayout) {

            'use strict';

            //var _debug = true;

            function updateTotalSise(elm, size) {
                var style = {
                    width: '',
                    height: ''
                };
                if (size) {
                    style.width = size.width;
                    style.height = size.height;
                }
                elm.css(style);
            }

            function artFullLink(scope, element/* , attrs */) {

                function builsStockLayout() {

                    if (buildPromise) return buildPromise;

                    var model = articleModel.make(scope.articleSource, scope.basis);

                    scope.cachedColumns.splice(0);

                    buildPromise = articleColumnLayout.buildColumns(model, null)
                        .then(function(cols) {
                            scope.columns.push.apply(scope.columns, cols);
                            return articleColumnLayout.buildColumns(model, scope.columns, LAYOUT_TYPE.EXPANDED);
                        })
                        .then(function(cols) {
                            scope.columns.splice(0);
                            scope.columns.push.apply(scope.columns, cols);
                        })
                        .finally(function() {
                            buildPromise = null;
                        });

                    return buildPromise;
                }

                var buildPromise = null;

                scope.columns = [];
                scope.cachedColumns = [];

                scope.$watch('basis', function(/* basis, oldBasis */) {
                    if (scope.layoutType === LAYOUT_TYPE.EXPANDED) {
                        builsStockLayout();
                    }
                });

                scope.$watch('layoutType', function(layoutType, oldLayoutType) {
                    if (layoutType === LAYOUT_TYPE.SHRINKED && oldLayoutType === LAYOUT_TYPE.EXPANDED) {
                        scope.cachedColumns = scope.columns.splice(1);
                    }
                    else if (layoutType === LAYOUT_TYPE.EXPANDED && oldLayoutType === LAYOUT_TYPE.SHRINKED) {
                        scope.columns.push.apply(scope.columns, scope.cachedColumns.splice(0));
                    }
                    else if (layoutType === LAYOUT_TYPE.EXPANDED) {
                        builsStockLayout();
                    }
                });

                scope.$watch('cachedColumns.length', function(cachedColumnsLen) {
                    if (buildPromise) return;
                    scope.expandAvailable = cachedColumnsLen > 0;
                });

                scope.$watchCollection('columns', function(columns) {
                    if (buildPromise) return;
                    scope.columnAmount = columns.length;
                    var totalSize = scope.columns.reduce(function(total, col) {
                        total.height = Math.max(total.height, col.size.height);
                        total.width += col.size.width;
                        return total;
                    }, dimensions.size(0, 0));

                    if (totalSize.height === scope.basis.blockMax.height) totalSize.height = scope.basis.column.height;

                    updateTotalSise(element, totalSize.width !== 0 && totalSize.height !== 0 ? totalSize : null);

                    if (scope.columnAmount > 1) {
                        element.parents('.art-wrapper').addClass('art-expanded');
                    } else {
                        element.parents('.art-wrapper').removeClass('art-expanded');
                    }
                });
            }

            return {
                restrict: 'A',
                templateUrl: 'articlefull.html',
                transclude: true,
                scope: {
                    articleSource: '=prArtFull',
                    basis: '=prArtBasis',
                    layoutType: '=prLayoutType',
                    columnAmount: '=prColumnAmount',
                    expandAvailable: '=prArtCanExpand'
                },
                link: artFullLink
                //link: function(scope, element, attrs) {
                //    var a = scope;
                //    function updateTotalSize() {
                //        totalSize = scope.columns.reduce(function(buf, col) {
                //            buf.height = Math.max(buf.height, col.size.height);
                //            buf.width += col.size.width;
                //            return buf;
                //        }, dimensions.size(0, 0));

                //        if (isNaN(totalSize.width) || isNaN(totalSize.height)) {
                //            console.warn('totla size is incorrect', totalSize);
                //        }

                //        scope.$parent.artStyle = {
                //            width: totalSize.width,
                //            height: totalSize.height
                //        };
                //    }

                //    function insertColumns(newColumns) {
                //        scope.columns.push.apply(scope.columns, (newColumns || []).splice(0));

                //        if (scope.columns.length <= 1) {
                //            scope.disableSlider = true;
                //            //scope.$parent.disableSlider = true;
                //            element.parents('.art-wrapper').removeClass('art-expanded');
                //        } else {
                //            //scope.$parent.disableSlider = false;
                //            element.parents('.art-wrapper').addClass('art-expanded');
                //        }
                //    }

                //    //scope.columns = [];
                //    scope.columns.splice(0);
                //    var buildedColumns = null, totalSize= null, measured = false;

                //    scope.$watch('layoutType', function(layoutType, oldLayoutType) {

                //        if (layoutType === layoutStates.expanded) {
                //            if (measured) {
                //                insertColumns(buildedColumns);
                //                updateTotalSize();
                //            } else {
                //                basisService.get()
                //                    .then(function(basis) {
                //                        var model = artModelFactory.make(scope.article, basis);
                //                        articleColumnLayout.buildColumns(model, null, layoutStates.init)
                //                            .then(function(cols) {
                //                                //scope.columns = cols;
                //                                scope.columns.push.apply(scope.columns, cols);
                //                                measured = true;
                //                                return articleColumnLayout.buildColumns(model, cols, layoutStates.expanded)
                //                                    .then(function(cls) {
                //                                        //scope.columns = [];
                //                                        scope.columns.splice(0);
                //                                        insertColumns(cls);
                //                                        updateTotalSize();
                //                                    });
                //                            });
                //                    });
                //            }

                //        } else if (layoutType === layoutStates.shrinked) {
                //            if (!measured || scope.columns.length === 0) return;
                //            buildedColumns = scope.columns.splice(1);
                //            insertColumns();
                //            updateTotalSize();
                //        }
                //    });
                //}
            };
        }
    ]);
angular
    .module('sp.smartflow.ui')
    .directive('prArtBlock', ['$q', '$timeout', 'sp.smartflow.ui.articleBlockTypes',
        function ($q, $timeout, blockTypes) {

            'use strict';

            var templates = {
                title:
                    '<header class="art-title" ng-if="title" pr-block-size-it="model">' +
                        '<ul class="art-byline">' +
                            '<li class="art-source">' +
                                '<a href="javascript:void(0);" sp-bind-once="model.originalData.issue.title"></a>' +
                            '</li>' +
                            '<li class="art-date">' +
                                '<a href="javascript:void(0);">' +
                                    '<time datetime="{{model.originalData.issue.shortDateString}}" pubdate sp-bind-once="model.originalData.issue.shortDateString"></time>' +
                                '</a>' +
                            '</li>' +
                            '<li class="art-similar" ng-if="model.originalData.similarsCount > 0">' +
                                '<a href="javascript:void(0);">' +
                                    '<span sp-bind-once="\'+\' + model.originalData.similarsCount + \' MORE\'"></span>' +
                                '</a>' +
                            '</li>' +
                            '<li class="art-page" sp-bind-once="model.originalData.pageName"></li>' +
                            '<li class="art-author" sp-bind-once="model.originalData.byline"></li>' +
                            '<li class="art-tools-call"><a href="javascript:void(0);"><em>Article tools</em></a></li>' +
                        '</ul>' +

                        '<hgroup ui-sref="issues.pagesView({issue: \'{{model.issueId}}\' })" ng-click="$event.stopPropagation()">' +
                            '<h1 sp-bind-once="model.originalData.title"></h1>' +
                            '<h2 ng-if="model.originalData.subtitle" sp-bind-once="model.originalData.subtitle"></h2>' +
                        '</hgroup>' +

                    '</header>',
                image:
                    '<figure class="art-pic" ng-if="image" pr-block-size-it="model" ng-show="model.visible">' +
                        '<a href="javascript:void(0);">' +
                            '<img alt="" ng-src="{{model.src}}" ng-style="model.imageSize">' +
                            '<em></em>' +
                        '</a>' +
                        '<figcaption ng-show="model.captionEnabled" sp-bind-once="model.originalData.text.text"></figcaption>' +
                    '</figure>',
                text:
                    '<div class="art-text" ng-if="text" pr-block-size-it="model" ng-style="style">' +
                        '<p ng-style="model.offset" sp-bind-once="model.originalData.text"></p>' +
                    '</div>',
                filler:
                    '<div class="filler" ng-style="model.filler"></div>'
            };


            return {
                restrict: 'A',
                scope: {
                    model: '= prArtBlock',
                },
                //require: '^?prSizeMeasure',
                template:
                        templates.title + templates.image + templates.text + templates.filler,
                link: function (scope/* , element, attr, bSizeCtrl */) {
                    scope.$watch('model', function (model) {
                        //console.info('article block watcher', model);

                        if (!angular.isObject(model)) return;

                        var existedType = false;
                        angular.forEach(blockTypes, function (value, key) {
                            if (value === model.type) scope[key] = existedType = true;
                        });
                        if (!existedType) scope['dummy'] = true;    /*jshint ignore:line*/

                        if (angular.isObject(model.size)) {
                            scope.style = {
                                width: model.size.width,
                                height: model.size.height
                            };
                        }
                    });

                }
            };
        }]);

// TODO: allow external code to manage:
//       * swipe speed factor
//       * the minimum part of child width which is enough for transition to the next child;
//       * transition properties (timing function etc.)
//       * deflection angle

//       * sliding should consider initial offset of the element being animated

// TODO: right alignment is not very precise so far, investigate and fix

/**
 * Adds slider effect to the element. Requires Hammer.js.
 * @param {string} prSlider CSS filter to apply slider effect to.
 * @example '<article pr-slider="\'.art-col\'"><div class="art-col"></div><div class="art-col"></div></article>' +
*/
angular
    .module('sp.smartflow.ui')
    .directive('prSlider', ['prHammer', 'sp.smartflow.internal.dimensions',
        function SliderDirective(Hammer, dimensions) {



            'use strict';

            // Default event manager options
            var defaultEventMgrOptions = {
                'prevent_default': false,
            },
            // Preset transitions
            transitionPresets = {
                immediate: {
                    'transition-property': 'none',
                    'transition-duration': '0s',
                    'transition-timing-function': 'ease',
                    'transition-delay': '0s',
                },
                smooth: {
                    'transition-property': 'all',
                    'transition-duration': '500ms',
                    'transition-timing-function': 'cubic-bezier(0.33, 0.66, 0.66, 1)',
                    //'transition-timing-function': 'ease',
                    'transition-delay': '0s',
                }
            },
            ALIGNMENT = {
                LEFT: 'left',
                RIGHT: 'right',
                CENTER: 'center'
            },

            // TODO: accept all three in the directive options

            // Choosing the closest to the real left border child 
            // means that in order to move to the next one, user should drag through half or more of the current child's width,
            // otherwise the slider will stick to the same child.
            // In order to avoid this unwanted "rubber"- effect, when choosing is made
            // the reference border is virtually moved left or right for hysteresisPart * averageChildWidth of average child width according to the gesture direction.
            hysteresisPart = 0.20,

            // The angle range (if measured from 0 and 180 degrees) where a gesture is considered meaningful for slider, if it closer to vertical axis the gesture is not handled.
            deflectionAngle = 60,

            // Velocity factor to make the sliding effect smoother.
            velocityFactor = 1;

            /**
             * Creates Hammer event manager with appropriate recognizers (since Hammer 2.*).
             * @param {DOMElement} elm Element to chreate manager for.
             * @param {?Object} options Event manager options. If undefined default options will be used.
             * @returns {Object} Hammer Manager.
            */
            function createEventManager(elm, options) {
                var swipe = new Hammer.Swipe({
                    direction: Hammer.DIRECTION_HORIZONTAL,
                    velocity: 0.3
                });

                var pan = new Hammer.Pan({
                    direction: Hammer.DIRECTION_HORIZONTAL
                });

                options = options || defaultEventMgrOptions;
                var eventMgr = new Hammer.Manager(elm, angular.copy(options));
                swipe.recognizeWith(pan);

                // In Hammer 2.* event firing order depends on the order recognizers were added in, which is not very obvious behavior.
                // If swipe recognizer was added after pan recognizer, swipe* evens would be fired after all of the pan* events, including 'panend'.
                eventMgr.add([swipe, pan]);
                return eventMgr;

                // Manager with default configuration
                //return Hammer(elm, options);
            }

            /**
             * Determines the relative left offset of the element.
             * @param {DOMElement|jQuery} elm Element reference.
             * @returns {number} Relative left offset.
            */
            function getLeftRelative(elm) {
                if (!elm.offset) elm = angular.element(elm);
                return Math.round(elm.offset().left - elm.parent().offset().left);
            }

            /**
             * Determines the position of the element given.
             * @param {DOMElement|jQuery} elm Element to find position.
             * @param {?boolean} forceInner Force using inner width
             * @returns {dimensions.horisontalRange} Position of the element
            */
            function getPosition(element, forceInner) {
                if (!element.offset) element = angular.element(element);
                var left = element.offset().left + (forceInner ? parseInt(element.css('padding-left')) : 0);
                var width = forceInner ? element.width() : element.outerWidth(true);

                return dimensions.horisontalPosition(Math.round(left), Math.round(left + width));
            }

            /**
             * Creates an object which contains translate3d definition.
             * @param {?number} x-axis transformation.
             * @param {?number} y-axis transformation.
             * @param {?number} z-axis transformation.
             * @returns {Object} Definition object
            */
            function getTransformDefinition(x, y, z) {
                return {
                    transform: 'translate3d(' + (x || 0) + 'px, ' + (y || 0) + 'px, ' + (z || 0) + 'px)',
                };
            }

            /**
             * Applies CSS tranformation with optional transition to the element given.
             * @param {jQuery} elm Element reference.
             * @param {?Object} transform Object contains translation definitions.
             * @param {?Object} transition Object contains transition definitions. If undefined the immediate preset will be used.
             * @returns {jQuery} Element reference for chaining.
            */
            function applyTransform(elm, transform, transition) {
                return elm.css(angular.extend({}, transform, transition || transitionPresets.immediate));
            }

            /**
             * Aligns element, which represents slider to one of its children items.
             * @param {dimensions.horisontalRange} itemPosition Position of the item to align to.
             * @param {dimensions.horisontalRange} sliderPosition Position of the slider.
             * @param {dimensions.horisontalRange} sliderContainerPosition Position of the slider container.
             * @param {jQuery} element Slider element.
             * @param {?ALINGMENT} alignment Alignment definition.
             * @param {?Object} transitionDef Transition definition.
            */
            function moveTo(itemPosition, sliderPosition, sliderContainerPosition, element, alignment, transitionDef) {
                if (!angular.isObject(itemPosition)) throw new Error('Item position is required');
                if (!angular.isObject(sliderPosition)) throw new Error('Slider position is required');
                if (!angular.isObject(sliderContainerPosition)) throw new Error('Slider container position is required');

                if (alignment == undefined) alignment = ALIGNMENT.LEFT; /* jshint ignore:line */

                var offset = alignment === ALIGNMENT.LEFT ?
                    sliderPosition.left - itemPosition.left :
                    sliderPosition.left + sliderContainerPosition.right - itemPosition.right;

                applyTransform(element, getTransformDefinition(offset), transitionDef);
            }


            // DEBUG helpers
            /*
            function unhighlightChildren(elm, childFilter) {
                return elm.children(childFilter).css('background-color', '');
            }

            function highlightChild(elm, childFilter, index) {
                return unhighlightChildren(elm, childFilter)
                    .eq(index).css('background-color', 'pink');
            }

            function logEvent(evt) {
                console.info(evt.type, parseInt(evt.angle), evt);
            }

            */

            /**
             * Decorator: prevents event handler execution if event angle is within deflection range.
             * @param {Function<event>} fn Original event handler.
             * @returns {Function<event>} Decorated function.
            */
            function deflectionDecorator(fn) {
                return function(evt) {
                    var gestureAbsAngle = Math.abs(evt.angle);
                    if (gestureAbsAngle > deflectionAngle && gestureAbsAngle < 180 - deflectionAngle) {
                        console.info(evt.type, 'has been deflected, angle', evt.angle);
                        return undefined;
                    } else {
                        evt.preventDefault();
                        return fn.call(this, evt);
                    }
                };
            }

            return {
                restrict: 'A',
                link: function(scope, element, attr) {

                    function transitionEndHandler() {
                        applyTransform(element, null, transitionPresets.immediate);
                        element.off('transitionend', transitionEndHandler);
                        //console.info('transitionend fired');
                    }

                    var itemFilter = '',
                        initialOffset = /* element.offset().left */0,   //TODO: consider posssible initial non null offset
                        alignTo = ALIGNMENT.LEFT,
                        gestureStartOffset = null,
                        gestureDirection = Hammer.DIRECTION_NONE,
                        isSwiped = false;
                    //var evtMgrOptions = {};
                    var eventMgr = null;

                    var dragStart = deflectionDecorator(function(/* evt */) {
                        element.off('transitionend', transitionEndHandler);
                        gestureStartOffset = getLeftRelative(element);
                        //console.info('gesture start at ', gestureStartOffset);
                    });

                    var dragProcess = function(evt) {
                        if (gestureStartOffset === null) {
                            //console.warn('attempt to process gesture before start');
                            return;
                        }
                        gestureDirection = evt.direction;

                        var sliderContainerPosition = getPosition(element.parent(), true),
                            sliderPosition = getPosition(element, true),
                            extraOffset = sliderContainerPosition.width - sliderContainerPosition.intersection(sliderPosition).width;

                        if (extraOffset > sliderContainerPosition.width * hysteresisPart)
                            return;

                        var offset = Math.round(gestureStartOffset + evt.deltaX);
                        applyTransform(element, getTransformDefinition(offset), transitionPresets.immediate);
                    };

                    var dragEnd = function(evt) {

                        //console.info('gesture end at ', gestureStartOffset + evt.deltaX);
                        var sliderContainerPosition = getPosition(element.parent(), true),
                            sliderPosition = getPosition(element, true),
                            sliderItemsPositions = [];

                        angular.forEach(element.children(itemFilter), function(child) {
                            sliderItemsPositions.push(getPosition(child));
                        });

                        var virtualDisplacement = 0;

                        if (isSwiped) {
                            // Calculations are simplified as if we are dealing with a uniform acceleration.
                            var time = parseInt(transitionPresets.smooth['transition-duration']) || 0;
                            virtualDisplacement = Math.floor(evt.velocityX * velocityFactor * time / 2);
                        }

                        sliderContainerPosition.move(virtualDisplacement);

                        var overlappingPositions = sliderItemsPositions.filter(function(p) {
                            return sliderContainerPosition.overlap(p);
                        });

                        var transitTo;

                        if (overlappingPositions.length === 0) {

                            transitTo = gestureDirection === Hammer.DIRECTION_LEFT ?
                                sliderItemsPositions[sliderItemsPositions.length - 1] :
                                sliderItemsPositions[0];

                        } else if (overlappingPositions.length === 1) {
                            transitTo = overlappingPositions[0];
                        } else {
                            var candidate, overlay;

                            // TODO: these nested conditions might be flatted
                            if (alignTo === ALIGNMENT.LEFT) {

                                candidate = overlappingPositions[0];

                                if (gestureDirection === Hammer.DIRECTION_LEFT) {
                                    overlay = dimensions.horisontalPosition(candidate.left, sliderContainerPosition.left);
                                    transitTo = overlay.width > candidate.width * hysteresisPart ?
                                        sliderItemsPositions[sliderItemsPositions.indexOf(candidate) + 1] :
                                        candidate;
                                } else {
                                    overlay = sliderContainerPosition.intersection(candidate);

                                    if (overlay.width > candidate.width * hysteresisPart)
                                        transitTo = candidate;
                                    else
                                        transitTo = sliderItemsPositions[sliderItemsPositions.indexOf(candidate) + 1];
                                }

                            } else if (alignTo === ALIGNMENT.RIGHT) {

                                candidate = overlappingPositions[overlappingPositions.length - 1];

                                if (gestureDirection === Hammer.DIRECTION_LEFT) {
                                    overlay = sliderContainerPosition.intersection(candidate);
                                    transitTo = overlay.width > candidate.width * hysteresisPart ?
                                        candidate :
                                        sliderItemsPositions[sliderItemsPositions.indexOf(candidate) - 1];
                                } else {
                                    overlay = dimensions.horisontalPosition(sliderContainerPosition.right, candidate.right);
                                    transitTo = overlay.width > candidate.width * hysteresisPart ?
                                        sliderItemsPositions[sliderItemsPositions.indexOf(candidate) - 1] :
                                        candidate;
                                }
                            }
                        }

                        if (transitTo) {
                            var align = alignTo,
                                indexOfTransit = sliderItemsPositions.indexOf(transitTo);
                            if (indexOfTransit === sliderItemsPositions.length - 1) {
                                align = ALIGNMENT.RIGHT;
                            } else if (indexOfTransit === 0) {
                                align = ALIGNMENT.LEFT;
                            }
                            moveTo(transitTo, sliderPosition, sliderContainerPosition.move(-virtualDisplacement), element, align, transitionPresets.smooth);
                            element.on('transitionend', transitionEndHandler);
                        } else {
                            console.warn('Could not find slider item for transition');
                        }

                        gestureStartOffset = null;
                        gestureDirection = Hammer.DIRECTION_NONE;
                        isSwiped = false;
                    };

                    var swipeHandler = function(/* evt */) {
                        isSwiped = true;
                    };

                    var handlersMap = {
                        'panstart': [dragStart /* , logEvent */],
                        'panend': [dragEnd /* , logEvent */],
                        'panleft panright': [dragProcess /* , logEvent */],
                        'swipeleft swiperight': swipeHandler
                    };

                    scope.$watch(attr.prSlider, function(newItemsFilter) {
                        if (!angular.isString(newItemsFilter)) return;
                        itemFilter = newItemsFilter;
                        // TODO: if the filter is changed slider position should probably be recalculated.
                    });

                    scope.$watch(attr.prSliderDisable, function(disable) {
                        if (!disable) { // enable
                            if (!eventMgr) {
                                eventMgr = createEventManager(element[0], defaultEventMgrOptions);

                                angular.forEach(handlersMap, function(handlers, evtNames) {
                                    (angular.isArray(handlers) ? handlers : [handlers]).forEach(function(h) {
                                        eventMgr.on(evtNames, h);
                                    });
                                });
                            }

                        } else {    // disable
                            if (!eventMgr) return;

                            applyTransform(element, getTransformDefinition(initialOffset));

                            eventMgr.destroy();
                            eventMgr = null;
                        }
                    });

                    scope.$watch(attr.prSliderAlignTo, function(alignment) {
                        var valid = false;
                        angular.forEach(ALIGNMENT, function(val) {
                            valid = valid || val === alignment;
                        });
                        alignTo = valid ? alignment : ALIGNMENT.LEFT;
                    });

                    scope.$on('$destroy', function() {
                        if (eventMgr) {
                            element.off('transitionend', transitionEndHandler);

                            eventMgr.destroy();
                            eventMgr = null;
                        }
                    });
                }
            };
        }
    ]);
angular
    .module('sp.smartflow.ui')
    .directive('prBlockSize', function () {

        'use strict';

        function measureSize(element) {
            if (!angular.isObject(element)) throw new Error('Element is required and must be a jQuery');
            return [element.width(), element.height()];
        }

        return {
            controller: function ($scope, $element/* , $attrs */) {
                this.measure = function (model) {
                    if (!model || !model.setSize) throw new Error('Cannot measure size for model provided');
                    model.setSize(measureSize($element));
                };
            }
        };
    });

angular
    .module('sp.smartflow.ui')
    .directive('prBlockSizeIt', function () {

        'use strict';

        return {
            require: '^?prBlockSize',
            link: function (scope, element, attr, blockSizeCtrl) {
                var unreg = scope.$watch(attr.prBlockSizeIt, function (model) {
                    if (angular.isObject(model.size)) return;

                    blockSizeCtrl.measure(model);
                    unreg();
                });
            }
    };
    });

angular
    .module('sp.smartflow.ui')
    .constant('sp.smartflow.ui.layoutType', {
        PREVIEW: '_l_preview',
        EXPANDED: '_l_expanded',
        SHRINKED: '_l_shrinked',
        ERROR: '_l_error'
    });

angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.articleModel', [
        '$q',
        'sp.smartflow.ui.articleBlockTypes',
        'sp.smartflow.ui.articleBlockFactory',

        function ($q, blockTypes, blockFactory) {

            'use strict';

            // TODO: create base class for all entry models

            // TODO: allow creating objects with custom set of block types.

            function ArticleModel(entry, basis, options) {

                if (!angular.isObject(entry)) throw new Error('entry is required');
                if (!angular.isObject(basis)) throw new Error('basis is required');

                this.__id = '__art_model__' + parseInt(Math.random() * 0x1000000);

                this.options = angular.extend({}, this._defaultOptions, options);

                //this.size = {
                //    width: undefined,
                //    height: undefined
                //};

                var blockMap = {};
                angular.forEach(blockTypes, function (val) { blockMap[val] = []; });
                this.blockMap = blockMap;

                this.setBasis(basis);
                this.parse(entry);
            }

            angular.extend(ArticleModel.prototype, {
                _defaultCut: 't1',
                _defaultOptions: {
                    //blockTypes: blockTypes,
                    //titleFamily: ['a1', 'a2', 'a3', 'a4']
                    titleFamily: ['a1']
                    //imageNumber:
                    //basis:
                },
                _configureDescriptions: function () {
                    // Might be different depends on this.cut;
                    // TODO: implement different strategies.

                    var newTitleFamily = this.options.titleFamily,
                        newImages = angular.isArray(this.entry.content.images) ? this.entry.content.images : [],
                        newTextBlocks = angular.isArray(this.entry.content.blocks) ? this.entry.content.blocks : [];

                    var resMap = {};

                    resMap[blockTypes.title] = newTitleFamily.map(function (cut) {
                        return [this.entry.content, cut];
                    }, this);

                    if (newImages.length > 0) {
                        resMap[blockTypes.image] = newImages.map(function (img) {
                            return [img, this.basis];
                        }, this);
                    }
                    // the order of textblocks is reverted to allow using fast push/pop methods
                    resMap[blockTypes.text] = newTextBlocks.map(function (tb, index) {
                        return [tb, index];
                    }, this);

                    return resMap;
                },
                setBasis: function (basis) {
                    if (!angular.isObject(basis)) throw new Error('basis is required'); // check basis

                    this.basis = basis;
                    //this.blocks.forEach(function (b) {
                    //    if (angular.isFunction(b.adjust)) b.adjust(basis);
                    //});
                },
                parse: function (entry, options) {
                    if (!angular.isObject(entry)) throw new Error('entry is required');

                    this.entry = entry;

                    if (angular.isObject(options)) angular.extend(this.options, options);

                    var blockMap = this.blockMap;

                    // TODO: blocks might be saved and be binded to anoter data by calling parse method,
                    // TODO: unused blocks might be moved to a buffer.
                    // reset all existing blocks
                    angular.forEach(blockTypes, function (val) {
                        blockMap[val] = [];
                    });

                    var blockDescriptions = this._configureDescriptions();

                    angular.forEach(blockDescriptions, function (argArr, type) {
                        blockMap[type].push.apply(blockMap[type], argArr.map(function (args) {
                            return blockFactory.get(type, args);
                        }));
                    });
                }
            });


            return {
                make: function (entry, basis, options) {
                    return new ArticleModel(entry, basis, options);
                }
            };
        }]);

angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.articleColumnFactory', ['$q', 'sp.smartflow.internal.dimensions',
        function ($q, dimensions) {

            'use strict';

            function ColumnBlock(size, blocks) {
                if (angular.isObject(size)) {
                    this.size = dimensions.size(size);
                }
                this.blocks = blocks || [];
            }

            ColumnBlock.prototype.reset = function () {
                this.blocks = [];
                this.size = null;
            };
            ColumnBlock.prototype.getFilledHeight = function () {
                // assuming all blocks are measured
                return this.blocks.reduce(function (fHeight, b) { return fHeight + b.size.height; }, 0);
            };
            ColumnBlock.prototype.setSize = function () {
                this.size = dimensions.size.apply(dimensions, arguments);
            };

            return {
                make: function (size, blocks) {
                    return new ColumnBlock(size, blocks);
                }
            };
        }
    ]);

/* jshint ignore:start */

angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.articleColumnLayout', [
        '$q',
        'sp.smartflow.ui.layoutType',

        'sp.smartflow.ui.articleBlockTypes',
        'sp.smartflow.ui.articleColumnFactory',

        function ($q, LAYOUT_TYPE, blockTypes, columnFactory) {

            'use strict';

            var layoutRepo = (function () {

                // Honest random choice
                function randomChoice(blocks) {
                    if (!angular.isArray(blocks) || blocks.length === 0) return -1;
                    return Math.round(Math.random() * (blocks.length - 1));
                }

                function getClosestByHeight(heights, bestHeight, leftLimit) {
                    return heights.reduce(function (bestChoose, curHeight, index) {
                        var curDelta, apply = false;
                        if (leftLimit) {
                            curDelta = bestHeight - curHeight;
                            apply = curDelta >= 0 && curDelta < bestChoose.delta;
                        } else {
                            curDelta = Math.abs(bestHeight - curHeight);
                            apply = curDelta < bestChoose.delta;
                        }
                        if (apply) {
                            bestChoose = {
                                delta: curDelta,
                                index: index
                            };
                        }
                        return bestChoose;
                    }, { delta: Infinity, index: -1 }).index;
                }

                function setVisibleAllExcept(blocks, value /*, indexes*/) {

                    if (arguments.length < 2) throw new Error('value is required');

                    var doNotTouchIndexes = Array.prototype.slice.call(arguments, 2);
                    blocks.forEach(function (b, index) {
                        if (doNotTouchIndexes.lastIndexOf(index) < 0) b.setVisible(!!value);
                    });
                }

                function calcMedian(images, basis, height) {
                    if (images.length <= 0 || height <= 0) return 0;

                    var totalImgHeight = images.reduce(function (prev, img) { return prev + img.size.height; }, 0);
                    var gap = height - totalImgHeight;
                    if (gap < 0) throw new Error(); // TODO: specify message;

                    return Math.round(gap / images.length + 1);
                }

                function getImageDistance(blocks) {
                    var distance = 0;
                    for (var i = blocks.length - 1; i >= 0; i--) {
                        var block = blocks[i];
                        if (block.type === blockTypes.image) break;
                        distance += block.size.height;
                    }
                    return distance;
                }

                //function expandStrategy(model, options) {
                //    var ss = Array.prototype.concat(
                //        model.blockMap[blockTypes.image].map(function (b) {
                //            return b.getSize();
                //        }),
                //        model.blockMap[blockTypes.text].map(function (b) {
                //            return b.getSize();
                //        })
                //    );

                //    return $q.all(ss)
                //        .then(function (sizes) {

                //            if (sizes.length === 0) return model;

                //            var basis = model.basis,
                //                blockMap = model.blockMap;


                //            var totalHeightForPlace = sizes.reduce(function (total, s) {
                //                return total + s.height;
                //            }, 0);

                //            var currentCol = model.columns[model.columns.length - 1];

                //            var availableHeight = basis.blockMax.height - currentCol.blocks.reduce(function (res, b) { return res + b.size.height; }, 0);
                //            var textBlocks = model.blockMap[blockTypes.text];
                //            while (availableHeight > 0 && textBlocks.length > 0) {
                //                var textBlock = textBlocks.shift();
                //                if (availableHeight < textBlock.size.height) {
                //                    var splited = textBlock.split(availableHeight);
                //                    textBlocks.unshift(splited);
                //                }
                //                currentCol.blocks.push(textBlock);
                //                availableHeight -= textBlock.size.height;
                //            }
                //            //currentCol.size.height = basis.blockMax.height;

                //            var images = model.blockMap[blockTypes.image] || [];

                //            while (textBlocks.length > 0 || images.length > 0) {
                //                if (availableHeight <= 0) {
                //                    currentCol = columnFactory.get(basis.column);
                //                    model.columns.push(currentCol);
                //                    availableHeight = basis.blockMax.height;
                //                }

                //                var img = images.pop();
                //                if (img) {
                //                    if (img.size.height > basis.blockMax.height) {
                //                        // throw out this image
                //                    } else {
                //                        if (img.size.height <= availableHeight) {

                //                            var fillerH = basis.line.height - img.size.height % basis.line.height;
                //                            if (fillerH !== 0) {
                //                                img.filler.height = fillerH;
                //                                img.size.height += fillerH;
                //                            }
                //                            currentCol.blocks.push(img);
                //                            availableHeight -= img.size.height;
                //                        }
                //                    }
                //                }
                //                var text = textBlocks.shift();
                //                if (text) {
                //                    if (text.size.height > availableHeight) {
                //                        splited = text.split(availableHeight);
                //                        if (splited) textBlocks.unshift(splited);
                //                    }
                //                    currentCol.blocks.push(text);
                //                    availableHeight -= text.size.height;
                //                }
                //            }

                //            //model.size.height = basis.column.height;
                //            model.size.width = model.columns.reduce(function (res, c) { return res + c.size.width; }, 0);

                //            return model;
                //        });
                //}

                //function endianSequentalFull(model, options) {
                //    return $q.all(model.blocks.map(function (b) { return b.getSize(); }))
                //        .then(function (ss) {
                //            var basis = model.basis;
                //            var detachedBlockMap = model.filteredBlockMap();
                //            var filledHeight = model.blocks.reduce(function (prev, b) {
                //                return prev + b.size.height;
                //            }, 0);
                //            var additionalHeight = model.filteredBlocks.reduce(function (prev, b) { return prev + b.size.height; }, 0) + filledHeight - model.size.height;
                //            var images = detachedBlockMap[blockTypes.image] || [];
                //            var textBlocks = (detachedBlockMap[blockTypes.text] || []).reverse();
                //            var medianImgDistance = calcMedian(images, basis, additionalHeight);

                //            var next = true;
                //            while (next) {
                //                var availableHeight = Math.ceil(filledHeight / basis.entry.height) * basis.entry.height - filledHeight;
                //                var imageDistance = getImageDistance(model.blocks);
                //                var block;

                //                if (imageDistance >= medianImgDistance && images.length > 0) {
                //                    block = images.pop();

                //                    if (availableHeight < block.size.height) {
                //                        if (textBlocks.length > 0) {
                //                            images.push(block);
                //                            block = textBlocks.pop();
                //                        }
                //                    }
                //                } else {
                //                    block = textBlocks.pop();
                //                    if (!block && images.length > 0) {
                //                        block = images.pop();
                //                    }
                //                }

                //                if (block) {
                //                    model.blocks.push(block);
                //                    filledHeight += block.size.height;
                //                    if (block.type === blockTypes.image) {
                //                        if (availableHeight < block.size.height) {
                //                            filledHeight += availableHeight;
                //                        }
                //                    }
                //                }

                //                next = images.length > 0 || textBlocks.length > 0;
                //            }
                //            model.size.columnCount = Math.ceil(filledHeight / basis.entry.height);
                //            return model;
                //        });
                //}


                //function setTotalSize(columns, basis) {
                //    columns.forEach(function (col) {
                //        if (angular.isObject(col.size)) return;

                //        var w = basis.column.width, h, filledH = col.getFilledHeight();
                //        if (filledH === basis.blockMax.height) {
                //            h = basis.column.height;
                //        } else {
                //            var dif = basis.column.height - basis.blockMax.height;
                //            h = filledH + dif;
                //        }
                //        col.setSize(w, h);
                //    });
                    
                //}

                //function shrinkedLayout(model, columns) {
                //    if (columns.length === 0) {
                //        // bild like a new
                //        var curColumn = columnFactory.make(),
                //            basis = model.basis,
                //            blockMap = model.blockMap;

                //        // Choose best fill title
                //        var titles = blockMap[blockTypes.title] || [];
                //        return $q.all(titles.map(function (b) { return b.getSize(); }))
                //            .then(function (titleSizes) {
                //                if (titles.length === 0) return false;  // TODO: check .mandatory field for blockType

                //                // 20% of total height. Might be adjusted according to the article rank etc.

                //                var bestFitIndex = getClosestByHeight(titleSizes.map(function (s) { return s.height; }), basis.blockMax.height * 0.2) || 0;
                //                curColumn.blocks.push(titles[bestFitIndex]);

                //                return curColumn;
                //            })
                //            .then(function (column) {   // Choose best fill image

                //                var images = blockMap[blockTypes.image] || [];
                //                if (images.length === 0) return column;

                //                return $q.all(images.map(function(b) { return b.getSize(); }))
                //                    .then(function(imageSizes) {

                //                        //var filledHeight = column.blocks.reduce(function(fHeight, b) { return fHeight + b.size.height; }, 0);
                //                        var filledHeight = column.getFilledHeight();

                //                        var maxImgHeight = basis.blockMax.height - filledHeight;

                //                        var bestFitIndex = getClosestByHeight(imageSizes.map(function(s) { return s.height; }), maxImgHeight, true);
                //                        var lastPlacedBlock;
                //                        if (bestFitIndex >= 0) {
                //                            lastPlacedBlock = images[bestFitIndex];
                //                            column.blocks.push(lastPlacedBlock);
                //                            filledHeight += imageSizes[bestFitIndex].height;
                //                        } else {
                //                            lastPlacedBlock = column.blocks[column.blocks.length - 1];
                //                        }


                //                        var fillerH = basis.line.height - filledHeight % basis.line.height;
                //                        if (fillerH !== 0) {
                //                            lastPlacedBlock.filler.height = fillerH;
                //                            lastPlacedBlock.size.height += fillerH;
                //                            //console.info('added filler', fillerH, 'filled', filledHeight);
                //                        }
                //                        return column;
                //                    });
                //            })
                //            .then(function(column) {   // add some text
                                

                //                if (basis.blockMax.height - column.getFilledHeight() < basis.line.height * 3) {
                //                    //console.info('TITLE-IMAGE-ONLY layout built');
                //                    return [column];
                //                }
                                
                //                var textBlocks = blockMap[blockTypes.text] || [];
                //                if (textBlocks.length === 0) return [column];

                //                //statistically first text block will be enough in most cases
                //                return textBlocks[0].getSize()
                //                    .then(function (firstTextBlockSize) {

                //                        var availableHeight = basis.blockMax.height - column.getFilledHeight();
                //                        var heightToFill = 0;

                //                        var lastPlacedBlock = column.blocks[column.blocks.length - 1];
                //                        if (lastPlacedBlock.type === blockTypes.image) { // there is an image
                //                            heightToFill = availableHeight;
                //                        } else {     // there is no image
                //                            heightToFill = Math.max(Math.min(availableHeight, firstTextBlockSize.height), basis.line.height * 3);
                //                        }

                //                        var index = 0;
                //                        if (firstTextBlockSize.height >= heightToFill) {
                //                            var splited = textBlocks[index].split(heightToFill);
                //                            if (splited) textBlocks.splice(index + 1, 0, splited);
                //                            column.blocks.push(textBlocks[index]);
                //                            return [column];
                //                        } else {    // first block is not enough
                //                            return $q.all(textBlocks.map(function (b) { return b.getSize(); }))
                //                                .then(function (testBlockSizes) {
                //                                    availableHeight = basis.blockMax.height - column.getFilledHeight();
                //                                    index = 0;
                //                                    var curBlock = textBlocks[index];
                //                                    while (curBlock && availableHeight > 0) {
                //                                        if (availableHeight < curBlock.size.height) {
                //                                            splited = curBlock.split(availableHeight);
                //                                            if (splited) textBlocks.splice(index + 1, 0, splited);
                //                                        }
                //                                        column.blocks.push(curBlock);
                //                                        availableHeight -= curBlock.size.height;

                //                                        index++;
                //                                        curBlock = textBlocks[index];
                //                                    }

                //                                    return [column];
                //                                });
                //                        }


                //                    });
                //            })
                //            .then(function (cols) {
                //                //setTotalSize(cols, basis);
                //                return cols;
                //            });
                //    } else {
                //        columns.length = 1;
                //        return $q.when(columns);
                //    }
                //}

                //function expandedLayout(model, columns) {
                //    var basis = model.basis;
                //    var textBlocks = model.blockMap[blockTypes.text] || [];
                //    return $q.all(textBlocks.map(function(b) { return b.getSize(); }))
                //        .then(function (textblockSizes) {
                //            var firstCol = columns[0],
                //                lastBlock = firstCol.blocks[firstCol.blocks.length - 1];

                //            var textBlockIndex = textBlocks.lastIndexOf(lastBlock) + 1;

                //            var availableHeight = basis.blockMax.height - firstCol.getFilledHeight();

                //            while (availableHeight > 0) {
                //                var curTextBlock = textBlocks[textBlockIndex];
                //                if (!curTextBlock) {
                //                    availableHeight = 0;
                //                    continue;
                //                }

                //                var splited = curTextBlock.split(availableHeight);
                //                if (splited) textBlocks.splice(textBlockIndex + 1, 0, splited);
                //                firstCol.blocks.push(curTextBlock);
                //                availableHeight -= curTextBlock.size.height;
                //                textBlockIndex++;
                //            }
                //            if (firstCol.getFilledHeight() === basis.blockMax.height) {
                //                firstCol.setSize(basis.column);
                //            }

                //            var colIndex = 0;
                //            var tBlock = textBlocks[textBlockIndex];
                //            var curColumn = columns[colIndex];
                //            availableHeight = basis.blockMax.height - curColumn.getFilledHeight();
                //            while (tBlock) {
                //                if (availableHeight <= 0) {
                //                    columns.push(columnFactory.make(basis.column));
                //                    colIndex++;
                //                    curColumn = columns[colIndex];
                //                    availableHeight = basis.blockMax.height;
                //                }

                //                splited = tBlock.split(availableHeight);
                //                if (splited) textBlocks.splice(textBlockIndex + 1, 0, splited);
                //                curColumn.blocks.push(tBlock);
                //                availableHeight -= tBlock.size.height;

                //                textBlockIndex++;
                //                tBlock = textBlocks[textBlockIndex];
                //            }

                //            return columns;
                //        });


                //}


                function bulkLayout(model, columns) {

                    var col = (columns || [])[0] || columnFactory.make();

                    col.reset();

                    angular.forEach(model.blockMap, function(blocks) {
                        col.blocks.push.apply(col.blocks, blocks);
                    });
                    return $q.when([col]);
                }

                function fullColumnLayout(model) {
                    var basis = model.basis;
                    var titleBlocks = model.blockMap[blockTypes.title];
                    return $q.all(titleBlocks.map(function(b) { return b.getSize(); }))
                        .then(function(titleSizes) {
                            var firstColumn = columnFactory.make(basis.column);
                            firstColumn.blocks.push(model.blockMap[blockTypes.title][0]); // do not choose title blocks so far
                            return [firstColumn];
                        }).
                        then(function(cols) {
                            var images = model.blockMap[blockTypes.image] || [];
                            if (images.length === 0) return cols;

                            return $q.all(images.map(function(b) { return b.getSize(); }))
                                .then(function(imageSizes) {
                                    var column = cols[0];
                                    var filledHeight = column.getFilledHeight();

                                    var maxImgHeight = basis.blockMax.height - filledHeight;

                                    var bestFitIndex = getClosestByHeight(imageSizes.map(function(s) { return s.height; }), maxImgHeight, true);
                                    var lastPlacedBlock;
                                    if (bestFitIndex >= 0) {
                                        lastPlacedBlock = images.splice(bestFitIndex, 1)[0];
                                        column.blocks.push(lastPlacedBlock);
                                        filledHeight += imageSizes[bestFitIndex].height;
                                    } else {
                                        lastPlacedBlock = column.blocks[column.blocks.length - 1];
                                    }

                                    var fillerH = basis.line.height - filledHeight % basis.line.height;
                                    if (fillerH !== 0) {
                                        lastPlacedBlock.filler.height = fillerH;
                                        lastPlacedBlock.size.height += fillerH;
                                        //console.info('added filler', fillerH, 'filled', filledHeight);
                                    }
                                    return cols;
                                });
                        })
                        .then(function(columns) {
                            var textBlocks = model.blockMap[blockTypes.text] || [];
                            return $q.all(textBlocks.map(function(b) { return b.getSize(); }))
                                .then(function(textblockSizes) {
                                    var firstCol = columns[0],
                                        lastBlock = firstCol.blocks[firstCol.blocks.length - 1];

                                    var textBlockIndex = textBlocks.lastIndexOf(lastBlock) + 1;

                                    var availableHeight = basis.blockMax.height - firstCol.getFilledHeight();

                                    while (availableHeight > 0) {
                                        var curTextBlock = textBlocks[textBlockIndex];
                                        if (!curTextBlock) {
                                            availableHeight = 0;
                                            continue;
                                        }

                                        var splited = curTextBlock.split(availableHeight);
                                        if (splited) textBlocks.splice(textBlockIndex + 1, 0, splited);
                                        firstCol.blocks.push(curTextBlock);
                                        availableHeight -= curTextBlock.size.height;
                                        textBlockIndex++;
                                    }
                                    if (firstCol.getFilledHeight() === basis.blockMax.height) {
                                        firstCol.setSize(basis.column);
                                    }

                                    var colIndex = 0;
                                    var tBlock = textBlocks[textBlockIndex];
                                    var curColumn = columns[colIndex];
                                    availableHeight = basis.blockMax.height - curColumn.getFilledHeight();
                                    while (tBlock) {
                                        if (availableHeight <= 0) {
                                            columns.push(columnFactory.make(basis.column));
                                            colIndex++;
                                            curColumn = columns[colIndex];
                                            var images = model.blockMap[blockTypes.image] || [];
                                            availableHeight = basis.blockMax.height;

                                            for (var i = 0; i < images.length; i++) {
                                                if (images[i].size.height > availableHeight) continue;
                                                var img = images.splice(i, 1)[0];
                                                curColumn.blocks.push(img);

                                                var fillerH = basis.line.height - img.size.height % basis.line.height;
                                                if (fillerH !== 0) {
                                                    img.filler.height = fillerH;
                                                    img.size.height += fillerH;
                                                }
                                                availableHeight -= img.size.height;

                                                break;
                                            }
                                            if (availableHeight < model.basis.line.height) continue;
                                        }

                                        splited = tBlock.split(availableHeight);
                                        if (splited) textBlocks.splice(textBlockIndex + 1, 0, splited);
                                        curColumn.blocks.push(tBlock);
                                        availableHeight -= tBlock.size.height;

                                        textBlockIndex++;
                                        tBlock = textBlocks[textBlockIndex];
                                    }

                                    return columns;
                                });
                        });

                }

                var strategyMap = {};
                strategyMap['init'] = bulkLayout;
                strategyMap[LAYOUT_TYPE.EXPANDED] = fullColumnLayout;

                return {
                    getStrategy: function (type) {
                        if (strategyMap[type]) return strategyMap[type];
                        return strategyMap['init'];
                    }
                };
            })();

            return {
                buildColumns: function (model, columns, lType) {
                    var strategy = layoutRepo.getStrategy(lType);
                    return strategy(model, columns);
                }
            };

        }
    ]);

/* jshint ignore:end */

angular
    .module('sp.smartflow.ui')
    .constant('sp.smartflow.ui.articleBlockTypes', {
        title: '__title__',
        image: '__image__',
        //textSection: '__text_section__',
        text: '__text__'
    });

// TODO: refactor this: allow each block service to register with this factory on 'config'-stage.
angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.articleBlockFactory', [
        'sp.smartflow.ui.articleBlockTypes',
        'sp.smartflow.ui.articleTitleBlock',
        'sp.smartflow.ui.articleImageBlock',
        'sp.smartflow.ui.articleTextBlock',
            function articleBlockFactory(blockTypes, TitleBlock, ImageBlock, TextBlock) {

                'use strict';

                return {
                    get: function (type, args) {
                        var ctor;
                        switch (type) {
                            case blockTypes.title:
                                ctor = TitleBlock;
                                break;
                            case blockTypes.image:
                                ctor = ImageBlock;
                                break;
                            case blockTypes.text:
                                ctor = TextBlock;
                                break;
                            default:
                                throw new Error('Unknown block type: ' + type);
                        }
                        if (!angular.isArray(args)) args = [];

                        args.unshift(undefined);
                        var BindedCtor = ctor.bind.apply(ctor, args);

                        return new BindedCtor();
                    },
                    getTitle: function (content, cut) {
                        return new TitleBlock(content, cut);
                    },
                    getImage: function (imgData, basis) {
                        return new ImageBlock(imgData, basis);
                    },
                    getText: function (originalData, index, offset) {
                        return new TextBlock(originalData, index, offset);
                    }
                };
            }
        ]);

angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.articleBlock', ['$q', 'sp.smartflow.ui.articleBlockTypes', 'sp.smartflow.internal.dimensions',
        function ($q, blockTypes, dimensions) {

            'use strict';

            function Block() {

                this.__id = '__art_block__' + parseInt(Math.random() * 0x1000000);
                this.filler = dimensions.size(0, 0);
                this.parse.apply(this, arguments);
            }

            angular.extend(Block.prototype, {
                _checkType: function (type) {
                    var included = false;
                    angular.forEach(blockTypes, function(value) {
                        included = included || value === type;
                    });
                    return included;
                },
                _setType: function (type) {
                    if (!this._checkType(type)) throw new Error('Unknown block type.');
                    this.type = type;
                },
                _onSizeChanged: function (handler) {
                    if (!angular.isArray(this._sizeChangedHandlers)) this._sizeChangedHandlers = [];
                    this._sizeChangedHandlers.push(handler);

                },
                _sizeChanged: function () {
                    var size = this.size;
                    (this._sizeChangedHandlers || []).forEach(function (h) {
                        h.call(undefined, size);
                    });
                },
                setSize: function () {

                    if (!angular.isObject(this.size)) this.size = dimensions.size(0, 0);

                    this.size.set.apply(this.size, arguments);

                    this._sizeChanged();
                },
                getSize: function () {
                    var deferred = $q.defer();
                    if (this.size && this.size.width && this.size.height) {
                        deferred.resolve(this.size);
                    } else {
                        this._onSizeChanged(function (size) {
                            deferred.resolve(size);
                        });
                    }
                    return deferred.promise;
                },
                setVisible: function (val) {
                    this.visible = !!val;   /* jshint ignore:line */
                },
                parse: function () {
                    this.setVisible(true);
                },
                reset: function () {
                },
                adjust: function (/*basis*/) {
                }
            });

            return Block;
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.articleTitleBlock', ['$q', 'sp.smartflow.ui.articleBlockTypes', 'sp.smartflow.ui.articleBlock',
        function ($q, blockTypes, BaseBlock) {

            'use strict';

            function TitleBlock(/*content, cut*/) {
                BaseBlock.apply(this, arguments);
                this._setType(blockTypes.title);
            }

            TitleBlock.prototype = Object.create(BaseBlock.prototype);
            TitleBlock.prototype.constructor = BaseBlock;

            angular.extend(TitleBlock.prototype, {
                parse: function (content, cut) {
                    //BaseBlock.parse.apply(this, arguments);
                    if (angular.isObject(content)) {
                        angular.extend(this, {
                            originalData: content,
                            issueId: ((content || {}).issue || {}).id,    //TODO: temporary
                            cut: cut,
                            //subTitle:
                            social: {
                                // TODO: bind likes, comment count etc.
                            },
                        });
                    }

                    //else {
                    //    //this.reset();
                    //}
                    this.setVisible(true);
                },
                reset: function () {
                    this.setVisible(true);
                    this.issueId = this.cut = this.text = this.social = this.size = null;
                }
            });

            return TitleBlock;
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.articleImageBlock', ['$q', 'sp.smartflow.ui.articleBlockTypes', 'sp.smartflow.ui.articleBlock',
        function ($q, blockTypes, BaseBlock) {

            'use strict';

            function getScale (needed, original) {
                var MAX_SCALE = 4; // TODO: move to a service.
                var rawScale = Math.min(needed / original, MAX_SCALE);
                return Math.round(rawScale * 100);
            }


            function ImageBlock(/*imgData, basis*/) {
                this._setType(blockTypes.image);
                BaseBlock.apply(this, arguments);
            }

            ImageBlock.prototype = Object.create(BaseBlock.prototype);
            ImageBlock.prototype.constructor = BaseBlock;

            angular.extend(ImageBlock.prototype, {
                parse: function (imgData, basis) {
                    //BaseBlock.parse.apply(this, arguments);
                    if (angular.isObject(imgData)) {
                        angular.extend(this, {
                            originalData: imgData,
                            captionEnabled: angular.isObject(imgData.text)
                        });
                        if (angular.isObject(basis)) this.adjust(basis);
                    }
                    //else {
                    //    //this.reset();
                    //}
                    this.setVisible(true);
                },
                reset: function () {
                    this.setVisible(true);
                    this.originalData = this.caption = this.src = this.scale = this.imageSize = null;
                },
                adjust: function (basis) {
                    if (!angular.isObject(basis)) throw new Error('basis is required');
                    if (!angular.isObject(this.originalData)) throw new Error('No original data provided');
                    var scale = getScale(basis.line.width, this.originalData.width);
                    angular.extend(this, {
                        src: this.originalData.url + '&scale=' + scale,
                        scale: scale,
                        imageSize: {
                            width: Math.round(this.originalData.width * scale / 100),
                            height: Math.round(this.originalData.height * scale / 100)
                        }
                    });
                }
            });
            return ImageBlock;
        }
    ]);

angular
    .module('sp.smartflow.ui')
    .factory('sp.smartflow.ui.articleTextBlock', ['$q', 'sp.smartflow.ui.articleBlockTypes', 'sp.smartflow.ui.articleBlock',
        function ($q, blockTypes, BaseBlock) {

            'use strict';

            function TextBlock(/*originalData, index, offset*/) {
                this._setType(blockTypes.text);
                BaseBlock.apply(this, arguments);
            }

            TextBlock.prototype = Object.create(BaseBlock.prototype);
            TextBlock.prototype.constructor = BaseBlock;

            angular.extend(TextBlock.prototype, {
                parse: function (originalData, index, offset) {
                    //BaseBlock.parse.apply(this, arguments);
                    this.setVisible(true);
                    this.originalData = originalData;
                    this.originalIndex = index;

                    this.setTopOffset(offset);
                },
                setTopOffset: function (newTopOffset) {
                    this.offset = {};
                    if (angular.isNumber(newTopOffset)) this.offset.top = newTopOffset;
                },
                copy: function () {
                    return new TextBlock(this.originalData, this.originalIndex);
                },
                split: function (availableHeight) {
                    if (this.size.height <= availableHeight) return null;
                    var unusedHeight = this.size.height - availableHeight;
                    this.size.height = availableHeight;
                    var copy = this.copy();
                    copy.setSize(this.size.width, unusedHeight);
                    copy.setTopOffset(-availableHeight);
                    return copy;
                }
            });
            
            return TextBlock;
        }
    ]);
;(function() {

    'use strict';

    angular
        .module('sp.smartflow', ['classy', 'sp.configuration', 'sp.smartflow.ui', 'sp.smartflow.meta', 'sp.smartflow.providers', 'sp.statistics', 'pr.smartflow.common'])
        .config([
            '$stateProvider',
            'sp.configuration.templatesStoreProvider',

            function($stateProvider, tStore) {

                $stateProvider
                    .state('smartflow', {
                        url: '/smartflow',
                        parent: 'shell.container',
                        views: {
                            '@': {
                                templateProvider: tStore.getTemplateService('smartflow.feed'),
                                controller: 'sp.smartflow.feed.controller',
                                //templateProvider: tStore.getTemplateService('smartflow.randomFeed'),
                                //controller: 'sp.smartflow.stub.controller'
                            }

                        },
                        resolve: {
                            feedConfig: ['$stateParams', function ($stateParams) {
                                var config = {
                                    metaProvider: 'newsfeed',
                                    viewType: 'topnews',
                                };
                                if ($stateParams.token) config = $stateParams.token;
                                if ($stateParams.entryId) config = $stateParams.entryId;

                                return config;
                            }]
                        }
                    });
            }])
        .run(['sp.statistics.historyProvider', 'pr.smartflow.common.events', function(historyProvider, SM_EVENTS) {
            historyProvider.startListen(SM_EVENTS.ON_ENTRY_STATE_CHANGED);
        }]);
})();


angular
    .module('sp.smartflow')
    .provider('sp.smartflow.feedProvider', [
        function feedProvider() {

            'use strict';

            //var _debug = false;

            var MAX_LOAD_ATTEMPT = 3;

            return {
                $get: [
                    '$q',
                    'sp.smartflow.providers.metaProviderRepository',
                    'sp.smartflow.providers.contentProviderRepository',
                    'pr.smartflow.common.entry',
                    'sp.smartflow.meta.type',

                    function feedProvider($q, metaProviderRepo, contentProviderRepo, entryFactory, META_TYPE) {

                        function loadContent(config, metas) {

                            //// only for debug reasons
                            //function removeNonArticles(res) {
                            //    _.remove(entries, function (e) {
                            //        var notArticle = e.meta.type !== META_TYPE.ARTICLE_PREVIEW;
                            //        if (notArticle) console.info('entry filtered as non article', e);
                            //        return notArticle;
                            //    });
                            //    return res;
                            //}

                            function removeInvalid(res) {
                                _.remove(entries, function (e) {
                                    var invalid =
                                        e.meta.type === META_TYPE.ARTICLE_PREVIEW &&
                                        (!angular.isString(e.content.title) || e.content.title.length === 0);
                                    if (invalid) console.info('entry filtered as loaded with error', e);
                                    return invalid;
                                });
                                return res;
                            }

                            var entries = [],
                                typeSplitEntries = {};

                            if (!metas) metas = [];

                            metas.forEach(function(meta) {

                                // Meta provider might return content inside its metadata.
                                // Do not load content for such items.

                                var entry = entryFactory.make(meta);

                                if (!entry.content) {
                                    var key = entry.getType();
                                    if (typeSplitEntries[key] === undefined) typeSplitEntries[key] = [];
                                    typeSplitEntries[key].push(entry);
                                }
                                entries.push(entry);
                            });

                            // TODO: here an event of newly created entries might be broadcasted into event bus.

                            var loadBuffer = [];
                            angular.forEach(typeSplitEntries, function(entries, type) {
                                var contentProvider = contentProviderRepo.getProvider(type);
                                if (!angular.isObject(contentProvider)) throw new Error('Content provider for type ' + type + ' was not found.');
                                loadBuffer.push(contentProvider.load(config, entries));
                            });

                            //return $q.when(entries);

                            // wait for all providers to load content.
                            return $q.all(loadBuffer)
                                        //.then(removeNonArticles)
                                        .then(removeInvalid)
                                        .then(function () {
                                            return entries;
                                        });
                                        
                        }

                        /**
                         * Loads next entries for feed.
                         * @params {?object} config - config object.
                         * @params {string} config.metaProvider - the key of metaProvider that is used for loading feed metadata.
                         * @returns promise fulfilled with loaded entries.
                        */
                        function loadNext(config, attempt) {
                            // TODO: pass only the meaningfull config properties.
                            // TODO: the result of getProvider might be a promise as well.
                            config = config || {};
                            var metaProvider = metaProviderRepo.getProvider(config.metaProvider);
                            if (metaProvider === undefined) throw new Error('Meta provider for type was not found.');   // TODO: specify error message
                            if (!angular.isNumber(attempt)) attempt = 1;
                            return metaProvider.loadNext(config)
                                        .then(function(metas) {
                                            return loadContent(config, metas)
                                                .then(function(loadedEntries) {
                                                    if ((!loadedEntries || loadedEntries.length === 0) && attempt < MAX_LOAD_ATTEMPT) {
                                                        attempt++;
                                                        config.entryId = metas[metas.length - 1].id;
                                                        return loadNext(config, attempt);
                                                    }
                                                    return loadedEntries;
                                                });
                                        });
                        }

                        /**
                         * Loads previous entries for feed.
                         * @params {?object} config - config object.
                         * @params {string} config.metaProvider - the key of metaProvider that is used for loading feed metadata.
                         * @returns promise fulfilled with loaded entries.
                        */
                        function loadPrevious(config) {
                            config = config || {};
                            var metaProvider = metaProviderRepo.getProvider(config.metaProvider);
                            return metaProvider.loadPrevious(config)
                                        .then(loadContent.bind(undefined, config));
                        }

                        return {
                            loadNext: loadNext,
                            loadPrevious: loadPrevious,
                        };
                    }
                ]
            };
        }
    ]);

; (function () {

    'use strict';

    var _debug = false;

    /**
     * Removes (collection.length - minLen) elements from
     * either start or end of the given array if its length is greater then given maxLen.
     * @param {Array.<*>} collection Source array.
     * @param {number} maxLen Maximun amount of the elements in the source array starting from which its elements are removed.
     * @param {number} minLen The amount of elements source array should contain after the removing.
     * @param {Boolean} recycleLast Remove last elements. If false, first elements are removed.
    */
    function shortenMaxMin(collection, maxLen, minLen, recycleLast) {

        if (!angular.isNumber(minLen)) throw new Error('minLen must be a number');
        if (!angular.isNumber(maxLen)) throw new Error('maxLen must be a number');
        if (maxLen < minLen) throw new Error('maxLen must be greater or equal to minLen');

        if (!angular.isArray(collection) || collection.length <= maxLen) return [];

        return recycleLast ?
            collection.splice(minLen) :
            collection.splice(0, collection.length - minLen);
    }

    angular
        .module('sp.smartflow')
        .classy
        .controller({
            name: 'sp.smartflow.feed.controller',
            inject: {
                '$scope': '.',
                '$window': '.',
                '$location': '.',
                '$q': '.',
                'feedConfig': '.',
                'sp.smartflow.feedProvider': 'feedProvider',
                'pr.smartflow.common.entryStates': 'ENTRY_STATES',
                'sp.common.eventBus': 'eventBus',
                'pr.smartflow.common.events': 'SM_EVENTS',

            },
            _defaultConfig: {
                requestedAmount: 5,
                cleaned: true
            },
            _maxLen: 20,
            _minLen: 10,
            //_requestAmount: 5,
            //_entryStub: {
            //    meta: {},
            //    getKey: angular.noop
            //},
            getNext: function (config) {
                var scope = this.$,
                    entries = scope.entries;

                if (scope.getNextPromise) {
                    if (_debug) console.info('getNext called while pending, return existed');
                    return scope.getNextPromise;
                }

                if (scope.needsRecycle) {
                    if (_debug) console.info('getNext called but needsRecycle set');
                    return this.$q.when([]);
                }

                if (_debug) console.info('getNext called normally at', (new Date()).toISOString());

                var mergedConfig = angular.extend({}, this._defaultConfig, this.feedConfig, config);
                if (!mergedConfig.entryId && !mergedConfig.token && entries.length > 0) {
                    var lastEntry = entries[entries.length - 1];
                    mergedConfig.token = lastEntry.meta.rightToken;
                    mergedConfig.entryId = lastEntry.getKey();
                }   // TODO: flush current entry collection if there is Id or Token in config

                scope.endContentNext = false;
                scope.getNextPromise = this.feedProvider.loadNext(mergedConfig)
                    .then(function (loadedEntries) {
                        if (_debug) console.info('getNext loaded', loadedEntries, 'old last', entries.slice(-1)[0]);
                        entries.push.apply(entries, loadedEntries);
                        if (!loadedEntries || loadedEntries.length === 0) scope.endContentNext = true;
                        return loadedEntries;
                    })
                    .catch(function (err) {
                        if (_debug) console.warn('getNext failed:', err);
                        scope.endContentNext = true;
                    })
                    .finally(function () {
                        scope.getNextPromise = null;
                        if (_debug) console.info('getNext finally, promise reset at', (new Date()).toISOString());
                    });
                return scope.getNextPromise;
            },
            getPrevious: function (config) {
                var scope = this.$,
                    entries = scope.entries;

                if (scope.getPrevPromise) {
                    if (_debug) console.info('getPrevious called while pending, return existed');
                    return scope.getPrevPromise;
                }

                if (scope.needsRecycle) {
                    if (_debug) console.info('getPrevious called but needsRecycle set');
                    return this.$q.when([]);
                }

                if (_debug) console.info('getPrevious called normally');

                var mergedConfig = angular.extend({}, this._defaultConfig, this.feedConfig, config);
                if (!mergedConfig.entryId && !mergedConfig.token && entries.length > 0) {
                    var firstEntry = scope.entries[0];
                    mergedConfig.token = firstEntry.meta.rightToken;
                    mergedConfig.entryId = firstEntry.getKey();
                }

                scope.endContentPrevious = false;
                scope.getPrevPromise = this.feedProvider.loadPrevious(mergedConfig)
                    .then(function (loadedEntries) {
                        entries.unshift.apply(entries, loadedEntries);
                        if (!loadedEntries || loadedEntries.length === 0) scope.endContentPrevious = true;
                        return loadedEntries;
                    })
                    .catch(function (err) {
                        if (_debug) console.warn('getPrevious failed:', err);
                        scope.endContentPrevious = true;
                    })
                    .finally(function () {
                        scope.getPrevPromise = null;
                    });
                return scope.getPrevPromise;
            },
            recycleFirst: function () {
                var recycled = shortenMaxMin(this.$.entries, this._maxLen, this._minLen, false);
                if (_debug) console.info('recycled first', recycled.length);
                return recycled;
            },
            recycleLast: function () {
                var recycled = shortenMaxMin(this.$.entries, this._maxLen, this._minLen, true);
                if (_debug) console.info('recycled last', recycled.length);
                return recycled;
            },
            feedState: function (newState) {
                if (angular.isObject(newState)) {   //setter
                    var mergedState = {};
                    angular.extend(mergedState, this.$location.state(), newState);
                    if (_debug) console.info('replace state to', mergedState);
                    this.$location.state(mergedState);
                    return mergedState;
                } else {    // getter
                    if (_debug) console.info('read state', this.$location.state());
                    return this.$location.state();
                }
            },
            init: function () {
                var scope = this.$,
                    eventBus = this.eventBus,
                    maxCollectionLenght = this._maxLen,
                    SM_EVENTS = this.SM_EVENTS,
                    ENTRY_STATES = this.ENTRY_STATES;

                scope.entries = window.__en = [];
                scope.needsRecycle = scope.endContentPrevious = scope.endContentNext = false;
                scope.doubleSpinner = true;

                scope.basis = {};

                // try to restore state
                var initState = this.feedState() || {};

                if (!initState.token && !initState.entryId) { // it's a fresh start
                    initState.cleaned = false;
                    initState.reset = true;
                } else {
                    initState.include = true;
                }

                scope.getNextPromise = this.getNext(initState)
                    .then(function () {
                        if (scope.entries.length === 0) return;  // TODO: +warning: this indicates "silent" content loading error.
                        var startEntryId = initState.entryId || scope.entries[0].getKey();
                        scope.entries.forEach(function (e) {
                            if (e.getKey() === startEntryId) {
                                e.state = ENTRY_STATES.ACTIVE;
                                e.location = initState.location || {};
                            } else {
                                e.state = ENTRY_STATES.DETACHED;
                            }
                        });
                    });

                scope.$watch('entries.length', function (length) {
                    scope.doubleSpinner = length <= 1;
                    scope.needsRecycle = length > maxCollectionLenght;
                });

                var self = this;
                var unsub = eventBus.subscribe(SM_EVENTS.ON_FEED_VISIBLE_ZONE_CHANGED, function (/*evt, data*/) {

                    // for now the first visible entry is considered as active
                    // TODO: improve this checking
                    var activeEntry = _.find(scope.entries, function (e) {
                        return e.state === ENTRY_STATES.VISIBLE;
                    });

                    if (!activeEntry) return;

                    // update state with new active entry
                    self.feedState({
                        entryId: activeEntry.getKey(),
                        token: activeEntry.rightToken,  // TODO: what about leftToken?
                        location: activeEntry.location,
                        title: activeEntry.content.title
                    });
                });
                scope.$on('$destroy', function () {
                    unsub();
                });
            },
        });
})();

/* jshint ignore:start */

'use strict';

angular
    .module('sp.smartflow')
    .classy
    .controller({
        name: 'sp.smartflow.stub.controller',
        inject: {
            '$scope': '.',
            '$window': '.',
            '$timeout': '.',
            '$q': '.',

            'sp.smartflow.feedProvider': 'feedProvider',
            'pr.smartflow.common.entryStates': 'ENTRY_STATES',
        },
        _sharedConfig: {
            metaProvider: 'newsfeed',
            viewType: 'topnews',
            requestedAmount: 5
        },
        _entryStub: {
            meta: {},
            getKey: angular.noop
        },
        _maxLen: 100,
        _minLen: 5,
        _getNextId: function() {
            var scope = this.$;
            return (_.last(scope.entries || []) || { id: 0 }).id + 1;
        },
        _getPrevId: function() {
            var scope = this.$;
            return (_.first(scope.entries || []) || { id: 0 }).id - 1;
        },
        _getDelay: function() {
            return parseInt(Math.random() * 1000);
        },
        _getAmount: function() {
            return parseInt(Math.random() * 10) + 1;
        },
        _getHeight: function() {
            return parseInt(Math.random() * 500) + 100;
        },
        _recycle: function(end) {
            var scope = this.$,
                minLen = this._minLen,
                maxLen = this._maxLen;

            if (!angular.isArray(scope.entries) || scope.entries.length <= maxLen) return;

            if (end) {
                scope.entries.splice(minLen);
            } else {
                scope.entries.splice(0, scope.entries.length - minLen);
            }
            //scope.$apply();
        },
        _recycleDeco: function(fn) {
            var scope = this.$scope;
            return function() {
                if (scope.needsRecycle) {
                    return null;
                }
                return fn.apply(this, arguments);
            };
        },
        _getMore: function(step, getId) {
            var scope = this.$,
                amount = this._getAmount(),
                maxLen = this._maxLen,
                delay = this._getDelay(),
                getHeight = this._getHeight,
                ENTRY_STATES = this.ENTRY_STATES;

            if (scope.needsRecycle) {
                console.info('asked for more but needsRecycle set');
                return this.$q.when([]);
            }

            console.info('more generated with', delay, 'delay');

            return this.$timeout(function() {
                while (amount >= 0) {
                    step(scope.entries, {
                        id: getId(),
                        style: {
                            height: getHeight()
                        },
                        state: ENTRY_STATES.DETACHED
                    });
                    amount--;
                }
                if (scope.entries.length > maxLen) {
                    console.info('needsRecycle set', scope.entries.length);
                    scope.needsRecycle = true;
                }

            }, delay);
        },
        getNext: function() {
            var scope = this.$;
            if (scope.getNextPromise) {
                console.info('getNext called while pending, return existed');
                return scope.getNextPromise;
            }
            if (scope.needsRecycle) {
                console.info('getNext called but needsRecycle set');
                return this.$q.when([]);
            }
            console.info('getNext called normally');
            var nextId = this._getNextId();
            scope.endContentNext = false;
            return scope.getNextPromise =
                (nextId > 20 ?
                    this.$q.when(this.$timeout(function() {
                        scope.endContentNext = true;
                    }, this._getDelay())) :
                    this._getMore(function(c, m) { c.push(m); }, this._getNextId.bind(this))
                )
                    .finally(function() {
                        scope.getNextPromise = null;
                    });
        },
        getPrevious: function() {
            var scope = this.$;
            if (scope.getPrevPromise) {
                console.info('getPrevious called while pending, return existed');
                return scope.getPrevPromise;
            }
            if (scope.needsRecycle) {
                console.info('getPrevious called but needsRecycle set');
                return this.$q.when([]);
            }
            console.info('getPrevious called normally');
            var lastId = this._getPrevId();
            scope.endContentPrevious = false;
            return scope.getPrevPromise =
                (lastId < -10 ?
                    this.$q.when(this.$timeout(function() {
                        scope.endContentPrevious = true;
                    }, this._getDelay())) :
                    this._getMore(function(c, m) { c.unshift(m); }, this._getPrevId.bind(this))
                )
                    .then(function() {
                        scope.getPrevPromise = null;
                    });
        },
        recycleFirst: function() {
            return this._recycle();
        },
        recycleLast: function() {
            return this._recycle(true);
        },
        init: function() {

            var scope = this.$,
                entryStub = this._entryStub,
                ENTRY_STATES = this.ENTRY_STATES;

            scope.entries = [];
            scope.needsRecycle = scope.endContentPrevious = scope.endContentNext = false;
            scope.doubleSpinner = true;

            scope.getNextPromise =
                this.getNext()
                    .then(function() {
                        (scope.entries[0] || entryStub).state = ENTRY_STATES.ACTIVE;
                    });

            var maxLen = this._maxLen;
            scope.$watchCollection('entries', function(col) {
                console.info('scope.entries watcher', col);

                scope.doubleSpinner = col.length <= 1;
                scope.needsRecycle = col.length > maxLen;
            });

            scope.artBasis = {};

            //this.$timeout(function() {
            //    scope.entries.splice(0, 1);

            //    //scope.getNextPromise =
            //    //        this.getNext()
            //    //            .then(function() {
            //    //                (scope.entries[0] || entryStub).state = ENTRY_STATES.ACTIVE;
            //    //            });
            //}.bind(this), 5000);

            $(window).on('scroll',
                _.throttle(function () {
                    var element = $(window);
                    var offset = element.offset(),
                        top = element.scrollTop() + (offset ? offset.top : 0);

                    console.info('onscroll', top);
                }, 200)
            );

        },
    });

/* jshint ignore:end */

angular
    .module('pr.issues.internal', ['sp.utils']);


angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issueInfoProvider', ['sp.network.api', 'sp.utils.url', function issueInfoProvider(api, urlUtils) {

        'use strict';

        var issueInfoUrl = 'spapi/issueinfo';


        /**
         * Loads new issue info data from server.
         * @param {string} issue - issue identifier (long string).
         * @returns {Promise} - when fulfilled contains issue info  data.
         */
        function load(issue) {
            if (angular.isUndefined(issue)) throw new Error('issue id should be specified.');
            var url = urlUtils.combine(issueInfoUrl, issue);

            function issueInfoLoadedHandler(response) {
                return response.data;
            }

            return api.server
                .get(url)
                .then(issueInfoLoadedHandler);
        }




        return {
            load: load
        };
    }]);



angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issueLayoutProvider', ['sp.network.api', function issueLayoutProvider(api) {

        'use strict';

        /**
         * Loads new issue info data from server.
         * @param {string} issue - issue identifier (long string).
         * @returns {Promise} - when fulfilled contains issue info  data.
         */
        function load(issue) {
            if (angular.isUndefined(issue)) throw new Error('issue id should be specified.');

            function issueInfoLoadedHandler(response) {
                return response.data;
            }

            return api
                .profile('layout')
                .jsonp('', { params: { issue: issue }})
                .then(issueInfoLoadedHandler);
        }




        return {
            load: load
        };
    }]);



/**
 * Created by alexanderk on 6/12/2014.
 */

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.zoom', ['pr.issues.internal.zoomType', function (zoomTypes) {

        'use strict';

        var mandatoryProperties = ['maxWidth', 'maxHeight', 'zoomType'];

        /**
         * Initializes a new instance of zoom structure.
         * @param {object} size - zoom size.
         * @param {Number} size.maxWidth - zoom maximum width.
         * @param {Number} size.maxHeight - zoom maximum height.
         * @param {zoomType} zoomType - zoom type. See {@link zoomType} for details.
         * @param {object} flags - zoom flags.
         * @param {boolean} flags.fitToHeight - indicates whether this zoom fits to the screen height.
         * @param {boolean} flags.disableRestrictedScales - if set to true then during scaling, maximum scale value
         * will have no up line restriction.
         * @constructor
         */
        function Zoom(size, zoomType, flags) {
            this.maxWidth = size.maxWidth;
            this.maxHeight = size.maxHeight;
            this.zoomType = zoomType;
            this.zoomTypes = zoomTypes;
            this.fitToHeight = flags && flags.fitToHeight;
            this.disableRestrictedScales = flags && flags.disableRestrictedScales;

            Object.freeze(this);
        }

        /**
         * Checks whether the specified zoom is valid i.e. has all necessary properties and in the correct state.
         * @param {Zoom} zoom - zoom to check.
         * @returns {{isValid: boolean, message: string}} - validation result. isValid says whether the specified object
         * valid or not and message describes more specifically what is wrong.
         */
        Zoom.prototype.validate = function isValidZoom(zoom) {

            if (!zoom) {
                return {
                    isValid: false,
                    message: 'object is null or undefined.'
                };
            }

            var missedProps = [],
                result = {
                    isValid: true,
                    message: ''
                };

            mandatoryProperties.forEach(function (prop) {

                if (!zoom.hasOwnProperty(prop)) {
                    result.isValid = false;
                    missedProps.push(prop);
                }
            });

            if (!result.isValid) result.message = 'The following properties are missed: ' + missedProps.join(',');
            Object.freeze(result);

            return result;
        };


        return Zoom;
    }]);



angular
    .module('pr.issues.internal')
    .constant('pr.issues.internal.zoomSearchMode', {
        /**
         * Means that during search all zooms will be scanned.
         */
        ALL: 1,
        /**
         * Only zooms with large gap between them will be scanned.
         */
        DISPERSED: 2
    });
angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issuePage', ['pr.issues.internal.zoom',
        'pr.issues.internal.zoomType', 'pr.issues.internal.issuePageArea', function (Zoom, ZOOM_TYPE, Area) {

            'use strict';

            /**
             * Initializes a new instance of IssuePage class.
             * @param {number} pageNumber - page number.
             * @param {IssueInfo} issueInfo - an instance of {@link IssueInfo} object.
             * @param {object} issueInfoData - issue info data, received from server.
             * @param {Array<object>} issueInfoData.pagesInfo - pages info array.
             * @param {object} pageLayoutData - page layout data, received from server.
             * @param {number} pageLayoutData.Width - page layout width.
             * @param {number} pageLayoutData.Height - page layout height.
             * @constructor
             */
            function IssuePage(pageNumber, issueInfo, issueInfoData, pageLayoutData) {
                this.pageNumber = pageNumber;
                this.issueInfo = issueInfo;
                this.size = {
                    width: pageLayoutData.Width,
                    height: pageLayoutData.Height
                };
                this.maxUnrestrictedScale = issueInfoData.pagesInfo[pageNumber - 1].maxUnrestrictedScale;
                Object.freeze(this);
            }

            /**
             * Calculates new issue page scale for the specified container size.
             * @param {number} width - container width.
             * @param {number} height - container height.
             * @param {boolean} [enableRestrictedScale=false] - if set to {@link true}
             * @returns {number} scale - new page scale for the specified size.
             */
            IssuePage.prototype.getScale = function getScale(width, height, enableRestrictedScale) {

                width = parseInt(width, 10);
                height = parseInt(height, 10);
                if (isNaN(width) || width < 0) throw new Error('width parameter should be a valid positive number.');
                if (isNaN(height) || height < 0) throw new Error('height parameter should be a valid positive number.');

                var pageWidth = this.size.width,
                    pageHeight = this.size.height,
                    maxWidth = width > 0 ? width : 100000,
                    maxHeight = height > 0 ? height : 100000,
                    maxScale = (!enableRestrictedScale && this.maxUnrestrictedScale) || 100000,
                    hScale = 0, wScale = 0, scale;

                for (var i = this.issueInfo.heights.length - 1; i >= 0; i--) {
                    var h = this.issueInfo.heights[i];
                    if (h <= maxHeight) {
                        scale = Math.floor(100 * h / pageHeight);
                        if (scale <= maxScale && (maxWidth >= 100000 || Math.floor(pageWidth * scale / 100) <= maxWidth)) {
                            hScale = scale;
                            break;
                        }
                    }
                }

                for (i = this.issueInfo.widths.length - 1; i >= 0; i--) {
                    var w = this.issueInfo.widths[i];
                    if (w <= maxWidth) {
                        scale = Math.floor(100 * w / pageWidth);
                        if (scale <= maxScale && (maxHeight >= 100000 || Math.floor(pageHeight * scale / 100) <= maxHeight)) {
                            wScale = scale;
                            break;
                        }
                    }
                }

                if (hScale || wScale) {
                    return Math.max(hScale, wScale);
                }

                return Math.floor(100 * this.issueInfo.heights[0] / pageHeight);
            };

            /**
             * Calculates size (width and height) for the specified zoom scale.
             * @param {float} scale - zoom scale.
             * @returns {{width: number, height: number}} - size object.
             */
            IssuePage.prototype.getSize = function getSize(scale) {

                scale = parseFloat(scale);
                if (isNaN(scale) || scale < 0) throw new Error('scale parameter should be a valid positive number.');

                var width = Math.floor(scale * this.size.width / 100),
                    height = Math.floor(scale * this.size.height / 100);

                return {
                    width: width,
                    height: height
                };
            };

            /**
             * Calculates size (width and height) for the specified zoom.
             * @param {Zoom} zoom - zoom to calculate size for,
             * @returns {{width: number, height: number}} - size object.
             */
            IssuePage.prototype.getZoomSize = function getZoomSize(zoom) {
                var zoomValidation = Zoom.prototype.validate(zoom);
                if (!zoomValidation.isValid) throw new Error(zoomValidation.message);

                var scale = this.getZoomScale(zoom);

                return this.getSize(scale);
            };

            /**
             * Calculates scale for the specified zoom.
             * @param {Zoom} zoom - zoom object.
             * @param {number} zoom.maxWidth - maximum zoom width.
             * @param {number} zoom.maxHeight - maximum zoom height.
             * @param {zoomType} zoom.zoomType - zoom type.
             * @returns {number} - scale for the zoom provided.
             */
            IssuePage.prototype.getZoomScale = function getZoomScale(zoom) {

                var zoomValidation = Zoom.prototype.validate(zoom);
                if (!zoomValidation.isValid) throw new Error(zoomValidation.message);

                if (zoom.zoomType === ZOOM_TYPE.MAGNIFIER_ZOOM) {
                    return this.getMagnifierScale(zoom);
                } else {
                    return this.getScale(zoom.maxWidth, zoom.maxHeight, !(!!zoom.disableRestrictedScales));
                }

            };

            /**
             * Returns magnifier scale as a smallest scale by one of the dimensions (x,y).
             * @param {Zoom} zoom - zoom, to find a scale for.
             * @param {number} zoom.maxWidth - maximum zoom width.
             * @param {number} zoom.maxHeight - maximum zoom height.
             * @param {zoomType} zoom.zoomType - zoom type. Must be of type MAGNIFIER_ZOOM.
             * @returns {number} - resulting magnifier scale.
             */
            IssuePage.prototype.getMagnifierScale = function getMagnifierScale(zoom) {

                var zoomValidation = Zoom.prototype.validate(zoom);
                if (!zoomValidation.isValid) throw new Error(zoomValidation.message);
                if (zoom.zoomType !== ZOOM_TYPE.MAGNIFIER_ZOOM) {
                    throw new Error('Cannot calculate magnifier scale for non-magnifier zoom.');
                }

                var xScale = zoom.maxWidth * 100 / this.size.width,
                    yScale = zoom.maxHeight * 100 / this.size.height;

                return Math.floor(Math.min(xScale, yScale));
            };

            /**
             * returns an array of areas defined for this page.
             * @returns {Array.<Area>} - array of areas.
             */
            IssuePage.prototype.getAreas = function getAreas() {

                var areas = [],
                    w = this.size.width,
                    h = this.size.height,
                    areaSize = 200;

                for (var y = 0; y < h; y += areaSize) {
                    var b = Math.min(h, y + areaSize);
                    for (var x = 0; x < w; x += areaSize) {

                        var area = new Area(areas.length, {
                            left: x,
                            top: y,
                            right: Math.min(w, x + areaSize),
                            bottom: b
                        });
                        areas[area.id] = area;
                    }
                }
                Object.freeze(areas);

                return areas;
            };

            return IssuePage;
        }]);



angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.zoomInfo', ['pr.issues.internal.zoom', 'pr.issues.internal.zoomType',
        'pr.issues.internal.zoomSearchMode', function (Zoom, ZOOM_TYPE, ZOOM_SEARCH_MODE) {

        'use strict';

        function ZoomInfo(issueInfo, screenWidth, screenHeight) {
            var firstPage = issueInfo.pages[0],
                zooms = [],
                allZooms = [],
                currentZoom,
                defaultMagnifierZoom,
                defaultZoom = new Zoom({ maxWidth: screenWidth, maxHeight: screenHeight },
                    ZOOM_TYPE.NORMAL_ZOOM,
                    { fitToHeight: true, disableRestrictedScales: true });

            zooms.push(defaultZoom);
            allZooms.push(defaultZoom);

            var lastScale = firstPage.getScale(screenWidth, screenHeight, true),
                maxScale = issueInfo.getMagnifierScale(0),
            // scale difference between magnifier scales
                scaleDiff = issueInfo.getMagnifierScale(1) / maxScale;

            //normalize scaleDiff
            scaleDiff = (maxScale - lastScale) / Math.ceil((maxScale - lastScale) / scaleDiff);

            issueInfo.heights.every(function (height) {
                if (height <= screenHeight) return true;
                var scale = 100 * height / firstPage.pageHeight;
                if (scale >= maxScale) return false;

                var zoom = new Zoom({ maxWidth: 0, maxHeight: height }, ZOOM_TYPE.NORMAL_ZOOM);
                allZooms.push(zoom);
                if (scale / lastScale >= scaleDiff && maxScale / scale >= scaleDiff) {
                    zooms.push(zoom);
                    lastScale = scale;
                }

                return true;
            });

            for (var i = 0, len = issueInfo.magnifierPageSizes.length; i < len; i++) {
                var current = issueInfo.magnifierPageSizes[i];
                var mZoom = new Zoom({ maxWidth: current.w, maxHeight: current.h }, ZOOM_TYPE.MAGNIFIER_ZOOM);
                if (i === 1) defaultMagnifierZoom = mZoom;
                zooms.push(mZoom);
                allZooms.push(mZoom);
            }

            /**
             * Gets the default non-magnifier zoom.
             * @returns {Zoom} - default non-magnifier zoom.
             */
            this.defaultZoom = function getDefaultZoom() {
                return defaultZoom;
            };

            /**
             * Contains search modes for zoom lookup.
             */
            this.zoomSearchMode = ZOOM_SEARCH_MODE;

            /**
             * Searches for a zoom that corresponds to the specified scale.
             * @param {Number!} zoomScale - scale zoom needs to be found for.
             * @param {Number} [zoomSearchMode=1] - zoom search mode. see {@link zoomSearchMode} for details.
             * @param {Zoom} [baseZoom] - base zoom. Will be used as a base point to zoom searching.
             * @returns {Zoom} - zoom object corresponds to the specified scale.
             */
            this.findZoom = function findZoom(zoomScale, zoomSearchMode, baseZoom) {

                zoomScale = parseFloat(zoomScale);
                if (isNaN(zoomScale)) throw new Error('Zoom scale should be a valid number.');

                baseZoom = baseZoom || currentZoom;
                var scanningZooms = zoomSearchMode === ZOOM_SEARCH_MODE.ALL ? allZooms : zooms;

                if (baseZoom) {
                    var maxHeight = baseZoom.maxHeight * zoomScale,
                        increment = zoomScale > 1 ? 1 : -1,
                        current = _.find(scanningZooms, { maxHeight: baseZoom.maxHeight });

                    if (!current) {
                        throw new Error('Cannot find base zoom object with maxHeight = ' + baseZoom.maxHeight + '.');
                    }

                    var currentDiff = Math.abs(maxHeight - current.maxHeight),
                        idx = scanningZooms.indexOf(current);

                    while (current) {
                        idx += increment;
                        var next = scanningZooms[idx];
                        if (!next) {
                            return current;
                        }

                        var diff = Math.abs(maxHeight - next.maxHeight);
                        if (diff > currentDiff) {
                            return current;
                        }
                        current = next;
                        currentDiff = diff;
                    }
                    return current || baseZoom;
                }
                /* TODO: not sure this is a good idea to return base zoom. I think it'd be better to throw error. */
                return baseZoom;
            };

            /**
             * Gets or sets current zoom.
             * @param {Zoom?} zoom - if specified, current zoom will be replaced by it. Must be an item of zooms
             * collection stored in this instance.
             * @returns {Zoom|undefined} - if no arguments specified, returns current zoom, otherwise returns undefined.
             */
            this.currentZoom = function getSetCurrentZoom(zoom) {
                if (arguments.length === 0) return currentZoom;

                var isExist = allZooms.indexOf(zoom) > -1;
                if (!isExist) {
                    throw new Error('Parameter should be an item of zooms collection provided by this object.');
                }
                currentZoom = zoom;
                return undefined;
            };

            this.currentZoom(defaultZoom);
        }

        return ZoomInfo;

    }]);

angular
    .module('pr.issues.internal')
    .constant('pr.issues.internal.zoomType', {
        /**
         *  normal zoom - don't need to load picture by parts
         *  */
        NORMAL_ZOOM: 1,
        /**
         *  magnifier zoom - requires picture loading by parts
         */
        MAGNIFIER_ZOOM: 2
    });

/**
 * Created by alexanderk on 6/16/2014.
 */

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issueInfo', ['pr.issues.internal.zoomInfo', 'pr.issues.internal.issuePage', function (ZoomInfo, IssuePage) {

        'use strict';

        var cache = {
            width: Number.NEGATIVE_INFINITY,
            height: Number.NEGATIVE_INFINITY,
            zoomInfo: null
        };

        /**
         * Initializes a new instance of IssueInfo class.
         * @param {!string} issueId - unique issue identifier.
         * @param {!object} issueInfoData - issue info description.
         * @param {!object} issueLayoutData - issue layout description.
         * @constructor
         */
        function IssueInfo(issueId, issueInfoData, issueLayoutData) {
            var firstPage = issueLayoutData.Pages[0];

            this.issueId = issueId;
            this.pages = [];
            this.heights = issueInfoData.heights;

            this.widths = _.sortBy(_.compact(issueInfoData.pageSizes.map(function (pageSize) {

                if (pageSize.w && !pageSize.h) {
                    return pageSize.w;
                }

                return null;
            })));

            this.magnifierPageSizes = issueInfoData.magnifierPageSizes;

            this.layout = {
                width: firstPage.Width,
                height: firstPage.Height
            };

            for (var i = 0; i < issueInfoData.pages; i++) {
                var page = new IssuePage(i + 1, this, issueInfoData, issueLayoutData.Pages[i]);
                this.pages.push(page);
            }

            Object.freeze(this);
        }

        /**
         * Returns zoom information for the specified screen width and height.
         * @param {!number} width - screen width.
         * @param {!number} height - screen height.
         * @returns {ZoomInfo} - see {@link ZoomInfo} for details.
         */
        IssueInfo.prototype.getZooms = function getZooms(width, height) {

            var parsedWidth = parseInt(width, 10),
                parsedHeight = parseInt(height, 10);

            if (isNaN(parsedWidth) || parsedWidth < 0) throw new Error('Width must be a valid positive number.');
            if (isNaN(parsedHeight) || parsedHeight < 0) throw new Error('Height must be a valid positive number.');


            if (!(cache.width === width && cache.height === height)) {
                var zoomInfo = new ZoomInfo(this, parsedWidth, parsedHeight);
                cache.width = parsedWidth;
                cache.height = parsedHeight;
                cache.zoomInfo = zoomInfo;
            }

            return cache.zoomInfo;
        };

        /**
         * Returns magnifier scale for the page size specified by magnifier size array index.
         * @param {!number} magnifierIdx - index in the magnifier array.
         * @returns {number} - magnifier scale.
         */
        IssueInfo.prototype.getMagnifierScale = function getMagnifierScale(magnifierIdx) {

            var idx = parseInt(magnifierIdx, 10);

            if (!(idx < this.magnifierPageSizes.length && idx >= 0)) {
                throw new Error('Magnifier index is outside the bounds of the pages array.');
            }

            var magnifierSize = this.magnifierPageSizes[idx];

            return Math.floor(Math.min(magnifierSize.w * 100 / this.layout.width, magnifierSize.h * 100 / this.layout.height));
        };

        return IssueInfo;

    }]);

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issueImageLoader', ['sp.common.invariants', '$q', 'sp.configuration.imageServersPool',
        function (invariants, $q, imageServersPool) {

            'use strict';

            /**
             * returns url to load issue page graphic view with the specified scale.
             * @param {string} server - image server.
             * @param {string} issue - issue identifier.
             * @param {number} page - issue page, starts from 1.
             * @param {number} scale - page scale.
             * @param {object} rect - rectangle to load.
             * @param {number} rect.left - left point.
             * @param {number} rect.top - top point.
             * @param {number} rect.right - right point.
             * @param {number} rect.bottom - bottom point.
             * @param {string} layer (bg, fg) - layer to download.
             * @returns {string} - issue page url.
             */
            function getDocImageUrl(server, issue, page, scale, rect, layer) {
                if (angular.isUndefined(issue)) throw new Error('issue id should be specified.');
                if (angular.isUndefined(page)) throw new Error('page should be specified.');
                if (angular.isUndefined(scale)) throw new Error('scale should be specified.');

                var pageNumber = parseInt(page, 10),
                    scaleNumber = parseInt(scale, 10);

                if (isNaN(pageNumber)) throw new Error('page should be a number.');
                if (isNaN(scaleNumber)) throw new Error('scale should be a number.');

                var url = server + '?file=' + issue + '&page=' + pageNumber + '&scale=' + scaleNumber;

                if (rect &&
                    angular.isDefined(rect.top) &&
                    angular.isDefined(rect.left) &&
                    angular.isDefined(rect.bottom) &&
                    angular.isDefined(rect.right)) {
                    url += '&left=' + rect.left + '&top=' + rect.top + '&right=' + rect.right + '&bottom=' + rect.bottom;
                }

                if (layer) {
                    url += '&layer=' + layer;
                }

                return url;
            }


            function createUrl(issueId, pageIndex, scale, rect, layer) {
                return imageServersPool.get().then(function (server) {
                    return getDocImageUrl(server, issueId, pageIndex, scale, rect, layer);
                });

            }

            /**
             * Loads issue page as an image.
             * @param {string} issueId - issue id.
             * @param {number} pageIndex - page index, one-based (should start from 1).
             * @param {float} scale - desired page scale.
             * @param {object} rect - rectangle to load.
             * @param {number} rect.left - left point.
             * @param {number} rect.top - top point.
             * @param {number} rect.right - right point.
             * @param {number} rect.bottom - bottom point.
             * @param {string} layer (bg, fg) - layer to download.
             * @returns {Promise} - promise object, when resolved contains {url:string} object.
             */
            function loadImage(issueId, pageIndex, scale, rect, layer) {

                var defer = $q.defer(),
                    image = new Image();
//                    timestamp = Date.now();

                createUrl(issueId, pageIndex, scale, rect, layer)
                    .then(function (url) {
                        image.src = url;

                        image.onload = function issueImageLoaded() {
                            this.onload = this.onerror = this.onabort = null;
                            var timestamp = Date.now();
                            defer.resolve({
                                url: url,
                                timestamp: timestamp,
                                args: {
                                    issueId: issueId,
                                    pageIndex: pageIndex,
                                    scale: scale,
                                    rect: rect
                                }
                            });
                        };

                        image.onerror = image.onabort = function issueImageLoadError() {
                            this.onload = this.onerror = this.onabort = null;

                            defer.reject({ reason: 'image loading error.' });
                        };

                    }, function (reason) {
                        defer.reject(reason);
                    });




                return defer.promise;
            }

            return {
                load: loadImage,
                createUrl: createUrl
            };

        }]);

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issuePageArea', function () {

        'use strict';

//        var area = { left: x,
//            top: y,
//            right: Math.min(w, x + areaSize),
//            bottom: b,
//            id: areas.length
//        };


        function Area(id, rect) {

            this.id = id;
            this.rect = rect;
//            this.left = rect.left;
//            this.top = rect.top;
//            this.right = rect.right;
//            this.bottom = rect.bottom;

            Object.freeze(this);
        }

        return Area;
    });


angular
    .module('pr.issues.internal')
    .constant('pr.issues.internal.pagesViewEvents', {
        PAGE_IMAGE_LOADED: 'pr.view.pagesview.image_loaded',
        ALL_IMAGES_LOADED: 'pr.view.pagesview.all_images_loaded',
        PAGES_COLLECTION_CHANGED: 'pr.view.pagesview.pages_collection_changed',
//        PAGE_SCALE_CHANGED: 'pr.view.pagesview.page_scaled',
        PAGE_CHANGED: 'pr.view.pagesview.page_changed',
        GESTURE_RECOGNIZED: 'pr.view.pagesview.gesture_recognized',
        CONTAINER_POSITION_CHANGED: 'pr.view.pagesview.container_position_changed',
        BEGIN_ANIMATION: 'pr.view.pagesview.begin_animation',
        END_ANIMATION: 'pr.view.pagesview.end_animation',
        STOP_ANIMATION: 'pr.view.pagesview.stop_animation',
        BEGIN_PAGE_ANIMATION: 'pr.view.pagesview.begin_page_animation',
        END_PAGE_ANIMATION: 'pr.view.pagesview.end_page_animation',
        REEVALUATE_OPTIMIZING: 'pr.view.pagesview.reevaluate_optimizing'
    });


angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.arranger', ['pr.issues.internal.screenBoundsProvider', function (screenBounds) {

        'use strict';

        function Arranger(pages, DEFAULT_PAGE_DISTANCE) {

            this.centerContainer = function centerContainer(pageContainer, screenContainer) {

                var screenWidth = screenBounds.width(),
                    pageLeft = pageContainer.transform.translate.left,
                    pageWidth = pageContainer.size.width;

                // formula is (lpage + rpage) / 2 == (lscreen + rscreen) / 2
                var containerLeft = parseInt((2 * pageLeft + pageWidth - screenWidth) / 2, 10);

                screenContainer.transform.translate.left = -1 * containerLeft;
            };

            /**
             * Arranges pages in order to be one after another with the specified distance.
             * @param {Number} centerPageIdx - index of the page related offsets will be calculated from.
             * @param {Number} centerPageLeft - center page left position.
             */
            this.arrangePages = function arrange(centerPageIdx, centerPageLeft) {

                centerPageIdx = centerPageIdx || 0;
                centerPageLeft = centerPageLeft || 0;

                var left = centerPageLeft,
                    issuePage,
                    scale;

                // pages to the right
                for (var i = centerPageIdx + 1, len = pages.length; i < len; i++) {
                    var prevPage = pages[i - 1];

                    issuePage = pages[i];
                    scale = prevPage.container.transform.scale || 1;

                    left += prevPage.container.size.width * scale + DEFAULT_PAGE_DISTANCE;
                    issuePage.container.transform.translate.left = left;

                }

                left = centerPageLeft;

                // pages to the left
                for (i = centerPageIdx - 1; i >= 0; i--) {
                    issuePage = pages[i];
                    scale = issuePage.container.transform.scale || 1;

                    left -= issuePage.container.size.width * scale + DEFAULT_PAGE_DISTANCE;
                    issuePage.container.transform.translate.left = left;
                }
            };
        }


        return Arranger;
    }]);




angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.momentum', function () {

        'use strict';


        function momentum(distance, minDistance, maxDistance, time) {
            var deceleration = 0.0006,
                speed = Math.abs(distance) / time,
                newDist = (speed * speed) / (2 * deceleration),
                newTime;

            // Proportionally reduce speed if we are outside of the boundaries
            if (distance > 0 && newDist > maxDistance) {
                speed = speed * maxDistance / newDist;
                newDist = maxDistance;
            } else if (distance < 0 && newDist > minDistance) {
                speed = speed * minDistance / newDist;
                newDist = minDistance;
            }

            newDist = newDist * (distance < 0 ? -1 : 1);
            newTime = speed / deceleration;

            return {
                distance: Math.round(newDist),
                time: Math.round(newTime)
            };
        }

        return momentum;

//        _momentum: function (distance, time) {
//
//
//            var deceleration = 0.0006,
//                speed = Math.abs(distance) / time,
////                oldSpeed = speed,
//                newDist = (speed * speed) / (2 * deceleration),
//                scope = this.$,
//                containerPos = -1 * scope.translate.left,
//                estimatedContainerPos = containerPos + (distance < 0 ? 1 : -1) * newDist,
//                pages = scope.pagesPool.pages(scope.translate),
//                firstVisiblePage = _.find(pages, { isVisible: true }),
//                lastVisiblePage = _.findLast(pages, { isVisible: true }),
//                minDist = firstVisiblePage.translate.left || 0,
//                maxDist = (lastVisiblePage.translate.left + lastVisiblePage.panel.size.width - this.$window.innerWidth),
//                newTime;
//
////            if (dist > 0 && newDist > maxDistUpper) {
////                outsideDist = size / (6 / (newDist / speed * deceleration));
////                maxDistUpper = maxDistUpper + outsideDist;
////                returnTime = 800 / size * outsideDist + 100;
////                speed = speed * maxDistUpper / newDist;
////                newDist = maxDistUpper;
//
//            // Proportinally reduce speed if we are outside of the boundaries
//            if (estimatedContainerPos > maxDist) {
//                var maxRelativeDist = maxDist - containerPos;
//                speed = speed * maxRelativeDist / newDist;
//                newDist = maxRelativeDist;
////                console.log('reducing speed - moving left. old speed - ' + oldSpeed + ', new speed - ' + speed);
//            } else if (estimatedContainerPos < minDist) {
//                var minRelativeDist = containerPos - minDist;
//                speed = speed * minRelativeDist / newDist;
//                newDist = minRelativeDist;
////                console.log('reducing speed - moving right. old speed - ' + oldSpeed + ', new speed - ' + speed);
//            }
//
//            newDist = (distance < 0 ? -1 : 1) * newDist;
//
//            newTime = Math.abs(speed) / deceleration;
////            console.log('time = ' + newTime);
//
//            return {
//                distance: parseInt(newDist, 10),
//                time: Math.round(newTime)
//            };
//        },
    });

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.transformDescriptor', function () {

        'use strict';

        function TransformDescriptor(translate, scale) {

            translate = translate || { left : 0, top: 0 };
            scale = scale || null;

            this.translate = translate;
            this.scale = scale;
            this.origin = {
                x: 0,
                y: 0
            };

            Object.freeze(this);
        }

        TransformDescriptor.prototype.toCssTransform = function toCssTransform(use3d) {

            var translateTop = this.translate.top,
                translateLeft = this.translate.left,
                scale = this.scale,
                res = '';

            if (translateTop || translateLeft) {
                if (use3d) {
                    res = 'translate3d(' + parseInt(translateLeft || 0, 10) + 'px,' + parseInt(translateTop || 0, 10) + 'px,0px)';
                }
                else {
                    res = 'translate(' + parseInt(translateLeft || 0, 10) + 'px,' + parseInt(translateTop || 0, 10) + 'px)';
                }
            }
            if (scale && Math.abs(scale - 1) > 0.000001) {
                res += ' scale3d(' + scale + ',' + scale + ',1.000)';
            }
            return res;
        };

        TransformDescriptor.prototype.toCssOrigin = function toCssOrigin() {
            var origin = this.origin;

            if (!origin ||
                (!origin.x && !origin.y)) return '';

            return origin.x + 'px ' + origin.y + 'px';
        };

        return TransformDescriptor;
    });


angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issueImage', ['pr.issues.internal.transformDescriptor', function (TransformDescriptor) {


        'use strict';

        function IssueImage(container, conf) {

            this.loaded = conf.loaded;
            this.url = conf.url;
            this.timestamp = conf.timestamp;
            this.container = container;
            this.transform = conf.transform || new TransformDescriptor();
            this.size = conf.size || {};

        }

        IssueImage.prototype.getSize = function getImageSize() {
            if (this.size.width && this.size.height) return this.size;

            return this.container.size;
        };

        return IssueImage;

    }]);
/**
 * Created by alexanderk on 5/5/2014.
 */


angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issuePageViewModel', ['pr.issues.internal.screenBoundsProvider',
        'pr.issues.internal.transformDescriptor',
        'pr.issues.internal.issueImage',
        function (screenBounds, TransformDescriptor, IssueImage) {

            'use strict';

            function IssuePage(issueInfo, issuePageInfo) {

                var zooms = issueInfo.getZooms(screenBounds.width(), screenBounds.height()),
                    scale = issuePageInfo.getScale(screenBounds.width(), screenBounds.height()) / 100,
                    zoom = zooms.findZoom(scale, zooms.zoomSearchMode.ALL),
                    size = issuePageInfo.getZoomSize(zoom);


                this.timestamp = (new Date()).getTime();
                this.issueId = issueInfo.issueId;
                this.index = issuePageInfo.pageNumber - 1;
                this.pageInfo = Object.freeze(issuePageInfo);

                this.defaults = {
                    zoom: zoom,
                    image: {},
                    container: {
                        size: angular.copy(size),
                        offset: {}, // always received from UI
                        transform: new TransformDescriptor({left: 0, top: parseInt((screenBounds.height() - size.height) / 2)})
                    }
                };

                /**
                 * Resets page parameters to their default values.
                 */
                this.setDefaults = function setPageDefaults() {
                    this.zoom = this.defaults.zoom;
                    this.image = angular.copy(this.defaults.image);
                    this.container = angular.copy(this.defaults.container);
                };

                /**
                 * Checks whether page is in restricted mode.
                 * @returns {boolean}, true - if page is in restricted mode, false - otherwise.
                 */
                this.isInRestrictedMode = function isInRestrictedMode() {
                    return issuePageInfo.maxUnrestrictedScale > 0;
                };


                /**
                 * checks if page currenly has default zoom fit to screen bounds.
                 * @returns {boolean}, true - if default zoom is set, false - otherwise.
                 */
                this.isDefaultZoomSet = function isDefaultZoomSet() {
                    return this.zoom === this.defaults.zoom;
                };

                /**
                 * Sets page image information.
                 * @param {object} imgInfo - object contained image information.
                 * @param {string} imgInfo.url - image url.
                 * @param {date}   imgInfo.timestamp - timestamp when image was loaded.
                 */
                this.setImage = function setImage(imgInfo) {

                    var required = ['url', 'timestamp'];

                    if (_.intersection(Object.keys(imgInfo), required).length !== required.length) {
                        throw new Error('Parameter must contain the following properties: ' + required.join(','));
                    }

                    this.image = new IssueImage(this.container, {
                        loaded: true,
                        url: imgInfo.url,
                        timestamp: imgInfo.timestamp
                    });
                };

                Object.freeze(this.defaults);
                this.setDefaults();
            }

            return IssuePage;
        }]);

/**
 * Created by alexanderk on 5/5/2014.
 */


angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.pageScaleService', function pageScaleService() {

        'use strict';

        /**
         * Initializes a new instance of PageScaleService.
         * Note: this service supports vertical page alignment only. Maybe it should support both screen orientations.
         * @param {object} containerTranslation - an object with pages container translation.
         * @param {number} containerTranslation.left - container left translation.
         * @constructor
         */
        function PageScaleService(containerTranslation) {

            if (!containerTranslation) throw new Error('containerTranslation is required.');
            if (!angular.isObject(containerTranslation) || !angular.isDefined(containerTranslation.left)) {
                throw new Error('containerTranslation should be an object and contain left property.');
            }

            var startLeft,
                startTop,
                startX,
                startY,
                dx,
                dy,
                startContainerLeft,
                origin = null,
                pageInfo,
                pageSize,
                pageZoom,
                scale;

            /**
             * Starts a new zoom process.
             * @param {IssuePageViewModel} page - page view model.
             * @param {object} page.container.offset - an object with page panel coordinates.
             * @param {number} page.container.offset.left - page panel left coordinate.
             * @param {number} page.container.offset.top - page panel top coordinate.
             * @param {object} page.container.transform.translate - an object with page translation.
             * @param {number} page.container.transform.translate.left - page left translation.
             * @param {number} page.container.transform.translate.top - page top translation.
             * @param {IssuePage} page.pageInfo - page metadata.
             * @param {number} page.container.transform.scale - page scale.
             * @param {object} page.size - an object describing page size.
             * @param {number} page.size.width - page width.
             * @param {number} page.size.height - page height.
             * @param {object} gesture - an object with current gesture.
             * @param {object} gesture.center - object defining gesture's center position.
             * @param {number} gesture.center.pageX - x coordinate of gesture's center.
             * @param {number} gesture.center.pageY - y coordinate of gesture's center.
             * @returns {object} origin - object that contains gesture center point coordinates related to current page.
             * @returns {number} origin.x - x coordinate of gesture center point.
             * @returns {number} origin.y - y coordinate of gesture center point.
             */
            this.zoomStart = function zoomStart(page, gesture) {

                if (!page) throw new Error('page is required.');
                if (!page.container) throw new Error('page.container is required.');
                if (!page.container.offset) throw new Error('page.container.offset is required.');
                if (!page.container.size) throw new Error('page.container.size is required.');
                if (!page.container.transform) throw new Error('page.container.transform is required.');
                if (!gesture) throw new Error('gesture is required.');
                if (!gesture.center) throw new Error('gesture.center is required.');

                if (origin) throw new Error('zoom is already running');

                startLeft = page.container.transform.translate.left || 0;
                startTop = page.container.transform.translate.top || 0;
                startContainerLeft = containerTranslation.left || 0;
                startX = gesture.center.x;
                startY = gesture.center.y;
                pageInfo = page.pageInfo;
                pageZoom = page.zoom;
                pageSize = page.container.size;

                var panelLeft = page.container.offset.left ? parseInt(page.container.offset.left, 10) : 0,
                    panelTop = page.container.offset.top ? parseInt(page.container.offset.top, 10) : 0;

                origin = {
                    x: startX - panelLeft,
                    y: startY - panelTop
                };

                return origin;
            };

            /**
             * Determines whether this service is already tracking zooming process or not.
             * @returns {boolean} - true, if service has already registered zoomStart call, false - otherwise.
             */
            this.isZoomStarted = function isZoomStarted() {
                return origin !== null;
            };

            /**
             * Tracks current zoom process and records scale change
             * @param {object} gesture - an object with current gesture.
             * @param {object} gesture.center - object defining gesture's center position.
             * @param {number} gesture.center.pageX - x coordinate of gesture's center.
             * @param {number} gesture.center.pageY - y coordinate of gesture's center.
             * @param {number} gesture.scale - current scale.
             * @returns {{page: {left: (Number), top: (Number)}, delta: {x: (Number), y: (Number)}, scale: (gesture.scale)}}
             */
            this.zoom = function zoom(gesture) {

                if (!gesture) throw new Error('gesture is required.');
                if (!gesture.center) throw new Error('gesture.center is required.');
                if (!origin) throw new Error('Zoom process has not been started.');

                dx = gesture.center.x - startX;
                dy = gesture.center.y - startY;
                scale = gesture.scale;

                var left = startLeft + dx,
                    top = startTop + dy,
                    deltaX = parseInt(origin.x * (scale - 1), 10),
                    deltaY = parseInt(origin.y * (scale - 1), 10);

//                console.log('zoom in process. page.left = ' + left + ',top=' + top);

                return {
                    page: {
                        left: left,
                        top: top
                    },
                    delta: {
                        x: deltaX,
                        y: deltaY
                    },
                    scale: gesture.scale
                };
            };


            /**
             * Handles zoom end.
             * @param {ZoomInfo} zooms - an array of zooms.
             * @returns {{page: {left: number, intermediateTop: number, top: number},container: {left: number}, scale: number, zoom: *, setTopImmediately: boolean, delta: {x: number, y: number}}}
             */
            this.zoomEnd = function zoomEnd(zooms) {

                if (!origin) throw new Error('Zoom process has not been started.');
                if (!scale)  throw new Error('Zoom process has started but no scale change has been tracked. Probably zoom method has never been called.');
                if (!zooms || !angular.isFunction(zooms.findZoom)) throw new Error('Zooms must be a valid object and respond to findZoom method.');

                var old = {
                        width: parseInt(pageSize.width * scale, 10),
                        height: parseInt(pageSize.height * scale, 10)
                    },
                    zoom = zooms.findZoom(scale, zooms.zoomSearchMode.ALL, pageZoom),
                    size = pageInfo.getZoomSize(zoom),
                    widthDiff = size.width / old.width,
                    intermediateScale = scale * widthDiff;


                var xOffset = parseInt(origin.x * (intermediateScale - 1), 10),
                    yOffset = parseInt(origin.y * (intermediateScale - 1), 10),
                    currentScale = intermediateScale,
                    pageTop = zoom.fitToHeight ? 0 : startTop + dy - yOffset,
                    intermediateTop = zoom.fitToHeight ? origin.y * (intermediateScale - 1) : 0;

                origin = null;
                scale = null;

                return {
                    page: {
                        left: startLeft,
                        intermediateTop: intermediateTop,
                        top: pageTop
                    },
                    container: {
                        left: startContainerLeft + dx - xOffset
                    },
                    scale: currentScale,
                    zoom: zoom,
                    setTopImmediately: !!zoom.fitToHeight,
                    delta: {
                        x: dx - xOffset,
                        y: dy - yOffset
                    }
                };
            };
        }


        return PageScaleService;

    });

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.issuePagesPool', ['pr.issues.internal.screenBoundsProvider', function (screenBoundsProvider) {

        'use strict';

        /**
         * Initializes a new instance of issue pages pool
         * @param {!Array.<object>} issuePages - an array of objects each of them represent an issue page.
         * @param {number} maxPagesAvailableCount - max pages simultaneously exist in the pool.
         * @constructor
         */
        function PagesPool(issuePages, maxPagesAvailableCount) {

            if (!issuePages) throw new Error('issuePages is required.');
            if (!angular.isArray(issuePages)) throw new Error('issuePages must be of Array type.');

            issuePages.forEach(function (issuePage) {
                issuePage.isVisible = false;
            });

            var centerPageIdx = 0,
                windowWidth = screenBoundsProvider.width(),
                cache = {
                    pages: [],
                    offset: {
                        left: Number.NEGATIVE_INFINITY
                    }
                };


            function isPageVisible(page, offset) {

                var offsetLeft = offset.left,
                    container = page.container,
                    pageLeft = container.transform.translate.left || 0,
                    pageWidth = container.size.width * (container.transform.scale || 1),
                    pageRight = pageLeft + pageWidth,
                    screenLeft = Math.abs(offsetLeft),
                    screenRight = screenLeft + windowWidth;

                var pageInsideScreenBoundaries = (offsetLeft + pageLeft > 0 && offsetLeft + pageLeft < windowWidth) ||
                        (offsetLeft + pageRight > 0 && offsetLeft + pageRight < windowWidth),
                    screenInsidePageBoundaries = pageLeft < screenLeft && pageRight > screenRight;

//                console.log('checking page ' + page.index + ' visibility. pageLeft = ' + pageLeft + ', pageRight = ' + pageRight +
//                    ', screenLeft = ' + screenLeft + ', screenRight = ' + screenRight + ', result = ' + pageInsideScreenBoundaries);

                return pageInsideScreenBoundaries || screenInsidePageBoundaries;
            }

            function pages() {

                var left = parseInt((cache.offset && cache.offset.left || 0), 10);

                if (!cache.offset) { cache.offset = { left: left }; }

                var len = issuePages.length,
                    firstVisiblePageIndex,
                    lastVisiblePageIndex;

                issuePages.forEach(function (issuePage) {
                    issuePage.isVisible = false;
                });

                for (var i = 0; i < len; i++) {
                    var isVisible = isPageVisible(issuePages[i], cache.offset);
                    if (!isVisible && angular.isDefined(firstVisiblePageIndex)) {
                        lastVisiblePageIndex = i - 1;
                    }

                    if (angular.isDefined(firstVisiblePageIndex) &&
                        angular.isDefined(lastVisiblePageIndex)) break;

                    if (isVisible && angular.isUndefined(firstVisiblePageIndex)) firstVisiblePageIndex = i;
                }

                if (angular.isUndefined(lastVisiblePageIndex) &&
                    angular.isDefined(firstVisiblePageIndex)) lastVisiblePageIndex = firstVisiblePageIndex;

                if (angular.isUndefined(firstVisiblePageIndex) ||
                    angular.isUndefined(lastVisiblePageIndex)) {
                    throw new Error('No visible pages found.');
                }

                // now we have visible interval and can build pages array in constant time
                var firstIndex,
                    lastIndex;

                centerPageIdx = Math.floor((lastVisiblePageIndex + firstVisiblePageIndex) / 2);
                firstIndex = Math.floor(Math.max(0, centerPageIdx - (maxPagesAvailableCount / 2)));
                lastIndex = Math.floor(Math.min(len - 1, centerPageIdx + (maxPagesAvailableCount / 2)));

                if (lastIndex - firstIndex < maxPagesAvailableCount) {
                    if (lastIndex === len) {
                        firstIndex -= (maxPagesAvailableCount - 1) - (lastIndex - firstIndex);
                        lastIndex = len - 1;
                    }
                    else {
                        lastIndex += (maxPagesAvailableCount - 1) - (lastIndex - firstIndex);
                        lastIndex = Math.min(lastIndex, issuePages.length - 1);
                    }
                }

                for (i = firstIndex; i <= lastIndex; i++) {
                    issuePages[i].isVisible = true;
                }


                return issuePages;
            }

            /**
             * sets current offset and recalculates visible pages.
             * @param {object?} offset - screen visible area.
             * @param {number} offset.left - left coordinate of screen visible area.
             */
            this.setOffset = function setOffset(offset) {
                cache.offset.left = offset.left;
                cache.pages = pages();
            };


            /**
             * Returns last visible page.
             * @param {object?} offset - screen visible area.
             * @param {number} offset.left - left coordinate of screen visible area.
             * @returns {Object} - an instance of IssuePage class.
             */
            this.getLastVisiblePage = function (offset) {
                var pages = this.pages(offset);

                return _.findLast(pages, { isVisible: true });
            };

            /**
             * Returns first visible page.
             * @param {object?} offset - screen visible area.
             * @param {number} offset.left - left coordinate of screen visible area.
             * @returns {Object} - an instance of IssuePage class.
             */
            this.getFirstVisiblePage = function (offset) {
                var pages = this.pages(offset);

                return _.find(pages, { isVisible: true });
            };

            /**
             * Returns pages currently in the pool. Visible pages are in the center of returning array.
             * @param {object?} offset - screen visible area.
             * @param {number} offset.left - left coordinate of screen visible area.
             * @returns {Array.<object>} - an array of issue pages.
             */
            this.pages = function pages() {
                if (!cache.pages.length) throw new Error('setOffset has not been called before pages call.');

                return cache.pages;
            };
        }

        return PagesPool;
    }]);


/**
 * Created by alexanderk on 10/6/2014.
 */


angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.screenBoundsProvider', ['$window', function ($window) {

        'use strict';

        return {
            width: function () { return $window.innerWidth; },
            height: function () { return $window.innerHeight; }
        };
    }]);

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.pagesViewController.handlers.pan', ['pr.issues.internal.pagesViewEvents',
        function (pagesViewEvents) {

            'use strict';


            /**
             * Handles press events correlated to pages view controller gestures processing.
             * @param {Scope} scope - pages view controller scope.
             * @param {Object} scope.container - pages view container settings.
             * @param {Object} scope.optimizing - optimizing panel settings.
             * @param {Number} scope.imagesCountToLoad - number of images currently loading in background.
             * This parameter is used to determine whether optimizing window should be closed.
             * @param {Number} scope.MIN_TIME_TO_ANIMATE_SCROLL - minimum amount of time in milliseconds
             * required to user gesture in order to start animating scrolling process.
             * @param {Object} pagesPoolInstance - an instance of {@link pr.issues.internal.pagesPool} service.
             * @constructor
             */
            function PanHandler(scope, pagesPoolInstance, arranger) {

                function setContainerLeftPosition(gesture) {
                    containerTransform.translate.left = state.initial.left + (gesture.deltaX - state.delta.x);
                }

                function pageIndexIsValid(pageIndex) {
                    if (pageIndex === null) return false;

                    if (pageIndex >= pagesPoolInstance.pages().length ||
                        pageIndex < 0) {
                        return false;
                    }

                    return true;
                }

                function onAnimationEnded() {
                    pagesPoolInstance.setOffset(scope.container.transform.translate);
                    firePageChangesEvent(pagesPoolInstance.pages());

                    event.stopPropagation(); // we do not want this event being bubbled higher than this controller.
                }

                function firePageChangesEvent(changedPages) {

                    scope.imagesCountToLoad = 0;
                    scope.$broadcast(pagesViewEvents.PAGE_CHANGED, changedPages.map(function (p) {
                        if (!p.image.loaded && p.isVisible) {
                            scope.imagesCountToLoad++;
                        }

                        if (scope.imagesCountToLoad > 0) {
                            scope.optimizing.show = true;
                            scope.$broadcast(pagesViewEvents.REEVALUATE_OPTIMIZING);
                            console.log('will wait for loading ' + scope.imagesCountToLoad);
                        }

                        return p.index;
                    }));
                }

                var state = { active: false },
                    containerTransform = scope.container.transform,
                    unsubscribeFn = scope.$on(pagesViewEvents.END_ANIMATION, onAnimationEnded);


                /**
                 * Runs when pages view container scope is destroying.
                 */
                this.$destroy = function $destroy() {
                    unsubscribeFn();
                };

                /**
                 * Handles pan gesture event.
                 * @param {object} gesture - an object describing current gesture.
                 * @param {object} page - an instance of {@link pr.issues.internal.issuePageViewModel}.
                 */
                this.handle = function (gesture, page) {

                    var fn = this[gesture.type.replace('pan', '')];

                    if (!fn) throw Error('No handler defined for gesture ' + gesture.type);
                    //console.log('pan. ' + gesture.type.replace('pan', ''));
                    fn(gesture, page);
                };

                /**
                 * Handles panstart event.
                 * @param {object} gesture - an object describing current gesture.
                 * @param {object} page - an instance of {@link pr.issues.internal.issuePageViewModel}.
                 */
                this.start = function handleStart(gesture, page) {

                    if (scope.getZoom() - 1 > 0.01) {

                        console.log('page zoomed - pan cancelled.');
                        return;
                    }

                    state = {
                        active: true,
                        initial: {
                            left: containerTransform.translate.left,
                            top: page && page.container.transform.translate.top
                        }
                    };

                    state.delta = {
                        x: gesture.deltaX,
                        y: gesture.deltaY
                    };
                };

                /**
                 * Handles panmove event.
                 * @param {object} gesture - an object describing current gesture.
                 * @param {object} page - an instance of {@link pr.issues.internal.issuePageViewModel}.
                 */
                this.move = function handleMove(gesture) {

                    if (!state.active) {
                        console.log('no pan start registered. ignoring move.');
                        return;
                    }

                    state.move = true;

                    setContainerLeftPosition(gesture);

                    scope.$broadcast(pagesViewEvents.CONTAINER_POSITION_CHANGED);
                };

                /**
                 * Handles panend event.
                 * @param {object} gesture - an object describing current gesture.
                 * @param {object} page - an instance of {@link pr.issues.internal.issuePageViewModel}.
                 */
                this.end = function handleEnd(gesture, page) {

                    if (!state.active) {
                        console.log('no pan start registered. ignoring end.');
                        return;
                    }

                    setContainerLeftPosition(gesture);


                    //setPageTopPosition(gesture, page);

                    var distance = -1 * (gesture.deltaX - state.delta.x),
                        nextPageIndex = null,
                        pages = pagesPoolInstance.pages();

                    if (page) {
                        nextPageIndex = distance > 0 ? page.index + 1 : page.index - 1;
                    }

                    if (!state.move) {
                        console.log('no move.', distance, gesture.deltaTime);
                    }


                    state = { active: false };



                    if (gesture.deltaTime <= scope.MIN_TIME_TO_ANIMATE_SCROLL &&
                        !!distance &&
                        pageIndexIsValid(nextPageIndex)) {

                        //var momentum = momentumService(distance, minDistance, maxDistance, gesture.deltaTime);
                        var time = 200;
                        //momentum.distance =
                        console.log('navigating to', nextPageIndex);
                        arranger.centerContainer(pages[nextPageIndex].container, scope.container);

                        //containerTransform.translate.left += -1 * momentum.distance;

                        scope.$broadcast(pagesViewEvents.BEGIN_ANIMATION, { time: time });
                        scope.$broadcast(pagesViewEvents.CONTAINER_POSITION_CHANGED);
                    }
                    else {
                        pagesPoolInstance.setOffset(containerTransform.translate);
                        scope.$broadcast(pagesViewEvents.CONTAINER_POSITION_CHANGED);
                        firePageChangesEvent(pagesPoolInstance.pages());
                    }

                };

                scope.$on('$destroy', this.$destroy);
            }

            return PanHandler;


        }]);

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.pagesViewController.handlers.pinch', ['pr.issues.internal.pagesViewEvents',
        function (pagesViewEvents) {

            'use strict';


            /**
             * Handles pinch events correlated to pages view controller gestures processing.
             * @param {Scope} scope - pages view controller scope.
             * @param {Object} scope.container - pages view container settings.
             * @param {Object} pagesPoolInstance - an instance of {@link pr.issues.internal.pagesPool} service.
             * @constructor
             */
            function PinchHandler(scope, pagesPoolInstance) {
                /* arranger */
                var state = {};

                this.$destroy = angular.noop();

                /**
                 * Handles pinch gesture event.
                 * @param {object} gesture - an object describing current gesture.
                 * @param {object} page - an instance of {@link pr.issues.internal.issuePageViewModel}.
                 */
                this.handle = function handlePinch(gesture, page) {
                    var fn = this[gesture.type.replace('pinch', '')];

                    if (!fn) throw Error('No handler defined for gesture ' + gesture.type);

                    console.log('pinch', gesture.type);
                    fn(gesture, page);
                };

                /**
                 * Handles pinchstart gesture event.
                 * @param {object} gesture - an object describing current gesture.
                 * @param {object} page - an instance of {@link pr.issues.internal.issuePageViewModel}.
                 */
                this.start = function handlePinchStart(gesture, page) {
                    if (!page || page.isInRestrictedMode()) return;

                    state = {
                        active: true
                    };
                };

                /**
                 * Handles pinchmove gesture event.
                 */
                this.move = function handlePinchMove() {
                };

                /**
                 * Handles pinchend gesture event.
                 * @param {object} gesture - an object describing current gesture.
                 * @param {object} page - an instance of {@link pr.issues.internal.issuePageViewModel}.
                 */
                this.end = function handlePinchEnd(gesture, page) {
                    if (!state.active) return;
                    if (!page) return;

                    var scale = scope.getZoom(),
                        prevScale = page.scale || 1,
                        zooms = scope.zooms,
                        zoom = zooms.findZoom(scale / prevScale, zooms.zoomSearchMode.ALL, page.zoom);

                    console.log('new zoom', zoom);
                    //page.container.size = size;
                    page.zoom = zoom;
                    page.scale = scale;
                    scope.$broadcast(pagesViewEvents.PAGE_CHANGED, _.pluck(pagesPoolInstance.pages(), 'index'));
                };


            }


            return PinchHandler;


        }]);

angular
    .module('pr.issues.internal')
    .factory('pr.issues.internal.pagesViewController.handlers.press', ['pr.issues.internal.pagesViewEvents',
        function (pagesViewEvents) {

            'use strict';


            /**
             * Handles press events correlated to pages view controller gestures processing.
             * @param {Scope} scope - pages view controller scope.
             * @constructor
             */
            function PressHandler(scope) {

                /**
                 * Handles press gesture events.
                 */
                this.handle = function () {
                    scope.$broadcast(pagesViewEvents.STOP_ANIMATION);
                };

                this.$destroy = angular.noop;
            }

            return PressHandler;


        }]);
angular
    .module('pr.issues.ui', ['pr.issues.internal']);

angular
    .module('pr.issues.ui')
    .directive('uiPrIssuePageImages', ['$q', '$rootScope',
        'pr.issues.internal.pagesViewEvents', 'pr.issues.internal.issueImageLoader',
        'pr.issues.internal.issueImage', 'pr.issues.internal.transformDescriptor',
        function ($q, $rootScope, pagesViewEvents, issueImageLoader) {

            'use strict';


            function loadImage(scope, scale, rect, layer) {

                var defer = $q.defer();

                issueImageLoader
                    .load(scope.issuePage.issueId, scope.issuePage.index + 1, scale, rect, layer)
                    .then(function (imageInfo) {
                        if (imageInfo.timestamp > scope.timestamp) {
                            scope.timestamp = imageInfo.timestamp;
                            defer.resolve(imageInfo);
                        }
                        else {
                            defer.reject();
                        }
                    }, function (data) {
                        defer.reject(data);
                    });

                return defer.promise;
            }

            function updateImageSize(scope) {

                var newSize = scope.issuePage.image.container.size;

                // keep container size - in case of change we'll update image physical size.
                scope.size = angular.copy(newSize);
            }

            function loadZoomImage(scope, scale, layer, emitEvent) {

                var page = scope.issuePage,
                    images = scope.images;

                emitEvent = angular.isUndefined(emitEvent) ? true : emitEvent;

                if (!page.image.loading) {
                    // load new image
                    page.image.loading = true;

                    loadImage(scope, scale, null, layer)
                        .then(function zoomImageLoaded(imgInfo) {

                            images.length = 0;
                            page.setImage(imgInfo);
                            images.push(page.image);

                            updateImageSize(scope);
                            if (emitEvent) {
                                scope.$emit(pagesViewEvents.PAGE_IMAGE_LOADED);
                            }
                        });
                }
                else {
                    // image has already been loaded
                    images.push(page.image);
                }
            }

//            function loadMagnifierZoomImages(scope, zoomScale) {
//                var pageInfo = scope.issuePage.pageInfo,
//                    areas = pageInfo.getAreas(),
//                    promises = [];
//
//                // remove old images
//                scope.issuePage.image = {};
//
//                // first of all we have to load background image
//
//                // todo: background may be restricted, needs to check issue info metadata.
//                loadZoomImage(scope, zoomScale, 'bg', false);
//
//                areas.forEach(function (area) {
//                    promises.push(issueImageLoader.load(scope.issuePage.issueId, scope.issuePage.index + 1, zoomScale, area.rect));
//                });
//
//                $q
//                    .all(promises)
//                    .then(function magnifierImagesLoaded(imagesInfo) {
//
//                        console.log('magnifier images loaded');
//                        var images = scope.images,
//                            decScale = zoomScale / 100,
//                            rectTransform = function (prop) {
//                                return parseInt(prop * decScale, 10);
//                            };
//
//                        imagesInfo.forEach(function (imageInfo) {
//
////                            if (imageInfo.timestamp < scope.timestamp) return;
//
//                            var imageRect = _.mapValues(imageInfo.args.rect, rectTransform);
//
//                            imageRect.width = imageRect.right - imageRect.left;
//                            imageRect.height = imageRect.bottom - imageRect.top;
//                            images.push(new IssueImage(scope.issuePage.container, {
//                                loaded: true,
//                                timestamp: imageInfo.timestamp,
//                                transform: new TransformDescriptor({
//                                    left: imageRect.left,
//                                    top: imageRect.top
//                                }),
//                                url: imageInfo.url,
//                                size: {
//                                    width: imageRect.width,
//                                    height: imageRect.height
//                                }
//                            }));
//                        });
//
//                        scope.$emit(pagesViewEvents.PAGE_IMAGE_LOADED);
//                    });
//            }


            function link(scope, element, attrs, ctrls) {


                var pageIndexCtrl = ctrls[0],
                    pageShowCtrl = ctrls[1],
                    pageIndex = pageIndexCtrl.getPageIndex(),
                    page = scope.issuePage,
                    onPageScaleChanged = function (event, args) {

                        var pageIndices = args;

                        if (pageIndices.indexOf(pageIndex) === -1) {
                            return;
                        }

                        if (!pageShowCtrl.isVisible()) {
                            return;
                        }

                        if (!angular.equals(scope.size || {}, (page.image.container && page.image.container.size) || {})) {
                            updateImageSize(scope);
                            scope.$emit(pagesViewEvents.PAGE_IMAGE_LOADED);
                        }

                        var zoomScale = page.pageInfo.getZoomScale(page.zoom);

                        if (scope.scale === zoomScale) {
                            return;
                        }

                        scope.scale = zoomScale; // this prevents the same image from loading twice.

                        //if (page.zoom &&
                        //    page.zoom.zoomType === page.zoom.zoomTypes.MAGNIFIER_ZOOM) {
                        //    loadMagnifierZoomImages(scope, zoomScale);
                        //}
                        //else {
                        if (scope.images.length > 1) {
                            scope.images.length = 1;
                            scope.$emit(pagesViewEvents.PAGE_IMAGE_LOADED);
                        }
                        loadZoomImage(scope, zoomScale, null);
                        //}
                    };

                var unsubscribeFn = scope.$on(pagesViewEvents.PAGE_CHANGED, onPageScaleChanged);
                scope.$on('$destroy', unsubscribeFn);

                scope.timestamp = Date.now();
                scope.images = [];
                onPageScaleChanged({}, [pageIndex]);
            }

            return {
                require: ['^uiPrPageIndex', '^uiPrPageShow'],
                restrict: 'E',
                scope: {
                    issuePage: '=for'
                },
                link: link,
                replace: true,
                templateUrl: 'templates/issues/issuePageImages.html'
            };
        }]);

(function (angular) {

    'use strict';


    var directiveName = 'uiPrPagesViewContainer';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['pr.issues.internal.pagesViewEvents', function () {


            function setSize(element, scope, args) {
                var size = scope.container.size;
                args = args || { width: true };

                if (args.width && size.width) element.width(size.width);
                if (size.height) element.height(size.height);
            }




            function pagesViewContainerLink(scope, element, attrs, gesturesCtrl) {

                gesturesCtrl.registerInterceptor(function containerGestureHandler(args) {
                    // we have to intercept this event and extend arguments with the page number gesture event is being fired over.
                    // Angular controller does not work with DOM elements

                    var $targetElement = angular.element(args.gesture.target),
                        targetScope = $targetElement.scope();

                    if (!targetScope) throw Error('Gesture event fired over element which is not Angular directive.');
                    var pageIndex = scope.childPages[targetScope.$id];

                    // Page number can be undefined. That means event fired over area between pages.
                    // we must propagate such events as well because user should be able to scroll pages.
                    args.pageIndex = pageIndex;
                });


                setSize(element, scope);
                setSize(element.children(), scope, { width: false });

                //scope.$parent.$on(pagesViewEvents.GESTURE_RECOGNIZED, );

                // link function works in digest cycle
                // so we don't need to listen change event at this moment
            }

            function pagesViewContainerController($scope) {
                $scope.childPages = {};
                /*jshint validthis:true */
                this.registerChildPageScope = function registerChildPageScope(pageNumber, scope) {
                    if ($scope.childPages[scope.$id]) throw Error('Page for element has already been registered.');

                    $scope.childPages[scope.$id] = pageNumber;
                };
                /*jshint validthis:false */
            }

            return {
                restrict: 'EA',
                require: 'uiPrGestures',
                scope: {
                    container: '=' + directiveName,
                    pagesPool: '='
                },
                link: pagesViewContainerLink,
                controller: pagesViewContainerController,
                templateUrl: 'templates/issues/pagesViewContainer.html'
            };

        }]);

})(window.angular);


(function (angular) {

    'use strict';

    var directiveName = 'uiPrCollection',
        PR_ELEMENT_REMOVED = 'pr-element-hidden',
        minErr = angular.$$minErr('pr-issues');

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['$parse', 'pr.issues.internal.pagesViewEvents', function ($parse, pagesViewEvents) {

            /**
             * Return the DOM siblings between the first and last node in the given array.
             * @param {Array} array like object
             * @returns {DOMElement} object containing the elements
             */
            function getBlockElements(nodes) {
                var startNode = nodes[0],
                    endNode = nodes[nodes.length - 1];
                if (startNode === endNode) {
                    return angular.element(startNode);
                }

                var element = startNode;
                var elements = [element];

                do {
                    element = element.nextSibling;
                    if (!element) break;
                    elements.push(element);
                } while (element !== endNode);

                return angular.element(elements);
            }

            function getBlockEnd(block) {
                return block.clone[block.clone.length - 1];
            }

//            function getBlockStart(block) {
//                return block.clone[0];
//            }

            return {
                transclude: 'element',
                priority: 1000,
                terminal: true,
                $$tlb: true,
                link: function ($scope, $element, $attr, ctrl, $transclude) {
                    var expression = $attr[directiveName];
                    var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?\s+refresh\s+on\s+([\s\S]+?)\s*$/),
                        trackByExp, trackByExpGetter, trackByIdExpFn, trackByIdArrayFn, trackByIdObjFn,
                        lhs, rhs, valueIdentifier, keyIdentifier,
                        refreshEvent,
                        hashFnLocals = {};

                    if (!match) {
                        throw minErr('Expected expression in form of \'_item_ in _collection_ track by _id_ refresh on _event_\' but got \'{0}\'.',
                            expression);
                    }

                    lhs = match[1];
                    rhs = match[2];
                    trackByExp = match[3];
                    refreshEvent = match[4];

                    if (!pagesViewEvents[refreshEvent]) throw minErr('{0} is not a registered event name.', refreshEvent);

                    if (trackByExp) {
                        trackByExpGetter = $parse(trackByExp);
                        trackByIdExpFn = function (key, value, index) {
                            // assign key, value, and $index to the locals so that they can be used in hash functions
                            if (keyIdentifier) hashFnLocals[keyIdentifier] = key;
                            hashFnLocals[valueIdentifier] = value;
                            hashFnLocals.$index = index;
                            return trackByExpGetter($scope, hashFnLocals);
                        };
                    } else {
                        trackByIdArrayFn = function () {
                            throw new Error('Expressions with no \'track by\' section are not supported at the moment.');
                        };
                        trackByIdObjFn = function (key) {
                            return key;
                        };
                    }

                    match = lhs.match(/^(?:([\$\w]+)|\(([\$\w]+)\s*,\s*([\$\w]+)\))$/);
                    if (!match) {
                        throw minErr('iidexp', '\'_item_\' in \'_item_ in _collection_\' should be an identifier or \'(_key_, _value_)\' expression, but got \'{0}\'.',
                            lhs);
                    }
                    valueIdentifier = match[3] || match[1];
                    keyIdentifier = match[2];

                    // Store a list of elements from previous run. This is a hash where key is the item from the
                    // iterator, and the value is objects with following properties.
                    //   - scope: bound scope
                    //   - element: previous element.
                    //   - index: position
                    var lastBlockMap = {},
                        collectionExpr = $parse(rhs),

//                    $scope.$watchCollection(rhs, function ngRepeatAction(collection) {
                        onCollectionChanged = function onCollectionChanged() {
                            var collection = collectionExpr($scope),
                                index, length,
                                previousNode = $element[0],     // current position of the node
                                nextNode,
                            // Same as lastBlockMap but it has the current state. It will become the
                            // lastBlockMap on the next iteration.
                                nextBlockMap = {},
                                arrayLength,
                                childScope,
                                key, value, // key/value of iteration
                                trackById,
                                trackByIdFn,
                                collectionKeys,
                                block,       // last object information {scope, element, id}
                                nextBlockOrder = [],
                                elementsToRemove;


                            if (angular.isArray(collection)) {
                                collectionKeys = collection;
                                trackByIdFn = trackByIdExpFn || trackByIdArrayFn;
                            } else {
                                trackByIdFn = trackByIdExpFn || trackByIdObjFn;
                                // if object, extract keys, sort them and use to determine order of iteration over obj props
                                collectionKeys = [];
                                for (key in collection) {
                                    if (collection.hasOwnProperty(key) && key.charAt(0) !== '$') {
                                        collectionKeys.push(key);
                                    }
                                }
                                collectionKeys.sort();
                            }

                            arrayLength = collectionKeys.length;

                            // locate existing items
                            var blockLocator = function (block) {
                                if (block && block.scope) lastBlockMap[block.id] = block;
                            };
                            length = nextBlockOrder.length = collectionKeys.length;
                            for (index = 0; index < length; index++) {
                                key = (collection === collectionKeys) ? index : collectionKeys[index];
                                value = collection[key];
                                trackById = trackByIdFn(key, value, index);
                                if (lastBlockMap.hasOwnProperty(trackById)) {
                                    block = lastBlockMap[trackById];
                                    delete lastBlockMap[trackById];
                                    nextBlockMap[trackById] = block;
                                    nextBlockOrder[index] = block;
                                } else if (nextBlockMap.hasOwnProperty(trackById)) {
                                    // restore lastBlockMap
                                    angular.forEach(nextBlockOrder, blockLocator);
                                    // This is a duplicate and we need to throw an error
                                    throw minErr('dupes', 'Duplicates in a repeater are not allowed. Use \'track by\' expression to specify unique keys. Repeater: {0}, Duplicate key: {1}',
                                        expression, trackById);
                                } else {
                                    // new never before seen block
                                    nextBlockOrder[index] = { id: trackById };
                                    nextBlockMap[trackById] = false;
                                }
                            }

                            // remove existing items (hide instead of remove)
                            for (key in lastBlockMap) {
                                // lastBlockMap is our own object so we don't need to use special hasOwnPropertyFn
                                if (lastBlockMap.hasOwnProperty(key)) {
                                    block = lastBlockMap[key];
                                    elementsToRemove = getBlockElements(block.clone);
                                    elementsToRemove.remove();
//                                $animate.leave(elementsToRemove);
                                    /*jshint -W083 */
                                    angular.forEach(elementsToRemove, function (element) {
                                        element[PR_ELEMENT_REMOVED] = true;
//                                        element.style.display = 'none';
                                    });
                                    block.scope.$destroy();

                                    /*jshint +W083 */
                                }
                            }

                            // we are not using forEach for perf reasons (trying to avoid #call)
                            for (index = 0, length = collectionKeys.length; index < length; index++) {
                                key = (collection === collectionKeys) ? index : collectionKeys[index];
                                value = collection[key];
                                block = nextBlockOrder[index];
                                if (nextBlockOrder[index - 1]) previousNode = getBlockEnd(nextBlockOrder[index - 1]);

                                if (block.scope) {
                                    // if we have already seen this object, then we need to reuse the
                                    // associated scope/element
                                    childScope = block.scope;

                                    nextNode = previousNode;
                                    do {
                                        nextNode = nextNode.nextSibling;
                                    } while (nextNode && nextNode[PR_ELEMENT_REMOVED]);

//                                    if (getBlockStart(block) !== nextNode) {
//                                        // existing item which got moved
//                                        $animate.move(getBlockElements(block.clone), null, angular.element(previousNode));
//                                    }

                                    previousNode = getBlockEnd(block);
                                } else {
                                    // new item which we don't know about
                                    childScope = $scope.$new();
                                }

                                childScope[valueIdentifier] = value;
                                if (keyIdentifier) childScope[keyIdentifier] = key;
                                childScope.$index = index;
                                childScope.$first = (index === 0);
                                childScope.$last = (index === (arrayLength - 1));
                                childScope.$middle = !(childScope.$first || childScope.$last);
                                // jshint bitwise: false
                                childScope.$odd = !(childScope.$even = (index & 1) === 0);
                                // jshint bitwise: true

                                if (!block.scope) {
                                    /*jshint -W083 */
                                    $transclude(childScope, function (clone) {
//                                        clone[clone.length++] = document.createComment(' end pr-ui-issue-pages-collection: ' + expression + ' ');
                                        clone.removeAttr($attr.$attr[directiveName]);
                                        angular
                                            .element(previousNode)
                                            .after(clone);

                                        previousNode = clone;
                                        block.scope = childScope;
                                        // Note: We only need the first/last node of the cloned nodes.
                                        // However, we need to keep the reference to the jqlite wrapper as it might be changed later
                                        // by a directive with templateUrl when its template arrives.
                                        block.clone = clone;
                                        nextBlockMap[block.id] = block;
                                    });
                                    /*jshint +W083 */
                                }
                            }
                            lastBlockMap = nextBlockMap;
                        };

                    var unsubscribeFn = $scope.$on(pagesViewEvents[refreshEvent], onCollectionChanged);
                    $scope.$on('$destroy', unsubscribeFn);
                    onCollectionChanged();
                }
            };

        }]);
})(window.angular);




(function (angular) {

    'use strict';

    var directiveName = 'uiPrTransform',
        transformKey = 'PR-TRANSFORM',
        originKey = 'PR-ORIGIN';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['pr.issues.internal.pagesViewEvents', '$parse', function (pagesViewEvents, $parse) {

            function onTransformChanged(element, descriptor) {

                var transform,
                    origin,
                    oldTransform = element.data(transformKey),
                    oldOrigin = element.data(originKey);

                if (!descriptor) {
                    transform = origin = '';
                } else {
                    transform = descriptor.toCssTransform();
                    origin = descriptor.toCssOrigin();
                }


                if (transform !== oldTransform) {
                    element.css('transform', transform);
                }

                if (origin !== oldOrigin) {
                    element.css('transform-origin', origin);
                }
                element.data(transformKey, transform);
                element.data(originKey, origin);
            }

            function link(scope, element, attrs, pageIndexCtrl) {

                var transformExpr = $parse(attrs[directiveName]),
                    pageIndex = pageIndexCtrl.getPageIndex(),
                    onPageChanged = function onPageChanged(event, args) {

                        var indices = args;

                        if (indices.indexOf(pageIndex) === -1) {
                            return;
                        }

                        var state = transformExpr(scope);
                        onTransformChanged(element, state);
                    },
                    unsubscribeFn = scope.$on(pagesViewEvents.PAGE_CHANGED, onPageChanged);


                scope.$on('$destroy', unsubscribeFn);
                onPageChanged({}, [pageIndex]);
            }

            return {
                require: '^uiPrPageIndex',
                restrict: 'A',
                link: link
            };

        }]);

})(window.angular);



(function (angular) {

    'use strict';

    var directiveName = 'uiPrContainerTransform',
        transformKey = 'PR-CONTAINER-TRANSFORM';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['pr.issues.internal.pagesViewEvents',
            '$parse', function (pagesViewEvents, $parse) {

            function onTransformChanged(element, descriptor) {

                var transform,
                    oldTransform = element.data(transformKey);

                if (!descriptor) {
                    transform = '';
                } else {
                    transform = descriptor.toCssTransform(true);
                }

                if (transform !== oldTransform) {
                    element.css('transform', transform);
                }


                element.data(transformKey, transform);
            }

            function containerTransformPreLink(scope, element, attrs) {

                var transformExpr = $parse(attrs[directiveName]),
                    onContainerPositionChanged = function onContainerPositionChanged() {

                        var state = transformExpr(scope);
                        onTransformChanged(element, state);
                    },
                    onAnimationStopped = function onAnimationStopped() {
                        var state = transformExpr(scope);

                        var val = element.css('transform'),
                            m = /\(([^,]*),([^,]*),([^,]*),([^,]*),([^,p]*)(?:px)?,([^)p]*)(?:px)?/.exec(val),
                            translateX = m && parseInt(m[5], 10) || 0;

                        state.translate.left = translateX;
                        onContainerPositionChanged();
                    },
                    unsubscribeFn = scope.$on(pagesViewEvents.CONTAINER_POSITION_CHANGED, onContainerPositionChanged),
                    unsubscribeFn2 = scope.$on(pagesViewEvents.STOP_ANIMATION, onAnimationStopped);

                scope.$on('$destroy', function () {
                    unsubscribeFn();
                    unsubscribeFn2();
                });

                onContainerPositionChanged();
            }

            return {
                restrict: 'A',
                link: {
                    // we need to update container position as soon as possible
                    // because inner directives may require its state in order to
                    // run their link function properly.
                    pre: containerTransformPreLink
                }
            };

        }]);

})(window.angular);



(function (angular) {

    'use strict';

    var directiveName = 'uiPrPageIndex';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['$parse', function ($parse) {

            function controller($scope, $attrs) {

                var indexExpr = $parse($attrs[directiveName]);

                /*jshint validthis:true */
                this.getPageIndex = function getIndex() {
                    return indexExpr($scope);
                };
                /*jshint validthis:false */
            }

            function link(scope, element, attrs, ctrls) {
                var parentController = ctrls[0],
                    thisController = ctrls[1];

                parentController.registerChildPageScope(thisController.getPageIndex(), scope);
            }

            return {
                require: ['^^uiPrPagesViewContainer', directiveName],
                restrict: 'A',
                controller: controller,
                link: link
            };

        }]);

})(window.angular);



(function (angular) {

    'use strict';

    var directiveName = 'uiPrGestures';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['pr.issues.internal.pagesViewEvents', '$hammerManager', '$hammerInvariants', '$parse', function (pagesViewEvents, $hammerManager, $hammerInvariants, $parse) {


            function gesturesDirectiveLink(scope, element, attrs, ctrl) {
                var descriptor = $parse(attrs[directiveName])(scope);

                if (!descriptor) throw Error('directive requires non-empty ' + attrs.$attr[directiveName] + ' attribute.');



                var hammerInstance = $hammerManager(element[0], {
                        // both options required for native scrolling support
                        // in order to display top/bottom panels on Android and iOS
                        // devices when they're hidden.
                         'touchAction': 'auto'
                    }),
                    gestures = [],
                    gesturesStr;

                for (var descr in descriptor) {

                    var ctor = descr[0].toUpperCase() + descr.substr(1),
                        ctorSettings = descriptor[descr];

                    hammerInstance.add(new $hammerInvariants[ctor](ctorSettings));
                }


                //hammerInstance.remove(hammerInstance.get('swipe'));
                //hammerInstance.remove(hammerInstance.get('doubletap'));
                //hammerInstance.remove(hammerInstance.get('press'));
                //hammerInstance.get('swipe').set({ enable: false });

                for (var recognizer in descriptor) {
                    //var hammerRecognizer = hammerInstance.get(recognizer),
                    var settings = descriptor[recognizer];

                    //if (!hammerRecognizer) throw Error(recognizer + ' does not supported by Hammer. Probably you should use HammerManager instead.');
                    //
                    //hammerRecognizer.set({ enable: true });

                    if (settings.suffixes) {
                        // combine suffixes with recognizer name
                        // i.e. pan { suffixes: ['start', 'move'] } will add gestures 'panstart', 'panmove'
                        for (var i = 0, len = settings.suffixes.length; i < len; i++) {
                            gestures.push(recognizer + settings.suffixes[i]);
                        }
                    }
                    else {
                        gestures.push(recognizer);
                    }
                }

                gesturesStr = gestures.join(' ');

                hammerInstance.on(gesturesStr, function gestureHandled(ev) {
                    var params = {
                        gesture: ev
                    };

                    console.log('gestures.', ev.type);

                    ctrl.applyInterceptors(params);

                    //params.gesture.prPreventDefault = true;

                    scope.$emit(pagesViewEvents.GESTURE_RECOGNIZED, params);

                    //if (params.gesture.prPreventDefault) {
                    //    ev.preventDefault();
                    //}
                });





                scope.$on('$destroy', function () {
                    hammerInstance.off(gesturesStr);
                    hammerInstance.destroy();
                });
            }

            function gesturesDirectiveController($scope) {

                var interceptors = [];

                /* jshint validthis:true */
                this.registerInterceptor = function registerInterceptor(interceptorFn) {
                    interceptors.push(interceptorFn);
                };

                this.applyInterceptors = function applyInterceptors(ev) {

                    for (var i = 0, len = interceptors.length; i < len; i++) {
                        interceptors[i](ev);
                    }
                };
                /* jshint validthis:false */

                $scope.$on('$destroy', function onScopeDestroying() {
                    interceptors.length = 0;
                });
            }

            return {
                require: directiveName,
                restrict: 'A',
                link: gesturesDirectiveLink,
                controller: gesturesDirectiveController
            };
        }]);


})(window.angular);


angular
    .module('pr.issues.ui')
    .directive('uiPrAnimate', ['pr.issues.internal.pagesViewEvents', function (pagesViewEvents) {

        'use strict';

        var TRANSITION_EVENT = 'transitionend webkitTransitionEnd';


        function link(scope, element, attrs, ctrl) {


            var unsubscribeFn = scope.$on(pagesViewEvents.BEGIN_ANIMATION, function onAnimationBegan(event, args) {

                    var time = args.time;

                    ctrl.animationInProgress = true;

                    element
                        .css({
                            transitionTimingFunction: 'cubic-bezier(0.33, 0.66, 0.66, 1)',
                            transitionProperty: 'transform, -webkit-transform',
                            transitionDuration: time + 'ms'
                        });

                    element.on(TRANSITION_EVENT, function () {

                        element
                            .off(TRANSITION_EVENT)
                            .css({
                                transitionTimingFunction: '',
                                transitionProperty: '',
                                transitionDuration: ''
                            });

                        ctrl.animationInProgress = false;
                        scope.$emit(pagesViewEvents.END_ANIMATION);
                    });
                }),
                onAnimationStopRequested = function onAnimationStopRequested() {

                    element
                        .off(TRANSITION_EVENT)
                        .css({
                            transitionTimingFunction: '',
                            transitionProperty: '',
                            transitionDuration: ''
                        });
                };


            var unsubscribeStopFn = scope.$on(pagesViewEvents.STOP_ANIMATION, onAnimationStopRequested);
            scope.$on('$destroy', function () {
                unsubscribeFn();
                unsubscribeStopFn();
            });
        }

        function animateController() {
            /* jshint validthis: true */
            this.animationInProgress = false;
            /* jshint validthis: false */
        }

        return {
            restrict: 'A',
            controller: animateController,
            link: link
        };
    }])
;




(function (angular) {

    'use strict';

    var directiveName = 'uiPrPageShow',
        VISIBLE_KEY='pr-visible';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['pr.issues.internal.pagesViewEvents', '$parse', function (pagesViewEvents, $parse) {


            function pageShowLink(scope, element, attrs, ctrls) {

                var pageIndexCtrl = ctrls[0],
                    thisCtrl = ctrls[1],
                    pageIndex = pageIndexCtrl.getPageIndex(),
                    onPageChanged = function onPageChanged(event, args) {

                        var changedPageIndices = args;

                        if (changedPageIndices.indexOf(pageIndex) === -1) {
                            return;
                        }

                        var val = thisCtrl.isVisible(),
                            oldStatus = element.data(VISIBLE_KEY);

                        if (val !== oldStatus) {
                            element.css('display', val ? '' : 'none');
                            element.data(VISIBLE_KEY, val);
                        }
                    };

                var unsubscribeFn = scope.$on(pagesViewEvents.PAGE_CHANGED, onPageChanged);

                scope.$on('$destroy', unsubscribeFn);

                onPageChanged({}, [pageIndex]);
            }

            function pageShowController($scope, $attrs) {
                var expr = $parse($attrs[directiveName]);

                /* jshint validthis:true */
                this.isVisible = function isVisible() {
                    var val = expr($scope);

                    return val;
                };
                /* jshint validthis:false */
            }

            return {
                require: ['uiPrPageIndex', 'uiPrPageShow'],
                restrict: 'A',
                link: pageShowLink,
                controller: pageShowController
            };

        }]);

})(window.angular);




(function (angular) {

    'use strict';

    var directiveName = 'uiPrOptimizingPanel';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['$parse', function ($parse) {

            function link(scope, element, attrs) {
                var expression = attrs[directiveName],
                    match = expression.match(/^\s*([\s\S]+?)\s+reevaluate\s+on\s+([\s\S]+?)\s*$/);

                if (!match) {
                    throw Error('Expected expression in form of \'_descriptor_ reevaluate on event_name. Got \'' + expression + '\'');
                }

                var optimizingDescriptorExpr = $parse(match[1]),
                    eventName = match[2],
                    timeoutDescr = {},
//                    timeoutId,
                    reevaluateFn = function onReevaluateRequested () {

                        var descr = optimizingDescriptorExpr(scope);

                        if (descr.panel.size.width) element.width(descr.panel.size.width);
                        if (descr.panel.size.height) element.height(descr.panel.size.height);

                        if (timeoutDescr && timeoutDescr.state === descr.show) {
                            return;
                        }
//                        console.log('timeout going to ' + descr.show + ' element');

                        if (timeoutDescr) {
                            window.clearTimeout(timeoutDescr.id);
                        }

                        var id = window.setTimeout(function () {
//                            console.log('timeout. ' + timeoutDescr.state + ' element.');
                            element.css('display', timeoutDescr.state ? '' : 'none');
                            timeoutDescr = {};
                        }, 300);

                        timeoutDescr = {
                            id: id,
                            state: descr.show
                        };
                    };

                var unsubscribeFn = scope.$on(eventName, reevaluateFn);
                scope.$on('$destroy', unsubscribeFn);

                reevaluateFn();
            }

            return {
                restrict: 'A',
                link: link,
                templateUrl: 'templates/issues/optimizingPanel.html'
            };

        }]);
})(window.angular);



(function (angular) {

    'use strict';

    var directiveName = 'uiPrOffset';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['pr.issues.internal.pagesViewEvents',
            '$parse', function (pagesViewEvents, $parse) {


            function recalculateOffset(element, obj) {
                var offset = element.offset();

                obj.left = offset.left;
                obj.top = offset.top;
            }


            function link(scope, element, attrs, ctrls) {

                var pageIndexCtrl = ctrls[0],
                    pageShowCtrl = ctrls[1],
                    offsetExpr = $parse(attrs[directiveName]),
                    pageIndex = pageIndexCtrl.getPageIndex(),
                    onContainerChanged = function onContainerChanged() {

                        if (!pageShowCtrl.isVisible()) {
                            return;
                        }

                        recalculateOffset(element, offsetExpr(scope));
                    },
                    onPageChanged = function onPageChanged(event, args) {

                        var indices = args;

                        if (indices.indexOf(pageIndex) === -1) {
                            return;
                        }

                        if (!pageShowCtrl.isVisible()) {
                            return;
                        }

                        recalculateOffset(element, offsetExpr(scope));
                    },
                    unsubscribeFn = scope.$on(pagesViewEvents.PAGE_CHANGED, onPageChanged),
                    unsubscribeFn2 = scope.$on(pagesViewEvents.CONTAINER_POSITION_CHANGED, onContainerChanged);


                scope.$on('$destroy', function () {
                    unsubscribeFn();
                    unsubscribeFn2();
                });

                onPageChanged({}, [pageIndex]);
            }

            return {
                require: ['^uiPrPageIndex', '^uiPrPageShow'],
                restrict: 'A',
                link: link
            };

        }]);
})(window.angular);
angular
    .module('pr.issues.ui')
    .directive('uiPrPageAnimate', ['pr.issues.internal.pagesViewEvents', function (pagesViewEvents) {

        'use strict';

        var TRANSITION_EVENT = 'transitionend webkitTransitionEnd';


        function link(scope, element) {

            var unsubscribeFn = scope.$on(pagesViewEvents.BEGIN_PAGE_ANIMATION, function onAnimationBegan() {

//                    -webkit-transition-duration: 300ms;
//                    -webkit-timing-function: linear;
//                    -webkit-transition-property: -webkit-transform;
//                    transition-duration: 300ms;
//                    transition-timing-function: linear;
//                    transition-property: transform, -webkit-transform;

                    element
                        .css({
                            transitionTimingFunction: 'linear',
                            transitionProperty: 'transform, -webkit-transform',
                            transitionDuration: '300ms'
                        });

                    element.on(TRANSITION_EVENT, function () {

                        element
                            .css({
                                transitionTimingFunction: '',
                                transitionProperty: '',
                                transitionDuration: ''
                            });

                        scope.$emit(pagesViewEvents.END_PAGE_ANIMATION);
                    });
                });

            scope.$on('$destroy', function () {
                unsubscribeFn();
            });
        }

        return {
            restrict: 'A',
            link: link
        };
    }])
;
(function () {

    'use strict';

    angular
        .module('pr.issues.ui')
        .directive('issuePage', ['pr.issues.internal.pagesViewEvents', function (pagesViewEvents) {

            function setSize(element, scope) {
                var size = scope.issuePage.container.size;

                if (size.width) element.width(size.width);
                if (size.height) element.height(size.height);
            }

            function issuePageLink(scope, element, attrs, ctrls) {

                if (!scope.issuePage) throw new Error('issuePage must present in scope.');

                var pageIndexCtrl = ctrls[0],
                    pageShowCtrl = ctrls[1];

                var pageIndex = pageIndexCtrl.getPageIndex(),
                    onPageChanged = function (event, args) {

                        var indices = args;

                        if (indices.indexOf(pageIndex) === -1) {
                            return;
                        }

                        if (!pageShowCtrl.isVisible()) {
                            return;
                        }

                        setSize(element, scope);
                    };

                var unsubscribeFn = scope.$on(pagesViewEvents.PAGE_CHANGED, onPageChanged);

                setSize(element, scope);
                scope.$on('$destroy', unsubscribeFn);
            }


            return {
                require: ['uiPrPageIndex', 'uiPrPageShow'],
                restrict: 'C',
                link: issuePageLink
            };

        }]);

})(window.angular);




(function (angular) {

    'use strict';

    var directiveName = 'uiPrIssueImageStyle';

    angular.module('pr.issues.ui')
        .directive(directiveName, ['pr.issues.internal.pagesViewEvents', '$parse', function (pagesViewEvents, $parse) {

            function issueImageStyleLink(scope, element, attrs, pageIndexCtrl) {

                var pageIndex = pageIndexCtrl.getPageIndex(),
                    pageExpr = $parse(attrs[directiveName]),
                    onPageChanged = function (event, args) {

                        var pageIndices = args;

                        if (pageIndices.indexOf(pageIndex) === -1) return;

                        var size = pageExpr(scope);

                        element
                            .css('width', size.width)
                            .css('height', size.height);
                    };

                var unsubscribeFn = scope.$on(pagesViewEvents.PAGE_CHANGED, onPageChanged);
                scope.$on('$destroy', unsubscribeFn);
                onPageChanged({}, [pageIndex]);
            }

            return {
                require: '^uiPrPageIndex',
                restrict: 'A',
                link: issueImageStyleLink
            };

        }]);


})(window.angular);


(function (angular) {

    'use strict';

    var directiveName = 'uiPrSrc';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['$parse', function ($parse) {


            function srcLink(scope, element, attrs) {
                var expr = $parse(attrs[directiveName]);
                element.attr('src', expr(scope));
            }


            return {
                restrict: 'A',
                link: srcLink
            };

        }]);

})(window.angular);



(function (angular, $) {

    'use strict';

    angular
        .module('pr.issues.ui')
        .directive('uiPrViewport', function () {


            function viewportLink(scope) {

                var docElem = $('meta[name="viewport"]')[0],
                    oldVal = docElem.getAttribute('content');

                docElem.setAttribute('content', 'width=device-width, initial-scale=1, minimal-ui');

                scope.$on('$destroy', function () {

                    docElem.setAttribute('content', oldVal);
                });
            }

            return {
                link: viewportLink
            };
        });

})(window.angular, window.jQuery);


(function (angular) {


    'use strict';

    var directiveName = 'uiPrZoomDetection';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['pr.issues.internal.screenBoundsProvider', '$document', '$parse',
            function zoomDetectionDirective(screenBounds, $document, $parse) {

                var $element = angular.element($document);


                function getZoom() {
                    var zoom = parseFloat(1 / (screenBounds.width() / $element.width()).toFixed(2));

                    return zoom;
                }


                function zoomDetectionLink(scope, element, attrs) {
                    var setFnExpr = $parse(attrs[directiveName]);

                    setFnExpr(scope, { $zoomFn: getZoom });
                }

                return {
                    link: zoomDetectionLink
                };
            }]);


})(window.angular);






(function (angular) {


    'use strict';

    var directiveName = 'uiPrBounceHandler';

    angular
        .module('pr.issues.ui')
        .directive(directiveName, ['$document', '$parse', function ($document, $parse) {


            function bounceHandlerLink(scope, element, attrs, animateCtrl) {

                var xStart, yStart = 0,
                    handlerExpr = $parse(attrs[directiveName]),
                    touchStartHandler,
                    touchMoveHandler;

                $document[0].addEventListener('touchstart', touchStartHandler = function(e) {
                    xStart = e.touches[0].screenX;
                    yStart = e.touches[0].screenY;
                });

                $document[0].addEventListener('touchmove', touchMoveHandler = function(e) {
                    if (animateCtrl.animationInProgress) {
                        e.preventDefault();
                        return;
                    }

                    var xMovement = Math.abs(e.touches[0].screenX - xStart);
                    var yMovement = Math.abs(e.touches[0].screenY - yStart);
                    var args = angular.extend(e, { deltaX: xMovement, deltaY: yMovement });

                    handlerExpr(scope, { $event: args });
                });

                scope.$on('$destroy', function () {
                    $document[0].removeEventListener('touchstart', touchStartHandler);
                    $document[0].removeEventListener('touchmove', touchMoveHandler);
                });
            }

            return {
                require: 'uiPrAnimate',
                restrict: 'A',
                link: bounceHandlerLink

            };

        }]);

})(window.angular);

angular
    .module('pr.issues', ['pr.issues.internal', 'sp.common', 'pr.issues.ui', 'ui.router', 'sp.configuration', 'sp.network', 'classy'])
    .config(['$stateProvider', 'sp.configuration.templatesStoreProvider', 'pr.issues.internal.zoomSearchMode', 'pr.issues.zoomSearchMode',
        function issuesConfiguration($stateProvider, templatesStore, ZOOM_SEARCH_MODE_INTERNAL, ZOOM_SEARCH_MODE) {

            'use strict';

            angular.extend(ZOOM_SEARCH_MODE, ZOOM_SEARCH_MODE_INTERNAL);

            $stateProvider
                .state('issues', {
                    url: '/issues',
                    parent: 'shell.container'
                })
                .state('issues.pagesView', {
                    url: '/{issue}/pages/',
                    views: {
                        '@': {
                            templateProvider: templatesStore.getTemplateService('Issues.PagesView'),
                            controller: 'pr.issues.pagesView.nativeZoom.controller'
                        }
                    },
                    resolve: {
                        issueInfo: ['$stateParams', 'pr.issues.issueInfoLoader', function ($stateParams, issueInfoLoader) {

                            var issueId = $stateParams.issue; // todo check and throw error
                            return issueInfoLoader
                                .load(issueId);
                        }]
                    }

                });
        }]);

/**
 * Created by alexanderk on 9/17/2014.
 */

(function (angular) {

    'use strict';

    function initDefaults() {

        return {
            PAGE_DISTANCE_IN_PIXELS: 10,
            TIMEOUT_TO_SHOW_OPTIMIZING: 290,
            MAX_PAGES_ON_SCREEN: 20,
            MIN_TIME_TO_ANIMATE_SCROLL: 300
        };
    }

    function initOptimizing(screenBoundsProvider, pagesViewEvents) {
        return {
            optimizing: {
                panel: {
                    size: {
                        height: screenBoundsProvider.height(),
                        width: screenBoundsProvider.width()
                    }
                },
                REEVALUATE_EVENT: pagesViewEvents.REEVALUATE_OPTIMIZING,
                show: true
            }
        };
    }

    function initContainer(screenBoundsProvider, TransformDescriptor) {
        return {
            container: {
                size: {
                    height: screenBoundsProvider.height(),
                    width: screenBoundsProvider.width()
                },
                transform: new TransformDescriptor(),
                gestures: {
                    pan: {
                        suffixes: ['start', 'move', 'end']
                    },
                    pinch: {
                        suffixes: ['start', 'move', 'end']
                    },
                    press: {
                        config: {
                            time: 100
                        }
                    }
                }
            }
        };
    }


    angular
        .module('pr.issues')
        .controller('pr.issues.pagesView.controller', [
            '$scope',
            'issueInfo',
            'pr.issues.internal.screenBoundsProvider',
            'pr.issues.internal.pagesViewEvents',
            'pr.issues.internal.transformDescriptor',
            'pr.issues.internal.arranger',
            'pr.issues.internal.issuePageViewModel',
            'pr.issues.internal.issuePagesPool',
            'pr.issues.internal.pageScaleService',
            'pr.issues.internal.pagesViewController.handlers.pan',
            'pr.issues.internal.pagesViewController.handlers.press',
            'pr.issues.internal.pagesViewController.handlers.pinch',
            function (scope, issueInfo, screenBoundsProvider, pagesViewEvents, TransformDescriptor, Arranger, IssuePageViewModel,
                      PagesPool, PageScaleService, PanHandler, PressHandler, PinchHandler) {

                /* scope extending and defaults creation */
                angular.extend(scope, initDefaults());
                angular.extend(scope, initContainer(screenBoundsProvider, TransformDescriptor));
                angular.extend(scope, initOptimizing(screenBoundsProvider, pagesViewEvents));

                var pages = issueInfo.pages.map(function (page) {
                        return new IssuePageViewModel(issueInfo, page);
                    });

//                pages.length = 1;
//                scope.imagesCountToLoad = 1;
                scope.zooms = issueInfo.getZooms(screenBoundsProvider.width(), screenBoundsProvider.height());
                scope.pageScaleService = new PageScaleService(scope.container.transform.translate);
                scope.pagesPool = new PagesPool(pages, scope.MAX_PAGES_ON_SCREEN);
                scope.arranger = new Arranger(pages, scope.PAGE_DISTANCE_IN_PIXELS);

                scope.imagesCountToLoad = pages.length > scope.MAX_PAGES_ON_SCREEN ? scope.MAX_PAGES_ON_SCREEN : pages.length;


                var panHandler = new PanHandler(scope, scope.pagesPool),
                    pressHandler = new PressHandler(scope),
                    pinchHandler = new PinchHandler(scope, scope.pagesPool, scope.pageScaleService, scope.arranger);


                scope.handlers = {
                    'panstart': panHandler,
                    'panmove': panHandler,
                    'panend': panHandler,
                    'press': pressHandler,
                    'pinchstart': pinchHandler,
                    'pinchmove': pinchHandler,
                    'pinchend': pinchHandler
                };


                /* event handlers */
                var onIssueImageLoaded = function onIssueImageLoaded() {
                        scope.imagesCountToLoad--;
//                        console.log('image loading handler received image loaded event. remain ' + scope.imagesCountToLoad);
                        if (scope.imagesCountToLoad === 0) {
                            console.log('all images loaded');
                            scope.$broadcast(pagesViewEvents.ALL_IMAGES_LOADED);
                        }
                    },
                    onGestureRecognized = function onGestureRecognized(event, args) {
                        scope.handlers[args.gesture.type].handle(args.gesture, pages[args.pageIndex]);
                        event.stopPropagation(); // we do not want this event being bubbled higher than this controller.
                    },
                    onAllImagesLoaded = function onAllImagesLoaded() {
                        scope.optimizing.show = false;
                        scope.$broadcast(pagesViewEvents.REEVALUATE_OPTIMIZING);
                    };

                /* events subscribe */
                var eventFns = [];
                eventFns.push(scope.$on(pagesViewEvents.PAGE_IMAGE_LOADED, onIssueImageLoaded));
                eventFns.push(scope.$on(pagesViewEvents.GESTURE_RECOGNIZED, onGestureRecognized));
                eventFns.push(scope.$on(pagesViewEvents.ALL_IMAGES_LOADED, onAllImagesLoaded));

                /* events destroying */
                scope.$on('$destroy', function onScopeDestroy() {
                    eventFns.forEach(function (unsubscribe) {
                        unsubscribe();
                    });
                });

                /* init */
                scope.arranger.arrangePages();
                scope.arranger.centerContainer(pages[0].container, scope.container);
                scope.pagesPool.setOffset(scope.container.transform.translate);


            }
        ]);

})(window.angular);

/**
 * Created by alexanderk on 9/17/2014.
 */

(function (angular) {

    'use strict';

    function initDefaults(screenBoundsProvider) {

        return {
            PAGE_DISTANCE_IN_PIXELS: screenBoundsProvider.width() / 2 + 10,
            //PAGE_DISTANCE_IN_PIXELS: 20,
            TIMEOUT_TO_SHOW_OPTIMIZING: 290,
            MAX_PAGES_ON_SCREEN: 20,
            MIN_TIME_TO_ANIMATE_SCROLL: 300
        };
    }

    function initOptimizing(screenBoundsProvider, pagesViewEvents) {
        return {
            optimizing: {
                panel: {
                    size: {
                        height: screenBoundsProvider.height(),
                        width: screenBoundsProvider.width()
                    }
                },
                REEVALUATE_EVENT: pagesViewEvents.REEVALUATE_OPTIMIZING,
                show: true
            }
        };
    }

    function initContainer(scope, screenBoundsProvider, TransformDescriptor, $hammerInvariants) {
        var container = {
                size: {
                    height: screenBoundsProvider.height(),
                    width: screenBoundsProvider.width()
                },
                transform: new TransformDescriptor(),
                gestures: {
                    pan: {
                        suffixes: ['start', 'move', 'end'],
                        config: {
                            direction: $hammerInvariants.DIRECTION_HORIZONTAL,
                            threshold: 1
                        }
                    },
                    pinch: {
                        suffixes: ['start', 'move', 'end']
                    }
                    //swipe: {
                    //    suffixes: ['left', 'right']
                    //}
                    //press: {
                    //    config: {
                    //        time: 100
                    //    }
                    //}
                }
            };

        container.bounceHandler = function bounceHandler($event) {

            if ($event.touches.length > 1) {
                return;
            }

            var zoom = scope.getZoom();
            if (parseFloat(zoom) > 1) {
                return;
            }

            //if(($event.deltaY * 5) > $event.deltaX) {
            if ($event.deltaY > 0) $event.preventDefault();
            //}
        };

        return {
            container: container
        };
    }


    angular
        .module('pr.issues')
        .controller('pr.issues.pagesView.nativeZoom.controller', [
            '$scope',
            '$hammerInvariants',
            'issueInfo',
            'pr.issues.internal.screenBoundsProvider',
            'pr.issues.internal.pagesViewEvents',
            'pr.issues.internal.transformDescriptor',
            'pr.issues.internal.arranger',
            'pr.issues.internal.issuePageViewModel',
            'pr.issues.internal.issuePagesPool',
            'pr.issues.internal.pageScaleService',
            'pr.issues.internal.pagesViewController.handlers.pan',
            'pr.issues.internal.pagesViewController.handlers.press',
            'pr.issues.internal.pagesViewController.handlers.pinch',
            function (scope, $hammerInvariants, issueInfo, screenBoundsProvider, pagesViewEvents, TransformDescriptor, Arranger, IssuePageViewModel,
                      PagesPool, PageScaleService, PanHandler, PressHandler, PinchHandler) {

                /* scope extending and defaults creation */
                angular.extend(scope, initDefaults(screenBoundsProvider));
                angular.extend(scope, initContainer(scope, screenBoundsProvider, TransformDescriptor, $hammerInvariants));
                angular.extend(scope, initOptimizing(screenBoundsProvider, pagesViewEvents));

                var pages = issueInfo.pages.map(function (page) {
                    return new IssuePageViewModel(issueInfo, page);
                });

                //pages.length = 1;
                //scope.imagesCountToLoad = 1;

                scope.zooms = issueInfo.getZooms(screenBoundsProvider.width(), screenBoundsProvider.height());
                scope.pageScaleService = new PageScaleService(scope.container.transform.translate);
                scope.pagesPool = new PagesPool(pages, scope.MAX_PAGES_ON_SCREEN);
                scope.arranger = new Arranger(pages, scope.PAGE_DISTANCE_IN_PIXELS);
                scope.container.setZoomDetectionCallback = function setZoomDetectionCallback(zoomDetectionFn) {
                    scope.getZoom = zoomDetectionFn;
                };
                console.log('images loading');
                scope.imagesCountToLoad = pages.length > scope.MAX_PAGES_ON_SCREEN ? scope.MAX_PAGES_ON_SCREEN : pages.length;

                var panHandler = new PanHandler(scope, scope.pagesPool, scope.arranger),
                    /* pressHandler = new PressHandler(scope), */
                    pinchHandler = new PinchHandler(scope, scope.pagesPool, scope.pageScaleService, scope.arranger);


                scope.handlers = {
                    'panstart': panHandler,
                    'panmove': panHandler,
                    'panend': panHandler,
                    //'press': pressHandler,
                    //'swipeleft': swipeHandler,
                    //'swiperight': swipeHandler,
                    'pinchstart': pinchHandler,
                    'pinchmove': pinchHandler,
                    'pinchend': pinchHandler
                };


                /* event handlers */
                var onIssueImageLoaded = function onIssueImageLoaded() {
                        scope.imagesCountToLoad--;
//                        console.log('image loading handler received image loaded event. remain ' + scope.imagesCountToLoad);
                        if (scope.imagesCountToLoad === 0) {
                            console.log('all images loaded');
                            scope.$broadcast(pagesViewEvents.ALL_IMAGES_LOADED);
                        }
                    },
                    onGestureRecognized = function onGestureRecognized(event, args) {
                        scope.handlers[args.gesture.type].handle(args.gesture, pages[args.pageIndex]);
                        event.stopPropagation(); // we do not want this event being bubbled higher than this controller.
                    },
                    onAllImagesLoaded = function onAllImagesLoaded() {
                        scope.optimizing.show = false;
                        scope.$broadcast(pagesViewEvents.REEVALUATE_OPTIMIZING);
                    };

                /* events subscribe */
                var eventFns = [];
                eventFns.push(scope.$on(pagesViewEvents.PAGE_IMAGE_LOADED, onIssueImageLoaded));
                eventFns.push(scope.$on(pagesViewEvents.GESTURE_RECOGNIZED, onGestureRecognized));
                eventFns.push(scope.$on(pagesViewEvents.ALL_IMAGES_LOADED, onAllImagesLoaded));

                /* events destroying */
                scope.$on('$destroy', function onScopeDestroy() {
                    eventFns.forEach(function (unsubscribe) {
                        unsubscribe();
                    });
                });

                /* init */
                scope.arranger.arrangePages();
                scope.arranger.centerContainer(pages[0].container, scope.container);
                scope.pagesPool.setOffset(scope.container.transform.translate);


            }
        ]);

})(window.angular);

angular
    .module('pr.issues')
    .constant('pr.issues.zoomSearchMode', {
        /* it is configured in _def file (during module configuration phase) */
});


angular
    .module('pr.issues')
    .factory('pr.issues.issueInfoLoader', ['pr.issues.internal.issueInfoProvider',
        'pr.issues.internal.issueLayoutProvider',
        'sp.common.events',
        'pr.issues.internal.issueInfo',
        '$q',
        function (issueInfoProvider, issueLayoutProvider, commonEvents, IssueInfo, $q) {

            'use strict';


            /**
             * Loads new issue info data from provider.
             * @param {string} issueId - issue identifier.
             * @returns {Promise} - when fulfilled contains an information about issue.
             */
            function load(issueId) {

                function issueInfoLoadedHandler(issueInfoDataArr) {
                    var issueInfoData = issueInfoDataArr[0],
                        issueLayoutData = issueInfoDataArr[1];

                    if (!issueInfoData) throw new Error('IssueInfo service has returned no data.');
                    if (!issueLayoutData) throw new Error('IssueLayout service has returned no data.');

                    return new IssueInfo(issueId, issueInfoData, issueLayoutData);
                }

                return $q
                    .all([issueInfoProvider.load(issueId), issueLayoutProvider.load(issueId)])
                    .then(issueInfoLoadedHandler);

            }

            return {
                load: load
            };
        }]);

angular
    .module('sp.common', ['sp.utils', 'sp.common.ui']);


/**
 * Contains basic communication methods via HTTP protocol.
 */
angular
    .module('sp.common')
    .factory('sp.common.httpService', function spHttpService($http) {

        'use strict';

        /**
         * Executes a general HTTP request.
         * @param method - HTTP method (GET, PUT)
         * @param url - url to request
         * @param conf - request configuration.
         * @param conf.params - arguments to be passed to the server via url.
         * @param conf.data - arguments to be passed to the server via message data.
         * @returns {promise} - an http promise
         */
        function commonRequest(method, url, conf) {

            if (!method) throw new Error('Method parameter is required.');
            if (!url) throw new Error('Url parameter is required.');

            var httpConf = {
                    method: method,
                    url: url
                },
                params = conf && conf.params,
                data = conf && conf.data;

            if (params) httpConf.params = params;
            if (data) httpConf.data = data;

            return $http(httpConf);
        }

        /**
         * Executes GET request and returns a promise.
         * @param url - an url request has to be sent to.
         * @param conf - request configuration.
         * @param conf.params - arguments to be passed to the server (via url).
         * @returns {promise} - an http promise.
         */
        function get(url, conf) {
            return commonRequest('GET', url, conf);
        }

        /**
         * Executes JSONP request and returns a promise.
         * @param url - an url request has to be sent to.
         * @param conf - request configuration.
         * @param conf.params - arguments to be passed to the server (via url).
         * @returns {promise} - an http promise.
         */
        function jsonp(url, conf) {

            var httpConf = angular.copy(conf);
            if (!httpConf.params) httpConf.params = {};

            httpConf.params.callback = 'JSON_CALLBACK';

            return commonRequest('JSONP', url, httpConf);
        }

        /**
         * Executes POST request and returns a promise.
         * @param url - an url request has to be sent to.
         * @param conf - request configuration.
         * @param conf.data - arguments to be passed to the server via form data.
         * @param conf.params - arguments to be passed to the server via url.
         * @returns {promise} - an http promise.
         */
        function post(url, conf) {
            return commonRequest('POST', url, conf);
        }

        /**
         * Executes PUT request and returns a promise.
         * @param url - an url request has to be sent to.
         * @param conf - request configuration.
         * @param conf.data - arguments to be passed to the server via form data.
         * @param conf.params - arguments to be passed to the server via url.
         * @returns {promise} - an http promise.
         */
        function put(url, conf) {
            return commonRequest('PUT', url, conf);
        }

        /**
         * Executes DELETE request and returns a promise.
         * @param url - an url request has to be sent to.
         * @param conf - request configuration.
         * @param conf.params - arguments to be passed to the server (via url).
         * @returns {promise} - an http promise.
         */
        function remove(url, conf) {
            return commonRequest('DELETE', url, conf);
        }

        return {
            get: get,
            jsonp: jsonp,
            post: post,
            delete: remove,
            put: put
        };
    });

/*
 Caching service, allows to store promise fulfillment result.
 */
angular
    .module('sp.common')
    .factory('sp.common.promiseCache', ['$q', '$cacheFactory', 'sp.common.events', 'sp.common.eventBus',
        function ($q, $cacheFactory, events, eventBus) {

            'use strict';

            var PROMISE_CACHE_KEY = 'promise__fulfillment__value';

            function setInvalidationPolicy(cache, invalidationConf) {
                var evtName = invalidationConf.invalidationEvtName,
                    newValFn = angular.copy(invalidationConf.newValFn);
                if (!evtName) throw new Error('InvalidationEvtName is required.');
                if (newValFn && !angular.isFunction(newValFn)) throw new Error('newValFn has to be a function.');
                eventBus.subscribe(invalidationConf.invalidationEvtName, function onCacheNeedsInvalidation() {
                    cache.remove(PROMISE_CACHE_KEY);
                    if (newValFn) {
                        var args = Array.prototype.slice.call(arguments, 1),
                            newVal = newValFn.apply(this, args);

                        cache.put(PROMISE_CACHE_KEY, newVal);
                    }
                });
            }

            /**
             * This function creates a promise cache which checks if promise fulfillment result already stored.
             * If stored, returns cached value,
             * if not - waits until promise is fulfilled, caches its value and returns it.
             * @param {string} cacheName - globally unique cache name
             *        (will be used to store cached data in global {$cacheFactory} instance).
             * @param {Function} promiseFn - will be executed if no cached value exists.
             * @param {?object} invalidationConf - object to configure cache invalidation.
             * @param {string} invalidationConf.invalidationEvtName - name of the event, when triggered causes cache invalidation.
             * @param {Function} invalidationConf.newValFn - function to get a new value (if needed). Event parameters will be passed
             * to this function.
             * @returns {function} when executed returns {promise} object,
             *          when fulfilled contains result of {promiseFn} promise or cached value
             */
            function promiseCache(cacheName, promiseFn, invalidationConf) {
                if (!cacheName) throw new Error('cacheName parameter is required.');
                if (!promiseFn) throw new Error('promiseFn parameter is required.');
                if (!angular.isFunction(promiseFn)) throw new Error('promiseFn must be a function.');

                var cache = $cacheFactory(cacheName);

                if (invalidationConf) setInvalidationPolicy(cache, invalidationConf);

                return function getOrLoadValue() {
                    var storedVal = cache.get(PROMISE_CACHE_KEY);

                    if (storedVal) return $q.when(storedVal);

                    var promise = $q
                                    .when(promiseFn.apply(undefined, arguments))
                                    .then(function promiseFulfilledHandler(data) {
                                        cache.put(PROMISE_CACHE_KEY, data);

                                        return data;
                                    });
                    cache.put(PROMISE_CACHE_KEY, promise);
                    return promise;
                };
            }

            return promiseCache;

        }]);

angular
    .module('sp.common')
    .factory('sp.common.eventBus', ['$rootScope', function eventBus($rootScope) {

        'use strict';

        // http://stackoverflow.com/questions/11252780/whats-the-correct-way-to-communicate-between-controllers-in-angularjs/19498009#19498009
        // http://jsperf.com/rootscope-emit-vs-rootscope-broadcast

        /**
         * Publishes an event to event bus. All subscribes to this particular event will be notified.
         * @param {!string} evtName - name of the event.
         * @param {...*} args - event arguments.
         * @returns {Object} - event object. See http://docs.angularjs.org/api/ng.$rootScope.Scope#methods_$on
         */
        function publish(evtName, args) {

            if (!evtName) throw new Error('Event name is required.');
            return $rootScope.$emit(evtName, args);
        }

        /**
         * Subscribes to an event in service bus.
         * Important! You are responsible to unsubscribe from event when needed otherwise memory leak will appear.
         * If you need to subscribe to event in controller, use {$scope.spSubscribeToEvent} instead, it will unsubscribe
         * automatically.
         * @param {!string} evtName - name of the event.
         * @param {!Function} listenerFn
         * @returns {function()} - function to unsubscribe from this event.
         */
        function subscribe(evtName, listenerFn) {
            if (!evtName) throw new Error('Event name is required.');
            if (!angular.isFunction(listenerFn)) throw new Error('Listener must be a function.');

            return $rootScope.$on(evtName, listenerFn);
        }


        return {
            publish: publish,
            subscribe: subscribe
        };



    }
    ]);

angular
    .module('sp.common')
    .config(['$provide', function ($provide) {

        'use strict';

        $provide.decorator('$rootScope', ['$delegate', function ($delegate) {

            // scope prototype

            /**
             * Subscribes to event, generated by smartphone modules.
             * Automatically unsubsribes when scope is destroying.
             * @param {string} evtName - name of the event.
             * @param {Function} listenerFn - listener function.
             */
            $delegate.constructor.prototype.spSubscribeToEvent = function spSubscribe(evtName, listenerFn) {

                if (!evtName) throw new Error('Event name is required.');
                if (!angular.isFunction(listenerFn)) throw new Error('Listener must be a function.');

                var unsubscribe = $delegate.$on(evtName, listenerFn);
                this.$on('$destroy', unsubscribe);
            };

            return $delegate;
        }]);
    }]);

angular
    .module('sp.common')
    .provider('sp.common.areasCatalog', function () {

        'use strict';

        var areas = {};

        return {
            /**
             * Registers a new area to display on shell view.
             * @param {object} areaConf - area configuration. Must be valid ui-router state configuration.
             * See {ui-router.state} for details.
             * @example
             * areas.registerArea({
             *      'topbar-logo': {
             *          template: '<div class='logo'>Logo</div>'
             *      },
             *      '@': {
             *          template: '<div>this will be displayed in the main area</div>'
             *      }
             * })
             */
            registerShellArea: function registerArea(areaConf) {
                angular.forEach(areaConf, function (val, key) {

                    if (areas[key]) throw new Error('area with key = ' + key + ' has already been registered.');

                    // all areas must be specified with absolute names
                    // see ui-router documentation.
                    // shell - is the parent state.
                    // todo - move shell to constants.
                    if (!key.endsWith('@')) key = key + '@shell';
                    areas[key] = val;
                });
            },

            /**
             * Returns all areas have been registered.
             * It is for internal use. You do not need to use this method.
             * @returns {object} - areas configuration.
             */
            getAreas: function getAreas() {
                return angular.copy(areas);
            },

            $get: function getAreasCatalogInstance() {
                return this.getAreas();
            }
        };

    });



(function (angular) {

    'use strict';

    var templatesPrefix = 'v7.Client.Smartphone',
        templatesPrefixRegex = new RegExp(templatesPrefix + '.', 'i');


    angular
        .module('sp.common')
        .constant('sp.common.invariants', {
            server: {
                servicesUrl: 'http://services.pressdisplay.com/test/beta',

                /**
                 * Returns relative path to services url.
                 * For example if services path is http://services-dev.pd.com/test/ivan
                 * this function returns /test/ivan as a relative path.
                 * @returns {string} - relative path to services url
                 */
                getRelativeServicesPath: function getRelativeServicesPath() {

                    var url = this.servicesUrl,
                        protocolIdx = url.indexOf('://');

                    if (protocolIdx > 0) {
                        // skips protocol symbols and search for first '/' sign after it
                        url = url.substr(url.indexOf('/', protocolIdx + 3));
                    }

                    return url;
                }
            },
            baseUrl: 'http://beta.pressdisplay.com/test/beta',
            views: {

                /**
                 * Base url to locate view templates in case if they absent in resources
                 * OR if configuration requires to locate view in local folder first.
                 */
                baseUrl: 'templates',

                /**
                 * Templates name prefix to be removed when locating a template in local folder.
                 */
                templatesPrefix: templatesPrefix,
                templatesPrefixRegex: templatesPrefixRegex
            }
        });

})(angular);



angular
    .module('sp.common')
    .constant('sp.common.events', {
        /**
         * Triggers when application configuration and common modules need to be reloaded.
         */
        ON_NEEDS_RELOAD: 'sp.common.events.onNeedsReload',
    });

/**
 * Provides methods for transforming data.
 * Initially used for converting some of the server responses into conventional format.
 * @remarks
 *      At the moment this was first introduced, the services were returning data in CamelCaps format,
 *      thus camelCase transformation does not modifies dashes (a-b -> aB), nether does the reverse operation.
 *      All usages that transform data received from server must be removed, if the server responds "camelCase"ed data.
*/
angular
    .module('sp.common')
    .factory('sp.common.dataTransformation', [
        function dataTransformationService() {

            'use strict';

            var modifiers = {
                /**
                 * Lowers first letter of given string
                 * @params s String to modify
                 * @returns modified string
                */
                smallFirst: function(s) {
                    return s.replace(/^\w{1}/, function(l) { return l.toLowerCase(); });
                    //return angular.element.camelCase.apply(this, arguments)
                    //    .replace(/^\w{1}/, function (l) { return l.toLowerCase(); });
                },

                /**
                 * Capitalizes first letter of given string
                 * @params s String to modify
                 * @returns modified string
                */
                capitalFirst: function(s) {
                    return s.replace(/^\w{1}/, function(l) { return l.toUpperCase(); });
                }
            },

            traversers = {
                /**
                 * Returns functin which performs deep traverse through all object properties, modifying property name with modifierFn;
                 * @params {Function<string>} modifierFn Function to call on property name.
                 * @returns {Function<object>} Traverse function binded to modifierFn;
                */
                deepProps: function(modifierFn) {
                    return function deepTraverse(source) {

                        if (!angular.isObject(source)) return source;

                        angular.forEach(source, function(value, name) {
                            if (angular.isString(name)) {
                                var modifiedName = modifierFn(name);
                                if (modifiedName !== name) {
                                    delete source[name];
                                    source[modifiedName] = value;
                                }
                            }
                            deepTraverse(value);
                        });
                        return source;
                    };
                }
            };


            var transformations = {
                deepPropSmallFirst: traversers.deepProps(modifiers.smallFirst),
                deepPropCapitalFirst: traversers.deepProps(modifiers.capitalFirst),
            };


            return {

                /**
                 * "camelCase"s properties of the object given. Lower case first letter
                 * WARNING: does not changes dashes (a-b -> aB)
                 * @params {Object} s Source object
                 * @returns {Object} Source object
                */
                camelCaseIt: function(s) {
                    return transformations.deepPropSmallFirst(s);
                },

                /**
                 * "CamelCaps"es properties of the object given. Upper case first letter
                 * WARNING: does not changes dashes (aB -> a-b )
                 * @params {Object} s Source object
                 * @returns {Object} Source object
                */
                // TODO: consider changing the method name
                uglifyIt: function(s) {
                    return transformations.deepPropCapitalFirst(s);
                }
            };
        }
    ]);

angular.module('sp.common.ui', []);


angular
    .module('sp.common.ui')
    .provider('navProvider', function() {

        // Copyright (c) 2012 Olivier Louvignes

        // temporary, until design will be delivered.

        'use strict';

        var defaults = this.defaults = {
            activeClass: 'active',
            routeAttr: 'data-sp-match-route'
        };

        this.$get = function() {
            return {defaults: defaults};
        };
    })
    .directive('nav', function($location, navProvider) {

        'use strict';

        var defaults = navProvider.defaults;

        return {
            restrict: 'C',
            link: function postLink(scope, element, attr) {

                // Directive options
                var options = defaults;
                angular.forEach(Object.keys(defaults), function(key) {
                    if(angular.isDefined(attr[key])) options[key] = attr[key];
                });

                // Watch for the $location
                scope.$watch(function() {

                    return $location.path();

                }, function (newValue) {
                    var liElements = element[0].querySelectorAll('li[' + options.routeAttr + ']');

                    angular.forEach(liElements, function(li) {

                        var liElement = angular.element(li),
                            pattern = liElement.attr(options.routeAttr),
                            regexp = new RegExp('^' + pattern.replace('/', '\\/'), 'i');

                        if(regexp.test(newValue)) {
                            liElement.addClass(options.activeClass);
                        } else {
                            liElement.removeClass(options.activeClass);
                        }

                    });

                });

            }

        };

    });
angular
    .module('sp.common.ui')
    .filter('int', function intFilter() {

        'use strict';

        /**
         * Tries to convert the specified value to string via parseInt function.
         * @param {string} value - value to be converted.
         * @returns {number} - converted number or {NaN} if it is not possible.
         */
        function convertToInt(value) {
            return parseInt(value);
        }

        return convertToInt;
    });

/**
 * Binds value into element text. 
 * If there is no value, watches it until it appears, otherwise binds the value momentarily.
 * @element ANY
 * @param {expression} spBindOnce - expression to evaluate.
 * @example <span sp-bind-once="content.Title"></span>
*/
angular
    .module('sp.common.ui')
    .directive('spBindOnce', function spBindOnceDirective() {

        'use strict';

        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                var value = scope.$eval(attr.spBindOnce);

                if (value != undefined) {   /* jshint ignore:line */
                    element.text(value);
                } else {
                    var unregisterFn = scope.$watch(attr.spBindOnce, function spBindOnceWatchAction(value) {

                        if (value == undefined) return; /* jshint ignore:line */

                        element.text(value);
                        unregisterFn();
                    });
                }
            }
        };
    });
'use strict';

angular.module('pressReaderSmartPhoneApp', [
        'ui.router',
        'sp.shell'
    ])
    .config(function () {
//        snapRemoteProvider.globalOptions.disable = 'right';
    })
    .run(function ($rootScope) {

        // TODO - move to special service.
        $rootScope.$on('$stateChangeError',
            function (event, toState, toParams, fromState, fromParams, error) {
                throw error;
            });
    });
