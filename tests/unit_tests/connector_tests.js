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
  describe('#post', function () {
    describe('with object', function () {
      describe('with id', function () {
        var record = {
          Id: 'id',
          Name: 'name'
        };
        var type = 'type';
        var response = {};
        var sobject;
        before(function () {
          sobject = connector.conn.sobject(type);
          sinon.stub(sobject, 'update').returns(BBPromise.resolve(response));
          return connector.post(type, record);
        });
        after(function () {
          sobject.update.restore();
        });
        it('calls sobject.update', function () {
          expect(sobject.update)
            .to.have.been.calledWith(record);
        });
      });
      describe('without id', function () {
        var record = {
          Name: 'name'
        };
        var type = 'type';
        var response = {};
        var sobject;
        before(function () {
          sobject = connector.conn.sobject(type);
          sinon.stub(sobject, 'create').returns(BBPromise.resolve(response));
          return connector.post(type, record);
        });
        after(function () {
          sobject.create.restore();
        });
        it('calls sobject.create', function () {
          expect(sobject.create)
            .to.have.been.calledWith(record);
        });
      });
    });
    describe('with array', function () {
      describe('with some records having id', function () {
        var creates = [{
          Name: 'name'
        }, {
          Name: 'name2'
        }];
        var updates = [{
          Id: 'id',
          Name: 'name'
        }, {
          Id: 'id',
          Name: 'name2'
        }];
        var records = creates.concat(updates);
        var type = 'type';
        var response = {};
        var sobject;
        before(function () {
          sobject = connector.conn.sobject(type);
          sinon.stub(sobject, 'create').returns(BBPromise.resolve(response));
          sinon.stub(sobject, 'update').returns(BBPromise.resolve(response));
          return connector.post(type, records);
        });
        after(function () {
          sobject.update.restore();
          sobject.create.restore();
        });
        it('calls sobject.create', function () {
          expect(sobject.create)
            .to.have.been.calledWith(creates);
        });
        it('calls sobject.update', function () {
          expect(sobject.update)
            .to.have.been.calledWith(updates);
        });
      });
      describe('with all records having id', function () {
        var records = [{
          Id: 'id',
          Name: 'name'
        }, {
          Id: 'id',
          Name: 'name2'
        }];
        var type = 'type';
        var response = {};
        var sobject;
        before(function () {
          sobject = connector.conn.sobject(type);
          sinon.stub(sobject, 'create').returns(BBPromise.resolve(response));
          sinon.stub(sobject, 'update').returns(BBPromise.resolve(response));
          return connector.post(type, records);
        });
        after(function () {
          sobject.update.restore();
          sobject.create.restore();
        });
        it('does not call sobject.create', function () {
          expect(sobject.create.called)
            .to.eql(false);
        });
        it('calls sobject.update', function () {
          expect(sobject.update)
            .to.have.been.calledWith(records);
        });
      });
      describe('with no records having id', function () {
        var records = [{
          Name: 'name'
        }, {
          Name: 'name2'
        }];
        var type = 'type';
        var response = {};
        var sobject;
        before(function () {
          sobject = connector.conn.sobject(type);
          sinon.stub(sobject, 'create').returns(BBPromise.resolve(response));
          sinon.stub(sobject, 'update').returns(BBPromise.resolve(response));
          return connector.post(type, records);
        });
        after(function () {
          sobject.update.restore();
          sobject.create.restore();
        });
        it('does not call sobject.update', function () {
          expect(sobject.update.called)
            .to.eql(false);
        });
        it('calls sobject.create', function () {
          expect(sobject.create)
            .to.have.been.calledWith(records);
        });
      });
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