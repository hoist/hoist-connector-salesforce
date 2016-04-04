'use strict';

var _ = require('lodash');
var Connector = require('./connector');
var BBPromise = require('bluebird');
var moment = require('moment');
var jsforce = require('jsforce');

function SalesforcePoller(context) {
  this.logger = require('@hoist/logger').child({
    cls: 'SalesforcePoller',
    application: context.application._id,
    subscription: context.subscription._id
  });
  this.logger.alert = require('@hoist/logger').alert;
  this.logger.debug('setting up salesforce poller');
  this.context = context;
  this.connector = new Connector(context.settings);
}

SalesforcePoller.prototype.pollSubscription = function () {
  var _this = this;

  this.logger.debug('authorizing connector');
  return this.connector.authorize(this.context.authorization).then(function () {
    _this.logger.info('loading all objects');
    return _this.loadAllObjects();
  }).then(function (salesforceObjects) {
    _this.logger.info({
      salesforceObjects: salesforceObjects
    }, 'processing objects');
    return _.map(salesforceObjects, function (salesForceObject) {
      _this.logger.info({
        salesForceObject: salesForceObject
      }, 'processing object');
      return _this.pollObject(salesForceObject);
    });
  }).then(function (queries) {
    return BBPromise.all(queries);
  }).catch(function (err) {
    _this.logger.error(err);
    _this.logger.alert(new Error("an error occured during polling subscription"), _this.context.application._id, {
      original: err.message
    });
  }).finally(function () {
    _this.context.subscription.delayTill(moment().add(5, 'minutes').toDate());
  });
};
SalesforcePoller.prototype.pollObject = function (salesForceObject) {
  var _this2 = this;

  return this.loadMeta(salesForceObject.name).then(function (metaData) {
    return _this2.queryChanges(metaData, salesForceObject.name);
  }).then(function (metaData) {
    return _this2.saveMeta(metaData, salesForceObject.name);
  });
};
SalesforcePoller.prototype.loadMeta = function (salesForceObjectName) {
  return BBPromise.resolve(this.context.subscription.get(salesForceObjectName.toLowerCase()));
};
SalesforcePoller.prototype.queryChanges = function (metaData, salesForceObjectName) {
  var _this3 = this;

  var pollTime = moment();
  var updated;
  var deleted;
  var created;
  var populated;
  if (!metaData) {
    metaData = {
      ids: []
    };
    populated = BBPromise.resolve(this.connector.conn.sobject(salesForceObjectName).find({})).bind(this).then(function (objects) {
      updated = objects;
    });
    created = [];
    deleted = [];
  } else {
    this.logger.info('polled before', salesForceObjectName);
    populated = BBPromise.all([BBPromise.resolve(this.connector.sobject(salesForceObjectName).updated(metaData.lastPolled, pollTime.toISOString())).then(function (response) {
      updated = _.map(response.ids, function (id) {
        return {
          Id: id
        };
      });
    }), BBPromise.resolve(this.connector.sobject(salesForceObjectName).deleted(metaData.lastPolled, pollTime.toISOString())).then(function (response) {
      _this3.logger.info('deletes', response);
      deleted = _.map(response.ids, function (id) {
        return {
          Id: id
        };
      });
    }), BBPromise.resolve(this.connector.sobject(salesForceObjectName).find({
      CreatedDate: {
        $gte: new jsforce.Date(moment(metaData.lastPolled).toISOString())
      }
    })).then(function (objects) {
      created = objects;
    })]).catch(function (err) {
      _this3.logger.error(err);
      _this3.logger.alert(new Error("error getting created object from salesforce"), _this3.context.application._id, {
        original: err.message
      });
    });
  }
  return populated.then(function () {
    console.log(updated, deleted, created);
    _this3.logger.info(updated, deleted, created);
    return _.map(updated, function (update) {
      _this3.logger.info(salesForceObjectName, 'update');
      return _this3.processUpdate(salesForceObjectName, update, metaData);
    }).concat(_.map(deleted, function (d) {
      _this3.logger.info('processing deletes', d);
      return _this3.processDelete(salesForceObjectName, d, metaData);
    })).concat(_.map(created, function (create) {
      return _this3.processCreate(salesForceObjectName, create, metaData);
    }));
  }).then(function (updates) {
    return BBPromise.all(updates);
  }).then(function () {
    metaData.lastPolled = pollTime.toISOString();
    return metaData;
  }).catch(function (err) {
    _this3.logger.info(err);
  });
};
SalesforcePoller.prototype.processUpdate = function (salesForceObjectName, updateObject, metaData) {
  var _this4 = this;

  return BBPromise.try(function () {
    metaData.ids = metaData.ids || [];
    var eventName = _this4.context.connectorKey + ':modified:' + salesForceObjectName.toLowerCase();
    _this4.logger.info('eventName', eventName);
    _this4.emit(eventName, updateObject);
    if (!_.includes(metaData.ids, updateObject.Id)) {
      metaData.ids.push(updateObject.Id);
    }
  }).catch(function (err) {
    _this4.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.processCreate = function (salesForceObjectName, createObject, metaData) {
  var _this5 = this;

  return BBPromise.try(function () {
    metaData.ids = metaData.ids || [];
    var eventName = _this5.context.connectorKey + ':new:' + salesForceObjectName.toLowerCase();
    _this5.emit(eventName, createObject);
    if (!_.includes(metaData.ids, createObject.Id)) {
      metaData.ids.push(createObject.Id);
    }
  }).catch(function (err) {
    _this5.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.processDelete = function (salesForceObjectName, deleteObject, metaData) {
  var _this6 = this;

  return BBPromise.try(function () {
    _this6.logger.info('processing deletes');
    metaData.ids = metaData.ids || [];
    var eventName = _this6.context.connectorKey + ':deleted:' + salesForceObjectName.toLowerCase();
    _this6.emit(eventName, deleteObject);
    _.remove(metaData.ids, function (id) {
      return id === deleteObject.Id;
    });
  }).catch(function (err) {
    _this6.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.saveMeta = function (metaData, salesForceObjectName) {
  return this.context.subscription.set(salesForceObjectName.toLowerCase(), metaData);
};
SalesforcePoller.prototype.loadAllObjects = function () {
  var _this7 = this;

  this.logger.info('loading all salesforce objects');

  return BBPromise.resolve(this.connector.describeGlobal()).then(function (response) {
    _this7.logger.info({
      objectCount: response.sobjects.length,
      object1: response.sobjects[0]
    }, 'got response from all salesforce objects');
    return _.filter(response.sobjects, function (sobject) {
      return sobject.queryable && sobject.replicateable && sobject.updateable;
    });
  });
};

module.exports = function (context, raiseMethod) {
  var poller = new SalesforcePoller(context);
  poller.emit = raiseMethod;
  return poller.pollSubscription();
};
module.exports.cls = SalesforcePoller;
//# sourceMappingURL=poll.js.map
