var _ = require('lodash');
var async = require('async');
var test = require('tap').test;
var util = require('util');
var gooddata = require('../lib/api.js');

// TO RUN TESTS REPLACE THE CONFIG WITH YOUR GOODDATA CREDENTIALS
var config = require('./config/config.js');

var api = gooddata.createClient(config);

test('updating filters', function (t) {
  var params = {
    userId: config.userId,
    filters: [config.filter]
  };

  api.updateFilters(params, function (err, res) {
    t.notOk(err, 'no errors logging in ' + util.inspect(err));
    t.ok(res, 'updated filters successfully ' + util.inspect(res));
    t.end();
  });
});

test('get attribute by uri', function (t) {
  var params = { uri: config.attributeUri };

  api.getAttributeByUri(params, function (err, res) {
    t.notOk(err, 'no errors logging in ' + util.inspect(err));
    t.ok(res, 'got response ' + util.inspect(res));
    t.end();
  });
});

test('get attribute\'s elements by title when passing attribute uri', function (t) {
  var params = {
    titles: config.titles,
    uri: config.attributeUri
  };

  api.findAttributeElementsByTitle(params, function (err, res) {
    t.notOk(err, 'no errors logging in ' + util.inspect(err));
    t.ok(res, 'got response ' + util.inspect(res));
    t.ok(_.keys(res).length > 0, 'found elements');
    t.end();
  });
});

test('get attribute\'s elements by title when passing attribute object', function (t) {
  var getAttributeParams = { uri: config.attributeUri };
  var findAttributeElementsParams = {
    titles: config.titles,
    uri: config.attributeUri
  };

  api.getAttributeByUri(getAttributeParams, function (err, res) {
    t.notOk(err, 'no errors logging in ' + util.inspect(err));
    t.ok(res, 'got response ' + util.inspect(res));

    api.findAttributeElementsByTitle(findAttributeElementsParams, function (err, res) {
      t.notOk(err, 'no errors logging in ' + util.inspect(err));
      t.ok(res, 'got response ' + util.inspect(res));
      t.ok(_.keys(res).length > 0, 'found elements');
      t.end();
    });
  });
});

test('create filter', function (t) {
  var params = {
    elementId: config.elementId,
    title: config.elementTitle
  };

  api.createFilter(params, function (err, res) {
    t.notOk(err, 'error on invalid login attempt ' + util.inspect(err));
    t.ok(res, 'should have responded ' + util.inspect(res));
    t.end();
  });
});

test('create user', function (t) {
  var params = config.createUserData;

  api.createUser(params, function (err, res) {
    t.notOk(err, 'error on invalid login attempt ' + util.inspect(err));
    t.ok(res, 'should have responded ' + util.inspect(res));
    t.end();
  });
});

test('get user info by login', function (t) {
  var params = {
    login: config.login
  };

  api.getUserInfoByLogin(params, function (err, res) {
    t.notOk(err, 'error on invalid login attempt ' + util.inspect(err));
    t.ok(res, 'should have responded ' + util.inspect(res));
    t.end();
  });
});

test('add use to project by role', function (t) {
  var params = {
    userId: config.userId,
    userRoles: [config.roles]
  };

  api.addUserToProject(params, function (err, res) {
    t.notOk(err, 'error on invalid login attempt ' + util.inspect(err));
    t.ok(res, 'should have responded ' + util.inspect(res));
    t.end();
  });
});

test('delete user', function (t) {
  var params = {
    userId: config.userId
  };

  api.deleteUser(params, function (err, res) {
    t.notOk(err, 'error on invalid login attempt ' + util.inspect(err));
    t.ok(res, 'should have responded ' + util.inspect(res));
    t.end();
  });
});
