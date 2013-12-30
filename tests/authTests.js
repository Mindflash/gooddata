var _ = require('lodash');
var test = require('tap').test;
var gooddata = require('../lib/api.js');

// TO RUN TESTS REPLACE THE CONFIG WITH YOUR GOODDATA CREDENTIALS
var config = require('./config/config.js');

test("GooddataAPI auth", function(t) {

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

	t.test("setup", function(t) {
		var api = getAPI();
		t.ok(api, 'api is ok');
		t.end();
	});

	t.test("invalid login attempt to gooddata returns err", function(t) {
		var api = getInvalidAPI();

		var gdOptions = {};

		var after = function (err, res) {
			t.ok(err, 'error on invalid login attempt');
			t.notOk(res, 'should not have responded');
			t.end();
		};

		api.updateFilters(gdOptions, after);
	});

	t.test("valid login to gooddata", function(t) {
		var api = getAPI();

		var gdOptions = {
			userId: config.userId,
			filters: [ config.filter ]
		};

		var after = function (err, res) {
			t.notOk(err, 'no errors logging in', err);
			t.ok(res, 'updated filters successfully', res);
			t.end();
		};

		api.updateFilters(gdOptions, after);
	});

	t.end();
});