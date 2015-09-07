// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const lang = require('lang');
const Q = require('q');
const ssdp = require('node-ssdp');

const BaseChannel = require('../../base_channel');
const Tier = require('../../tier_manager').Tier;

const SSDPChannel = new lang.Class({
    Name: 'SSDPChannel',
    Extends: BaseChannel,

    _init: function(engine, device) {
        this.parent();

        if (!device.hasKind('thingengine-own'))
            throw new Error("upnp-ssdp channel can only be instantiated with a ThingEngine own device");
        if (device.tier === Tier.CLOUD)
            throw new Error("upnp-ssdp cannot run in the cloud");

        this.engine = engine;
        this.targetTier = device.tier;
    },

    get isSource() {
        return true;
    },
    get isSink() {
        return true;
    },
    get isSupported() {
        return this.engine.ownTier === this.targetTier;
    },

    _onNotify: function(headers) {
        console.log(headers);
        this.emitEvent({ location: headers['LOCATION'],
                         st: headers['ST'],
                         nt: headers['NT'],
                         nts: headers['NTS'],
                         usn: headers['USN'] });
    },

    _doOpen: function() {
        var client = new ssdp.Client({
            //unicastHost: '::', // listen on all interfaces (ipv4 and ipv6)
        });
        this._client = client;

        this._listener = this._onNotify.bind(this);
        client.on('response', this._listener);
        client.on('advertise-alive', this._listener);
        client.on('advertise-bye', this._listener);

        return Q.ninvoke(client, 'start').then(function() {
            // run an explicit search now and every 10 minutes
            // the client will also listen for any advertisement
            // in between, so this is just to catch any lost
            // packet

            this._client.search('ssdp:all');
            this._timeout = setInterval(function() {
                this._client.search('ssdp:all');
            }.bind(this), 600000);
        }.bind(this));
        return Q();
    },

    _doClose: function() {
        this._client.removeListener('response', this._listener);
        this._client.removeListener('advertise-alive', this._listener);
        this._client.removeListener('advertise-bye', this._listener);
        this._listener = null;
        clearInterval(this._timeout);
        this._timeout = -1;
        // FIXME
        this._client._stop();
        return Q();
    }
});

function createChannel(engine, device) {
    return new SSDPChannel(engine, device);
}

module.exports.createChannel = createChannel;
