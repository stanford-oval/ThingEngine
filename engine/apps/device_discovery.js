// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const lang = require('lang');
const Q = require('q');

const BaseApp = require('../base_app');

// Listen on all channels that can give us devices, and try
// to discover them
const DeviceDiscoveryApp = new lang.Class({
    Name: 'DeviceDiscoveryApp',
    Extends: BaseApp,

    _init: function(engine, state) {
        this.parent(engine, state);

        this.name = "Device Discovery (system app)";
    },

    _onUPnPEvent: function(event) {
        console.log('Received UPnP event', event);

        // FINISHME: make a Device out of this event!
    },

    _onDeviceAdded: function(device) {
    },

    start: function() {
        var device = this.engine.devices.getSelf();
        if (device === undefined) {
            // during first run, before config-pairing starts,
            // selfdevice will be unavailable
            // wait until device added

            var devicedb = this.engine.devices;
            return Q.Promise(function(callback, errback) {
                function onDeviceAdded(device) {
                    var device = this.engine.devices.getSelf();
                    if (device !== undefined) {
                        this.start().then(callback, errback);
                        return;
                    }

                    // keep waiting...
                    devicedb.once('device-added', onDeviceAdded.bind(this));
                }

                devicedb.once('device-added', onDeviceAdded.bind(this));
            }.bind(this));
        }

        return Q.all([this.engine.channels.getDeviceChannel('upnp-ssdp', device)])
            .spread(function(upnp) {
                this._upnp = upnp;
                upnp.on('event', this._onUPnPEvent.bind(this));
            }.bind(this));
    },

    stop: function() {
        return Q.all([this._upnp != null ? this._testChannel.close() : Q()]);
    }

});

function createApp(engine, state) {
    return new DeviceDiscoveryApp(engine, state);
}

module.exports.createApp = createApp;
