// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingPedia
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

var Q = require('q');
var express = require('express');
var passport = require('passport');

var db = require('../util/db');
var model = require('../model/device');
var user = require('../util/user');

var router = express.Router();

router.get('/', function(req, res) {
    var page = req.query.page;
    if (page === undefined)
        page = 0;
    if (isNaN(page))
        page = 0;

    if (req.query.class && ['online', 'physical'].indexOf(req.query.class) < 0) {
        res.status(404).render('error', { page_title: "ThingEngine - Error",
                                          message: "Invalid device class" });
        return;
    }

    var online = req.query.class === 'online';

    db.withClient(function(client) {
        var rows = (online ? model.getAllWithKind(client, 'online-account') :
                    model.getAllWithoutKind(client, 'online-account'));
        return rows.then(function(devices) {
            res.render('thingpedia_device_list', { page_title: "ThingEngine - supported devices",
                                                   devices: devices,
                                                   onlineAccounts: online });
        });
    }).done();
});

function getDetails(fn, param, req, res) {
    Q.try(function() {
        return db.withClient(function(client) {
            return fn(client, param).tap(function(d) {
                return model.getAllKinds(client, d.id)
                    .then(function(kinds) { d.kinds = kinds; });
            }).tap(function(d) {
                if (req.user &&
                    req.user.developer_key !== null &&
                    req.user.id === d.owner) {
                    return model.getDeveloperCode(client, d.id)
                        .then(function(row) { d.code = row.code; });
                } else {
                    return model.getApprovedCode(client, d.id)
                        .then(function(row) { d.code = row.code; })
                        .catch(function() { d.code = null; });
                }
            });
        }).then(function(d) {
            var online = d.kinds.some(function(k) { return k.kind === 'online-account' });
            var title;
            if (online)
                title = "ThingEngine - Account details";
            else
                title = "ThingEngine - Device details";

            var triggers = [], actions = [];
            try {
                var ast = JSON.parse(d.code);
                if (ast.triggers) {
                    for (var t in ast.triggers) {
                        var obj = {
                            name: t
                        };
                        if (ast.triggers[t].params)
                            obj.params = ast.triggers[t].params;
                        else if (ast.triggers[t].args)
                            obj.params = ast.triggers[t].args;
                        else
                            obj.params = [];
                        obj.schema = ast.triggers[t].schema;
                        obj.doc = ast.triggers[t].doc;
                        triggers.push(obj);
                    }
                }
                if (ast.actions) {
                    for (var a in ast.actions) {
                        var obj = {
                            name: a
                        };
                        if (ast.actions[a].params)
                            obj.params = ast.actions[a].params;
                        else if (ast.actions[a].args)
                            obj.params = ast.actions[a].args;
                        else
                            obj.params = [];
                        obj.schema = ast.actions[a].schema;
                        obj.doc = ast.actions[a].doc;
                        actions.push(obj);
                    }
                }
            } catch(e) {}

            res.render('thingpedia_device_details', { page_title: title,
                                                      csrfToken: req.csrfToken(),
                                                      device: d,
                                                      triggers: triggers,
                                                      actions: actions,
                                                      online: online });
        });
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingPedia - Error",
                                          message: e.message });
    }).done();
}

router.get('/details/:id', function(req, res) {
    getDetails(model.get, req.params.id, req, res);
});

const LEGACY_MAPS = {
    'omlet': 'org.thingpedia.builtin.omlet',
    'linkedin': 'com.linkedin',
    'bodytrace-scale': 'com.bodytrace.scale',
    'twitter-account': 'com.twitter',
    'google-account': 'com.google',
    'facebook': 'com.facebook',
};

router.get('/by-id/:kind', function(req, res) {
    if (req.params.kind in LEGACY_MAPS)
        req.params.kind = LEGACY_MAPS[req.params.kind];
    getDetails(model.getByPrimaryKind, req.params.kind, req, res);
});

router.post('/approve/:id', user.requireLogIn, user.requireDeveloper(user.DeveloperStatus.ADMIN), function(req, res) {
    db.withTransaction(function(dbClient) {
        return model.approve(dbClient, req.params.id);
    }).then(function() {
        res.redirect('/thingpedia/devices/details/' + req.params.id);
    }).catch(function(e) {
        res.status(400).render('error', { page_title: "ThingEngine - Error",
                                          message: e.message });
    }).done();
});

module.exports = router;