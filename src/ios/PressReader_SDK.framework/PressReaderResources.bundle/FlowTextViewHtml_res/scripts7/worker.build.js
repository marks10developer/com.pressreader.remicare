/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.16 Copyright (c) 2010-2015, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.16',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite an existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part;
            for (i = 0; i < ary.length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i == 1 && ary[2] === '..') || ary[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI, normalizedBaseParts,
                baseParts = (baseName && baseName.split('/')),
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // If wanting node ID compatibility, strip .js from end
                // of IDs. Have to do this here, and not in nameToUrl
                // because node allows either .js or non .js to map
                // to same file.
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // Starts with a '.' so need the baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                trimDots(name);
                name = name.join('/');
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);

                //Custom require that does not do map translation, since
                //ID is "absolute", already mapped/resolved.
                context.makeRequire(null, {
                    skipMap: true
                })([id]);

                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        // If nested plugin references, then do not try to
                        // normalize, as it will not normalize correctly. This
                        // places a restriction on resourceIds, and the longer
                        // term solution is not to normalize until plugins are
                        // loaded and all normalizations to allow for async
                        // loading of a loader plugin. But for now, fixes the
                        // common uses. Details in #1131
                        normalizedName = name.indexOf('!') === -1 ?
                                         normalize(name, parentName, applyMap) :
                                         name;
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                           [defQueue.length, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return  getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        } else if (this.events.error) {
                            // No direct errback on this module, but something
                            // else is listening for errors, so be sure to
                            // propagate the error correctly.
                            on(depMap, 'error', bind(this, function(err) {
                                this.emit('error', err);
                            }));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if(args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                 //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));

define("req", function(){});

/**
 * @license
 * lodash 3.9.3 (Custom Build) lodash.com/license | Underscore.js 1.8.3 underscorejs.org/LICENSE
 * Build: `lodash modern -o ./lodash.js`
 */
;(function(){function n(n,t){if(n!==t){var r=null===n,e=n===m,u=n===n,i=null===t,o=t===m,f=t===t;if(n>t&&!i||!u||r&&!o&&f||e&&f)return 1;if(n<t&&!r||!f||i&&!e&&u||o&&u)return-1}return 0}function t(n,t,r){for(var e=n.length,u=r?e:-1;r?u--:++u<e;)if(t(n[u],u,n))return u;return-1}function r(n,t,r){if(t!==t)return s(n,r);r-=1;for(var e=n.length;++r<e;)if(n[r]===t)return r;return-1}function e(n){return typeof n=="function"||false}function u(n){return typeof n=="string"?n:null==n?"":n+""}function i(n,t){for(var r=-1,e=n.length;++r<e&&-1<t.indexOf(n.charAt(r)););
return r}function o(n,t){for(var r=n.length;r--&&-1<t.indexOf(n.charAt(r)););return r}function f(t,r){return n(t.a,r.a)||t.b-r.b}function l(n){return Nn[n]}function a(n){return Ln[n]}function c(n){return"\\"+Mn[n]}function s(n,t,r){var e=n.length;for(t+=r?0:-1;r?t--:++t<e;){var u=n[t];if(u!==u)return t}return-1}function p(n){return!!n&&typeof n=="object"}function h(n){return 160>=n&&9<=n&&13>=n||32==n||160==n||5760==n||6158==n||8192<=n&&(8202>=n||8232==n||8233==n||8239==n||8287==n||12288==n||65279==n);
}function _(n,t){for(var r=-1,e=n.length,u=-1,i=[];++r<e;)n[r]===t&&(n[r]=L,i[++u]=r);return i}function v(n){for(var t=-1,r=n.length;++t<r&&h(n.charCodeAt(t)););return t}function g(n){for(var t=n.length;t--&&h(n.charCodeAt(t)););return t}function y(n){return zn[n]}function d(h){function Nn(n){if(p(n)&&!(Ti(n)||n instanceof Bn)){if(n instanceof zn)return n;if(ru.call(n,"__chain__")&&ru.call(n,"__wrapped__"))return Mr(n)}return new zn(n)}function Ln(){}function zn(n,t,r){this.__wrapped__=n,this.__actions__=r||[],
this.__chain__=!!t}function Bn(n){this.__wrapped__=n,this.__actions__=null,this.__dir__=1,this.__filtered__=false,this.__iteratees__=null,this.__takeCount__=Su,this.__views__=null}function Mn(){this.__data__={}}function Pn(n){var t=n?n.length:0;for(this.data={hash:bu(null),set:new vu};t--;)this.push(n[t])}function qn(n,t){var r=n.data;return(typeof t=="string"||ve(t)?r.set.has(t):r.hash[t])?0:-1}function Dn(n,t){var r=-1,e=n.length;for(t||(t=Me(e));++r<e;)t[r]=n[r];return t}function Kn(n,t){for(var r=-1,e=n.length;++r<e&&false!==t(n[r],r,n););
return n}function Vn(n,t){for(var r=-1,e=n.length;++r<e;)if(!t(n[r],r,n))return false;return true}function Gn(n,t){for(var r=-1,e=n.length,u=-1,i=[];++r<e;){var o=n[r];t(o,r,n)&&(i[++u]=o)}return i}function Jn(n,t){for(var r=-1,e=n.length,u=Me(e);++r<e;)u[r]=t(n[r],r,n);return u}function Xn(n,t,r,e){var u=-1,i=n.length;for(e&&i&&(r=n[++u]);++u<i;)r=t(r,n[u],u,n);return r}function Hn(n,t){for(var r=-1,e=n.length;++r<e;)if(t(n[r],r,n))return true;return false}function Qn(n,t){return n===m?t:n}function nt(n,t,r,e){
return n!==m&&ru.call(e,r)?n:t}function tt(n,t,r){for(var e=-1,u=Ki(t),i=u.length;++e<i;){var o=u[e],f=n[o],l=r(f,t[o],o,n,t);(l===l?l===f:f!==f)&&(f!==m||o in n)||(n[o]=l)}return n}function rt(n,t){return null==t?n:ut(t,Ki(t),n)}function et(n,t){for(var r=-1,e=null==n,u=!e&&Ir(n),i=u?n.length:0,o=t.length,f=Me(o);++r<o;){var l=t[r];f[r]=u?Er(l,i)?n[l]:m:e?m:n[l]}return f}function ut(n,t,r){r||(r={});for(var e=-1,u=t.length;++e<u;){var i=t[e];r[i]=n[i]}return r}function it(n,t,r){var e=typeof n;return"function"==e?t===m?n:Mt(n,t,r):null==n?Fe:"object"==e?xt(n):t===m?Be(n):At(n,t);
}function ot(n,t,r,e,u,i,o){var f;if(r&&(f=u?r(n,e,u):r(n)),f!==m)return f;if(!ve(n))return n;if(e=Ti(n)){if(f=jr(n),!t)return Dn(n,f)}else{var l=uu.call(n),a=l==D;if(l!=V&&l!=z&&(!a||u))return $n[l]?Or(n,l,t):u?n:{};if(f=kr(a?{}:n),!t)return rt(f,n)}for(i||(i=[]),o||(o=[]),u=i.length;u--;)if(i[u]==n)return o[u];return i.push(n),o.push(f),(e?Kn:vt)(n,function(e,u){f[u]=ot(e,t,r,u,n,i,o)}),f}function ft(n,t,r){if(typeof n!="function")throw new Je(N);return gu(function(){n.apply(m,r)},t)}function lt(n,t){
var e=n?n.length:0,u=[];if(!e)return u;var i=-1,o=br(),f=o==r,l=f&&200<=t.length?Vu(t):null,a=t.length;l&&(o=qn,f=false,t=l);n:for(;++i<e;)if(l=n[i],f&&l===l){for(var c=a;c--;)if(t[c]===l)continue n;u.push(l)}else 0>o(t,l,0)&&u.push(l);return u}function at(n,t){var r=true;return Mu(n,function(n,e,u){return r=!!t(n,e,u)}),r}function ct(n,t,r,e){var u=e,i=u;return Mu(n,function(n,o,f){o=+t(n,o,f),(r(o,u)||o===e&&o===i)&&(u=o,i=n)}),i}function st(n,t){var r=[];return Mu(n,function(n,e,u){t(n,e,u)&&r.push(n);
}),r}function pt(n,t,r,e){var u;return r(n,function(n,r,i){return t(n,r,i)?(u=e?r:n,false):void 0}),u}function ht(n,t,r){for(var e=-1,u=n.length,i=-1,o=[];++e<u;){var f=n[e];if(p(f)&&Ir(f)&&(r||Ti(f)||se(f))){t&&(f=ht(f,t,r));for(var l=-1,a=f.length;++l<a;)o[++i]=f[l]}else r||(o[++i]=f)}return o}function _t(n,t){qu(n,t,ke)}function vt(n,t){return qu(n,t,Ki)}function gt(n,t){return Du(n,t,Ki)}function yt(n,t){for(var r=-1,e=t.length,u=-1,i=[];++r<e;){var o=t[r];$i(n[o])&&(i[++u]=o)}return i}function dt(n,t,r){
if(null!=n){r!==m&&r in zr(n)&&(t=[r]),r=0;for(var e=t.length;null!=n&&r<e;)n=n[t[r++]];return r&&r==e?n:m}}function mt(n,t,r,e,u,i){if(n===t)n=true;else if(null==n||null==t||!ve(n)&&!p(t))n=n!==n&&t!==t;else n:{var o=mt,f=Ti(n),l=Ti(t),a=B,c=B;f||(a=uu.call(n),a==z?a=V:a!=V&&(f=we(n))),l||(c=uu.call(t),c==z?c=V:c!=V&&we(t));var s=a==V,l=c==V,c=a==c;if(!c||f||s){if(!e&&(a=s&&ru.call(n,"__wrapped__"),l=l&&ru.call(t,"__wrapped__"),a||l)){n=o(a?n.value():n,l?t.value():t,r,e,u,i);break n}if(c){for(u||(u=[]),
i||(i=[]),a=u.length;a--;)if(u[a]==n){n=i[a]==t;break n}u.push(n),i.push(t),n=(f?gr:dr)(n,t,o,r,e,u,i),u.pop(),i.pop()}else n=false}else n=yr(n,t,a)}return n}function wt(n,t,r){var e=t.length,u=e,i=!r;if(null==n)return!u;for(n=zr(n);e--;){var o=t[e];if(i&&o[2]?o[1]!==n[o[0]]:!(o[0]in n))return false}for(;++e<u;){var o=t[e],f=o[0],l=n[f],a=o[1];if(i&&o[2]){if(l===m&&!(f in n))return false}else if(o=r?r(l,a,f):m,o===m?!mt(a,l,r,true):!o)return false}return true}function bt(n,t){var r=-1,e=Ir(n)?Me(n.length):[];return Mu(n,function(n,u,i){
e[++r]=t(n,u,i)}),e}function xt(n){var t=xr(n);if(1==t.length&&t[0][2]){var r=t[0][0],e=t[0][1];return function(n){return null==n?false:n[r]===e&&(e!==m||r in zr(n))}}return function(n){return wt(n,t)}}function At(n,t){var r=Ti(n),e=Wr(n)&&t===t&&!ve(t),u=n+"";return n=Br(n),function(i){if(null==i)return false;var o=u;if(i=zr(i),!(!r&&e||o in i)){if(i=1==n.length?i:dt(i,Ct(n,0,-1)),null==i)return false;o=Vr(n),i=zr(i)}return i[o]===t?t!==m||o in i:mt(t,i[o],m,true)}}function jt(n,t,r,e,u){if(!ve(n))return n;var i=Ir(t)&&(Ti(t)||we(t)),o=i?null:Ki(t);
return Kn(o||t,function(f,l){if(o&&(l=f,f=t[l]),p(f)){e||(e=[]),u||(u=[]);n:{for(var a=l,c=e,s=u,h=c.length,_=t[a];h--;)if(c[h]==_){n[a]=s[h];break n}var h=n[a],v=r?r(h,_,a,n,t):m,g=v===m;g&&(v=_,Ir(_)&&(Ti(_)||we(_))?v=Ti(h)?h:Ir(h)?Dn(h):[]:Fi(_)||se(_)?v=se(h)?Ae(h):Fi(h)?h:{}:g=false),c.push(_),s.push(v),g?n[a]=jt(v,_,r,c,s):(v===v?v!==h:h===h)&&(n[a]=v)}}else a=n[l],c=r?r(a,f,l,n,t):m,(s=c===m)&&(c=f),c===m&&(!i||l in n)||!s&&(c===c?c===a:a!==a)||(n[l]=c)}),n}function kt(n){return function(t){return null==t?m:t[n];
}}function Ot(n){var t=n+"";return n=Br(n),function(r){return dt(r,n,t)}}function Rt(n,t){for(var r=n?t.length:0;r--;){var e=t[r];if(e!=u&&Er(e)){var u=e;yu.call(n,e,1)}}}function It(n,t){return n+su(Cu()*(t-n+1))}function Et(n,t,r,e,u){return u(n,function(n,u,i){r=e?(e=false,n):t(r,n,u,i)}),r}function Ct(n,t,r){var e=-1,u=n.length;for(t=null==t?0:+t||0,0>t&&(t=-t>u?0:u+t),r=r===m||r>u?u:+r||0,0>r&&(r+=u),u=t>r?0:r-t>>>0,t>>>=0,r=Me(u);++e<u;)r[e]=n[e+t];return r}function Wt(n,t){var r;return Mu(n,function(n,e,u){
return r=t(n,e,u),!r}),!!r}function St(n,t){var r=n.length;for(n.sort(t);r--;)n[r]=n[r].c;return n}function Tt(t,r,e){var u=mr(),i=-1;return r=Jn(r,function(n){return u(n)}),t=bt(t,function(n){return{a:Jn(r,function(t){return t(n)}),b:++i,c:n}}),St(t,function(t,r){var u;n:{u=-1;for(var i=t.a,o=r.a,f=i.length,l=e.length;++u<f;){var a=n(i[u],o[u]);if(a){u=u<l?a*(e[u]?1:-1):a;break n}}u=t.b-r.b}return u})}function Ut(n,t){var r=0;return Mu(n,function(n,e,u){r+=+t(n,e,u)||0}),r}function $t(n,t){var e=-1,u=br(),i=n.length,o=u==r,f=o&&200<=i,l=f?Vu():null,a=[];
l?(u=qn,o=false):(f=false,l=t?[]:a);n:for(;++e<i;){var c=n[e],s=t?t(c,e,n):c;if(o&&c===c){for(var p=l.length;p--;)if(l[p]===s)continue n;t&&l.push(s),a.push(c)}else 0>u(l,s,0)&&((t||f)&&l.push(s),a.push(c))}return a}function Ft(n,t){for(var r=-1,e=t.length,u=Me(e);++r<e;)u[r]=n[t[r]];return u}function Nt(n,t,r,e){for(var u=n.length,i=e?u:-1;(e?i--:++i<u)&&t(n[i],i,n););return r?Ct(n,e?0:i,e?i+1:u):Ct(n,e?i+1:0,e?u:i)}function Lt(n,t){var r=n;r instanceof Bn&&(r=r.value());for(var e=-1,u=t.length;++e<u;){
var r=[r],i=t[e];_u.apply(r,i.args),r=i.func.apply(i.thisArg,r)}return r}function zt(n,t,r){var e=0,u=n?n.length:e;if(typeof t=="number"&&t===t&&u<=Uu){for(;e<u;){var i=e+u>>>1,o=n[i];(r?o<=t:o<t)&&null!==o?e=i+1:u=i}return u}return Bt(n,t,Fe,r)}function Bt(n,t,r,e){t=r(t);for(var u=0,i=n?n.length:0,o=t!==t,f=null===t,l=t===m;u<i;){var a=su((u+i)/2),c=r(n[a]),s=c!==m,p=c===c;(o?p||e:f?p&&s&&(e||null!=c):l?p&&(e||s):null==c?0:e?c<=t:c<t)?u=a+1:i=a}return Ou(i,Tu)}function Mt(n,t,r){if(typeof n!="function")return Fe;
if(t===m)return n;switch(r){case 1:return function(r){return n.call(t,r)};case 3:return function(r,e,u){return n.call(t,r,e,u)};case 4:return function(r,e,u,i){return n.call(t,r,e,u,i)};case 5:return function(r,e,u,i,o){return n.call(t,r,e,u,i,o)}}return function(){return n.apply(t,arguments)}}function Pt(n){return lu.call(n,0)}function qt(n,t,r){for(var e=r.length,u=-1,i=ku(n.length-e,0),o=-1,f=t.length,l=Me(i+f);++o<f;)l[o]=t[o];for(;++u<e;)l[r[u]]=n[u];for(;i--;)l[o++]=n[u++];return l}function Dt(n,t,r){
for(var e=-1,u=r.length,i=-1,o=ku(n.length-u,0),f=-1,l=t.length,a=Me(o+l);++i<o;)a[i]=n[i];for(o=i;++f<l;)a[o+f]=t[f];for(;++e<u;)a[o+r[e]]=n[i++];return a}function Kt(n,t){return function(r,e,u){var i=t?t():{};if(e=mr(e,u,3),Ti(r)){u=-1;for(var o=r.length;++u<o;){var f=r[u];n(i,f,e(f,u,r),r)}}else Mu(r,function(t,r,u){n(i,t,e(t,r,u),u)});return i}}function Vt(n){return ae(function(t,r){var e=-1,u=null==t?0:r.length,i=2<u?r[u-2]:m,o=2<u?r[2]:m,f=1<u?r[u-1]:m;for(typeof i=="function"?(i=Mt(i,f,5),
u-=2):(i=typeof f=="function"?f:m,u-=i?1:0),o&&Cr(r[0],r[1],o)&&(i=3>u?m:i,u=1);++e<u;)(o=r[e])&&n(t,o,i);return t})}function Yt(n,t){return function(r,e){var u=r?Zu(r):0;if(!Tr(u))return n(r,e);for(var i=t?u:-1,o=zr(r);(t?i--:++i<u)&&false!==e(o[i],i,o););return r}}function Zt(n){return function(t,r,e){var u=zr(t);e=e(t);for(var i=e.length,o=n?i:-1;n?o--:++o<i;){var f=e[o];if(false===r(u[f],f,u))break}return t}}function Gt(n,t){function r(){return(this&&this!==Yn&&this instanceof r?e:n).apply(t,arguments);
}var e=Xt(n);return r}function Jt(n){return function(t){var r=-1;t=Te(Ie(t));for(var e=t.length,u="";++r<e;)u=n(u,t[r],r);return u}}function Xt(n){return function(){var t=arguments;switch(t.length){case 0:return new n;case 1:return new n(t[0]);case 2:return new n(t[0],t[1]);case 3:return new n(t[0],t[1],t[2]);case 4:return new n(t[0],t[1],t[2],t[3]);case 5:return new n(t[0],t[1],t[2],t[3],t[4])}var r=Bu(n.prototype),t=n.apply(r,t);return ve(t)?t:r}}function Ht(n){function t(r,e,u){return u&&Cr(r,e,u)&&(e=null),
r=vr(r,n,null,null,null,null,null,e),r.placeholder=t.placeholder,r}return t}function Qt(n,t){return function(r,e,u){if(u&&Cr(r,e,u)&&(e=null),e=mr(e,u,3),1==e.length){u=r=Lr(r);for(var i=e,o=-1,f=u.length,l=t,a=l;++o<f;){var c=u[o],s=+i(c);n(s,l)&&(l=s,a=c)}if(u=a,!r.length||u!==t)return u}return ct(r,e,n,t)}}function nr(n,r){return function(e,u,i){return u=mr(u,i,3),Ti(e)?(u=t(e,u,r),-1<u?e[u]:m):pt(e,u,n)}}function tr(n){return function(r,e,u){return r&&r.length?(e=mr(e,u,3),t(r,e,n)):-1}}function rr(n){
return function(t,r,e){return r=mr(r,e,3),pt(t,r,n,true)}}function er(n){return function(){for(var t,r=arguments.length,e=n?r:-1,u=0,i=Me(r);n?e--:++e<r;){var o=i[u++]=arguments[e];if(typeof o!="function")throw new Je(N);!t&&zn.prototype.thru&&"wrapper"==wr(o)&&(t=new zn([]))}for(e=t?-1:r;++e<r;){var o=i[e],u=wr(o),f="wrapper"==u?Yu(o):null;t=f&&Sr(f[0])&&f[1]==(I|j|O|E)&&!f[4].length&&1==f[9]?t[wr(f[0])].apply(t,f[3]):1==o.length&&Sr(o)?t[u]():t.thru(o)}return function(){var n=arguments;if(t&&1==n.length&&Ti(n[0]))return t.plant(n[0]).value();
for(var e=0,n=r?i[e].apply(this,n):n[0];++e<r;)n=i[e].call(this,n);return n}}}function ur(n,t){return function(r,e,u){return typeof e=="function"&&u===m&&Ti(r)?n(r,e):t(r,Mt(e,u,3))}}function ir(n){return function(t,r,e){return(typeof r!="function"||e!==m)&&(r=Mt(r,e,3)),n(t,r,ke)}}function or(n){return function(t,r,e){return(typeof r!="function"||e!==m)&&(r=Mt(r,e,3)),n(t,r)}}function fr(n){return function(t,r,e){var u={};return r=mr(r,e,3),vt(t,function(t,e,i){i=r(t,e,i),e=n?i:e,t=n?t:i,u[e]=t}),
u}}function lr(n){return function(t,r,e){return t=u(t),(n?t:"")+pr(t,r,e)+(n?"":t)}}function ar(n){var t=ae(function(r,e){var u=_(e,t.placeholder);return vr(r,n,null,e,u)});return t}function cr(n,t){return function(r,e,u,i){var o=3>arguments.length;return typeof e=="function"&&i===m&&Ti(r)?n(r,e,u,o):Et(r,mr(e,i,4),u,o,t)}}function sr(n,t,r,e,u,i,o,f,l,a){function c(){for(var w=arguments.length,A=w,j=Me(w);A--;)j[A]=arguments[A];if(e&&(j=qt(j,e,u)),i&&(j=Dt(j,i,o)),v||y){var A=c.placeholder,k=_(j,A),w=w-k.length;
if(w<a){var I=f?Dn(f):null,w=ku(a-w,0),E=v?k:null,k=v?null:k,C=v?j:null,j=v?null:j;return t|=v?O:R,t&=~(v?R:O),g||(t&=~(b|x)),j=[n,t,r,C,E,j,k,I,l,w],I=sr.apply(m,j),Sr(n)&&Gu(I,j),I.placeholder=A,I}}if(A=p?r:this,I=h?A[n]:n,f)for(w=j.length,E=Ou(f.length,w),k=Dn(j);E--;)C=f[E],j[E]=Er(C,w)?k[C]:m;return s&&l<j.length&&(j.length=l),this&&this!==Yn&&this instanceof c&&(I=d||Xt(n)),I.apply(A,j)}var s=t&I,p=t&b,h=t&x,v=t&j,g=t&A,y=t&k,d=h?null:Xt(n);return c}function pr(n,t,r){return n=n.length,t=+t,
n<t&&Au(t)?(t-=n,r=null==r?" ":r+"",We(r,au(t/r.length)).slice(0,t)):""}function hr(n,t,r,e){function u(){for(var t=-1,f=arguments.length,l=-1,a=e.length,c=Me(f+a);++l<a;)c[l]=e[l];for(;f--;)c[l++]=arguments[++t];return(this&&this!==Yn&&this instanceof u?o:n).apply(i?r:this,c)}var i=t&b,o=Xt(n);return u}function _r(n){return function(t,r,e,u){var i=mr(e);return null==e&&i===it?zt(t,r,n):Bt(t,r,i(e,u,1),n)}}function vr(n,t,r,e,u,i,o,f){var l=t&x;if(!l&&typeof n!="function")throw new Je(N);var a=e?e.length:0;
if(a||(t&=~(O|R),e=u=null),a-=u?u.length:0,t&R){var c=e,s=u;e=u=null}var p=l?null:Yu(n);return r=[n,t,r,e,u,c,s,i,o,f],p&&(e=r[1],t=p[1],f=e|t,u=t==I&&e==j||t==I&&e==E&&r[7].length<=p[8]||t==(I|E)&&e==j,(f<I||u)&&(t&b&&(r[2]=p[2],f|=e&b?0:A),(e=p[3])&&(u=r[3],r[3]=u?qt(u,e,p[4]):Dn(e),r[4]=u?_(r[3],L):Dn(p[4])),(e=p[5])&&(u=r[5],r[5]=u?Dt(u,e,p[6]):Dn(e),r[6]=u?_(r[5],L):Dn(p[6])),(e=p[7])&&(r[7]=Dn(e)),t&I&&(r[8]=null==r[8]?p[8]:Ou(r[8],p[8])),null==r[9]&&(r[9]=p[9]),r[0]=p[0],r[1]=f),t=r[1],f=r[9]),
r[9]=null==f?l?0:n.length:ku(f-a,0)||0,(p?Ku:Gu)(t==b?Gt(r[0],r[2]):t!=O&&t!=(b|O)||r[4].length?sr.apply(m,r):hr.apply(m,r),r)}function gr(n,t,r,e,u,i,o){var f=-1,l=n.length,a=t.length;if(l!=a&&(!u||a<=l))return false;for(;++f<l;){var c=n[f],a=t[f],s=e?e(u?a:c,u?c:a,f):m;if(s!==m){if(s)continue;return false}if(u){if(!Hn(t,function(n){return c===n||r(c,n,e,u,i,o)}))return false}else if(c!==a&&!r(c,a,e,u,i,o))return false}return true}function yr(n,t,r){switch(r){case M:case P:return+n==+t;case q:return n.name==t.name&&n.message==t.message;
case K:return n!=+n?t!=+t:n==+t;case Y:case Z:return n==t+""}return false}function dr(n,t,r,e,u,i,o){var f=Ki(n),l=f.length,a=Ki(t).length;if(l!=a&&!u)return false;for(a=l;a--;){var c=f[a];if(!(u?c in t:ru.call(t,c)))return false}for(var s=u;++a<l;){var c=f[a],p=n[c],h=t[c],_=e?e(u?h:p,u?p:h,c):m;if(_===m?!r(p,h,e,u,i,o):!_)return false;s||(s="constructor"==c)}return s||(r=n.constructor,e=t.constructor,!(r!=e&&"constructor"in n&&"constructor"in t)||typeof r=="function"&&r instanceof r&&typeof e=="function"&&e instanceof e)?true:false;
}function mr(n,t,r){var e=Nn.callback||Ue,e=e===Ue?it:e;return r?e(n,t,r):e}function wr(n){for(var t=n.name,r=Lu[t],e=r?r.length:0;e--;){var u=r[e],i=u.func;if(null==i||i==n)return u.name}return t}function br(n,t,e){var u=Nn.indexOf||Kr,u=u===Kr?r:u;return n?u(n,t,e):u}function xr(n){n=Oe(n);for(var t=n.length;t--;){var r=n[t][1];n[t][2]=r===r&&!ve(r)}return n}function Ar(n,t){var r=null==n?m:n[t];return ge(r)?r:m}function jr(n){var t=n.length,r=new n.constructor(t);return t&&"string"==typeof n[0]&&ru.call(n,"index")&&(r.index=n.index,
r.input=n.input),r}function kr(n){return n=n.constructor,typeof n=="function"&&n instanceof n||(n=Ye),new n}function Or(n,t,r){var e=n.constructor;switch(t){case G:return Pt(n);case M:case P:return new e(+n);case J:case X:case H:case Q:case nn:case tn:case rn:case en:case un:return t=n.buffer,new e(r?Pt(t):t,n.byteOffset,n.length);case K:case Z:return new e(n);case Y:var u=new e(n.source,jn.exec(n));u.lastIndex=n.lastIndex}return u}function Rr(n,t,r){return null==n||Wr(t,n)||(t=Br(t),n=1==t.length?n:dt(n,Ct(t,0,-1)),
t=Vr(t)),t=null==n?n:n[t],null==t?m:t.apply(n,r)}function Ir(n){return null!=n&&Tr(Zu(n))}function Er(n,t){return n=typeof n=="number"||Rn.test(n)?+n:-1,t=null==t?Fu:t,-1<n&&0==n%1&&n<t}function Cr(n,t,r){if(!ve(r))return false;var e=typeof t;return("number"==e?Ir(r)&&Er(t,r.length):"string"==e&&t in r)?(t=r[t],n===n?n===t:t!==t):false}function Wr(n,t){var r=typeof n;return"string"==r&&yn.test(n)||"number"==r?true:Ti(n)?false:!gn.test(n)||null!=t&&n in zr(t)}function Sr(n){var t=wr(n);return t in Bn.prototype?(t=Nn[t],
n===t?true:(t=Yu(t),!!t&&n===t[0])):false}function Tr(n){return typeof n=="number"&&-1<n&&0==n%1&&n<=Fu}function Ur(n,t){n=zr(n);for(var r=-1,e=t.length,u={};++r<e;){var i=t[r];i in n&&(u[i]=n[i])}return u}function $r(n,t){var r={};return _t(n,function(n,e,u){t(n,e,u)&&(r[e]=n)}),r}function Fr(n){var t;if(!p(n)||uu.call(n)!=V||!(ru.call(n,"constructor")||(t=n.constructor,typeof t!="function"||t instanceof t)))return false;var r;return _t(n,function(n,t){r=t}),r===m||ru.call(n,r)}function Nr(n){for(var t=ke(n),r=t.length,e=r&&n.length,u=!!e&&Tr(e)&&(Ti(n)||se(n)),i=-1,o=[];++i<r;){
var f=t[i];(u&&Er(f,e)||ru.call(n,f))&&o.push(f)}return o}function Lr(n){return null==n?[]:Ir(n)?ve(n)?n:Ye(n):Re(n)}function zr(n){return ve(n)?n:Ye(n)}function Br(n){if(Ti(n))return n;var t=[];return u(n).replace(dn,function(n,r,e,u){t.push(e?u.replace(xn,"$1"):r||n)}),t}function Mr(n){return n instanceof Bn?n.clone():new zn(n.__wrapped__,n.__chain__,Dn(n.__actions__))}function Pr(n,t,r){return n&&n.length?((r?Cr(n,t,r):null==t)&&(t=1),Ct(n,0>t?0:t)):[]}function qr(n,t,r){var e=n?n.length:0;return e?((r?Cr(n,t,r):null==t)&&(t=1),
t=e-(+t||0),Ct(n,0,0>t?0:t)):[]}function Dr(n){return n?n[0]:m}function Kr(n,t,e){var u=n?n.length:0;if(!u)return-1;if(typeof e=="number")e=0>e?ku(u+e,0):e;else if(e)return e=zt(n,t),n=n[e],(t===t?t===n:n!==n)?e:-1;return r(n,t,e||0)}function Vr(n){var t=n?n.length:0;return t?n[t-1]:m}function Yr(n){return Pr(n,1)}function Zr(n,t,e,u){if(!n||!n.length)return[];null!=t&&typeof t!="boolean"&&(u=e,e=Cr(n,t,u)?null:t,t=false);var i=mr();if((null!=e||i!==it)&&(e=i(e,u,3)),t&&br()==r){t=e;var o;e=-1,u=n.length;
for(var i=-1,f=[];++e<u;){var l=n[e],a=t?t(l,e,n):l;e&&o===a||(o=a,f[++i]=l)}n=f}else n=$t(n,e);return n}function Gr(n){if(!n||!n.length)return[];var t=-1,r=0;n=Gn(n,function(n){return Ir(n)?(r=ku(n.length,r),true):void 0});for(var e=Me(r);++t<r;)e[t]=Jn(n,kt(t));return e}function Jr(n,t,r){return n&&n.length?(n=Gr(n),null==t?n:(t=Mt(t,r,4),Jn(n,function(n){return Xn(n,t,m,true)}))):[]}function Xr(n,t){var r=-1,e=n?n.length:0,u={};for(!e||t||Ti(n[0])||(t=[]);++r<e;){var i=n[r];t?u[i]=t[r]:i&&(u[i[0]]=i[1]);
}return u}function Hr(n){return n=Nn(n),n.__chain__=true,n}function Qr(n,t,r){return t.call(r,n)}function ne(n,t,r){var e=Ti(n)?Vn:at;return r&&Cr(n,t,r)&&(t=null),(typeof t!="function"||r!==m)&&(t=mr(t,r,3)),e(n,t)}function te(n,t,r){var e=Ti(n)?Gn:st;return t=mr(t,r,3),e(n,t)}function re(n,t,r,e){var u=n?Zu(n):0;return Tr(u)||(n=Re(n),u=n.length),u?(r=typeof r!="number"||e&&Cr(t,r,e)?0:0>r?ku(u+r,0):r||0,typeof n=="string"||!Ti(n)&&me(n)?r<u&&-1<n.indexOf(t,r):-1<br(n,t,r)):false}function ee(n,t,r){
var e=Ti(n)?Jn:bt;return t=mr(t,r,3),e(n,t)}function ue(n,t,r){if(r?Cr(n,t,r):null==t){n=Lr(n);var e=n.length;return 0<e?n[It(0,e-1)]:m}r=-1,n=xe(n);var e=n.length,u=e-1;for(t=Ou(0>t?0:+t||0,e);++r<t;){var e=It(r,u),i=n[e];n[e]=n[r],n[r]=i}return n.length=t,n}function ie(n,t,r){var e=Ti(n)?Hn:Wt;return r&&Cr(n,t,r)&&(t=null),(typeof t!="function"||r!==m)&&(t=mr(t,r,3)),e(n,t)}function oe(n,t){var r;if(typeof t!="function"){if(typeof n!="function")throw new Je(N);var e=n;n=t,t=e}return function(){
return 0<--n&&(r=t.apply(this,arguments)),1>=n&&(t=null),r}}function fe(n,t,r){function e(){var r=t-(wi()-a);0>=r||r>t?(f&&cu(f),r=p,f=s=p=m,r&&(h=wi(),l=n.apply(c,o),s||f||(o=c=null))):s=gu(e,r)}function u(){s&&cu(s),f=s=p=m,(v||_!==t)&&(h=wi(),l=n.apply(c,o),s||f||(o=c=null))}function i(){if(o=arguments,a=wi(),c=this,p=v&&(s||!g),false===_)var r=g&&!s;else{f||g||(h=a);var i=_-(a-h),y=0>=i||i>_;y?(f&&(f=cu(f)),h=a,l=n.apply(c,o)):f||(f=gu(u,i))}return y&&s?s=cu(s):s||t===_||(s=gu(e,t)),r&&(y=true,l=n.apply(c,o)),
!y||s||f||(o=c=null),l}var o,f,l,a,c,s,p,h=0,_=false,v=true;if(typeof n!="function")throw new Je(N);if(t=0>t?0:+t||0,true===r)var g=true,v=false;else ve(r)&&(g=r.leading,_="maxWait"in r&&ku(+r.maxWait||0,t),v="trailing"in r?r.trailing:v);return i.cancel=function(){s&&cu(s),f&&cu(f),f=s=p=m},i}function le(n,t){function r(){var e=arguments,u=t?t.apply(this,e):e[0],i=r.cache;return i.has(u)?i.get(u):(e=n.apply(this,e),r.cache=i.set(u,e),e)}if(typeof n!="function"||t&&typeof t!="function")throw new Je(N);return r.cache=new le.Cache,
r}function ae(n,t){if(typeof n!="function")throw new Je(N);return t=ku(t===m?n.length-1:+t||0,0),function(){for(var r=arguments,e=-1,u=ku(r.length-t,0),i=Me(u);++e<u;)i[e]=r[t+e];switch(t){case 0:return n.call(this,i);case 1:return n.call(this,r[0],i);case 2:return n.call(this,r[0],r[1],i)}for(u=Me(t+1),e=-1;++e<t;)u[e]=r[e];return u[t]=i,n.apply(this,u)}}function ce(n,t){return n>t}function se(n){return p(n)&&Ir(n)&&uu.call(n)==z}function pe(n){return!!n&&1===n.nodeType&&p(n)&&-1<uu.call(n).indexOf("Element");
}function he(n,t,r,e){return e=(r=typeof r=="function"?Mt(r,e,3):m)?r(n,t):m,e===m?mt(n,t,r):!!e}function _e(n){return p(n)&&typeof n.message=="string"&&uu.call(n)==q}function ve(n){var t=typeof n;return!!n&&("object"==t||"function"==t)}function ge(n){return null==n?false:uu.call(n)==D?ou.test(tu.call(n)):p(n)&&On.test(n)}function ye(n){return typeof n=="number"||p(n)&&uu.call(n)==K}function de(n){return p(n)&&uu.call(n)==Y}function me(n){return typeof n=="string"||p(n)&&uu.call(n)==Z}function we(n){return p(n)&&Tr(n.length)&&!!Un[uu.call(n)];
}function be(n,t){return n<t}function xe(n){var t=n?Zu(n):0;return Tr(t)?t?Dn(n):[]:Re(n)}function Ae(n){return ut(n,ke(n))}function je(n){return yt(n,ke(n))}function ke(n){if(null==n)return[];ve(n)||(n=Ye(n));for(var t=n.length,t=t&&Tr(t)&&(Ti(n)||se(n))&&t||0,r=n.constructor,e=-1,r=typeof r=="function"&&r.prototype===n,u=Me(t),i=0<t;++e<t;)u[e]=e+"";for(var o in n)i&&Er(o,t)||"constructor"==o&&(r||!ru.call(n,o))||u.push(o);return u}function Oe(n){n=zr(n);for(var t=-1,r=Ki(n),e=r.length,u=Me(e);++t<e;){
var i=r[t];u[t]=[i,n[i]]}return u}function Re(n){return Ft(n,Ki(n))}function Ie(n){return(n=u(n))&&n.replace(In,l).replace(bn,"")}function Ee(n){return(n=u(n))&&wn.test(n)?n.replace(mn,"\\$&"):n}function Ce(n,t,r){return r&&Cr(n,t,r)&&(t=0),Eu(n,t)}function We(n,t){var r="";if(n=u(n),t=+t,1>t||!n||!Au(t))return r;do t%2&&(r+=n),t=su(t/2),n+=n;while(t);return r}function Se(n,t,r){var e=n;return(n=u(n))?(r?Cr(e,t,r):null==t)?n.slice(v(n),g(n)+1):(t+="",n.slice(i(n,t),o(n,t)+1)):n}function Te(n,t,r){
return r&&Cr(n,t,r)&&(t=null),n=u(n),n.match(t||Wn)||[]}function Ue(n,t,r){return r&&Cr(n,t,r)&&(t=null),p(n)?Ne(n):it(n,t)}function $e(n){return function(){return n}}function Fe(n){return n}function Ne(n){return xt(ot(n,true))}function Le(n,t,r){if(null==r){var e=ve(t),u=e?Ki(t):null;((u=u&&u.length?yt(t,u):null)?u.length:e)||(u=false,r=t,t=n,n=this)}u||(u=yt(t,Ki(t)));var i=true,e=-1,o=$i(n),f=u.length;false===r?i=false:ve(r)&&"chain"in r&&(i=r.chain);for(;++e<f;){r=u[e];var l=t[r];n[r]=l,o&&(n.prototype[r]=function(t){
return function(){var r=this.__chain__;if(i||r){var e=n(this.__wrapped__);return(e.__actions__=Dn(this.__actions__)).push({func:t,args:arguments,thisArg:n}),e.__chain__=r,e}return r=[this.value()],_u.apply(r,arguments),t.apply(n,r)}}(l))}return n}function ze(){}function Be(n){return Wr(n)?kt(n):Ot(n)}h=h?Zn.defaults(Yn.Object(),h,Zn.pick(Yn,Tn)):Yn;var Me=h.Array,Pe=h.Date,qe=h.Error,De=h.Function,Ke=h.Math,Ve=h.Number,Ye=h.Object,Ze=h.RegExp,Ge=h.String,Je=h.TypeError,Xe=Me.prototype,He=Ye.prototype,Qe=Ge.prototype,nu=(nu=h.window)?nu.document:null,tu=De.prototype.toString,ru=He.hasOwnProperty,eu=0,uu=He.toString,iu=h._,ou=Ze("^"+Ee(tu.call(ru)).replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$"),fu=Ar(h,"ArrayBuffer"),lu=Ar(fu&&new fu(0),"slice"),au=Ke.ceil,cu=h.clearTimeout,su=Ke.floor,pu=Ar(Ye,"getPrototypeOf"),hu=h.parseFloat,_u=Xe.push,vu=Ar(h,"Set"),gu=h.setTimeout,yu=Xe.splice,du=Ar(h,"Uint8Array"),mu=Ar(h,"WeakMap"),wu=function(){
try{var n=Ar(h,"Float64Array"),t=new n(new fu(10),0,1)&&n}catch(r){}return t||null}(),bu=Ar(Ye,"create"),xu=Ar(Me,"isArray"),Au=h.isFinite,ju=Ar(Ye,"keys"),ku=Ke.max,Ou=Ke.min,Ru=Ar(Pe,"now"),Iu=Ar(Ve,"isFinite"),Eu=h.parseInt,Cu=Ke.random,Wu=Ve.NEGATIVE_INFINITY,Su=Ve.POSITIVE_INFINITY,Tu=4294967294,Uu=2147483647,$u=wu?wu.BYTES_PER_ELEMENT:0,Fu=9007199254740991,Nu=mu&&new mu,Lu={},zu=Nn.support={};!function(n){function t(){this.x=n}var r=[];t.prototype={valueOf:n,y:n};for(var e in new t)r.push(e);
try{zu.dom=11===nu.createDocumentFragment().nodeType}catch(u){zu.dom=false}}(1,0),Nn.templateSettings={escape:hn,evaluate:_n,interpolate:vn,variable:"",imports:{_:Nn}};var Bu=function(){function n(){}return function(t){if(ve(t)){n.prototype=t;var r=new n;n.prototype=null}return r||{}}}(),Mu=Yt(vt),Pu=Yt(gt,true),qu=Zt(),Du=Zt(true),Ku=Nu?function(n,t){return Nu.set(n,t),n}:Fe;lu||(Pt=fu&&du?function(n){var t=n.byteLength,r=wu?su(t/$u):0,e=r*$u,u=new fu(t);if(r){var i=new wu(u,0,r);i.set(new wu(n,0,r))}return t!=e&&(i=new du(u,e),
i.set(new du(n,e))),u}:$e(null));var Vu=bu&&vu?function(n){return new Pn(n)}:$e(null),Yu=Nu?function(n){return Nu.get(n)}:ze,Zu=kt("length"),Gu=function(){var n=0,t=0;return function(r,e){var u=wi(),i=T-(u-t);if(t=u,0<i){if(++n>=S)return r}else n=0;return Ku(r,e)}}(),Ju=ae(function(n,t){return Ir(n)?lt(n,ht(t,false,true)):[]}),Xu=tr(),Hu=tr(true),Qu=ae(function(n){for(var t=n.length,e=t,u=Me(c),i=br(),o=i==r,f=[];e--;){var l=n[e]=Ir(l=n[e])?l:[];u[e]=o&&120<=l.length?Vu(e&&l):null}var o=n[0],a=-1,c=o?o.length:0,s=u[0];
n:for(;++a<c;)if(l=o[a],0>(s?qn(s,l):i(f,l,0))){for(e=t;--e;){var p=u[e];if(0>(p?qn(p,l):i(n[e],l,0)))continue n}s&&s.push(l),f.push(l)}return f}),ni=ae(function(t,r){r=ht(r);var e=et(t,r);return Rt(t,r.sort(n)),e}),ti=_r(),ri=_r(true),ei=ae(function(n){return $t(ht(n,false,true))}),ui=ae(function(n,t){return Ir(n)?lt(n,t):[]}),ii=ae(Gr),oi=ae(function(n){var t=n.length,r=2<t?n[t-2]:m,e=1<t?n[t-1]:m;return 2<t&&typeof r=="function"?t-=2:(r=1<t&&typeof e=="function"?(--t,e):m,e=m),n.length=t,Jr(n,r,e)}),fi=ae(function(n,t){
return et(n,ht(t))}),li=Kt(function(n,t,r){ru.call(n,r)?++n[r]:n[r]=1}),ai=nr(Mu),ci=nr(Pu,true),si=ur(Kn,Mu),pi=ur(function(n,t){for(var r=n.length;r--&&false!==t(n[r],r,n););return n},Pu),hi=Kt(function(n,t,r){ru.call(n,r)?n[r].push(t):n[r]=[t]}),_i=Kt(function(n,t,r){n[r]=t}),vi=ae(function(n,t,r){var e=-1,u=typeof t=="function",i=Wr(t),o=Ir(n)?Me(n.length):[];return Mu(n,function(n){var f=u?t:i&&null!=n?n[t]:null;o[++e]=f?f.apply(n,r):Rr(n,t,r)}),o}),gi=Kt(function(n,t,r){n[r?0:1].push(t)},function(){
return[[],[]]}),yi=cr(Xn,Mu),di=cr(function(n,t,r,e){var u=n.length;for(e&&u&&(r=n[--u]);u--;)r=t(r,n[u],u,n);return r},Pu),mi=ae(function(n,t){if(null==n)return[];var r=t[2];return r&&Cr(t[0],t[1],r)&&(t.length=1),Tt(n,ht(t),[])}),wi=Ru||function(){return(new Pe).getTime()},bi=ae(function(n,t,r){var e=b;if(r.length)var u=_(r,bi.placeholder),e=e|O;return vr(n,e,t,r,u)}),xi=ae(function(n,t){t=t.length?ht(t):je(n);for(var r=-1,e=t.length;++r<e;){var u=t[r];n[u]=vr(n[u],b,n)}return n}),Ai=ae(function(n,t,r){
var e=b|x;if(r.length)var u=_(r,Ai.placeholder),e=e|O;return vr(t,e,n,r,u)}),ji=Ht(j),ki=Ht(k),Oi=ae(function(n,t){return ft(n,1,t)}),Ri=ae(function(n,t,r){return ft(n,t,r)}),Ii=er(),Ei=er(true),Ci=ar(O),Wi=ar(R),Si=ae(function(n,t){return vr(n,E,null,null,null,ht(t))}),Ti=xu||function(n){return p(n)&&Tr(n.length)&&uu.call(n)==B};zu.dom||(pe=function(n){return!!n&&1===n.nodeType&&p(n)&&!Fi(n)});var Ui=Iu||function(n){return typeof n=="number"&&Au(n)},$i=e(/x/)||du&&!e(du)?function(n){return uu.call(n)==D;
}:e,Fi=pu?function(n){if(!n||uu.call(n)!=V)return false;var t=Ar(n,"valueOf"),r=t&&(r=pu(t))&&pu(r);return r?n==r||pu(n)==r:Fr(n)}:Fr,Ni=Vt(function(n,t,r){return r?tt(n,t,r):rt(n,t)}),Li=ae(function(n){var t=n[0];return null==t?t:(n.push(Qn),Ni.apply(m,n))}),zi=rr(vt),Bi=rr(gt),Mi=ir(qu),Pi=ir(Du),qi=or(vt),Di=or(gt),Ki=ju?function(n){var t=null==n?null:n.constructor;return typeof t=="function"&&t.prototype===n||typeof n!="function"&&Ir(n)?Nr(n):ve(n)?ju(n):[]}:Nr,Vi=fr(true),Yi=fr(),Zi=Vt(jt),Gi=ae(function(n,t){
if(null==n)return{};if("function"!=typeof t[0])return t=Jn(ht(t),Ge),Ur(n,lt(ke(n),t));var r=Mt(t[0],t[1],3);return $r(n,function(n,t,e){return!r(n,t,e)})}),Ji=ae(function(n,t){return null==n?{}:"function"==typeof t[0]?$r(n,Mt(t[0],t[1],3)):Ur(n,ht(t))}),Xi=Jt(function(n,t,r){return t=t.toLowerCase(),n+(r?t.charAt(0).toUpperCase()+t.slice(1):t)}),Hi=Jt(function(n,t,r){return n+(r?"-":"")+t.toLowerCase()}),Qi=lr(),no=lr(true);8!=Eu(Sn+"08")&&(Ce=function(n,t,r){return(r?Cr(n,t,r):null==t)?t=0:t&&(t=+t),
n=Se(n),Eu(n,t||(kn.test(n)?16:10))});var to=Jt(function(n,t,r){return n+(r?"_":"")+t.toLowerCase()}),ro=Jt(function(n,t,r){return n+(r?" ":"")+(t.charAt(0).toUpperCase()+t.slice(1))}),eo=ae(function(n,t){try{return n.apply(m,t)}catch(r){return _e(r)?r:new qe(r)}}),uo=ae(function(n,t){return function(r){return Rr(r,n,t)}}),io=ae(function(n,t){return function(r){return Rr(n,r,t)}}),oo=Qt(ce,Wu),fo=Qt(be,Su);return Nn.prototype=Ln.prototype,zn.prototype=Bu(Ln.prototype),zn.prototype.constructor=zn,
Bn.prototype=Bu(Ln.prototype),Bn.prototype.constructor=Bn,Mn.prototype["delete"]=function(n){return this.has(n)&&delete this.__data__[n]},Mn.prototype.get=function(n){return"__proto__"==n?m:this.__data__[n]},Mn.prototype.has=function(n){return"__proto__"!=n&&ru.call(this.__data__,n)},Mn.prototype.set=function(n,t){return"__proto__"!=n&&(this.__data__[n]=t),this},Pn.prototype.push=function(n){var t=this.data;typeof n=="string"||ve(n)?t.set.add(n):t.hash[n]=true},le.Cache=Mn,Nn.after=function(n,t){if(typeof t!="function"){
if(typeof n!="function")throw new Je(N);var r=n;n=t,t=r}return n=Au(n=+n)?n:0,function(){return 1>--n?t.apply(this,arguments):void 0}},Nn.ary=function(n,t,r){return r&&Cr(n,t,r)&&(t=null),t=n&&null==t?n.length:ku(+t||0,0),vr(n,I,null,null,null,null,t)},Nn.assign=Ni,Nn.at=fi,Nn.before=oe,Nn.bind=bi,Nn.bindAll=xi,Nn.bindKey=Ai,Nn.callback=Ue,Nn.chain=Hr,Nn.chunk=function(n,t,r){t=(r?Cr(n,t,r):null==t)?1:ku(+t||1,1),r=0;for(var e=n?n.length:0,u=-1,i=Me(au(e/t));r<e;)i[++u]=Ct(n,r,r+=t);return i},Nn.compact=function(n){
for(var t=-1,r=n?n.length:0,e=-1,u=[];++t<r;){var i=n[t];i&&(u[++e]=i)}return u},Nn.constant=$e,Nn.countBy=li,Nn.create=function(n,t,r){var e=Bu(n);return r&&Cr(n,t,r)&&(t=null),t?rt(e,t):e},Nn.curry=ji,Nn.curryRight=ki,Nn.debounce=fe,Nn.defaults=Li,Nn.defer=Oi,Nn.delay=Ri,Nn.difference=Ju,Nn.drop=Pr,Nn.dropRight=qr,Nn.dropRightWhile=function(n,t,r){return n&&n.length?Nt(n,mr(t,r,3),true,true):[]},Nn.dropWhile=function(n,t,r){return n&&n.length?Nt(n,mr(t,r,3),true):[]},Nn.fill=function(n,t,r,e){var u=n?n.length:0;
if(!u)return[];for(r&&typeof r!="number"&&Cr(n,t,r)&&(r=0,e=u),u=n.length,r=null==r?0:+r||0,0>r&&(r=-r>u?0:u+r),e=e===m||e>u?u:+e||0,0>e&&(e+=u),u=r>e?0:e>>>0,r>>>=0;r<u;)n[r++]=t;return n},Nn.filter=te,Nn.flatten=function(n,t,r){var e=n?n.length:0;return r&&Cr(n,t,r)&&(t=false),e?ht(n,t):[]},Nn.flattenDeep=function(n){return n&&n.length?ht(n,true):[]},Nn.flow=Ii,Nn.flowRight=Ei,Nn.forEach=si,Nn.forEachRight=pi,Nn.forIn=Mi,Nn.forInRight=Pi,Nn.forOwn=qi,Nn.forOwnRight=Di,Nn.functions=je,Nn.groupBy=hi,Nn.indexBy=_i,
Nn.initial=function(n){return qr(n,1)},Nn.intersection=Qu,Nn.invert=function(n,t,r){r&&Cr(n,t,r)&&(t=null),r=-1;for(var e=Ki(n),u=e.length,i={};++r<u;){var o=e[r],f=n[o];t?ru.call(i,f)?i[f].push(o):i[f]=[o]:i[f]=o}return i},Nn.invoke=vi,Nn.keys=Ki,Nn.keysIn=ke,Nn.map=ee,Nn.mapKeys=Vi,Nn.mapValues=Yi,Nn.matches=Ne,Nn.matchesProperty=function(n,t){return At(n,ot(t,true))},Nn.memoize=le,Nn.merge=Zi,Nn.method=uo,Nn.methodOf=io,Nn.mixin=Le,Nn.negate=function(n){if(typeof n!="function")throw new Je(N);return function(){
return!n.apply(this,arguments)}},Nn.omit=Gi,Nn.once=function(n){return oe(2,n)},Nn.pairs=Oe,Nn.partial=Ci,Nn.partialRight=Wi,Nn.partition=gi,Nn.pick=Ji,Nn.pluck=function(n,t){return ee(n,Be(t))},Nn.property=Be,Nn.propertyOf=function(n){return function(t){return dt(n,Br(t),t+"")}},Nn.pull=function(){var n=arguments,t=n[0];if(!t||!t.length)return t;for(var r=0,e=br(),u=n.length;++r<u;)for(var i=0,o=n[r];-1<(i=e(t,o,i));)yu.call(t,i,1);return t},Nn.pullAt=ni,Nn.range=function(n,t,r){r&&Cr(n,t,r)&&(t=r=null),
n=+n||0,r=null==r?1:+r||0,null==t?(t=n,n=0):t=+t||0;var e=-1;t=ku(au((t-n)/(r||1)),0);for(var u=Me(t);++e<t;)u[e]=n,n+=r;return u},Nn.rearg=Si,Nn.reject=function(n,t,r){var e=Ti(n)?Gn:st;return t=mr(t,r,3),e(n,function(n,r,e){return!t(n,r,e)})},Nn.remove=function(n,t,r){var e=[];if(!n||!n.length)return e;var u=-1,i=[],o=n.length;for(t=mr(t,r,3);++u<o;)r=n[u],t(r,u,n)&&(e.push(r),i.push(u));return Rt(n,i),e},Nn.rest=Yr,Nn.restParam=ae,Nn.set=function(n,t,r){if(null==n)return n;var e=t+"";t=null!=n[e]||Wr(t,n)?[e]:Br(t);
for(var e=-1,u=t.length,i=u-1,o=n;null!=o&&++e<u;){var f=t[e];ve(o)&&(e==i?o[f]=r:null==o[f]&&(o[f]=Er(t[e+1])?[]:{})),o=o[f]}return n},Nn.shuffle=function(n){return ue(n,Su)},Nn.slice=function(n,t,r){var e=n?n.length:0;return e?(r&&typeof r!="number"&&Cr(n,t,r)&&(t=0,r=e),Ct(n,t,r)):[]},Nn.sortBy=function(n,t,r){if(null==n)return[];r&&Cr(n,t,r)&&(t=null);var e=-1;return t=mr(t,r,3),n=bt(n,function(n,r,u){return{a:t(n,r,u),b:++e,c:n}}),St(n,f)},Nn.sortByAll=mi,Nn.sortByOrder=function(n,t,r,e){return null==n?[]:(e&&Cr(t,r,e)&&(r=null),
Ti(t)||(t=null==t?[]:[t]),Ti(r)||(r=null==r?[]:[r]),Tt(n,t,r))},Nn.spread=function(n){if(typeof n!="function")throw new Je(N);return function(t){return n.apply(this,t)}},Nn.take=function(n,t,r){return n&&n.length?((r?Cr(n,t,r):null==t)&&(t=1),Ct(n,0,0>t?0:t)):[]},Nn.takeRight=function(n,t,r){var e=n?n.length:0;return e?((r?Cr(n,t,r):null==t)&&(t=1),t=e-(+t||0),Ct(n,0>t?0:t)):[]},Nn.takeRightWhile=function(n,t,r){return n&&n.length?Nt(n,mr(t,r,3),false,true):[]},Nn.takeWhile=function(n,t,r){return n&&n.length?Nt(n,mr(t,r,3)):[];
},Nn.tap=function(n,t,r){return t.call(r,n),n},Nn.throttle=function(n,t,r){var e=true,u=true;if(typeof n!="function")throw new Je(N);return false===r?e=false:ve(r)&&(e="leading"in r?!!r.leading:e,u="trailing"in r?!!r.trailing:u),Fn.leading=e,Fn.maxWait=+t,Fn.trailing=u,fe(n,t,Fn)},Nn.thru=Qr,Nn.times=function(n,t,r){if(n=su(n),1>n||!Au(n))return[];var e=-1,u=Me(Ou(n,4294967295));for(t=Mt(t,r,1);++e<n;)4294967295>e?u[e]=t(e):t(e);return u},Nn.toArray=xe,Nn.toPlainObject=Ae,Nn.transform=function(n,t,r,e){var u=Ti(n)||we(n);
return t=mr(t,e,4),null==r&&(u||ve(n)?(e=n.constructor,r=u?Ti(n)?new e:[]:Bu($i(e)?e.prototype:null)):r={}),(u?Kn:vt)(n,function(n,e,u){return t(r,n,e,u)}),r},Nn.union=ei,Nn.uniq=Zr,Nn.unzip=Gr,Nn.unzipWith=Jr,Nn.values=Re,Nn.valuesIn=function(n){return Ft(n,ke(n))},Nn.where=function(n,t){return te(n,xt(t))},Nn.without=ui,Nn.wrap=function(n,t){return t=null==t?Fe:t,vr(t,O,null,[n],[])},Nn.xor=function(){for(var n=-1,t=arguments.length;++n<t;){var r=arguments[n];if(Ir(r))var e=e?lt(e,r).concat(lt(r,e)):r;
}return e?$t(e):[]},Nn.zip=ii,Nn.zipObject=Xr,Nn.zipWith=oi,Nn.backflow=Ei,Nn.collect=ee,Nn.compose=Ei,Nn.each=si,Nn.eachRight=pi,Nn.extend=Ni,Nn.iteratee=Ue,Nn.methods=je,Nn.object=Xr,Nn.select=te,Nn.tail=Yr,Nn.unique=Zr,Le(Nn,Nn),Nn.add=function(n,t){return(+n||0)+(+t||0)},Nn.attempt=eo,Nn.camelCase=Xi,Nn.capitalize=function(n){return(n=u(n))&&n.charAt(0).toUpperCase()+n.slice(1)},Nn.clone=function(n,t,r,e){return t&&typeof t!="boolean"&&Cr(n,t,r)?t=false:typeof t=="function"&&(e=r,r=t,t=false),typeof r=="function"?ot(n,t,Mt(r,e,1)):ot(n,t);
},Nn.cloneDeep=function(n,t,r){return typeof t=="function"?ot(n,true,Mt(t,r,1)):ot(n,true)},Nn.deburr=Ie,Nn.endsWith=function(n,t,r){n=u(n),t+="";var e=n.length;return r=r===m?e:Ou(0>r?0:+r||0,e),r-=t.length,0<=r&&n.indexOf(t,r)==r},Nn.escape=function(n){return(n=u(n))&&pn.test(n)?n.replace(cn,a):n},Nn.escapeRegExp=Ee,Nn.every=ne,Nn.find=ai,Nn.findIndex=Xu,Nn.findKey=zi,Nn.findLast=ci,Nn.findLastIndex=Hu,Nn.findLastKey=Bi,Nn.findWhere=function(n,t){return ai(n,xt(t))},Nn.first=Dr,Nn.get=function(n,t,r){
return n=null==n?m:dt(n,Br(t),t+""),n===m?r:n},Nn.gt=ce,Nn.gte=function(n,t){return n>=t},Nn.has=function(n,t){if(null==n)return false;var r=ru.call(n,t);if(!r&&!Wr(t)){if(t=Br(t),n=1==t.length?n:dt(n,Ct(t,0,-1)),null==n)return false;t=Vr(t),r=ru.call(n,t)}return r||Tr(n.length)&&Er(t,n.length)&&(Ti(n)||se(n))},Nn.identity=Fe,Nn.includes=re,Nn.indexOf=Kr,Nn.inRange=function(n,t,r){return t=+t||0,"undefined"===typeof r?(r=t,t=0):r=+r||0,n>=Ou(t,r)&&n<ku(t,r)},Nn.isArguments=se,Nn.isArray=Ti,Nn.isBoolean=function(n){
return true===n||false===n||p(n)&&uu.call(n)==M},Nn.isDate=function(n){return p(n)&&uu.call(n)==P},Nn.isElement=pe,Nn.isEmpty=function(n){return null==n?true:Ir(n)&&(Ti(n)||me(n)||se(n)||p(n)&&$i(n.splice))?!n.length:!Ki(n).length},Nn.isEqual=he,Nn.isError=_e,Nn.isFinite=Ui,Nn.isFunction=$i,Nn.isMatch=function(n,t,r,e){return r=typeof r=="function"?Mt(r,e,3):m,wt(n,xr(t),r)},Nn.isNaN=function(n){return ye(n)&&n!=+n},Nn.isNative=ge,Nn.isNull=function(n){return null===n},Nn.isNumber=ye,Nn.isObject=ve,Nn.isPlainObject=Fi,
Nn.isRegExp=de,Nn.isString=me,Nn.isTypedArray=we,Nn.isUndefined=function(n){return n===m},Nn.kebabCase=Hi,Nn.last=Vr,Nn.lastIndexOf=function(n,t,r){var e=n?n.length:0;if(!e)return-1;var u=e;if(typeof r=="number")u=(0>r?ku(e+r,0):Ou(r||0,e-1))+1;else if(r)return u=zt(n,t,true)-1,n=n[u],(t===t?t===n:n!==n)?u:-1;if(t!==t)return s(n,u,true);for(;u--;)if(n[u]===t)return u;return-1},Nn.lt=be,Nn.lte=function(n,t){return n<=t},Nn.max=oo,Nn.min=fo,Nn.noConflict=function(){return h._=iu,this},Nn.noop=ze,Nn.now=wi,
Nn.pad=function(n,t,r){n=u(n),t=+t;var e=n.length;return e<t&&Au(t)?(e=(t-e)/2,t=su(e),e=au(e),r=pr("",e,r),r.slice(0,t)+n+r):n},Nn.padLeft=Qi,Nn.padRight=no,Nn.parseInt=Ce,Nn.random=function(n,t,r){r&&Cr(n,t,r)&&(t=r=null);var e=null==n,u=null==t;return null==r&&(u&&typeof n=="boolean"?(r=n,n=1):typeof t=="boolean"&&(r=t,u=true)),e&&u&&(t=1,u=false),n=+n||0,u?(t=n,n=0):t=+t||0,r||n%1||t%1?(r=Cu(),Ou(n+r*(t-n+hu("1e-"+((r+"").length-1))),t)):It(n,t)},Nn.reduce=yi,Nn.reduceRight=di,Nn.repeat=We,Nn.result=function(n,t,r){
var e=null==n?m:n[t];return e===m&&(null==n||Wr(t,n)||(t=Br(t),n=1==t.length?n:dt(n,Ct(t,0,-1)),e=null==n?m:n[Vr(t)]),e=e===m?r:e),$i(e)?e.call(n):e},Nn.runInContext=d,Nn.size=function(n){var t=n?Zu(n):0;return Tr(t)?t:Ki(n).length},Nn.snakeCase=to,Nn.some=ie,Nn.sortedIndex=ti,Nn.sortedLastIndex=ri,Nn.startCase=ro,Nn.startsWith=function(n,t,r){return n=u(n),r=null==r?0:Ou(0>r?0:+r||0,n.length),n.lastIndexOf(t,r)==r},Nn.sum=function(n,t,r){r&&Cr(n,t,r)&&(t=null);var e=mr(),u=null==t;if(u&&e===it||(u=false,
t=e(t,r,3)),u){for(n=Ti(n)?n:Lr(n),t=n.length,r=0;t--;)r+=+n[t]||0;n=r}else n=Ut(n,t);return n},Nn.template=function(n,t,r){var e=Nn.templateSettings;r&&Cr(n,t,r)&&(t=r=null),n=u(n),t=tt(rt({},r||t),e,nt),r=tt(rt({},t.imports),e.imports,nt);var i,o,f=Ki(r),l=Ft(r,f),a=0;r=t.interpolate||En;var s="__p+='";r=Ze((t.escape||En).source+"|"+r.source+"|"+(r===vn?An:En).source+"|"+(t.evaluate||En).source+"|$","g");var p="sourceURL"in t?"//# sourceURL="+t.sourceURL+"\n":"";if(n.replace(r,function(t,r,e,u,f,l){
return e||(e=u),s+=n.slice(a,l).replace(Cn,c),r&&(i=true,s+="'+__e("+r+")+'"),f&&(o=true,s+="';"+f+";\n__p+='"),e&&(s+="'+((__t=("+e+"))==null?'':__t)+'"),a=l+t.length,t}),s+="';",(t=t.variable)||(s="with(obj){"+s+"}"),s=(o?s.replace(on,""):s).replace(fn,"$1").replace(ln,"$1;"),s="function("+(t||"obj")+"){"+(t?"":"obj||(obj={});")+"var __t,__p=''"+(i?",__e=_.escape":"")+(o?",__j=Array.prototype.join;function print(){__p+=__j.call(arguments,'')}":";")+s+"return __p}",t=eo(function(){return De(f,p+"return "+s).apply(m,l);
}),t.source=s,_e(t))throw t;return t},Nn.trim=Se,Nn.trimLeft=function(n,t,r){var e=n;return(n=u(n))?n.slice((r?Cr(e,t,r):null==t)?v(n):i(n,t+"")):n},Nn.trimRight=function(n,t,r){var e=n;return(n=u(n))?(r?Cr(e,t,r):null==t)?n.slice(0,g(n)+1):n.slice(0,o(n,t+"")+1):n},Nn.trunc=function(n,t,r){r&&Cr(n,t,r)&&(t=null);var e=C;if(r=W,null!=t)if(ve(t)){var i="separator"in t?t.separator:i,e="length"in t?+t.length||0:e;r="omission"in t?u(t.omission):r}else e=+t||0;if(n=u(n),e>=n.length)return n;if(e-=r.length,
1>e)return r;if(t=n.slice(0,e),null==i)return t+r;if(de(i)){if(n.slice(e).search(i)){var o,f=n.slice(0,e);for(i.global||(i=Ze(i.source,(jn.exec(i)||"")+"g")),i.lastIndex=0;n=i.exec(f);)o=n.index;t=t.slice(0,null==o?e:o)}}else n.indexOf(i,e)!=e&&(i=t.lastIndexOf(i),-1<i&&(t=t.slice(0,i)));return t+r},Nn.unescape=function(n){return(n=u(n))&&sn.test(n)?n.replace(an,y):n},Nn.uniqueId=function(n){var t=++eu;return u(n)+t},Nn.words=Te,Nn.all=ne,Nn.any=ie,Nn.contains=re,Nn.eq=he,Nn.detect=ai,Nn.foldl=yi,
Nn.foldr=di,Nn.head=Dr,Nn.include=re,Nn.inject=yi,Le(Nn,function(){var n={};return vt(Nn,function(t,r){Nn.prototype[r]||(n[r]=t)}),n}(),false),Nn.sample=ue,Nn.prototype.sample=function(n){return this.__chain__||null!=n?this.thru(function(t){return ue(t,n)}):ue(this.value())},Nn.VERSION=w,Kn("bind bindKey curry curryRight partial partialRight".split(" "),function(n){Nn[n].placeholder=Nn}),Kn(["dropWhile","filter","map","takeWhile"],function(n,t){var r=t!=F,e=t==U;Bn.prototype[n]=function(n,u){var i=this.__filtered__,o=i&&e?new Bn(this):this.clone();
return(o.__iteratees__||(o.__iteratees__=[])).push({done:false,count:0,index:0,iteratee:mr(n,u,1),limit:-1,type:t}),o.__filtered__=i||r,o}}),Kn(["drop","take"],function(n,t){var r=n+"While";Bn.prototype[n]=function(r){var e=this.__filtered__,u=e&&!t?this.dropWhile():this.clone();return r=null==r?1:ku(su(r)||0,0),e?t?u.__takeCount__=Ou(u.__takeCount__,r):Vr(u.__iteratees__).limit=r:(u.__views__||(u.__views__=[])).push({size:r,type:n+(0>u.__dir__?"Right":"")}),u},Bn.prototype[n+"Right"]=function(t){return this.reverse()[n](t).reverse();
},Bn.prototype[n+"RightWhile"]=function(n,t){return this.reverse()[r](n,t).reverse()}}),Kn(["first","last"],function(n,t){var r="take"+(t?"Right":"");Bn.prototype[n]=function(){return this[r](1).value()[0]}}),Kn(["initial","rest"],function(n,t){var r="drop"+(t?"":"Right");Bn.prototype[n]=function(){return this[r](1)}}),Kn(["pluck","where"],function(n,t){var r=t?"filter":"map",e=t?xt:Be;Bn.prototype[n]=function(n){return this[r](e(n))}}),Bn.prototype.compact=function(){return this.filter(Fe)},Bn.prototype.reject=function(n,t){
return n=mr(n,t,1),this.filter(function(t){return!n(t)})},Bn.prototype.slice=function(n,t){n=null==n?0:+n||0;var r=this;return 0>n?r=this.takeRight(-n):n&&(r=this.drop(n)),t!==m&&(t=+t||0,r=0>t?r.dropRight(-t):r.take(t-n)),r},Bn.prototype.toArray=function(){return this.drop(0)},vt(Bn.prototype,function(n,t){var r=Nn[t];if(r){var e=/^(?:filter|map|reject)|While$/.test(t),u=/^(?:first|last)$/.test(t);Nn.prototype[t]=function(){function t(n){return n=[n],_u.apply(n,i),r.apply(Nn,n)}var i=arguments,o=this.__chain__,f=this.__wrapped__,l=!!this.__actions__.length,a=f instanceof Bn,c=i[0],s=a||Ti(f);
return s&&e&&typeof c=="function"&&1!=c.length&&(a=s=false),a=a&&!l,u&&!o?a?n.call(f):r.call(Nn,this.value()):s?(f=n.apply(a?f:new Bn(this),i),u||!l&&!f.__actions__||(f.__actions__||(f.__actions__=[])).push({func:Qr,args:[t],thisArg:Nn}),new zn(f,o)):this.thru(t)}}}),Kn("concat join pop push replace shift sort splice split unshift".split(" "),function(n){var t=(/^(?:replace|split)$/.test(n)?Qe:Xe)[n],r=/^(?:push|sort|unshift)$/.test(n)?"tap":"thru",e=/^(?:join|pop|replace|shift)$/.test(n);Nn.prototype[n]=function(){
var n=arguments;return e&&!this.__chain__?t.apply(this.value(),n):this[r](function(r){return t.apply(r,n)})}}),vt(Bn.prototype,function(n,t){var r=Nn[t];if(r){var e=r.name;(Lu[e]||(Lu[e]=[])).push({name:t,func:r})}}),Lu[sr(null,x).name]=[{name:"wrapper",func:null}],Bn.prototype.clone=function(){var n=this.__actions__,t=this.__iteratees__,r=this.__views__,e=new Bn(this.__wrapped__);return e.__actions__=n?Dn(n):null,e.__dir__=this.__dir__,e.__filtered__=this.__filtered__,e.__iteratees__=t?Dn(t):null,
e.__takeCount__=this.__takeCount__,e.__views__=r?Dn(r):null,e},Bn.prototype.reverse=function(){if(this.__filtered__){var n=new Bn(this);n.__dir__=-1,n.__filtered__=true}else n=this.clone(),n.__dir__*=-1;return n},Bn.prototype.value=function(){var n=this.__wrapped__.value();if(!Ti(n))return Lt(n,this.__actions__);var t,r=this.__dir__,e=0>r;t=n.length;for(var u=this.__views__,i=0,o=-1,f=u?u.length:0;++o<f;){var l=u[o],a=l.size;switch(l.type){case"drop":i+=a;break;case"dropRight":t-=a;break;case"take":
t=Ou(t,i+a);break;case"takeRight":i=ku(i,t-a)}}t={start:i,end:t},u=t.start,i=t.end,t=i-u,u=e?i:u-1,i=Ou(t,this.__takeCount__),f=(o=this.__iteratees__)?o.length:0,l=0,a=[];n:for(;t--&&l<i;){for(var u=u+r,c=-1,s=n[u];++c<f;){var p=o[c],h=p.iteratee,_=p.type;if(_==U){if(p.done&&(e?u>p.index:u<p.index)&&(p.count=0,p.done=false),p.index=u,!(p.done||(_=p.limit,p.done=-1<_?p.count++>=_:!h(s))))continue n}else if(p=h(s),_==F)s=p;else if(!p){if(_==$)continue n;break n}}a[l++]=s}return a},Nn.prototype.chain=function(){
return Hr(this)},Nn.prototype.commit=function(){return new zn(this.value(),this.__chain__)},Nn.prototype.plant=function(n){for(var t,r=this;r instanceof Ln;){var e=Mr(r);t?u.__wrapped__=e:t=e;var u=e,r=r.__wrapped__}return u.__wrapped__=n,t},Nn.prototype.reverse=function(){var n=this.__wrapped__;return n instanceof Bn?(this.__actions__.length&&(n=new Bn(this)),new zn(n.reverse(),this.__chain__)):this.thru(function(n){return n.reverse()})},Nn.prototype.toString=function(){return this.value()+""},Nn.prototype.run=Nn.prototype.toJSON=Nn.prototype.valueOf=Nn.prototype.value=function(){
return Lt(this.__wrapped__,this.__actions__)},Nn.prototype.collect=Nn.prototype.map,Nn.prototype.head=Nn.prototype.first,Nn.prototype.select=Nn.prototype.filter,Nn.prototype.tail=Nn.prototype.rest,Nn}var m,w="3.9.3",b=1,x=2,A=4,j=8,k=16,O=32,R=64,I=128,E=256,C=30,W="...",S=150,T=16,U=0,$=1,F=2,N="Expected a function",L="__lodash_placeholder__",z="[object Arguments]",B="[object Array]",M="[object Boolean]",P="[object Date]",q="[object Error]",D="[object Function]",K="[object Number]",V="[object Object]",Y="[object RegExp]",Z="[object String]",G="[object ArrayBuffer]",J="[object Float32Array]",X="[object Float64Array]",H="[object Int8Array]",Q="[object Int16Array]",nn="[object Int32Array]",tn="[object Uint8Array]",rn="[object Uint8ClampedArray]",en="[object Uint16Array]",un="[object Uint32Array]",on=/\b__p\+='';/g,fn=/\b(__p\+=)''\+/g,ln=/(__e\(.*?\)|\b__t\))\+'';/g,an=/&(?:amp|lt|gt|quot|#39|#96);/g,cn=/[&<>"'`]/g,sn=RegExp(an.source),pn=RegExp(cn.source),hn=/<%-([\s\S]+?)%>/g,_n=/<%([\s\S]+?)%>/g,vn=/<%=([\s\S]+?)%>/g,gn=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\n\\]|\\.)*?\1)\]/,yn=/^\w*$/,dn=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\n\\]|\\.)*?)\2)\]/g,mn=/[.*+?^${}()|[\]\/\\]/g,wn=RegExp(mn.source),bn=/[\u0300-\u036f\ufe20-\ufe23]/g,xn=/\\(\\)?/g,An=/\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g,jn=/\w*$/,kn=/^0[xX]/,On=/^\[object .+?Constructor\]$/,Rn=/^\d+$/,In=/[\xc0-\xd6\xd8-\xde\xdf-\xf6\xf8-\xff]/g,En=/($^)/,Cn=/['\n\r\u2028\u2029\\]/g,Wn=RegExp("[A-Z\\xc0-\\xd6\\xd8-\\xde]+(?=[A-Z\\xc0-\\xd6\\xd8-\\xde][a-z\\xdf-\\xf6\\xf8-\\xff]+)|[A-Z\\xc0-\\xd6\\xd8-\\xde]?[a-z\\xdf-\\xf6\\xf8-\\xff]+|[A-Z\\xc0-\\xd6\\xd8-\\xde]+|[0-9]+","g"),Sn=" \t\x0b\f\xa0\ufeff\n\r\u2028\u2029\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000",Tn="Array ArrayBuffer Date Error Float32Array Float64Array Function Int8Array Int16Array Int32Array Math Number Object RegExp Set String _ clearTimeout document isFinite parseFloat parseInt setTimeout TypeError Uint8Array Uint8ClampedArray Uint16Array Uint32Array WeakMap window".split(" "),Un={};
Un[J]=Un[X]=Un[H]=Un[Q]=Un[nn]=Un[tn]=Un[rn]=Un[en]=Un[un]=true,Un[z]=Un[B]=Un[G]=Un[M]=Un[P]=Un[q]=Un[D]=Un["[object Map]"]=Un[K]=Un[V]=Un[Y]=Un["[object Set]"]=Un[Z]=Un["[object WeakMap]"]=false;var $n={};$n[z]=$n[B]=$n[G]=$n[M]=$n[P]=$n[J]=$n[X]=$n[H]=$n[Q]=$n[nn]=$n[K]=$n[V]=$n[Y]=$n[Z]=$n[tn]=$n[rn]=$n[en]=$n[un]=true,$n[q]=$n[D]=$n["[object Map]"]=$n["[object Set]"]=$n["[object WeakMap]"]=false;var Fn={leading:false,maxWait:0,trailing:false},Nn={"\xc0":"A","\xc1":"A","\xc2":"A","\xc3":"A","\xc4":"A","\xc5":"A",
"\xe0":"a","\xe1":"a","\xe2":"a","\xe3":"a","\xe4":"a","\xe5":"a","\xc7":"C","\xe7":"c","\xd0":"D","\xf0":"d","\xc8":"E","\xc9":"E","\xca":"E","\xcb":"E","\xe8":"e","\xe9":"e","\xea":"e","\xeb":"e","\xcc":"I","\xcd":"I","\xce":"I","\xcf":"I","\xec":"i","\xed":"i","\xee":"i","\xef":"i","\xd1":"N","\xf1":"n","\xd2":"O","\xd3":"O","\xd4":"O","\xd5":"O","\xd6":"O","\xd8":"O","\xf2":"o","\xf3":"o","\xf4":"o","\xf5":"o","\xf6":"o","\xf8":"o","\xd9":"U","\xda":"U","\xdb":"U","\xdc":"U","\xf9":"u","\xfa":"u",
"\xfb":"u","\xfc":"u","\xdd":"Y","\xfd":"y","\xff":"y","\xc6":"Ae","\xe6":"ae","\xde":"Th","\xfe":"th","\xdf":"ss"},Ln={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#96;"},zn={"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&#39;":"'","&#96;":"`"},Bn={"function":true,object:true},Mn={"\\":"\\","'":"'","\n":"n","\r":"r","\u2028":"u2028","\u2029":"u2029"},Pn=Bn[typeof exports]&&exports&&!exports.nodeType&&exports,qn=Bn[typeof module]&&module&&!module.nodeType&&module,Dn=Bn[typeof self]&&self&&self.Object&&self,Kn=Bn[typeof window]&&window&&window.Object&&window,Vn=qn&&qn.exports===Pn&&Pn,Yn=Pn&&qn&&typeof global=="object"&&global&&global.Object&&global||Kn!==(this&&this.window)&&Kn||Dn||this,Zn=d();
typeof define=="function"&&typeof define.amd=="object"&&define.amd?(Yn._=Zn, define('lodash',[],function(){return Zn})):Pn&&qn?Vn?(qn.exports=Zn)._=Zn:Pn._=Zn:Yn._=Zn}).call(this);
define('nd.config.core',["lodash"], function(_) {

    "user strict";

    // ReSharper disable InconsistentNaming
    var _configData = null,
        _version = 0;

    function defaultConfigData() {
        return {
            config: {}
        }
    }

    function configData(data) {
        if (!arguments.length)
            return _configData;
        _configData = data;
        if (data && !_configData.config)
            _configData.config = {};
        return ++_version;
    }

    function getConfig() {
        return _configData ? _configData.config : {};
    }

    function getItem(path, defVal) {
        var paths = path.split('.'),
            config = getConfig();
        for (var i = 0; i < paths.length; ++i) {
            var name = paths[i];
            if (config && name in config)
                config = config[name];
            else return arguments.length == 1 ? null : defVal;
        }
        return config;
    }

    function extend(myconfig) {
        if (!_configData)
            _configData = defaultConfigData();
        for (var entry in myconfig) {
            var item = _configData.config[entry];
            if (!item) {
                _configData.config[entry] = myconfig[entry];
                continue;
            }
            _.extend(item, myconfig[entry]);
        }
        ++_version;
    }

    function version() {
        return _version;
    }

    return {
        get: getItem,
        extend: extend,
        configData: configData,
        version: version
    };

});


/**
 * Error object to send inside message.
 * Custom implementation is only needed for cloning objects to send them in message.
*/
function MessageError(message) {
	this.message = message;
}


var DEBUG = true,
	__debugInfo = {
		load: {},
		requests: {}
	},
	DEFAULT_REQUIRE_PATH = "require.js",
	STATUS = {
		READY: "__ready__",
		ERROR: "__error__",
		SUCCESS: "__success__",
		PROGRESS: "__progress__"
	},
	COMMAND = {
		LOAD_MODULE: "loadModule",
		EXEC_METHOD: "execMethod",
		RESET_ND_CONFIG: "resetNdConfig"
	},
	_worker = self;

function _sendGeneralError(originalMsgData, err) {
	_worker.postMessage({
		context: originalMsgData.context,
		status: STATUS.ERROR,
		command: originalMsgData.command,
		error: err
	});
}


function _moduleResolveErrorCallback(originalMsgData, err) {
	// todo: implement gracefull degradation, eg. try resolving module several times .
	var errorMessage = "Module loading failed: " + (err && err.message);
	_worker.postMessage({
		context: originalMsgData && originalMsgData.context,
		command: originalMsgData.command,
		status: STATUS.ERROR,
		error: new MessageError(errorMessage)
	});
	//debugger;
}

// todo: manage loading by sending messages from callee
if (typeof require === "undefined") {
	importScripts(DEFAULT_REQUIRE_PATH);
}

// todo: invest smth to incapsulate commands

function loadModuleCommand(msgData) {

	// todo: allow to take an array with module names;

	if (DEBUG) __debugInfo.load[msgData.moduleName] = { start: new Date() };

	if (typeof msgData.data.moduleName !== "string") {
		throw new MessageError("Command execution error: moduleName is required for " + COMMAND.LOAD_MODULE + " command.");
	}
	try {
		require([msgData.data.moduleName],
			function(module) {

				if (DEBUG) __debugInfo.load[msgData.moduleName].end = new Date();

				var message = {
					context: msgData.context,
					command: COMMAND.LOAD_MODULE,
					status: STATUS.READY
					//result: msgData.data.moduleName
				};

				if (DEBUG) message.__debugInfo = __debugInfo.load[msgData.moduleName];

				_worker.postMessage(message);
			},
			_moduleResolveErrorCallback.bind(_worker, msgData));
	} catch(e) {
		throw new MessageError("Command execution error: unhandled exception while executing" + COMMAND.LOAD_MODULE + " command.");
	}
}

function execMethodCommand(msgData) {
	//if (!msgData.context.requestId) throw new MessageError("Message format error: context.requestId is required.");
	var context = msgData.context || {};

	if (DEBUG) __debugInfo.requests[context.requestId] = { methodName: msgData.methodName, handleStart: new Date() };

	if (typeof msgData.data.moduleName !== "string") {
		throw new MessageError("Command execution error: moduleName is required for " + COMMAND.LOAD_MODULE + " command.");
	}
	if (typeof msgData.data.methodName !== "string") {
		throw new MessageError("Command execution error: methodName is required for " + COMMAND.LOAD_MODULE + " command.");
	}

	require([msgData.data.moduleName],
		function(module) {
			var messageToSend = { context: msgData.context, command: COMMAND.EXEC_METHOD };
			try {
				var method = module[msgData.data.methodName];
				if (typeof method === "function") {

					if (DEBUG) __debugInfo.requests[context.requestId].start = new Date();

					// todo: treat all execution results as promises. Subscribe on all events (done, fail and progress) with calback that sends an appropriate message.
					var result = method.apply(undefined, msgData.data.params);

					if (DEBUG) __debugInfo.requests[context.requestId].end = new Date();

					// todo: if result is undefined still pass property 'result' in the message
					messageToSend.result = result;
					messageToSend.status = STATUS.SUCCESS;

				} else {
					messageToSend.status = STATUS.ERROR;
					messageToSend.error = new MessageError("Module " + msgData.data.moduleName + " does not have a method " + msgData.data.methodName + ".");
				}
			} catch(e) {

				if (DEBUG) __debugInfo.requests[context.requestId].end = new Date();

				messageToSend.status = STATUS.ERROR;
				messageToSend.error = new MessageError("Unhandled exception in module" + msgData.data.moduleName + " while executing method " + msgData.data.methodName + ": " + e);
			} finally {
				if (DEBUG) (__debugInfo.requests[context.requestId].handleEnd = new Date(), messageToSend.__debugInfo = __debugInfo.requests[context.requestId]);
			}
			self.postMessage(messageToSend);
		},
		_moduleResolveErrorCallback.bind(_worker, msgData)); 
};

function resetNdConfig(msgData) {
    require(["nd.config.core"], function(ndConfigCore) {
        ndConfigCore.configData(msgData.data);
    });
}

var commands = {};
commands[COMMAND.LOAD_MODULE] = loadModuleCommand;
commands[COMMAND.EXEC_METHOD] = execMethodCommand;
commands[COMMAND.RESET_ND_CONFIG] = resetNdConfig;

self.addEventListener("message", function (msg) {
	var commandName = msg.data.command;
	if (typeof commandName !== "string") {
		_sendGeneralError(msg.data, new MessageError("Message format error: command is required."));
		return;
	}
	var command = commands[commandName];
	if (typeof command !== "function") {
		_sendGeneralError(msg.data, new MessageError("Message format error: " + commandName + " is not a command."));
		return;
	}
	try {
		command.apply(self, [msg.data]);
	} catch(e) {
		_sendGeneralError(msg.data, e);
	} 
});
define("nd.core.worker.init", function(){});

define('nd.viewer.textview.articlelayout.builder',["lodash"], function (_) {

	// TODO: can't be used since it's probably going to work in a worker. Alternatives?
	//window.pdmodules.push("nd.viewer.textview.articlelayout.builder");

	function LayoutQuality(mark, isValid) {
		this.mark = mark;
		this.valid = isValid;
	}

	var a = {
		addBlockInstance: function (instance) {
			if (this.colspan < instance.colspan()) {
				if (!this.allowExpand) {
					return [];

				} else {
					this.addColumns(instance.colspan() - this.colspan);
				}
			}
			for (var i = 0; i < instance.compositionRules.length; i++) {
				var rule = instance.compositionRules[i];

			}
		}
	};

	/**
		@constructor
		@param {function} LayoutCTOR Layout constructor
		@param {function} criterionFunc criterion function to measure layout quality
		@param {sufficientFunc} sufficientFunc function to determine, if an array passed as a parameter has enough good layouts. Used as a criteria of further tree-search necessity.
		@param {pickFunc} pickFunc function to pick the best layout
	*/
	function LayoutBuilder(LayoutCTOR, evaluationFunc, sufficientFunc, pickFunc, metaInfo, instanceMap) {
		if (typeof LayoutCTOR === "function") {
			this.LayoutCTOR = LayoutCTOR;
		}
		if (typeof evaluationFunc === "function") {
			this.evaluate = evaluationFunc;
		}
		if (typeof sufficientFunc === "function") {
			this.sufficient = sufficientFunc;
		}
		if (typeof pickFunc === "function") {
			this.pick = pickFunc;
		}

		this._metaInfo = metaInfo || [];
		this._instanceMap = instanceMap || [];

		/*debug*/ this.__debug && (this.__debugLayoutBuffer = [], this.__debugCompleteLayoutBuffer = [], this.__debugTime = { start: null, end: null, elapsed: 0 });
	}

	_.extend(LayoutBuilder.prototype, {
		__debug: true,
		__debugInternalOnly: false, // benchmark only internal methods, exclude layout's local methods
		__debugStart: function () {
			this.__debugTime.start = new Date();
		},
		__debugEnd: function () {
			this.__debugTime.end = new Date();
			this.__debugTime.elapsed += this.__debugTime.end - this.__debugTime.start;
		},
		debug: function (value) {
			if (arguments.length == 0) {
				return this.__debug;
			}
			this.__debug = !!value;
			return this;	// chaining
		},
		LayoutCTOR: function () { // Layout constructor mock
			return {
				addBlockInstance: function () {
				}
			};
		},
		getMetaByProperty: function (propName, value) {
			for (var i = 0; i < this._metaInfo.length; i++) {
				if (this._metaInfo[i][propName] === value) {
					return this._metaInfo[i];
				}
			}
			return null;
		},
		getMeta: function (type) {
			return this.getMetaByProperty("type", type);
		},
		getMetaRoot: function () {
			return this.getMetaByProperty("root", true);
		},
		evaluate: function (layout) { // very simple criterion function
			return new LayoutQuality((layout.blockInstances() || []).length, true);
		},
		sufficient: function (layouts) {
			return layouts && layouts.length > 0;
		},
		pick: function (layout1, layout2) {
			return layout1 ? layout1 : layout2;
		},
		_goDeep: function (layout, meta, builtBuffer) {
			if (meta.children === undefined) {
				/* It is a tree leaf, apply a evaluation function chosen to estimate layout quality */
				layout.quality = this.evaluate(layout);
				if (layout.quality.valid === true) {
					// todo: check if there is another way of determining whether or not the layout should be included into result array
					builtBuffer.push(layout);
				}
			} else {
				for (var i = 0; i < meta.children.length; i++) {
					var childMeta = this.getMeta(meta.children[i].type);

					// todo: prevent from adding already existed in the result layouts
					this._goWide(layout, childMeta, builtBuffer);

					if (this.sufficient(builtBuffer)) break;
				}
			}
		},
		_goWide: function (layout, meta, builtBuffer) {
			if (meta === null || meta === undefined) {
				throw { message: "Block's meta was not found" };
			}
			var instances = this._instanceMap[meta.type];

			var stopSearch = false;
			for (var i = 0; i < instances.length; i++) {

				/*debug*/ (this.__debug && this.__debugInternalOnly) && (this.__debugEnd());

				var modyfiedLayouts = layout.addBlockInstance(instances[i]);

				/*debug*/ (this.__debug && this.__debugInternalOnly) && (this.__debugStart());
				/*debug*/ this.__debug && this.__debugLayoutBuffer.push.apply(this.__debugLayoutBuffer, modyfiedLayouts);

				for (var k = 0; k < modyfiedLayouts.length; k++) {

					// todo: prevent from adding already existed in the result layouts
					this._goDeep(modyfiedLayouts[k], meta, builtBuffer);

					stopSearch = this.sufficient(builtBuffer);
					if (stopSearch) break;

				}
				if (stopSearch) break;

			}

			if (!stopSearch && !meta.imperative) {
				// todo: prevent from adding already existed in the result layouts
				this._goDeep(layout, meta, builtBuffer);
			}
		},

		buildLayout: function (metaInfo, instanceMap, sourceLayout) {

			/*debug*/ this.__debug && this.__debugStart();

			this._metaInfo = metaInfo;
			this._instanceMap = instanceMap;

			var metaRoot = this.getMetaRoot();
			if (!sourceLayout)
				sourceLayout = new this.LayoutCTOR();

			/*debug*/ this.__debug && this.__debugLayoutBuffer.push(sourceLayout);
			var builtLayouts = [];
			try {
				this._goWide(sourceLayout, metaRoot, builtLayouts);
			} catch (e) {
				return null;
			} finally {
				/*debug*/ this.__debug && this.__debugEnd();
				/*debug*/ this.__debug && this.__debugCompleteLayoutBuffer.push.apply(this.__debugCompleteLayoutBuffer, builtLayouts);
			}

			if (builtLayouts.length) {
				var result = builtLayouts[0];
				for (var i = 1; i < builtLayouts.length; ++i)
					result = this.pick(result, builtLayouts[i]);
				return result;
			}
			return null;
		},
	});
	return LayoutBuilder;
});

define('nd.data.list',["lodash"], function(_) {

    function Item() {}

    Item.fromJSON = function(json) {
        return new Item();
    }

    _.extend(Item.prototype, {
        _next: undefined, // if null - EOF
        _prev: undefined, // if null - EOF
        next: function() {
            ///	<summary>
            ///		1. Get the next or one of the following elements in the list
            ///		&#10;	1.1 - next()
            ///		&#10;	1.2 - next(n) - Get n-th element starting from this
            ///		2. Append item(s) immediatly after this
            ///		&#10;	2.1 - next(item)
            ///		&#10;	2.2 - next(item, n) - append n items starting with item
            ///	</summary>
            ///	<returns type="$.nd.data.list.item" />
            if (!arguments.length) {
                if (this._next === undefined) // give a chance to load more items
                    this.onREOF();
                return this._next;
            }
            if (arguments.length == 1 && typeof arguments[0] == "number") {
                /// .next(0) === this
                /// .next(3) === the 3-d item from here
                var result = this,
                    count = arguments[0];
                if (isNaN(count))
                    count = 1;
                for (var i = 0; i < count; ++i) {
                    result = result._next;
                    if (!result)
                        break;
                }
                return result;
            } else if (arguments.length == 2 && typeof arguments[1] == "number")
                return this.append(new Items(arguments[0], undefined, arguments[1]));
            else {
                var item = arguments[0];
                if (item !== this) {
                    if (item) {
                        item.detach();
                        if (this._next)
                            this._next._prev = item;
                        item._next = this._next;
                        item._prev = this;
                    }
                    this._next = item;
                }
                return item;
            }
        },
        prev: function() {
            ///	<summary>
            ///		1. Get the previous or one of the leading elements in the list
            ///		&#10;	1.1 - prev()
            ///		&#10;	1.2 - prev(n) - Get n-th element starting from this
            ///		2. Prepend item(s) immediatly after this
            ///		&#10;	2.1 - next(item)
            ///		&#10;	2.2 - next(item, n) - prepend n items starting with item
            ///	</summary>
            ///	<returns type="$.nd.data.list.item" />
            if (!arguments.length) {
                if (this._prev === undefined) // give a chance to load more items
                    this.onLEOF();
                return this._prev;
            }
            if (arguments.length == 1 && typeof arguments[0] == "number") {
                /// .prev(0) === this
                /// .prev(3) === the 3-d item from here
                var result = this,
                    count = arguments[0];
                if (isNaN(count))
                    count = 1;
                for (var i = 0; i < count; ++i) {
                    result = result._prev;
                    if (!result)
                        break;
                }
                return result;
            } else if (arguments.length == 2 && typeof arguments[1] == "number")
                return this.prepend(new Items(undefined, arguments[0], arguments[1]));
            else {
                var item = arguments[0];
                if (item !== this) {
                    if (item) {
                        item.detach();
                        if (this._prev)
                            this._prev._next = item;
                        item._prev = this._prev;
                        item._next = this;
                    }
                    this._prev = item;
                }
                return item;
            }
        },
        detach: function(type) {
            ///	<param name="type" type="Nummber">
            ///		Depending on type value the result will be:
            ///		&#10;	type == 0	- detached element
            ///		&#10;	type > 0	- the next element in the list
            ///		&#10;	type < 0	- the previous element in the list
            /// </param>
            /// <returns type="$.nd.data.list.item" />
            if (this._next)
                this._next._prev = this._prev;
            if (this._prev)
                this._prev._next = this._next;
            var result;
            if (!type)
                result = this;
            else if (type > 0)
                result = this._next;
            else if (type < 0)
                result = this._prev;
            delete this._next;
            delete this._prev;
            return result;
        },
        append: function(items) {
            /// <param name="items" type="$.nd.data.list.items" />
            /// <returns type="$.nd.data.list.item" />
            items.detach();
            if (this._next)
                this._next._prev = items._tail;
            items._tail._next = this._next;
            items._head._prev = this;
            this._next = items._head;
            return this;
        },
        prepend: function(items) {
            /// <param name="items" type="$.nd.data.list.items" />
            /// <returns type="$.nd.data.list.item" />
            items.detach();
            if (this._prev)
                this._prev._next = items._head;
            items._head._prev = this._prev;
            items._tail._next = this;
            this._prev = items._tail;
            return this;
        },
        onREOF: function() {}, // there are no more items to the left
        onLEOF: function() {}, // there are no more items to the right
        toJSON: function() {
            return {};
        }
    });

    function Items(head, tail, count) {
        if (head && tail) {
            this._head = head;
            this._tail = tail;
        } else if (head && count !== undefined) {
            this._head = head;
            this._tail = head;
            if (!count)
                count = Number.MAX_VALUE;
            while (--count > 0) {
                if (!this._tail._next)
                    break;
                this._tail = this._tail._next;
            }
        } else if (tail && count !== undefined) {
            this._tail = tail;
            this._head = tail;
            if (!count)
                count = Number.MAX_VALUE;
            while (--count > 0) {
                if (!this._head._prev)
                    break;
                this._head = this._head._prev;
            }
        }
    }

    Items.fromJSON = function (json, formatter) {
        if (!formatter) formatter = Item;
        var result = new Items(),
            args = Array.prototype.slice.call(arguments, 1); // starting with 1 because it will be replaced by json
        for (var i = 0; i < json.length; ++i) {
            args[0] = json[i];
            var item = formatter.fromJSON.apply(this, args);
            if (!i) result._head = result._tail = item;
            else {
                result._tail._next = item;
                item._prev = result._tail;
                result._tail = item;
            }
        }
        result._count = json.length;
        return result;
    }

    _.extend(Items.prototype, {
        _head: null,
        _tail: null,
        _count: 0,
        _finished: false,
        finished: function(finished) {
            if (!arguments.length)
                return this._finished;
            this._finished = finished;
            return this;
        },
        head: function(head) {
            if (!arguments.length)
                return this._head;
            this._count = 0;
            this._head = head;
            if (!this._tail)
                this._tail = head;
            return this;
        },
        tail: function(tail) {
            if (!arguments.length)
                return this._tail;
            this._count = 0;
            this._tail = tail;
            if (!this._head)
                this._head = tail;
            return this;
        },
        count: function() {
            /// <returns type="Number" />
            if (this.isEmpty())
                return 0;
            if (!this._count) {
                for (var item = this._head; item; item = item._next) {
                    ++this._count;
                    if (item === this._tail)
                        break;
                }
            }
            return this._count;
        },
        copy: function(items) {
            /// <returns type="$.nd.data.list.items" />
            if (!arguments.length)
                return new Items(this._head, this._tail);
            this._count = items._count;
            this._head = items._head;
            this._tail = items._tail;
            return this;
        },
        detach: function() {
            if (!arguments.length) {
                if (this.isEmpty())
                    return this;
                if (this._head._prev)
                    this._head._prev._next = this._tail._next;
                if (this._tail._next)
                    this._tail._next._prev = this._head._prev;

                delete this._head._prev;
                delete this._tail._next;
                return this;
            } else if (typeof arguments[0] == "number") {
                var count = arguments[0];
                this._count = 0;
                if (count > 0) {
                    var head = this._head,
                        tail = this._head;
                    for (var i = 1; i < count; ++i) {
                        if (!tail._next)
                            break;
                        tail = tail._next;
                    }
                    this._head = tail._next;
                    if (!this._head)
                        this._tail = null;
                    return new Items(head, tail).detach();
                } else if (count < 0) {
                    var head = this._tail,
                        tail = this._tail;
                    for (var i = 1; i < -count; ++i) {
                        if (!head._prev)
                            break;
                        head = head._prev;
                    }
                    this._tail = head._prev;
                    if (!this._tail)
                        this._head = null;
                    return new Items(head, tail).detach();
                }
            } else {
                var value = arguments[0];
                if (value.head && value.tail) {
                    if (value !== this) {
                        if (this._head === value._head && this._tail === value._tail)
                            this.empty();
                        else if (this._head === value._head)
                            this._head = value._tail._next;
                        else if (this._tail === value._tail)
                            this._tail = value._head._prev;
                        this._count = 0;
                        value.detach();
                    }
                } else if (value.next && value.prev) {
                    this.update4detach(value);
                    this._count = 0;
                    value.detach();
                }
                return this;
            }
        },
        update4detach: function(item) {
            if (this._head === item && this._tail === item)
                this.empty();
            else if (this._head === item)
                this._head = this._head._next;
            else if (this._tail === item)
                this._tail = this._tail._prev;
            return this;
        },
        append: function() {
            /// <summary>
            ///		&#10;1 - append($.nd.data.list.item value)
            ///		&#10;2 - append($.nd.data.list.items value)
            /// </summary>
            ///	<returns type="_Items" />
            var value;
            switch (arguments.length) {
            case 1:
                value = arguments[0];
                break;
            case 2:
                value = arguments[1];
                break;
            }
            if (!value)
                return this;
            if (value.head && value.tail)
                return this._appendItems.apply(this, arguments);
            else if (value.prev && value.next)
                return this._appendItem.apply(this, arguments);
            return this;
        },
        _appendItem: function() {
            var item, prev;
            switch (arguments.length) {
            case 1:
                item = arguments[0].detach();
                prev = this._tail;
                break;
            case 2:
                item = arguments[1].detach();
                prev = arguments[0];
                break;
            }
            if (this.isEmpty() && !prev) {
                this._count = 1;
                this._head = this._tail = item;
            } else if (!this.isEmpty() && prev) {
                prev.next(item);
                if (this._tail == prev)
                    this._tail = item;
                if (this._count)
                    ++this._count;
            }
            return this;
        },
        _appendItems: function() {
            var items, prev;
            switch (arguments.length) {
            case 1:
                items = arguments[0].detach();
                prev = this._tail;
                break;
            case 2:
                items = arguments[1].detach();
                prev = arguments[2];
                break;
            }
            if (this.isEmpty() && !prev) {
                this._head = items._head;
                this._tail = items._tail;
                this._count = items._count;
            } else if (!items.isEmpty() && prev) {
                items._tail._next = prev._next;
                prev._next = items._head;
                items._head._prev = prev;
                if (this._tail == prev)
                    this._tail = items._tail;
                if (this._count && items._count)
                    this._count += items._count;
                else this._count = 0;
            }
            return this;
        },
        prepend: function(value, item) {
            /// <summary>
            ///		&#10;1 - prepend($.nd.data.list.item value)
            ///		&#10;2 - prepend($.nd.data.list.items value)
            ///		&#10;3 - prepend($.nd.data.list.item value, $.nd.data.list.item existing_item)
            /// </summary>
            ///	<returns type="$.nd.data.list.items" />
            if (value.head && value.tail) // the object type is _Items
                return this._prependItems(value);
            else if (value.prev && value.next) // the object type is _Item
                return this._prependItem(value, item);
            return this;
        },
        _prependItem: function(item, before) {
            item.detach();
            if (this.isEmpty()) {
                this._count = 1;
                this._head = this._tail = item;
            } else {
                if (before) {
                    before.prev(item);
                    if (before === this._head)
                        this._head = item;
                } else {
                    this._head.prev(item);
                    this._head = item;
                }
                if (this._count)
                    ++this._count;
            }
            return this;
        },
        _prependItems: function(items) {
            items.detach();
            if (this.isEmpty()) {
                this._head = items._head;
                this._tail = items._tail;
                this._count = items._count;
            } else if (!items.isEmpty()) {
                items._head._prev = this._head._prev;
                this._head._prev = items._tail;
                items._tail._next = this._head;
                this._head = items._head;
                if (this._count && items._count)
                    this._count += items._count;
                else this._count = 0;
            }
            return this;
        },
        isEmpty: function() {
            /// <return type="Boolean" />
            return !this._head;
        },
        each: function() {
            /// <param name="f" type="Function" />
            if (!this.isEmpty()) {
                var f, dir;
                if (arguments.length == 1) {
                    dir = 1;
                    f = arguments[0];
                } else {
                    dir = arguments[0];
                    f = arguments[1];
                }
                var head = this._head, // use copies in case the collection is modified in the process
                    tail = this._tail;
                if (dir > 0) {
                    var item = head,
                        idx = 0;
                    while (item) {
                        var next = item._next;
                        if (f.call(item, idx) === false || item === tail)
                            break;
                        item = next;
                        ++idx;
                    }
                } else {
                    var item = tail,
                        idx = this.count() - 1;
                    while (item) {
                        var prev = item._prev;
                        if (f.call(item, idx) === false || item === head)
                            break;
                        item = prev;
                        --idx;
                    }
                }
            }
            return this;
        },
        empty: function() {
            delete this._head;
            delete this._tail;
            delete this._count;
            return this;
        },
        replace: function(oldItems, newItems) {
            /// <param name="oldItems" type="$.nd.data.list.items" />
            /// <param name="newItems" type="$.nd.data.list.items" />
            var prev = oldItems._head._prev,
                next = oldItems._tail._next;
            oldItems.detach();
            if (prev) {
                prev.append(newItems);
                if (!next)
                    this._tail = newItems._tail;
            } else if (next) {
                next.prepend(newItems);
                this._head = newItems._head;
            } else return this.copy(newItems);
            if (this._count && oldItems._count && newItems._count)
                this._count += newItems._count - oldItems._count;
            else this._count = 0;
            return this;
        },
        toArray: function() {
            /// <returns type="Array" />
            var result = [];
            for (var item = this._head; item; item = item._next) {
                result.push(item);
                if (item === this._tail)
                    break;
            }
            return result;
        },
        toJSON: function() {
            var result = [];
            for (var item = this._head; item; item = item._next) {
                result.push(item.toJSON());
                if (item === this._tail)
                    break;
            }
            return result;
        },
        swap: function(item1, item2) {
            /// <param name="item1" type="$.nd.data.list.item" />
            /// <param name="item2" type="$.nd.data.list.item" />
            ///	<returns type="$.nd.data.list.items" />
            var temp = item1._next;
            item1._next = item2._next == item1 ? item2 : item2._next;
            item2._next = temp == item2 ? item1 : temp;

            temp = item1._prev;
            item1._prev = item2._prev == item1 ? item2 : item2._prev;
            item2._prev = temp == item2 ? item1 : temp;

            if (item1._next)
                item1._next._prev = item1;
            if (item1._prev)
                item1._prev._next = item1;
            if (item2._next)
                item2._next._prev = item2;
            if (item2._prev)
                item2._prev._next = item2;

            if (item1 == this._head)
                this._head = item2;
            else if (item2 == this._head)
                this._head = item1;

            if (item1 == this._tail)
                this._tail = item2;
            else if (item2 == this._tail)
                this._tail = item1;

            return this;
        },
        item: function(index) {
            for (var item = this._head, idx = 0; item; item = item._next, ++idx) {
                if (idx == index)
                    return item;
                if (item === this._tail)
                    break;
            }
            return null;
        }
    });

    return {
        Item: Item,
        Items: Items
    }

});
define('nd.viewer.context',[],function () {

	function Context() { }
	Context.current = null;
	Context.prototype = {
		textViewScroller: null
	}

	return Context;

});
define('nd.viewer.textview.articlelayout.layout',[
    "lodash",
    "nd.data.list",
    "nd.viewer.context"
], function (_, ndDataList, ndViewerContext) {

    var _restrictions = {
            title: function (column, position, colspan, height, align) {
                return height <= ndViewerContext.current.textViewMetrics.columnsHeight / 2 ? position : null;
            },
            annotation: function (column, position, colspan, height, align) {
                if (!position)
                    return null;
                var text_height = ndViewerContext.current.textViewMetrics.columnsHeight - alignTop(position.top + height),
                    lineHeight = ndViewerContext.current.textViewMetrics.lineHeight; // $.nd.viewer.textView.scalesManager.lineHeight();
                return text_height >= lineHeight * 3 ? position : null;
            },
            image: function (column, position, colspan, height, align) {
                if (!position)
                    return position;
                var lineHeight = ndViewerContext.current.textViewMetrics.lineHeight, // $.nd.viewer.textView.scalesManager.lineHeight(),
                    bottom = position.top + position.height,
                    alignedTop = !position.top,
                    alignedBottom = ndViewerContext.current.textViewMetrics.columnsHeight - bottom < lineHeight;
                if (alignedTop && alignedBottom) {
                    var text_top = alignTop(height);
                    if (ndViewerContext.current.textViewMetrics.columnsHeight - text_top < lineHeight * 3)
                        return null; // not enough space for 3 lines of text
                    position.height = height;
                    return position;
                } else if (!alignedTop && !alignedBottom) { // in between other blocks
                    if (position.height < height * 2)
                        return null;
                    var delta = Math.round((position.height - height) / 2);
                    position.top += delta;
                    position.height = height;
                    return position;
                }
                var above = null,
                    below = null;
                column.positions().each(function () {
                    if (this.top < position.top)
                        above = this;
                    else {
                        below = this;
                        return false;
                    }
                });
                if (!above && !below) { // !alignedTop && !alignedBottom case is already processed
                    if (alignedTop) {
                        var text_top = alignTop(position.top + height);
                        if (bottom - text_top < lineHeight * 3)
                            return null;
                        position.height = height;
                        return position;
                    } else if (alignedBottom) {
                        var text_top = alignTop(position.top),
                            top = bottom - height;
                        if (top - text_top < lineHeight * 3)
                            return null;
                        position.top = top;
                        position.height = height;
                        return position;
                    }
                } else if (above && !below) { // !alignedTop && !alignedBottom case is already processed, so at this point alignedBottom == true.
                    if (position.top - above.top - above.height < lineHeight && above.current_colspan >= colspan) {
                        var text_top = alignTop(position.top + height);
                        if (ndViewerContext.current.textViewMetrics.columnsHeight - text_top < lineHeight * 3)
                            return null; // not enough space for 3 lines of text...
                        position.height = height;
                        return position;
                    } else { // align to the bottom
                        var text_top = alignTop(position.top),
                            top = bottom - height;
                        if (top - text_top < lineHeight * 3)
                            return null;
                        position.top = top;
                        position.height = height;
                        return position;
                    }
                } else if (below && !above) { // !alignedTop && !alignedBottom case is already processed, so at this point alignedTop == true.
                    if (below.top - position.top - position.height < lineHeight && below.current_colspan >= colspan) {
                        var top = position.height - height;
                        if (top < lineHeight * 3) // not enough space for 3 lines of text...
                            return null;
                        position.top = top;
                        position.height = height;
                        return position;
                    } else { // align to the top
                        var text_top = alignTop(height);
                        if (position.height - text_top < lineHeight * 3)
                            return null;
                        position.height = height;
                        return position;
                    }
                }
            },
            preserveOrder: function (column, position, colspan, height, align) {
                if (!this.idx) // the first block can be positioned anywhere
                    return position;
                var that = this,
                    passed = undefined;
                for (var col = column; col && passed === undefined; col = col.prev()) {
                    col.positions().each(-1, function () {
                        if (col === column && this.top > position.top) // ignore current column's blocks positioned lower than proposed position
                            return;
                        if (this.instance.type !== that.type)
                            return;
                        passed = this.instance.idx < that.idx;
                        return false;
                    });
                    if (passed) return position;
                }
                return null;
            }
        };

    function copy(item) {
        if (!item) return null;
        if (typeof item.copy === "function")
            return item.copy();
        return _.extend({}, item); // in fact creates a JSON copy, the type of the result will be not the same as the original
    }

    function alignTop(top) {
        var lineHeight = ndViewerContext.current.textViewMetrics.lineHeight,
            delta = top % lineHeight;
        if (delta)
            return top + lineHeight - delta;
        return top;
    }

    function linesCount(top, height, colspan) {
        return colspan * Math.ceil((top + height - alignTop(top)) / ndViewerContext.current.textViewMetrics.lineHeight);
    }

    function _Cell(column, instance, top) {
        this.column = column;
        this.instance = instance;
        this.top = top;
    }

    _Cell.fromJSON = function (json, column) {
        return new _Cell(column, json.instance, json.top);
    }

    _.extend(_Cell.prototype, ndDataList.Item.prototype, {
        column: null,
        instance: null,
        top: 0,
        toJSON: function () {
            return {
                top: this.top,
                instance: this.instance
            }
        },
        copy: function (column) {
            return new _Cell(column || this.column, copy(this.instance), this.top);
        },
        lines: function () {
            if (this.instance.isJSON)
                return linesCount(this.top, this.instance.height, this.instance.colspan);
            else return linesCount(this.top, this.instance.height(), this.instance.colspan());
        }
    });

    function _Position(top, current_colspan, instance) {
        this.top = top;
        this.height = instance.height;
        this.current_colspan = current_colspan;
        this.instance = instance;
    }

    _Position.fromJSON = function (json) {
        return new _Position(json.top, json.current_colspan, json.instance);
    }

    _.extend(_Position.prototype, ndDataList.Item.prototype, {
        top: -1, // == cell.top
        height: 0,
        current_colspan: -1, // colspan from current column. It's always <= cell.colspan
        instance: null,
        toJSON: function () {
            return {
                top: this.top,
                current_colspan: this.current_colspan,
                instance: this.instance
            }
        },
        copy: function () {
            return new _Position(this.top, this.current_colspan, copy(this.instance));
        }
    });

    function _Column(layout) {
        if (arguments.length) {
            this._layout = layout;
            this._cells = new ndDataList.Items();
            this._map = {};
            this._positions = new ndDataList.Items();
        }
    };

    _Column.fromJSON = function (json, layout) {
        var result = new _Column();
        result._layout = layout;
        result._map = {};
        result._cells = ndDataList.Items.fromJSON(json._cells, _Cell, result);
        result._positions = ndDataList.Items.fromJSON(json._positions, _Position);
        return result;
    };
    _.extend(_Column.prototype, ndDataList.Item.prototype, {
        _idx: -1,
        _cells: null, // list of cells sorted by "top"
        _map: null,
        _positions: null,
        _layout: null,
        toJSON: function () {
            return {
                _cells: this._cells.toJSON(),
                _positions: this._positions.toJSON()
            };
        },
        copy: function (layout) {
            var result = new _Column(layout);
            this._cells.each(function () {
                result._cells.append(this.copy(result));
            });
            this._positions.each(function () {
                result._positions.append(this.copy());
            });
            return result;
        },
        index: function (value) {
            if (!arguments.length)
                return this._idx;
            this._idx = value;
            return this;
        },
        findPosition: function (instance, maxHeight) {
            /// returns object { top: ..., height: ...} or array of objects
            // TODO: add positions range? Not sure how to process it later... so should probably avoid it...
            maxHeight = maxHeight || ndViewerContext.current.textViewMetrics.columnsHeight;
            var config = instance.config,
                colspan = instance.colspan,
                height = instance.height,
                align = instance.align;
            if (config.alignTop)
                return this._checkPosition(0, colspan, height, maxHeight) ? {top: 0, height: undefined} : null;
            else if (config.alignBottom) {
                var top = ndViewerContext.current.textViewMetrics.columnsHeight - height;
                if (config.align) {
                    var delta = ndViewerContext.current.textViewMetrics.columnsHeight % ndViewerContext.current.textViewMetrics.lineHeight; // $.nd.viewer.textView.scalesManager.lineHeight();
                    if (delta)
                        top -= delta;
                }
                return this._checkPosition(top, colspan, height, maxHeight) ? {top: top, height: height} : null;
            } else {
                var positions = this.findAllPositions(0, colspan, height, align, maxHeight);
                if (positions) {
                    var result = [];
                    for (var i = 0; i < positions.length; ++i) {
                        var position = this._applyRestrictions(instance, positions[i]);
                        if (position) {
                            if (config.arbitrary)
                                result.push(position);
                            else return position;
                        }
                    }
                    return result.length ? result : null;
                }
            }
            // TODO: check the block.config() to find the position described there including restrictions
            return this._applyRestrictions(instance, this.findFirstPosition(0, colspan, height, align, maxHeight));
        },
        _applyRestrictions: function (instance, position) {
            if (instance.config.restrictions) {
                for (var id in instance.config.restrictions) {
                    if (instance.config.restrictions[id] in _restrictions) {
                        position = _restrictions[instance.config.restrictions[id]].call(instance, this, position, instance.colspan, instance.height, instance.align);
                        if (!position)
                            break;
                    }
                }
            }
            return position;
        },
        findFirstPosition: function (top, colspan, height, align, maxHeight) { // find first available position going from top to bottom
            var lineHeight = ndViewerContext.current.textViewMetrics.lineHeight; // $.nd.viewer.textView.scalesManager.lineHeight();
            if (align)
                top = alignTop(top);
            if (top + height > maxHeight)
                return null;
            var next = this.next();
            if (colspan > 1 && !next)
                return null;
            var confirmed = colspan == 1,
                result = null,
                lastHeight = Number.MAX_VALUE;
            this._positions.each(function () {
                if (top >= this.top + this.height)
                    return;
                else if (top + height <= this.top) {
                    if (!confirmed) {
                        var position = next.findFirstPosition(top, colspan - 1, height, align, maxHeight);
                        if (!position)
                            return false;
                        top = position.top;
                        if (top + height <= this.top) {
                            result = {
                                top: top,
                                height: Math.min(position.height, this.top - top)
                            };
                            return false;
                        } else if (top >= this.top + this.height) {
                            confirmed = true;
                            lastHeight = position.height;
                            return;
                        }
                    } else {
                        result = {
                            top: top,
                            height: Math.min(lastHeight, this.top - top)
                        };
                        return false;
                    }
                }
                top = this.top + this.height;
                if (align)
                    top = alignTop(top);
                confirmed = colspan == 1;
                lastHeight = Number.MAX_VALUE;
            });
            if (!result && top >= 0 && top + height <= maxHeight) { // need to make the last check
                if (colspan > 1) {
                    var position = next.findFirstPosition(top, colspan - 1, height, align, maxHeight);
                    if (position) {
                        top = position.top;
                        if (align)
                            top = alignTop(top);
                        result = {
                            top: top,
                            height: Math.min(position.height, maxHeight - top)
                        };
                    }
                } else
                    result = {
                        top: top,
                        height: maxHeight - top
                    };
            }
            return result;
        },
        findAllPositions: function (top, colspan, height, align, maxHeight) {
            maxHeight = maxHeight || ndViewerContext.current.textViewMetrics.columnsHeight;
            if (align)
                top = alignTop(top);
            if (top + height > maxHeight)
                return null;
            var next = this.next();
            if (colspan > 1 && !next)
                return null;
            var confirmed = colspan == 1,
                result = [],
                lastHeight = Number.MAX_VALUE;
            this._positions.each(function () {
                if (top >= this.top + this.height)
                    return;
                else if (top + height <= this.top) {
                    if (!confirmed) {
                        var position = next.findFirstPosition(top, colspan - 1, height, align, maxHeight);
                        if (!position)
                            return false;
                        top = position.top;
                        if (top + height <= this.top) {
                            result.push({
                                top: top,
                                height: Math.min(position.height, this.top - top)
                            });
                            return;
                        } else if (top >= this.top + this.height) {
                            confirmed = true;
                            lastHeight = position.height;
                            return;
                        }
                    } else {
                        result.push({
                            top: top,
                            height: Math.min(lastHeight, this.top - top)
                        });
                    }
                }
                top = this.top + this.height;
                if (align)
                    top = alignTop(top);
                confirmed = colspan == 1;
                lastHeight = Number.MAX_VALUE;
            });
            if (/*!result.length && */top >= 0 && top + height <= maxHeight) { // need to make the last check
                if (colspan > 1) {
                    var position = next.findFirstPosition(top, colspan - 1, height, align, maxHeight);
                    if (position) {
                        top = position.top;
                        if (align)
                            top = alignTop(top);
                        result.push({
                            top: top,
                            height: Math.min(position.height, maxHeight - top)
                        });
                    }
                } else
                    result.push({
                        top: top,
                        height: maxHeight - top
                        //height: Math.min(height, maxHeight - top)
                    });
            }
            return result.length ? result : null;
        },
        _checkPosition: function (top, colspan, height, maxHeight) {
            maxHeight = maxHeight || ndViewerContext.current.textViewMetrics.columnsHeight;
            if (top + height > maxHeight)
                return false;
            var next = this.next();
            if (colspan > 1 && !next)
                return false;
            if (this._cells.isEmpty() || this._cells.head().top >= top + height)
                return colspan > 1 ? this._checkPosition(top, colspan - 1, height) : true;
            else return false;
        },
        add: function (instance, top) {
            this._cells.append(new _Cell(this, instance, top));
            this._addPosition(top, instance.colspan, instance);
            return this;
        },
        _addPosition: function (top, current_colspan, instance) {
            var that = this,
                done = false;
            this._positions.each(function () {
                if (this.top < top) // TODO: check the validity of the new position
                    return;
                that._positions.prepend(new _Position(top, current_colspan, instance), this);
                done = true;
                return false;
            });
            if (!done)
                this._positions.append(new _Position(top, current_colspan, instance));
            if (current_colspan > 1 && this.next())
                this.next()._addPosition(top, current_colspan - 1, instance);
            return this;
        },
        positions: function () {
            return this._positions;
        },
        layout: function () {
            return this._layout;
        },
        height: function () {
            if (this._positions.isEmpty())
                return 0;
            var tail = this._positions.tail();
            return tail.top + tail.height;
        },
        cells: function () {
            return this._cells;
        }
    });

    var _gLayoutId = 0;

    function Layout(colspan, renderer) {
        this._id = ++_gLayoutId;
        if (colspan) {
            this._colspan = colspan;
            this._columns = new ndDataList.Items();
            for (var i = 0; i < colspan; ++i)
                this._columns.append(new _Column(this).index(i));
        }
        this._config = {};
        if (renderer)
            this._renderer = renderer;
    };

    Layout.pick = function (layout1, layout2) {
        if (!layout1)
            return layout2;
        if (!layout2)
            return layout1;
        var rate1 = layout1.rate(),
            rate2 = layout2.rate();
        if (rate1 > rate2)
            return layout1;
        else if (rate2 > rate1)
            return layout2;
        var titleType1 = layout1.config().titleType,
            titleType2 = layout2.config().titleType;
        if (titleType1 > titleType2)
            return layout1;
        else if (titleType2 > titleType1)
            return layout2;
        else if (Math.random() >= 0.5)
            return layout1;
        else return layout2;
    };
    Layout.fromJSON = function (json, renderer) {
        var result = new Layout();
        if (renderer) {
            result._renderer = renderer;
            result._textBlocksHeights = renderer.textBlocksHeights();
            result._article = renderer.article();
        }
        result._colspan = json._colspan;
        result._config = json._config;
        result._blockInstances = json._blockInstances;
        result._columns = ndDataList.Items.fromJSON(json._columns, _Column, result);
        return result;
    };
    _.extend(Layout.prototype, {
        _id: 0,
        _renderer: null,
        _article: null,
        _colspan: 0,
        _columns: null,
        _config: null,
        _textViewColumns: null,
        _textDistribution: null,
        _blockInstances: null,
        _textBlocks: null,
        _rate: 0,
        _gaps: null,
        _textBlocksHeights: null,
        toJSON: function () {
            return {
                _colspan: this._colspan,
                _config: this._config,
                _blockInstances: this._blockInstances,
                _columns: this._columns.toJSON()
            };
        },
        id: function () {
            return this._id;
        },
        copy: function () {
            var result = new Layout();
            result._renderer = this._renderer;
            result._article = this._article;
            result._colspan = this._colspan;
            result._columns = new ndDataList.Items();
            this._columns.each(function () {
                result._columns.append(this.copy(result));
            });
            _.extend(result._config, this._config);
            result._textBlocksHeights = this._textBlocksHeights;
            if (this._blockInstances) {
                result._blockInstances = [];
                for (var i = 0; i < this._blockInstances.length; ++i)
                    result._blockInstances.push(copy(this._blockInstances[i]));
            }
            result._totalTextLinesCount = this._totalTextLinesCount;
            result._totalLinesCount = this._totalLinesCount;
            return result;
        },
        articleElm: function () {
            if (this._renderer && (!this._articleElm || !this._articleElm.elm()))
                this._articleElm = this._renderer.newArticleElm();
            return this._articleElm;
        },
        _deleteArticleElm: function () {
            if (this._articleElm) {
                this._articleElm.remove();
                delete this._articleElm;
            }
            return this;
        },
        columnElm: function (idx) {
            return this._renderer ? this._renderer.columnElm(idx) : null;
        },
        columns: function () {
            return this._columns;
        },
        colspan: function () {
            return this._colspan;
        },
        addBlockInstance: function (instance, expand, maxHeight) {
            // find positions range
            ///	instance = {
            ///		colspan: number,
            ///		height: number,
            ///		config: template,
            ///		align: boolean
            ///	}
            var colspan = instance.colspan,
                positions = [],
                config = instance.config;
            if (this._colspan < colspan && !expand) // the block needs more columns than we have, but we're not allowed to add any more.
                return [];
            var blockHeight = instance.height;
            if (!blockHeight)
                return [];
            var columnsCount = this._columns.count();
            if (config.alignRight) {
                var column = this._columns.tail();
                for (var i = colspan - 1, idx = this._columns.count() - 1; i > 0 && column; --i, --idx, column = column.prev());
                if (!column) // try the other colspan
                    return [];
                var position = column.findPosition(instance, maxHeight);
                if (!position) // try the other colspan
                    return [];
                if (!position.length)
                    positions.push({
                        colidx: idx,
                        column: column,
                        top: position.top,
                        instance: instance,
                        columnsCount: this._colspan
                    });
                else
                    for (var i = 0; i < position.length; ++i)
                        positions.push({
                            colidx: idx,
                            column: column,
                            top: position[i].top,
                            instance: instance,
                            columnsCount: this._colspan
                        });
            }
            else {
                // first expand this layout to fit all the current blocks and text plus new instance
                if (expand) this.expandForText(linesCount(0, instance.height, instance.colspan));
                var columns = this._columns.copy(),
                    that = this;
                columns.each(function (idx) {
                    if (idx + colspan > columns.count() && !positions.length && expand)
                        for (var i = columns.count(), j = columns.count() - idx - colspan; j > 0; --j, ++i)
                            columns.append(new _Column(that).index(i));
                    var position = this.findPosition(instance, maxHeight);
                    if (position) {
                        if (!position.length)
                            positions.push({
                                colidx: idx,
                                column: this,
                                top: position.top,
                                instance: instance,
                                columnsCount: columns.count()
                            });
                        else
                            for (var i = 0; i < position.length; ++i)
                                positions.push({
                                    colidx: idx,
                                    column: this,
                                    top: position[i].top,
                                    instance: instance,
                                    columnsCount: columns.count()
                                });
                        if (!config.arbitrary) // first position will do
                            return false;
                    }
                    if (config.alignLeft)
                        return false;
                });
                if (!positions.length && expand) { // try to put the block into the new set of columns
                    var idx = this._colspan;
                    for (var i = columns.count(), j = colspan - columns.count() + this._colspan; j > 0; --j, ++i)
                        columns.append(new _Column(this).index(i));
                    var column = this._columns.tail().next(),
                        position = column.findPosition(instance, maxHeight);
                    if (position) {
                        if (!position.length)
                            positions.push({
                                colidx: idx,
                                column: column,
                                top: position.top,
                                instance: instance,
                                columnsCount: columns.count()
                            });
                        else
                            for (var i = 0; i < position.length; ++i)
                                positions.push({
                                    colidx: idx,
                                    column: column,
                                    top: position[i].top,
                                    instance: instance,
                                    columnsCount: columns.count()
                                });
                    }
                }
                if (columns.count() > this._colspan) // remove extra columns
                    columns.detach(this._colspan - columns.count());
            }
            // get layout copies with block positioned according to found positions
            if (positions.length) {
                var result = [];
                for (var i = 0; i < positions.length; ++i) {
                    var layout = this.copy();
                    if (positions[i].columnsCount > this._colspan)
                        layout.appendColumns(positions[i].columnsCount - this._colspan);
                    layout._applyPosition(positions[i]);
                    result.push(layout);
                }
                return result;
            }
            return [];
        },
        _applyPosition: function (position) {
            var instance = position.instance;
            if (this._blockInstances)
                this._blockInstances.push(instance);
            else this._blockInstances = [instance];
            _.extend(this._config, instance.layoutConfig); // this way we get titleType, imageId, etc.
            this._columns.item(position.colidx).add(instance, position.top);

            // adding an instance can affect both, so they'll have to be recalculated
            this._totalTextLinesCount = this._totalLinesCount = -1;

            return this;
        },
        appendColumn: function () {
            var index = this._columns.count();
            this._colspan++;
            this._columns.append(new _Column(this).index(index));
            return this;
        },
        appendColumns: function (count) {
            var index = this._columns.count();
            for (var i = 0; i < count; ++i)
                this._columns.append(new _Column(this).index(index++));
            this._colspan += count;
            return this;
        },
        config: function () {
            return this._config;
        },
        applyConfig: function (config) {
            if (config)
                _.extend(this._config, config);
            return this;
        },
        rate: function () {
            if (!this._rate)
                this._calculateRate();
            return this._rate;
        },
        compareTo: function (layout) {
            var rate1 = this.rate(),
                rate2 = layout.rate();
            if (rate1 > rate2)
                return this;
            if (rate1 < rate2)
                return layout;
            var gaps1 = this._gaps,
                gaps2 = layout._gaps;
            if (gaps1.count > gaps2.count)
                return this;
            if (gaps1.count < gaps2.count)
                return layout;
            if (gaps1.avgSize < gaps2.avgSize)
                return this;
            if (gaps1.avgSize > gaps2.avgSize)
                return layout;
            if (gaps1.aboveAvgRate > gaps2.aboveAvgRate)
                return layout;
            if (gaps1.aboveAvgRate < gaps2.aboveAvgRate)
                return this;
            if (gaps1.belowAvgRate > gaps2.belowAvgRate)
                return layout;
            if (gaps1.belowAvgRate < gaps2.belowAvgRate)
                return this;
            if (Math.random() < 0.5)
                return this;
            return layout;
        },
        _calculateRate: function () {
            var height = 0,
                count = 0,
                flag = false,
                gap = null,
                gaps = [];
            this._columns.each(function () {
                if (!this._positions.count()) {
                    if (flag)
                        ++gap.colspan;
                    else {
                        flag = true;
                        gaps.push(gap = {colspan: 1});
                    }
                    ++count;
                } else {
                    flag = false;
                    this._positions.each(function () {
                        height += this.height * (this.instance.type === "image" ? 1.1 : 1);
                    });
                }
            });
            this._rate = height / (ndViewerContext.current.textViewMetrics.columnsHeight * this._colspan);
            var avgSize = count / gaps.length,
                aboveAvgCount = 0,
                belowAvgCount = 0;
            for (var i = 0; i < gaps.length; ++i) {
                if (gaps[i].colspan > avgSize)
                    ++aboveAvgCount;
                else if (gaps[i].colspan < avgSize)
                    ++belowAvgCount;
            }
            this._gaps = {
                count: gaps.length,
                avgSize: avgSize,
                aboveAvgRate: aboveAvgCount / gaps.length,
                belowAvgRate: belowAvgCount / gaps.length
            };
        },
        blockInstances: function () {
            return this._blockInstances;
        },
        renderer: function (renderer) {
            if (!arguments.length)
                return this._renderer;
            this._renderer = renderer;
            return this;
        },
        article: function () {
            if (!this._article && this._renderer)
                this._article = this._renderer.article();
            return this._article;
        },
        lock: function (column) {
            if (!this._textViewColumns)
                this._textViewColumns = [column];
            else {
                for (var i = 0; i < this._textViewColumns.length; ++i) {
                    if (this._textViewColumns[i] === column)
                        return this;
                }
                this._textViewColumns.push(column);
            }
            if (!this._onColumnDisposedEventHandler)
                this._onColumnDisposedEventHandler = this.unlock.bind(this);
            column.addLayout(this).on("disposed", this._onColumnDisposedEventHandler);
            this._renderer.lock(this);
            return this;
        },
        unlock: function (column) {
            if (this._onColumnDisposedEventHandler)
                column.off("disposed", this._onColumnDisposedEventHandler);
            if (this._textViewColumns) {
                for (var i = 0; i < this._textViewColumns.length; ++i) {
                    if (this._textViewColumns[i] !== column)
                        continue;
                    this._textViewColumns.splice(i, 1);
                    break;
                }
                if (!this._textViewColumns.length)
                    delete this._textViewColumns;
            }
            if (!this._textViewColumns) {
                //1
                this._deleteArticleElm();
                this._renderer.unlock(this);
            }
        },
        startBlockIdx: function () {
            if (this._article)
                return this._config.fromStart ? 0 : this._article.StartBlockIdx || 0;
            else if (this._config)
                return this._config.startBlockIdx || 0;
            else return 0;
        },
        addTextBlock: function (columnIdx, textBlock) {
            if (!this._textBlocks)
                this._textBlocks = [];
            var column = this._textBlocks[columnIdx];
            if (!column)
                this._textBlocks[columnIdx] = column = [];
            column.push(textBlock);

            return this;
        },
        dispose: function () {
            this._deleteArticleElm();
        },
        highlight: function (column) {
            if (this._renderer)
                return this._renderer.highlight(column);
        },
        addToolsBlock: function (block, column) {
            if (!column) {
                return null;
            }
            var availablePos = this.availableTailPosition();
            var sortedInstances = block.instances(column, this);
            var addedInstance = null;
            for (var i = 0; i < sortedInstances.length; i++) {
                var instance = sortedInstances[i];
                if (instance.height() <= availablePos.height) {
                    addedInstance = instance;
                    addedInstance.layout(this);
                    addedInstance.render(column, availablePos.top);
                    this._applyPosition({
                        instance: addedInstance,
                        colidx: availablePos.colIndex,
                        top: availablePos.top
                    });
                    if (!this._textBlocks)
                        this._textBlocks = [];
                    if (!this._textBlocks[availablePos.colIndex]) {
                        this._textBlocks[availablePos.colIndex] = [];
                    }
                    this._textBlocks[availablePos.colIndex].push(block); // hack: pretend to be a text block for proper animation
                    break;
                }
            }
            return addedInstance;
        },
        toolsAdded: false,
        availableTailPosition: function () {

            var availablePosition = null;

            var tailTextPos = {};
            tailTextPos.colIndex = this._textBlocks.length - 1;
            var tailTextBlock = this._textBlocks[tailTextPos.colIndex].slice(-1)[0];
            tailTextPos.top = tailTextBlock.top();
            tailTextPos.height = tailTextBlock.height();

            var tailBlockPos = {};
            tailBlockPos.colIndex = this._columns.count() - 1;
            var tailLayoutColumn = this._columns.item(tailBlockPos.colIndex),
                filleldPositions = tailLayoutColumn.positions();
            if (filleldPositions.count() > 0) {
                var tailFilledPos = filleldPositions.tail();
                tailBlockPos.top = tailFilledPos.top;
                tailBlockPos.height = tailFilledPos.height;
            } else {
                tailBlockPos.top = 0;
                tailBlockPos.height = 0;
            }

            if (tailBlockPos.colIndex > tailTextPos.colIndex) {
                availablePosition = {
                    colIndex: tailBlockPos.colIndex,
                    top: tailBlockPos.top + tailBlockPos.height
                };
            } else {
                if (tailBlockPos.top > tailTextPos.top) {
                    availablePosition = {
                        colIndex: tailBlockPos.colIndex,
                        top: tailBlockPos.top + tailBlockPos.height
                    };
                } else {
                    availablePosition = {
                        colIndex: tailTextPos.colIndex,
                        top: tailTextPos.top + tailTextPos.height
                    };
                }
            }

            availablePosition.height = ndViewerContext.current.textViewMetrics.columnsHeight - availablePosition.top;
            return availablePosition;
        },
        textBlocksHeights: function (textBlocksHeights) {
            if (!arguments.length)
                return this._textBlocksHeights;
            this._textBlocksHeights = textBlocksHeights;
            return this;
        },
        isValid: function () {
            return !this.textDistribution().emptyLinesCount;
        },
        textDistribution: function () {
            if (!this._textDistribution) {
                var lineHeight = ndViewerContext.current.textViewMetrics.lineHeight,
                    availableLines = 0,
                    textBlockIdx = this.startBlockIdx(),
                    textLinesCount = Math.floor(this._textBlocksHeights.get(textBlockIdx, this._config.titleType) / lineHeight),
                    emptyColumnsCount = 0,
                    emptyLinesCount = 0,
                    that = this;
                this._columns.each(function () {
                    var positions = this.findAllPositions(0, 1, lineHeight * 3, true),
                        lines = 0;
                    if (positions)
                        for (var i = 0; i < positions.length; ++i)
                            lines += Math.floor(positions[i].height / lineHeight);
                    availableLines += lines;
                    if (textBlockIdx >= 0) {
                        while (lines) {
                            if (lines < textLinesCount) {
                                textLinesCount -= lines;
                                lines = 0;
                                break;
                            }
                            lines -= textLinesCount;
                            if (++textBlockIdx >= that._articleTextBlocksCount()) {
                                textBlockIdx = -1;
                                break;
                            }
                            textLinesCount = Math.floor(that._textBlocksHeights.get(textBlockIdx, that._config.titleType) / lineHeight);
                        }
                    } else ++emptyColumnsCount;
                    if (lines)
                        emptyLinesCount += lines;
                });
                this._textDistribution = {
                    emptyColumnsCount: emptyColumnsCount,
                    availableLines: availableLines,
                    emptyLinesCount: emptyLinesCount
                }
            }
            return this._textDistribution;
        },
        _articleTextBlocksCount: function () {
            return this._article ? this._article.Blocks.length : this._config.textBlocksCount;
        },
        expand: function (value) {
            if (!arguments.length || typeof value === "boolean")
                return this._renderer ? this._renderer.expand(this, value) : this;
            if (typeof value === "number" && value > 0) {
                for (var i = 0; i < value; ++i)
                    this._columns.append(new _Column(this));
                this._colspan += value;
                this._textDistribution = null;
                this._rate = 0;
            }
            return this;
        },
        expandForText: function (extraLinesCount) {
            var totalLinesCount = this.totalLinesCount();
            if (extraLinesCount) totalLinesCount += extraLinesCount;
            var totalColumnsCount = Math.ceil(totalLinesCount / ndViewerContext.current.textViewMetrics.linesPerColumn);
            return this.expand(totalColumnsCount - this._colspan);
        },
        _totalTextLinesCount: -1,
        totalTextLinesCount: function () {
            if (this._totalTextLinesCount < 0) {
                var article = this.article();
                if (article) {
                    var lineHeight = ndViewerContext.current.textViewMetrics.lineHeight,
                        heights = this._textBlocksHeights.getAll(this._config.titleType, {allowLastBlockToolsBtn: true});
                    this._totalTextLinesCount = 0;
                    for (var i = this.startBlockIdx(); i < article.Blocks.length; ++i)
                        this._totalTextLinesCount += Math.floor(heights[i] / lineHeight);
                }
            }
            return this._totalTextLinesCount;
        },
        _totalLinesCount: -1,
        totalLinesCount: function () {
            if (this._totalLinesCount < 0) {
                this._totalLinesCount = 0;
                var that = this;
                this._columns.each(function () {
                    this.cells().each(function () {
                        that._totalLinesCount += this.lines();
                    });
                });
                this._totalLinesCount += this.totalTextLinesCount();
            }
            return this._totalLinesCount;
        },
        render: function () {
            return this._renderer ? this._renderer.renderLayout(this) : null;
        },
        textBlocks: function () {
            return this._textBlocks;
        },
        dataItem: function () {
            return this.article();
        }
    });

    return Layout;

});
define('nd.viewer.textview.articlelayout.renderers.config',[],function () {

	var clickPanelNode = '<div class="readmore-click-panel" style="width:100px;height:100px;position:fixed;bottom:-25px;right:-16px;text-indent:-998px;cursor:pointer;"></div>',
		ellipsisNode = '<a href="javascript:void(0)" class="readmore">Continue</a>',
		ellipsisDisdNode = '<a href="javascript:void(0)" class="readmore dis">Continue</a>';

	return {
        ellipsis: ellipsisNode + clickPanelNode,
		disabledEllipsis: ellipsisDisdNode + clickPanelNode,
		toolsbtn: ' <a href="javascript:void(0)" class="art-tools-call"><em>Article tools</em></a>',
		continued: ' <span class="lbl-continued">Continued</span> ',
		noHghltAttr: "no-hghlt",
		maxImageScale: 300,
		padding: 16,
        articleStyles: {
            "0": "",
            "1": "art-t2",
            "2": "art-t3",
            "3": "art-t4",
            "4": "art-t5"
        }
	}
});
define('nd.viewer.textview.articlelayout.textblocks',[
    "lodash",
    "nd.viewer.context",
    "nd.viewer.textview.articlelayout.renderers.config",
    "nd.config.core"
], function (_, ndViewerContext, rendererConfig, ndConfigCore) {

    var _count = 10;

    var _articleLayoutBlocks = null,
        _container = null,
        _currentType = 0;

    var blockRoleMap = {
        annotation: {
            className: "art-annotation"
        },
        paratitle: {
            className: "art-paratitle"
            //continuous: true
        },
        dropcap: {
            className: "dropcap"
        }
        //text: {
        //	className: "art-text",
        //	continuous: true
        //}
    };

    function _textBlockCacheKey(idx, type, config) {
        if (type < 0 || !idx && type >= 3) { // for some title type the first block differs
            var result = type + "_" + idx;
            if (!idx && type >= 3 && config && config.disableArtLeadFormatting)
                result += "_noArtLead";
            return result;
        }
        return idx;
    };

    function pclasshtml(blockidx, type, role, lines, config) {
        /// config: {
        ///     disableArtLeadFormatting: boolean
        /// }
        var classList = [],
            hasCustomRole = !!blockRoleMap[role];

        if (hasCustomRole) classList.push(blockRoleMap[role].className);

        if (!blockidx && ndConfigCore.get("textview.enableFirstBlockFormatting", true)) { // It's the first block of the article.
            if (!hasCustomRole) {
                if (type >= 3) { // Applied for only big templates.
                    if (!config || !config.disableArtLeadFormatting)
                        classList.push("art-lead");
                    if (!lines || lines >= 3)
                        classList.push("dropcap");
                }
            }
            classList.push("first-block");
        }

        return classList.length > 0 ? ' class="' + classList.join(" ") + '"' : "";
    };

    function init(articleLayoutBlocks) {
        _articleLayoutBlocks = articleLayoutBlocks;
        if (!_container) {
            _container = document.createElement("div");
            _container.style.position = "absolute";
            _container.style.left = "-10000px";
            _container.style.top = "-10000px";
            _container.className = "col";
        }
    }

    function TextBlocksHeights(article) {
        if (article)
            this._article = article;
        this._cache = {};

        // Textblock might have a margin from top, since we calculate the part of the block that should be displayed by setting margin-top css property.
        // The initial margin must be saved while the textblock height is being calculated and added during rendering process.
        // There is no need to serialize this data, because is not involved into layout building.
        this._textBlockOffsetMap = {};
    }

    TextBlocksHeights.fromJSON = function (json) {
        var result = new TextBlocksHeights();
        if (json)
            result._cache = json;
        return result;
    }
    _.extend(TextBlocksHeights.prototype, {
        _cache: null,
        _article: null,
        get: function (idx, type, config) {
            /// config: {
            ///		allowLastBlockToolsBtn: boolean,
            ///     disableArtLeadFormatting: boolean
            ///	}
            type = type || 0;
            var key = _textBlockCacheKey(idx, type, config);
            if (key in this._cache)
                return this._cache[key];
            if (!_container || !this._article)
                return undefined;
            var count, start;
            if (!idx && type >= 3) {
                count = 1;
                start = 0;
            }
            else {
                count = _count;
                start = idx - idx % count;
                if (start + count > this._article.Blocks.length)
                    count = this._article.Blocks.length - start;
            }
            var buffer = [], indexes = [];
            for (var i = 0; i < count; ++i) {
                var currentIdx = i + start,
                    currentKey = _textBlockCacheKey(currentIdx, type, config);
                if (currentKey in this._cache)
                    continue;
                buffer.push(this._textBlockHtml(currentIdx, type, config));
                indexes.push(currentIdx);
            }
            this._processHtml(buffer.join(""), indexes, type, config);
            return this._cache[key];
        },
        getAll: function (type, config) {
            var key = "all_" + type;
            if (key in this._cache)
                return this._cache[key];
            var result = this._cache[key] = [this.get(0, type, config)],
                buffer = [], indexes = [];
            for (var i = 1; i < this._article.Blocks.length; ++i) {
                key = _textBlockCacheKey(i, type, config);
                if (key in this._cache)
                    result[i] = this._cache[key];
                else {
                    buffer.push(this._textBlockHtml(i, type, config));
                    indexes.push(i);
                }
            }
            if (buffer.length) {
                var heights = this._processHtml(buffer.join(""), indexes, type, config);
                for (var idx in heights)
                    result[idx] = heights[idx];
            }
            return result;
        },
        _textBlockHtml: function (idx, type, config) {
            var result = [];
            result.push("<p" + pclasshtml(idx, type, this._article.Blocks[idx].Role, 0, config) + ">");
            result.push(this._article.Blocks[idx].Text);
            var ifLastTextBlockInExpandedArticle = idx >= this._article.Blocks.length - 1 && !this._article.isPreview(),
                ifNoAuthorAndNoIssueInfo = !this._article.Byline && !(ndViewerContext.current.textView.config().showIssueInfo && this._article.Issue);
            if (ifLastTextBlockInExpandedArticle && ifNoAuthorAndNoIssueInfo && config && config.allowLastBlockToolsBtn)
                result.push(rendererConfig.toolsbtn);
            result.push("</p>");
            return result.join("");
        },
        _processHtml: function (html, indexes, type, config) {
            _container.innerHTML = html + "<p>a</p>";
            _container.style.width = _articleLayoutBlocks.contentWidth(1) + "px";
            var articleElm = _articleLayoutBlocks.articleElm(type).elm()[0];
            articleElm.appendChild(_container);
            var offsetTop, prevIdx, result = {};
            for (var i = 0; i < _container.childNodes.length; ++i) {
                var elm = _container.childNodes[i],
                    idx = indexes[i],
                    ot = elm.offsetTop;
                if (elm.className.length > 0) {
                    // if an element has a class (or classes) it might have a margin-top which is included into offset.
                    // In order to calculate elm's height properly this margin should be subtracted from the offset. IE 9+
                    var marginTop = parseInt(document.defaultView.getComputedStyle(elm).getPropertyValue("margin-top"));
                    if (marginTop !== 0) this._textBlockOffsetMap[_textBlockCacheKey(idx, type, config)] = marginTop;
                    ot -= marginTop;
                }
                if (i) result[prevIdx] = this._cache[_textBlockCacheKey(prevIdx, type, config)] = ot - offsetTop;
                offsetTop = ot;
                prevIdx = idx;
            }
            articleElm.removeChild(_container);
            return result;
        },
        getInitialOffset: function (idx, type, config) {
            return this._textBlockOffsetMap[_textBlockCacheKey(idx, type, config)] || 0;
        },
        toJSON: function () {
            return this._cache;
        },
        reset: function () {
            this._cache = {};
            this._textBlockOffsetMap = {};
        }
    });

    return {
        init: init,
        pclasshtml: pclasshtml,
        TextBlocksHeights: TextBlocksHeights
    }

});
define('nd.viewer.textview.articlelayout.builder.worker',[
    "lodash",
    "nd.viewer.textview.articlelayout.builder",
    "nd.viewer.textview.articlelayout.layout",
    "nd.viewer.context",
    "nd.viewer.textview.articlelayout.textblocks"
], function(_, LayoutBuilder, Layout, ndViewerContext, textBlocks) {

    var _builder = new LayoutBuilder(Layout, _evaluate, _sufficient, Layout.pick);

    function buildLayout(metaInfo, instanceMap, config, textViewMetrics) {
        // init textView metrics: lineHeinght, viewHeight...
        if (!ndViewerContext.current)
            ndViewerContext.current = new ndViewerContext();
        ndViewerContext.current.textViewMetrics = _.extend(ndViewerContext.current.textViewMetrics || {}, textViewMetrics);

        var sourceLayout = new Layout(config.colspan).applyConfig(config).textBlocksHeights(textBlocks.TextBlocksHeights.fromJSON(config.textBlocksHeights));
        delete sourceLayout.config().textBlocksHeights;
        // build layout
        var result = _builder.buildLayout(metaInfo, instanceMap, sourceLayout);
        return result ? result.toJSON() : result;
    }

    function _sufficient() {
        return false;
    }

    function _evaluate(layout) {
        // TODO: check the validity (no empty spaces)
        return {
            valid: layout.isValid() || layout.colspan() === 1
        }
    }

    return {
        buildLayout: buildLayout
    };
});
require(["nd.core.worker.init", "nd.viewer.textview.articlelayout.builder.worker"],
	function () {
	}
);

define("init.worker", function(){});

