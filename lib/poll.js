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

  this.logger.debug('authorizing connector');
  return this.connector.authorize(this.context.authorization)
    .then(() => {
      this.logger.info('loading all objects');
      return this.loadAllObjects();
    })
    .then((salesforceObjects) => {
      this.logger.info({
        salesforceObjects: salesforceObjects
      }, 'processing objects');
      return _.map(salesforceObjects, (salesForceObject) => {
        this.logger.info({
          salesForceObject: salesForceObject
        }, 'processing object');
        return this.pollObject(salesForceObject);
      });
    }).then((queries) => {
      return BBPromise.all(queries);
    }).catch((err) => {
      this.logger.error(err);
      this.logger.alert("an error occured during polling subscription", {
        original: err.message
      });
    }).finally(() => {
      this.context.subscription.delayTill(moment().add(5, 'minutes').toDate());
    });
};
SalesforcePoller.prototype.pollObject = function (salesForceObject) {
  return this.loadMeta(salesForceObject.name)
    .then((metaData) => {
      return this.queryChanges(metaData, salesForceObject.name);
    })
    .then((metaData) => {
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
    populated = BBPromise.resolve(this.connector.conn.sobject(salesForceObjectName)
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
      .then((response) => {
        updated = _.map(response.ids, function (id) {
          return {
            Id: id
          };
        });
      }),
      BBPromise.resolve(this.connector.sobject(salesForceObjectName)
        .deleted(metaData.lastPolled, pollTime.toISOString()))
      .then((response) => {
        this.logger.info('deletes', response);
        deleted = _.map(response.ids, function (id) {
          return {
            Id: id
          };
        });
      }),
      BBPromise.resolve(this.connector.sobject(salesForceObjectName)
        .find({
          CreatedDate: {
            $gte: new jsforce.Date(moment(metaData.lastPolled).toISOString())
          }
        }))
      .then((objects) => {
        created = objects;
      })
    ]).catch((err) => {
      this.logger.error(err);
      this.logger.alert("error getting created object from salesforce", {
        original: err.message
      });
    });
  }
  return populated
    .then(() => {
      console.log(updated, deleted, created);
      this.logger.info(updated, deleted, created);
      return _.map(updated, (update) => {
        this.logger.info(salesForceObjectName, 'update');
        return this.processUpdate(salesForceObjectName, update, metaData);
      }).concat(_.map(deleted, (d) => {
        this.logger.info('processing deletes', d);
        return this.processDelete(salesForceObjectName, d, metaData);
      })).concat(_.map(created, (create) => {
        return this.processCreate(salesForceObjectName, create, metaData);
      }));
    }).then((updates) => {
      return BBPromise.all(updates);
    }).then(() => {
      metaData.lastPolled = pollTime.toISOString();
      return metaData;
    }).catch((err) => {
      this.logger.info(err);
    });
};
SalesforcePoller.prototype.processUpdate = function (salesForceObjectName, updateObject, metaData) {
  return BBPromise.try(() => {
    metaData.ids = metaData.ids || [];
    var eventName = this.context.connectorKey + ':modified:' + salesForceObjectName.toLowerCase();
    this.logger.info('eventName', eventName);
    this.emit(eventName, updateObject);
    if (!_.includes(metaData.ids, updateObject.Id)) {
      metaData.ids.push(updateObject.Id);
    }
  }).catch((err) => {
    this.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.processCreate = function (salesForceObjectName, createObject, metaData) {
  return BBPromise.try(() => {
    metaData.ids = metaData.ids || [];
    var eventName = this.context.connectorKey + ':new:' + salesForceObjectName.toLowerCase();
    this.emit(eventName, createObject);
    if (!_.includes(metaData.ids, createObject.Id)) {
      metaData.ids.push(createObject.Id);
    }
  }).catch((err) => {
    this.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.processDelete = function (salesForceObjectName, deleteObject, metaData) {
  return BBPromise.try(() => {
    this.logger.info('processing deletes');
    metaData.ids = metaData.ids || [];
    var eventName = this.context.connectorKey + ':deleted:' + salesForceObjectName.toLowerCase();
    this.emit(eventName, deleteObject);
    _.remove(metaData.ids, function (id) {
      return id === deleteObject.Id;
    });
  }).catch((err) => {
    this.logger.info(err, err.stack);
  });
};
SalesforcePoller.prototype.saveMeta = function (metaData, salesForceObjectName) {
  return this.context.subscription.set(salesForceObjectName.toLowerCase(), metaData);
};
SalesforcePoller.prototype.loadAllObjects = function () {
  this.logger.info('loading all salesforce objects');

  return BBPromise.resolve(this.connector.describeGlobal())
    .then((response) => {
      this.logger.info({
        objectCount: response.sobjects.length,
        object1: response.sobjects[0]
      }, 'got response from all salesforce objects');
      return _.filter(response.sobjects, (sobject) => {
        return sobject.queryable &&
          sobject.replicateable &&
          sobject.updateable;
      });
    });

};

module.exports = function (context, raiseMethod) {
  var poller = new SalesforcePoller(context);
  poller.emit = raiseMethod;
  return poller.pollSubscription();
};
module.exports.cls = SalesforcePoller;
