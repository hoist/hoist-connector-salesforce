/* Just copy and paste this snippet into your code */

module.exports = function (event, done) {

  var salesforce = Hoist.connector('<key>');
  salesforce.authorize().then(function () {
    return salesforce.get('SELECT Id, Name FROM Account');
  }).then(function (result) {
    for (var index = 0; index < result.length; index++) {
      Hoist.event.raise('account:found', result.records[index]);
    }
  });

};