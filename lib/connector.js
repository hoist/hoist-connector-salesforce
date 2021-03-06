'use strict';

var BBPromise = require('bluebird');
var logger = require('@hoist/logger');
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
  var fs = _.filter(_.functions(jsforce.Connection.prototype), function (f) {
    f = f.toLowerCase();
    return !_.startsWith(f, '_') && !_.endsWith(f, '$') && !_.includes(f, 'login') && !_.includes(f, 'logout') && !_.includes(f, 'authorize') && !_.includes(f, 'listener') && f !== 'on' && f !== 'once';
  });
  var self = this;
  _.forEach(fs, function (f) {
    if (!self[f]) {
      console.log('wrapping f', f);
      self[f] = function wrapConnector() {
        return self.conn[f].apply(self.conn, Array.prototype.slice.call(arguments));
      };
    }
  });
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
  return BBPromise.resolve(this.conn.login(this.settings.username, this.settings.password)).then(function (response) {
    logger.info('result from login', response);
  });
};

module.exports = SalesforceConnector;
//# sourceMappingURL=connector.js.map
