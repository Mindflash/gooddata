var _ = require('lodash');
var async = require('async');
var request = require("request");

var options = {
	hostName: 'secure.gooddata.com',
	port: 443
};

var GDCAuthSST = '';
var GDCAuthTT = '';

var GD = function(params) {
	_.extend(options, _.defaults(params, {
		projectId : '',
		username: '',
		password: ''
	}));

	function login(cb) {
		var payload = {
			postUserLogin: {
				login:options.username,
				password:options.password,
				remember:1
			}
		};

		request({
			url: 'https://' + options.hostName + '/gdc/account/login',
			port: options.port,
			method: "POST",
			json: payload
		},
		function (err, res, body) {
			if(err) return cb(err);

			if(body.error)
				return cb(body.error);

			if(res.statusCode >= 300 || !body.userLogin)
				return cb('error logging in');

			setupCookies(res);

			cb();
		});
	}

	function setupCookies(res) {
		var cookies = res.headers['set-cookie'];

		_.each(cookies, function(cookie) {
			if(cookie.indexOf('GDCAuthTT') != -1) GDCAuthTT = cookie;
			else if(cookie.indexOf('GDCAuthSST') != -1) GDCAuthSST = cookie;
		});
	}

	function getTempToken(cb) {
		request({
			url: 'https://' + options.hostName + '/gdc/account/token',
			port: options.port,
			method: "POST",
			headers: { Cookie: GDCAuthSST },
			json: {}
		},
		function (err, res, body) {
			if(err) return cb(err);

			if(body.error)
				return cb(body.error);

			if(res.statusCode >= 300)
				return cb('error logging in');

			setupCookies(res);

			cb();
		});
	}

	function updateFilters(params, cb) {
		request({
			url: 'https://' + options.hostName + '/gdc/md/' + options.projectId + '/userfilters',
			port: options.port,
			method: "POST",
			headers: { Cookie: GDCAuthTT },
			json: {
				userFilters: {
					items: [{
						user: params.userId,
						userFilters: params.filters
					}]
				}
			}
		},
		function (err, res, body) {
			if(err) return cb(err);

			if(body.error)
				return cb(body.error);

			if(res.statusCode >= 300)
				return cb('error updating filters');

			if(goodDataWasNotSuccessful(body, params.userId))
				return cb('error updating filters');

			cb();
		});

		function goodDataWasNotSuccessful(body, userId) {
			return body.userFiltersUpdateResult.successful.indexOf(userId) == -1
					|| !_.isEmpty(body.userFiltersUpdateResult.failed)
		}
	}

	return {
		updateFilters: function(params, cb) {
			async.series([
				login,
				getTempToken,
				updateFilters.bind(this, params)
			], function(err, res) {
				if(err) return cb(err);

				return cb(null, res);
			});
		}
	};
};

module.exports = {
	createClient: function(options)
 	{
		return new GD(options);
	}
}