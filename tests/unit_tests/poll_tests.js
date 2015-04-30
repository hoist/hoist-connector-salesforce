/// <reference path="../../typings/mocha/mocha.d.ts"/>
'use strict';
require('../bootstrap');
var expect = require('chai').expect;
var SalesforcePoller = require('../../lib/poll').cls;
var Connector = require('../../lib/connector');
var sinon = require('sinon');
var jsforce = require('jsforce');
var BBPromise = require('bluebird');
var moment = require('moment');

describe('SalesforcePoller', function () {
	describe('#pollSubscription', function () {
		var emit = sinon.stub();
		var context;
		var clock;
		var stubQuery1;
		var stubQuery2;
		before(function () {
			clock = sinon.useFakeTimers();
			context = {
				application: {
					_id: 'app_id'
				},
				subscription: {
					_id: 'subscription_id',
					get: sinon.stub(),
					set: sinon.stub(),
					delayTill: sinon.stub()
				},
				settings: {

				},
				authorization: {
					username: 'user',
					password: 'password'
				},
				connectorKey: 'test-key'
			};
			sinon.stub(jsforce.Connection.prototype, 'login');
			sinon.stub(jsforce.Connection.prototype, 'describeGlobal').returns(BBPromise.resolve({
				sobjects: [{
					name: 'unqueriedObject',
					queryable: true,
					replicateable: true,
					updateable: true
				}, {
						name: 'unqueriableObject',
						queryable: false,
						replicateable: true,
						updateable: true
					}, {
						name: 'queriedObject',
						queryable: true,
						replicateable: true,
						updateable: true
					}]
			}));
			stubQuery1 = {
				find: sinon.stub().returns(BBPromise.resolve([{
					Id: 1
				}, {
						Id: 2
					}]))
			};
			stubQuery2 = {
				updated: sinon.stub().returns(BBPromise.resolve({
					ids: [
						1,
						2
					]
				})),
				deleted: sinon.stub().returns(BBPromise.resolve({
					ids: [
						4
					]
				})),
				find: sinon.stub().returns(BBPromise.resolve([{
					Id: 3
				}]))
			};

			sinon.stub(jsforce.Connection.prototype, 'sobject')
				.withArgs('unqueriedObject').returns(stubQuery1)
			jsforce.Connection.prototype.sobject.withArgs('queriedObject').returns(stubQuery2);
			context.subscription.get.returns(null);
			context.subscription.get.withArgs('queriedobject').returns({
				lastPolled: moment().add(-1, 'd').toISOString(),
				ids: [1, 2, 4]
			});
			var poller = new SalesforcePoller(context);
			poller.emit = emit;
			return poller.pollSubscription();
		});
		after(function () {
			jsforce.Connection.prototype.login.restore();
			jsforce.Connection.prototype.sobject.restore();
			clock.restore();
		});
		it('logs in to salesforce', function () {
			return expect(jsforce.Connection.prototype.login)
				.to.have.been.calledWith('user', 'password');
		});
		it('loads all objects', function () {
			return expect(jsforce.Connection.prototype.describeGlobal)
				.to.have.been.called;
		});
		it('doesn\'t query unqueriable', function () {
			return expect(jsforce.Connection.prototype.sobject)
				.to.have.been.calledWith('unqueriedObject');
		});
		it('saves rases modified events for every object in unqueried', function () {
			return expect(emit)
				.to.have.been.calledWith('test-key:modified:unqueriedobject', {
				Id: 1
			}).and.been.calledWith('test-key:modified:unqueriedobject',
				{
					Id: 2
				});
		});
		it('saves the ids of new objects', function () {
			return expect(context.subscription.set)
				.to.have.been.calledWith('unqueriedobject', {
				lastPolled: moment().toISOString(),
				ids: [1, 2]
			});
		});
		it('rases modified events for modified objects in queried', function () {
			return expect(emit)
				.to.have.been.calledWith('test-key:modified:queriedobject', {
				Id: 1
			}).and.been.calledWith('test-key:modified:queriedobject', { Id: 2 });
		});
		it('rases new events for new object in queried', function () {
			return expect(emit)
				.to.have.been.calledWith('test-key:new:queriedobject', {
				Id: 3
			});
		});
		it('rases deleted events for deleted object in queried', function () {
			return expect(emit)
				.to.have.been.calledWith('test-key:deleted:queriedobject', {
				Id: 4
			});
		});
		it('queries for modified records', function () {
			return expect(stubQuery2.updated)
				.to.have.been.calledWith(moment().add(-1, 'd').toISOString(), moment().toISOString());
		});
		it('queries for deleted records', function () {
			return expect(stubQuery2.deleted)
				.to.have.been.calledWith(moment().add(-1, 'd').toISOString(), moment().toISOString());
		});
		it('queries for created records', function () {
			return expect(stubQuery2.find)
				.to.have.been.calledWith({
				CreatedDate: { $gte: new jsforce.Date(moment().add(-1, 'd').toISOString()) }
			});
		});
		it('saves the ids of queried objects', function () {
			return expect(context.subscription.set)
				.to.have.been.calledWith('queriedobject', {
				lastPolled: moment().toISOString(),
				ids: [1, 2, 3]
			});
		});

	});
});