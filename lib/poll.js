'use strict';
var _ = require('lodash');
var Connector = require('./connector');
var BBPromise = require('bluebird');
var moment = require('moment');

function SalesforcePoller(context) {
  this.logger = require('hoist-logger').child({
    cls: 'XeroPoller',
    application: context.application._id,
    subscription: context.subscription._id
  });
  this.logger.alert = require('hoist-logger').alert;
  this.logger.debug('setting up salesforce poller');
  this.context = context;
  this.connector = new Connector(context.settings);


}

SalesforcePoller.prototype.pollSubscription = function () {

  this.logger.debug('authorizing connector');
  return this.connector.authorize(this.context.authorization)
    .bind(this)
    .then(function () {
    return this.loadAllObjects();
  })
    .then(function (salesforceObjects) {
    return _.map(salesforceObjects, _.bind(function (salesForceObject) {
      return this.pollObject(salesForceObject);
    }, this));
  }).then(function (queries) {
    return BBPromise.settle(queries);
  }).finally(function () {
    this.context.subscription.delayTill(moment().add(5, 'minutes').toDate());
  });
};
SalesforcePoller.prototype.pollObject = function (salesForceObject) {
  return this.loadMeta(salesForceObject.name)
    .bind(this)
    .then(function (metaData) {
    return this.queryChanges(metaData, salesForceObject.name);
  })
    .then(function (metaData) {
    return this.saveMeta(metaData, salesForceObject.name);
  });
};
SalesforcePoller.prototype.loadMeta = function (salesForceObjectName) {
  return BBPromise.resolve(this.context.subscription.get(salesForceObjectName.toLowerCase()));
};
SalesforcePoller.prototype.queryChanges = function (metaData, salesForceObjectName) {
  var pollTime = moment();
  var updated;
  var deleted;
  var created;
  var populated;
  if (!metaData) {
    metaData = {
      ids: []
    };
    populated = BBPromise.resolve(this.connector.sobject(salesForceObjectName)
      .find({}))
      .bind(this)
      .then(function (objects) {
      updated = objects;
    });
    created = [];
    deleted = [];
  } else {
    this.logger.info('polled before', salesForceObjectName);
    populated = BBPromise.all([
      BBPromise.resolve(this.connector.sobject(salesForceObjectName)
        .updated(metaData.lastPolled, pollTime.toISOString()))
        .bind(this)
        .then(function (response) {
        updated = _.map(response.ids, function (id) {
          return { Id: id };
        });
      }),
      BBPromise.resolve(this.connector.sobject(salesForceObjectName)
        .deleted(metaData.lastPolled, pollTime.toISOString()))
        .bind(this)
        .then(function (response) {
        this.logger.info('deletes', response);
        deleted = _.map(response.ids, function (id) {
          return { Id: id };
        });
      }),
      BBPromise.resolve(this.connector.sobject(salesForceObjectName)
        .find({
        CreatedDate: { $gte: metaData.lastPolled }
      }))
        .bind(this)
        .then(function (objects) {
        created = objects;
      })
    ]).catch(function (err) {
      this.logger.info('error', err, err.stack);
    });
  }
  return populated
    .bind(this)
    .then(function () {
    this.logger.info(updated, deleted, created);
    return _.map(updated, _.bind(function (update) {
      this.logger.info(salesForceObjectName, 'update');
      return this.processUpdate(salesForceObjectName, update, metaData);
    }, this)).concat(_.map(deleted, _.bind(function (deleted) {
      this.logger.info('processing deletes', deleted);
      return this.processDelete(salesForceObjectName, deleted, metaData);
    }, this))).concat(_.map(created, _.bind(function (create) {
      return this.processCreate(salesForceObjectName, create, metaData);
    }, this)));
  }).then(function (updates) {
    return BBPromise.all(updates);
  }).then(function () {
    metaData.lastPolled = pollTime.toISOString();
    return metaData;
  }).catch(function (err) {
    this.logger.info(err);
  });
};
SalesforcePoller.prototype.processUpdate = function (salesForceObjectName, updateObject, metaData) {
  return BBPromise.try(function () {
    metaData.ids = metaData.ids || [];
    var eventName = this.context.connectorKey + ':modified:' + salesForceObjectName.toLowerCase();
    this.logger.info('eventName', eventName);
    this.emit(eventName, updateObject);
    if (!_.contains(metaData.ids, updateObject.Id)) {
      metaData.ids.push(updateObject.Id);
    }
  }, [], this).catch(function (err) {
    this.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.processCreate = function (salesForceObjectName, createObject, metaData) {
  return BBPromise.try(function () {
    metaData.ids = metaData.ids || [];
    var eventName = this.context.connectorKey + ':new:' + salesForceObjectName.toLowerCase();
    this.emit(eventName, createObject);
    if (!_.contains(metaData.ids, createObject.Id)) {
      metaData.ids.push(createObject.Id);
    }
  },
    [], this).catch(function (err) {
    this.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.processDelete = function (salesForceObjectName, deleteObject, metaData) {
  return BBPromise.try(function () {
    this.logger.info('processing deletes');
    metaData.ids = metaData.ids || [];
    var eventName = this.context.connectorKey + ':deleted:' + salesForceObjectName.toLowerCase();
    this.emit(eventName, deleteObject);
    _.remove(metaData.ids, function (id) {
      return id === deleteObject.Id;
    });
  },
    [], this).catch(function (err) {
    this.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.saveMeta = function (metaData, salesForceObjectName) {
  return this.context.subscription.set(salesForceObjectName.toLowerCase(), metaData);
};
SalesforcePoller.prototype.loadAllObjects = function () {
  this.logger.debug('loading all salesforce objects');

  return BBPromise.resolve(this.connector.describeGlobal())
    .bind(this)
    .then(function (response) {
    return _.filter(response.sobjects, function (sobject) {
      return sobject.queriable;
    });
  });

};

module.exports = function (context, raiseMethod) {
  var poller = new SalesforcePoller(context);
  poller.emit = raiseMethod;
  return poller.pollSubscription();
};
module.exports.cls = SalesforcePoller;