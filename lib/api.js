var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var JSONStream = require('JSONStream');
var request = require("request");
var through2 = require('through2');

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
		}, function (err, res, body) {
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
			method: "GET",
			headers: { Cookie: GDCAuthSST },
			json: {}
		}, function (err, res, body) {
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
			method: 'POST',
			headers: { Cookie: GDCAuthTT },
			json: {
				userFilters: {
					items: [{
						user: params.userId,
						userFilters: params.filters
					}]
				}
			}
		}, function (err, res, body) {
			if(err) return cb(err);

			if(body.error)
				return cb(body.error);

			if(res.statusCode >= 300)
				return cb('error updating filters');

			if(goodDataWasNotSuccessful(body, params.userId))
				return cb('error updating filters');

			cb(null, body);
		});

		function goodDataWasNotSuccessful(body, userId) {
			return body.userFiltersUpdateResult.successful.indexOf(userId) == -1
					|| !_.isEmpty(body.userFiltersUpdateResult.failed)
		}
	}

	function getAttributeByUri(params, cb) {
		request({
			url: 'https://' + options.hostName + params.uri,
			port: options.port,
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Accept-Charset': 'utf-8',
				Cookie: GDCAuthTT,
				'Content-Type': 'application/json; charset=utf-8'
			}
		}, function (err, res, body) {
			if (err) return cb(err);

			if (body)
				body = JSON.parse(body);

			if (body.error)
				return cb(body.error);

			if (res.statusCode >= 300)
				return cb('error getting attribute');

			cb(null, body.attribute);
		});
	}

	function findAttributeElementsByTitle(params, cb) {
		var attribute = params.attribute;
		var titles = params.titles;
		var elementLookup = {};

		if (!attribute || !attribute.content || !_.isArray(attribute.content.displayForms) ||
			attribute.content.displayForms.length == 0 || !attribute.content.displayForms[0] ||
			!attribute.content.displayForms[0].links || !attribute.content.displayForms[0].links.elements)
			return cb('Has no link to attribute\'s elements');
		if (!titles)
			return cb('Has no titles to find');

		request({
			url: 'https://' + options.hostName + attribute.content.displayForms[0].links.elements,
			port: options.port,
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Accept-Charset': 'utf-8',
				Cookie: GDCAuthTT,
				'Content-Type': 'application/json; charset=utf-8'
			}
		}).pipe(JSONStream.parse('attributeElements.elements.*')).pipe(through2.obj(function(chunk, enc, cb) {
				if(~titles.indexOf(chunk.title))
					elementLookup[chunk.title] = chunk.uri;

				this.push(null);
				cb();
			}, function() {
				cb(null, elementLookup);
			}));
	}

	return {
		updateFilters: function (params, cb) {
			async.series({
				login: login,
				getTempToken: getTempToken,
				updateFilters: updateFilters.bind(this, params)
			}, function(err, res) {
				if(err) return cb(err);
				cb(null, res.updateFilters);
			});
		},
		getAttributeByUri: function (params, cb) {
			async.series({
				login: login,
				getTempToken: getTempToken,
				getAttributeByUri: getAttributeByUri.bind(this, params)
			}, function(err, res) {
				if(err) return cb(err);
				cb(null, res.getAttributeByUri);
			});
		},
		findAttributeElementsByTitle: function (params, cb) {
			async.series({
				login: login,
				getTempToken: getTempToken,
				getAttributeByUri: function (sCb) {
					if (params.attribute) return sCb();
					getAttributeByUri(params, function (err, res) {
						if (err) return sCb(err);
						params.attribute = res;
						sCb(null, res);
					});
				},
				findAttributeElementsByTitle: findAttributeElementsByTitle.bind(this, params)
			}, function(err, res) {
				if(err) return cb(err);
				cb(null, res.findAttributeElementsByTitle);
			});
		}
	};
};

module.exports = {
	createClient: function(options) {
		return new GD(options);
	}
};