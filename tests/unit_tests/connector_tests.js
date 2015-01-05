'use strict';
require('../bootstrap');
var Salesforce = require('../../lib/connector');
var sinon = require('sinon');
var BBPromise = require('bluebird');
var expect = require('chai').expect;
var requestPromise = require('request-promise');
var config = require('config');
var errors = require('hoist-errors');

describe('SalesforceConnector', function () {
  var connector;
  before(function () {
    connector = new Salesforce({
      username: config.username,
      password: config.password
    });
  });
  describe('#get', function () {
    var response = {};
    before(function () {
      sinon.stub(connector.conn, 'query').returns(BBPromise.resolve(response));
      return connector.get('SELECT Id, Name FROM Account');
    });
    after(function () {
      connector.conn.query.restore();
    });
    it('calls conn.query', function () {
      expect(connector.conn.query)
        .to.have.been.calledWith('SELECT Id, Name FROM Account');
    });
  });
  describe('#authorize', function () {
    describe('with username and password', function () {
      var options = {
        username: 'username',
        password: 'password'
      }
      before(function () {
        sinon.stub(connector.conn, 'login').returns(BBPromise.resolve());
        return connector.authorize(options);
      });
      after(function () {
        connector.conn.login.restore();
        connector.settings = {
          username: config.username,
          password: config.password
        };
      });
      it('sets the username', function () {
        expect(connector.settings.username).to.eql(options.username);
      });
      it('sets the password', function () {
        expect(connector.settings.password).to.eql(options.password);
      });
      it('calls login', function () {
        expect(connector.conn.login).to.be.calledWith(options.username, options.password)
      });
    });
    describe('with only password', function () {
      var options = {
        password: 'password'
      }
      before(function () {
        sinon.stub(connector.conn, 'login').returns(BBPromise.resolve());
        return connector.authorize(options);
      });
      after(function () {
        connector.conn.login.restore();
        connector.settings = {
          username: config.username,
          password: config.password
        };
      });
      it('does not change the username', function () {
        expect(connector.settings.username).to.eql(config.username);
      });
      it('sets the password', function () {
        expect(connector.settings.password).to.eql(options.password);
      });
      it('calls login', function () {
        expect(connector.conn.login).to.be.calledWith(config.username, options.password)
      });
    });
    describe('with only username', function () {
      var options = {
        username: 'username'
      }
      before(function () {
        sinon.stub(connector.conn, 'login').returns(BBPromise.resolve());
        return connector.authorize(options);
      });
      after(function () {
        connector.conn.login.restore();
        connector.settings = {
          username: config.username,
          password: config.password
        };
      });
      it('sets the username', function () {
        expect(connector.settings.username).to.eql(options.username);
      });
      it('does not change the password', function () {
        expect(connector.settings.password).to.eql(config.password);
      });
      it('calls login', function () {
        expect(connector.conn.login).to.be.calledWith(options.username, config.password)
      });
    });
  });
});