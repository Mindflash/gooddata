'use strict';

const _ = require('lodash');
const async = require('async');
const JSONStream = require('JSONStream');
const request = require('request');
const through2 = require('through2');
const requestVersion = require('request/package.json').version;

const options = {
  hostName: 'secure.gooddata.com',
  port: 443
};
const LOGIN_ERR_CODE = 300;

let GDCAuthSST = '';
let GDCAuthTT = '';

const GD = function(params) {
  _.extend(options, _.defaults(params, {
    projectId: '',
    username: '',
    password: ''
  }));

  function login(cb) {
    const payload = {
      postUserLogin: {
        login: options.username,
        password: options.password,
        remember: 1
      }
    };

    request({
      url: `https://${options.hostName}/gdc/account/login`,
      port: options.port,
      method: 'POST',
      headers: {
        'User-Agent': `request/${requestVersion}`
      },
      json: payload
    }, (err, res, body) => {
      if (err) return cb(err);

      if (body.error) {
        return cb(body.error);
      }

      if (res.statusCode >= LOGIN_ERR_CODE || !body.userLogin) {
        return cb('error logging in');
      }

      setupCookies(res);

      cb();
    });
  }

  function setupCookies(res) {
    const cookies = res.headers['set-cookie'];

    _.each(cookies, cookie => {
      if (cookie.indexOf('GDCAuthTT') !== -1) GDCAuthTT = cookie;
      else if (cookie.indexOf('GDCAuthSST') !== -1) GDCAuthSST = cookie;
    });
  }

  function getTempToken(cb) {
    request({
      url: `https://${options.hostName}/gdc/account/token`,
      port: options.port,
      method: 'GET',
      headers: {
        Cookie: GDCAuthSST,
        'User-Agent': `request/${requestVersion}`
      },
      json: {}
    }, (err, res, body) => {
      if (err) return cb(err);

      if (body.error) {
        return cb(body.error);
      }

      if (res.statusCode >= LOGIN_ERR_CODE) {
        return cb('error logging in');
      }

      setupCookies(res);

      cb();
    });
  }

  function updateFilters(data, cb) {
    request({
      url: `https://${options.hostName}/gdc/md/${options.projectId}/userfilters`,
      port: options.port,
      method: 'POST',
      headers: {
        Cookie: GDCAuthTT,
        'User-Agent': `request/${requestVersion}`
      },
      json: {
        userFilters: {
          items: [{
            user: data.userId,
            userFilters: data.filters
          }]
        }
      }
    }, (err, res, body) => {
      if (err) return cb(err);

      if (body.error) {
        return cb(body.error);
      }

      if (res.statusCode >= LOGIN_ERR_CODE) {
        return cb('error updating filters');
      }

      if (goodDataWasNotSuccessful(body, data.userId)) {
        return cb('error updating filters');
      }

      cb(null, body);
    });

    function goodDataWasNotSuccessful(body, userId) {
      return body.userFiltersUpdateResult.successful.indexOf(userId) === -1 ||
        !_.isEmpty(body.userFiltersUpdateResult.failed);
    }
  }

  function getAttributeByUri(data, cb) {
    request({
      url: `https://${options.hostName}${data.uri}`,
      port: options.port,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Charset': 'utf-8',
        Cookie: GDCAuthTT,
        'User-Agent': `request/${requestVersion}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    }, (err, res, body) => {
      if (err) return cb(err);

      if (body) {
        body = JSON.parse(body);
      }

      if (body.error) {
        return cb(body.error);
      }

      if (res.statusCode >= LOGIN_ERR_CODE) {
        return cb('error getting attribute');
      }

      cb(null, body.attribute);
    });
  }

  function findAttributeElementsByTitle(data, cb) {
    const attribute = data.attribute;
    const titles = data.titles;
    const elementLookup = {};

    if (!attribute || !attribute.content || !_.isArray(attribute.content.displayForms) ||
      attribute.content.displayForms.length === 0 || !attribute.content.displayForms[0] ||
      !attribute.content.displayForms[0].links || !attribute.content.displayForms[0].links.elements) {
      return cb('Has no link to attribute\'s elements');
    }
    if (!titles) {
      return cb('Has no titles to find');
    }

    request({
      url: `https://${options.hostName}${attribute.content.displayForms[0].links.elements}`,
      port: options.port,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Charset': 'utf-8',
        Cookie: GDCAuthTT,
        'User-Agent': `request/${requestVersion}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    }, err => {
      if (err) return cb(err);
    }).pipe(JSONStream.parse('attributeElements.elements.*'))
      .pipe(through2.obj(function(chunk, enc, sCb) {
        if (titles.indexOf(chunk.title) !== -1) {
          elementLookup[chunk.title] = chunk.uri;
        }

        this.push(null);
        sCb();
      }, () => {
        cb(null, elementLookup);
      }));
  }

  return {
    updateFilters(data, cb) {
      async.series({
        login,
        getTempToken,
        updateFilters: updateFilters.bind(this, data)
      }, (err, res) => {
        if (err) return cb(err);
        cb(null, res.updateFilters);
      });
    },
    getAttributeByUri(data, cb) {
      async.series({
        login,
        getTempToken,
        getAttributeByUri: getAttributeByUri.bind(this, data)
      }, (err, res) => {
        if (err) return cb(err);
        cb(null, res.getAttributeByUri);
      });
    },
    findAttributeElementsByTitle(data, cb) {
      async.series({
        login,
        getTempToken,
        getAttributeByUri(sCb) {
          if (data.attribute) return sCb();
          getAttributeByUri(data, (err, res) => {
            if (err) return sCb(err);
            data.attribute = res;
            sCb(null, res);
          });
        },
        findAttributeElementsByTitle: findAttributeElementsByTitle.bind(this, data)
      }, (err, res) => {
        if (err) return cb(err);
        cb(null, res.findAttributeElementsByTitle);
      });
    }
  };
};

module.exports = {
  createClient(data) {
    return new GD(data);
  }
};
