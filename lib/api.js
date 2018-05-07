'use strict';

const _ = require('lodash');
const async = require('async');
const JSONStream = require('JSONStream');
const request = require('request');
const through2 = require('through2');
const requestVersion = require('request/package.json').version;

const options = {
  port: 443
};
const LOGIN_ERR_CODE = 300;
const USER_AGENT = `request/${requestVersion}`;

let GDCAuthSST = '';
let GDCAuthTT = '';

const GD = function(params) {
  _.extend(options, _.defaults(params, {
    hostName: 'secure.gooddata.com',
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
        'User-Agent': USER_AGENT
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
        'User-Agent': USER_AGENT
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

  function createFilter(data, cb) {
    request({
      url: `https://${options.hostName}/gdc/md/${options.projectId}/obj`,
      port: options.port,
      method: 'POST',
      headers: {
        Cookie: GDCAuthTT,
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      },
      json: {
        userFilter: {
          content: {
            expression:
              `[${options.attributeUriForFilter}]=[${options.attributeUriForFilter}/elements?id=${data.elementId}]`
          },
          meta: {
            category: 'userFilter',
            title: data.title
          }
        }
      }
    }, (err, res, body) => {
      if (err) {
        return cb(err);
      }

      if (body.error) {
        return cb(body.error);
      }

      if (res.statusCode >= LOGIN_ERR_CODE) {
        return cb('Error creating filter');
      }

      if (!body.uri) {
        return cb('Error creating filter');
      }

      cb(null, body);
    });
  }

  function updateFilters(data, cb) {
    request({
      url: `https://${options.hostName}/gdc/md/${options.projectId}/userfilters`,
      port: options.port,
      method: 'POST',
      headers: {
        Cookie: GDCAuthTT,
        'User-Agent': USER_AGENT
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

  function createUser(data, cb) {
    request({
      url: `https://${options.hostName}/gdc/account/domains/${options.domain}/users`,
      port: options.port,
      method: 'POST',
      headers: {
        Cookie: GDCAuthTT,
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      },
      json: {
        accountSetting: {
          login: data.login,
          email: data.email,
          password: data.password,
          verifyPassword: data.verifyPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          ssoProvider: data.ssoProvider,
          language: data.language || 'en-US'
        }
      }
    }, (err, res, body) => {
      if (err) {
        return cb(err);
      }

      if (body.error) {
        return cb(body.error);
      }

      if (res.statusCode >= LOGIN_ERR_CODE) {
        return cb('Error creating user');
      }

      if (!body.uri) {
        return cb('Error creating user');
      }

      cb(null, body);
    });
  }

  function addUserToProject(data, cb) {
    request({
      url: `https://${options.hostName}/gdc/projects/${options.projectId}/users`,
      port: options.port,
      method: 'POST',
      headers: {
        Cookie: GDCAuthTT,
        'User-Agent': USER_AGENT
      },
      json: {
        user: {
          content: {
            status: 'ENABLED',
            userRoles: data.userRoles
          },
          links: {
            self: data.userId
          }
        }
      }
    }, (err, res, body) => {
      if (err) {
        return cb(err);
      }

      if (body.error) {
        return cb(body.error);
      }

      if (res.statusCode >= LOGIN_ERR_CODE) {
        return cb('Error adding user to project');
      }

      if (!body.projectUsersUpdateResult || !body.projectUsersUpdateResult.successful.length) {
        return cb('Error adding user to project');
      }

      cb(null, body.projectUsersUpdateResult);
    });
  }

  function getUserInfoByLogin(data, cb) {
    request({
      url: `https://${options.hostName}/gdc/account/domains/${options.domain}/users?login=${data.login}`,
      port: options.port,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Charset': 'utf-8',
        Cookie: GDCAuthTT,
        'User-Agent': USER_AGENT,
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

      cb(null, body.accountSettings);
    });
  }

  function deleteUser(data, cb) {
    request({
      url: `https://${options.hostName}/gdc/account/profile/${data.userId}`,
      port: options.port,
      method: 'DELETE',
      headers: {
        Cookie: GDCAuthTT,
        'User-Agent': USER_AGENT
      }
    }, (err, res, body) => {
      if (err) return cb(err);

      if (res.statusCode >= LOGIN_ERR_CODE) {
        return cb('Error deleting user');
      }

      cb(null, body);
    });
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
        'User-Agent': USER_AGENT,
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
        'User-Agent': USER_AGENT,
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
    createFilter(data, cb) {
      async.series({
        login,
        getTempToken,
        createFilter: createFilter.bind(this, data)
      }, (err, res) => {
        if (err) return cb(err);
        cb(null, res.createFilter);
      });
    },
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
    getUserInfoByLogin(data, cb) {
      async.series({
        login,
        getTempToken,
        getUserInfoByLogin: getUserInfoByLogin.bind(this, data)
      }, (err, res) => {
        if (err) return cb(err);
        cb(null, res.getUserInfoByLogin);
      });
    },
    createUser(data, cb) {
      async.series({
        login,
        getTempToken,
        createUser: createUser.bind(this, data)
      }, (err, res) => {
        if (err) return cb(err);
        cb(null, res.createUser);
      });
    },
    addUserToProject(data, cb) {
      async.series({
        login,
        getTempToken,
        addUserToProject: addUserToProject.bind(this, data)
      }, (err, res) => {
        if (err) return cb(err);
        cb(null, res.addUserToProject);
      });
    },
    deleteUser(data, cb) {
      async.series({
        login,
        getTempToken,
        deleteUser: deleteUser.bind(this, data)
      }, (err, res) => {
        if (err) return cb(err);
        cb(null, res.deleteUser);
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
