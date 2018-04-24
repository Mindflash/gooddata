var _ = require('lodash');
var test = require('tap').test;
var util = require('util');
var gooddata = require('../lib/api.js');

// TO RUN TESTS REPLACE THE CONFIG WITH YOUR GOODDATA CREDENTIALS
var config = require('./config/config');

function getInvalidAPI() {
  return gooddata.createClient({
    projectId: 'TEST PROJ',
    username: 'TEST USER',
    password: 'TEST PWD'
  });
}

function getAPI() {
  return gooddata.createClient(config);
}

test('invalid login attempt to gooddata returns err', function (t) {
  var api = getInvalidAPI();
  var gdOptions = {};

  api.updateFilters(gdOptions, function (err, res) {
    t.ok(err, 'error on invalid login attempt ' + util.inspect(err));
    t.notOk(res, 'should not have responded ' + util.inspect(res));
    t.end();
  });
});

test('valid login to gooddata', function (t) {
  var api = getAPI();
  var gdOptions = {
    userId: config.userId,
    filters: [config.filter]
  };

  api.updateFilters(gdOptions, function (err, res) {
    t.notOk(err, 'no errors logging in ' + util.inspect(err));
    t.end();
  });
});
