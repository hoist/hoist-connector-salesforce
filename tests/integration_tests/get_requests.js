'use strict';
require('../bootstrap');
var Salesforce = require('../../lib/connector');
var fs = require('fs');
var path = require('path');
var expect = require('chai').expect;
var config = require('config');

describe('SalesforceConnector #get', function () {
  this.timeout(500000);
  describe('valid connection to get accounts', function () {
    var response;
    var connector;
    var expectedResponse = require(path.resolve(__dirname, '../fixtures/responses/get_account.json'));
    before(function () {
      connector = new Salesforce({
        username: config.username,
        password: config.password
      });
      response = connector.authorize().then(function () {
        return connector.get('SELECT Id, Name FROM Account')
      });
    });
    it('returns expected json', function () {
      return expect(response.then(function (json) {
        return json.totalSize;
      }).catch(function (err) {
        console.log("error", err);
      })).to.become(expectedResponse.totalSize);
    });
  });
});