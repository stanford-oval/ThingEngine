// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const lang = require('lang');
const Q = require('q');

var asyncCallbacks = {};
var eventCallbacks = {};

module.exports.makeJavaAPI = function makeJavaAPI(klass, methods) {
    var classObj = {
        Name: klass + '_Proxy',

        _init: function() {},

        registerCallback: function(callbackName, callback) {
            eventCallbacks[klass + '_' + callbackName] = callback;
        },

        unregisterCallback: function(callbackName) {
            delete eventCallbacks[klass + '_' + callbackName];
        },
    };
    methods.forEach(function(method) {
        classObj[method] = function() {
            var call = JXMobile(klass + '_' + method);
            var cb = call.callAsyncNative.apply(call, arguments);
            asyncCallbacks[cb] = Q.defer();
            return Q.promise;
        }
    });

    return new lang.Class(classObj);
}

module.exports.invokeCallback = function(callbackId, error, value) {
    if (callbackId in eventCallbacks)
        return eventCallbacks[callbackId](error, value);

    if (!callbackId in asyncCallbacks) {
        console.log('Invalid callback ID ' + callbackId);
        return;
    }

    if (error)
        asyncCallbacks[cb].reject(new Error(error));
    else
        asyncCallbacks[cb].resolve(value);
    delete asyncCallbacks[cb];
};