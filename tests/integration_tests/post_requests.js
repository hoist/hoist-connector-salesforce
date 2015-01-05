'use strict';
require('../bootstrap');
var Salesforce = require('../../lib/connector');
var fs = require('fs');
var path = require('path');
var expect = require('chai').expect;
var config = require('config');
var BBPromise = require('bluebird');

describe('SalesforceConnector #post', function () {
  this.timeout(500000);
  describe('valid connection to update/create Groups', function () {
    describe('with object', function () {
      describe('with id', function () {
        var record = {
          Id: '00G90000002PqvoEAC',
          Name: 'newName'
        };
        var type = 'Group';
        var response;
        var connector;
        var expectedResponse = require(path.resolve(__dirname, '../fixtures/responses/update_group_single.json'));
        before(function () {
          connector = new Salesforce({
            username: config.username,
            password: config.password
          });
          response = connector.authorize().then(function () {
            return connector.post(type, record);
          });
        });
        it('returns expected json', function () {
          return expect(response.then(function (json) {
            return json.Id;
          }).catch(function (err) {
            console.log("error", err);
          })).to.become(expectedResponse.Id);
        });
      });
      describe('without id', function () {
        var record = {
          Name: 'name'
        };
        var type = 'Group';
        var response;
        var connector;
        var expectedResponse = require(path.resolve(__dirname, '../fixtures/responses/create_group_single.json'));
        before(function () {
          connector = new Salesforce({
            username: config.username,
            password: config.password
          });
          response = connector.authorize().then(function () {
            return connector.post(type, record);
          });
        });
        it('returns expected json', function () {
          return expect(response.then(function (json) {
            return json.success;
          }).catch(function (err) {
            console.log("error", err);
          })).to.become(expectedResponse.success);
        });
      });
    });

    describe('with array', function () {
      describe('with some records having id', function () {
        var creates = [{
          Name: 'name3'
        }, {
          Name: 'name4'
        }];
        var updates = [{
          Id: '00G90000002PqvoEAC',
          Name: 'name'
        }, {
          Id: '00G90000002PuG4EAK',
          Name: 'name2'
        }];
        var records = creates.concat(updates);
        var type = 'Group';
        var response;
        var connector;
        var expectedUpdateResponse = require(path.resolve(__dirname, '../fixtures/responses/update_group_multiple.json'));
        var expectedCreateResponse = require(path.resolve(__dirname, '../fixtures/responses/create_group_multiple.json'));
        before(function () {
          connector = new Salesforce({
            username: config.username,
            password: config.password
          });
          response = connector.authorize().then(function () {
            return connector.post(type, records);
          });
        });
        it('returns expected update json', function () {
          return expect(response.then(function (result) {
            var res = result[1];
            if(res.isFulfilled()){
              return res.value()
            }
            if(res.isRejected()){
              return BBPromise.reject(res.reason());
            }
          }).then(function(json) {
            return json;
          }).catch(function (err) {
            console.log("error", err);
          })).to.become(expectedUpdateResponse);
        });
        it('returns expected create json', function () {
          return expect(response.then(function (result) {
            var res = result[0];
            if(res.isFulfilled()){
              return res.value()
            }
            if(res.isRejected()){
              return BBPromise.reject(res.reason());
            }
          }).then(function(json) {
            return [json[0].success, json[1].success];
          }).catch(function (err) {
            console.log("error", err);
          })).to.become([expectedCreateResponse[0].success, expectedCreateResponse[1].success]);
        });
      });
      describe('with all records having id', function () {
        var records = [{
          Id: '00G90000002PqvoEAC',
          Name: 'name'
        }, {
          Id: '00G90000002PuG4EAK',
          Name: 'name2'
        }];
        var type = 'Group';
        var response;
        var connector;
        var expectedResponse = require(path.resolve(__dirname, '../fixtures/responses/update_group_multiple.json'));
        before(function () {
          connector = new Salesforce({
            username: config.username,
            password: config.password
          });
          response = connector.authorize().then(function () {
            return connector.post(type, records);
          });
        });
        it('returns expected update json', function () {
          return expect(response.then(function(json) {
            return json;
          }).catch(function (err) {
            console.log("error", err);
          })).to.become(expectedResponse);
        });
      });
      describe('with no records having id', function () {
        var records = [{
          Name: 'name3'
        }, {
          Name: 'name4'
        }];
        var type = 'Group';
        var response;
        var connector;
        var expectedResponse = require(path.resolve(__dirname, '../fixtures/responses/create_group_multiple.json'));
        before(function () {
          connector = new Salesforce({
            username: config.username,
            password: config.password
          });
          response = connector.authorize().then(function () {
            return connector.post(type, records);
          });
        });
        it('returns expected create json', function () {
          return expect(response.then(function(json) {
            return [json[0].success, json[1].success];
          }).catch(function (err) {
            console.log("error", err);
          })).to.become([expectedResponse[0].success, expectedResponse[1].success]);
        });
      });
    });
  });
});