'use strict';
var BBPromise = require('bluebird');
var logger = require('hoist-logger');
// var errors = require('hoist-errors');
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

SalesforceConnector.prototype.authorize = function (settings) {
  if(settings && settings.username) {
    this.settings.username = settings.username;
  }
  if(settings && settings.password) {
    this.settings.password = settings.password;
  }
  return BBPromise.resolve(this.conn.login(this.settings.username, this.settings.password));
};

module.exports = SalesforceConnector;