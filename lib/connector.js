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
}

SalesforceConnector.prototype.get = function (query) {
  logger.info('inside hoist-connector-salesforce.get');
  return BBPromise.resolve(this.conn.query(query));
};

SalesforceConnector.prototype.post = function (type, record) {
  logger.info('inside hoist-connector-salesforce.get');
    console.log(1);
  if (_.isArray(record)) {
    console.log(2);
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
    console.log(3);
    console.log(creates)
      promises[0] = BBPromise.resolve(this.conn.sobject(type).create(creates));
      if(!updates.length) {
    console.log(4);
        return promises[0];
      }
    }
    if (updates.length) {
    console.log(5);
    console.log(updates)
      promises[1] = BBPromise.resolve(this.conn.sobject(type).update(updates));
      if(!creates.length) {
    console.log(6);
        return promises[1];
      }
    }
    return BBPromise.settle(promises);
  } else {
    console.log(7);
    if (record.Id) {
    console.log(8);
      return BBPromise.resolve(this.conn.sobject(type).update(record));
    } else {
    console.log(9);
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