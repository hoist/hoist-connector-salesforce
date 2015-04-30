'use strict';
var BBPromise = require('bluebird');
var logger = require('hoist-logger');
// var errors = require('hoist-errors');
var _ = require('lodash');
var jsforce = require('jsforce');
var loginUrl = 'https://login.salesforce.com';

function SalesforceConnector(settings) {
  logger.info({
    settings: settings
  }, 'constructed salesforce-connector');
  // console.log('sf settings',settings);
  this.settings = settings;
  this.conn = new jsforce.Connection({
    loginUrl: loginUrl
  });
  // this.conn.login(settings.username, settings.password);
  var fs = _.filter(_.functions(this.conn), function (f) {
    f = f.toLowerCase();
    return (!_.startsWith(f, '_')) &&
      !_.endsWith(f, '$') &&
      !_.contains(f, 'login') &&
      !_.contains(f, 'logout') &&
      !_.contains(f, 'authorize') &&
      !_.contains(f, 'listener') &&
      f !== 'on' && f !== 'once';
  });
  _.forEach(fs, _.bind(function (f) {
    if (!this[f]) {
      this[f] = _.bind(function wrapConnector() {
        return this.conn[f].apply(this.conn, arguments);
      }, this);
    }
  }, this));
}

SalesforceConnector.prototype.get = function (query) {
  logger.info('inside hoist-connector-salesforce.get');
  return BBPromise.resolve(this.conn.query(query));
};

SalesforceConnector.prototype.post = function (type, record) {
  logger.info('inside hoist-connector-salesforce.post');
  if (_.isArray(record)) {
    var updates = [];
    var creates = [];
    _.each(record, function (rec) {
      if (rec.Id) {
        updates.push(rec);
      } else {
        creates.push(rec);
      }
    });
    var promises = [];
    if (creates.length) {
      promises[0] = BBPromise.resolve(this.conn.sobject(type).create(creates));
      if (!updates.length) {
        return promises[0];
      }
    }
    if (updates.length) {
      promises[1] = BBPromise.resolve(this.conn.sobject(type).update(updates));
      if (!creates.length) {
        return promises[1];
      }
    }
    return BBPromise.settle(promises);
  } else {
    if (record.Id) {
      return BBPromise.resolve(this.conn.sobject(type).update(record));
    } else {
      return BBPromise.resolve(this.conn.sobject(type).create(record));
    }
  }
};

SalesforceConnector.prototype.authorize = function (settings) {
  if (settings && settings.username) {
    this.settings.username = settings.username;
  }
  if (settings && settings.password) {
    this.settings.password = settings.password;
  }
  return BBPromise.resolve(this.conn.login(this.settings.username, this.settings.password));
};

module.exports = SalesforceConnector;
