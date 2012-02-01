var db_io = require('./db.io.js'),
    keg_io = require('./keg.io.js'),
    protocol = require('../libs/protocol.js'),
    web_io = require('./web.io.js'),
    logger,
    keg,
    isDebug,
    devicePath,
    currentKeg,
    currentDrinker,
    lastDrinker,
    isUserEntry;

exports.start = function(loggerInstance, deviceInstance, isDebugInstance, socketsInstance) {
    logger = loggerInstance;
    device = deviceInstance;
    isDebug = isDebugInstance;
    db_io.start(_continueSetup, loggerInstance);
    web_io.start(socketsInstance, loggerInstance, this);
};

function _continueSetup(error) {
    if(error == undefined) {
        // Setup keg handlers
        keg = new this.keg_io.Keg();
        keg.init(this.devicePath, this.isDebug, this.logger);

        keg.addEventlistener(protocol.FLOW, _handleFlow);
        keg.addEventListener(protocol.TEMP, _handleTemp);
        keg.addEventListener(protocol.TAG, _handleTag);
        keg.addEventListener(protocol.POUR, _handlePour);

        // Populate variables
        db_io.getCurrentKeg(function(keg) {
            currentKeg = keg;
        });

        db_io.getLastDrinker(function(user) {
            lastDrinker = user;
        });
    }
}

function _handleFlow(flow) {
    web_io.updateFlow(flow);
}

function _handleTemp(temp) {
    // Store status if currentKeg exists
    if(currentKeg != undefined) {
        var status = new Object();
        status.kegId = currentKeg.id;
        status.amount = currentKeg.amount;
        status.temperature = temp;
        db_io.createKegStatus(status, function() {} );
    }
    web_io.updateTemperature(temp);
}

function _handleTag(tag) {

    if(isUserEntry) {
        var user = new Object();
        user.name = "";
        user.title = "";
        user.tag = tag;
        db_io.createUser(tag, function() {} );
    } else {
        // Get user
        db_io.getUserByRFID(tag, function(user) {
            if(user != undefined) {
                // If valid
                // Store as currentDrinker
                currentDrinker = user;
                keg.openValve();
                web_io.welcomeUser(user);
            } else {
                web_io.denyUser();
            }
        });
    }
}

function _handlePour(pour) {
    // Store pour
    var record = new Object();
    record.kegId = currentKeg.id;
    record.amount = pour;
    record.userId = currentDrinker.id;
    db_io.createKegPour(record, function(error) {
        if(error == undefined) {
            _checkPour(pour, function() {
                lastDrinker = currentDrinker;
                currentDrinker = null;
                web_io.updateStats();
            });
        }
    } );
}

function _checkPour(pour, callback) {
    callback();
}