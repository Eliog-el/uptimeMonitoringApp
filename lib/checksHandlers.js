/**
 * Request checksHandlers
 *
 */

// Dependencies
var _data = require('./data');
const handlers = require('./handlers');
var helpers = require('./helpers')
const config = require('../lib/config')

//Define the handler
var checksHandlers = {}

// Checks
checksHandlers.checks = function (data, callback) {
    var acceptableMethods = ["post", "get", "put", "delete"];
    if (acceptableMethods.indexOf(data.method) > -1) {
        checksHandlers._checks[data.method](data, callback);
    } else {
        callback(405);
    }
};

// Container for the checks methods
checksHandlers._checks = {};

/**
 * Checks - post
 * Required data : protocol(http / https), url, method, successCodes, timeoutSeconds
 * Optional data : none
 * 
 */

checksHandlers._checks.post = function (data, callback) {
    // Validate inputs
    var protocol = typeof (data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false
    var method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false
    var timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    if (protocol, url, method, successCodes, timeoutSeconds) {
        // AUTHENTICATED - Get token from the headers
        var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        // Lookup the user by reading the token
        _data.read('tokens', token, function (err, tokenData) {
            if (!err && tokenData) {
                var userPhone = tokenData.phone
                // Lookup user data
                _data.read('users', userPhone, function (err, userData) {
                    if (!err && userData) {
                        var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                        // Verify that the user has less the number of max-check-per-user
                        if (userChecks.length < config.maxChecks) {
                            // Create a random id for the check
                            var checkId = helpers.createRandomString(20)

                            // Create check object, and include the user's phone
                            var checkObject = {
                                'id': checkId,
                                'userPhone': userPhone,
                                'protocol': protocol,
                                'url': url,
                                'method': method,
                                'successCodes': successCodes,
                                'timeoutSeconds': timeoutSeconds
                            };

                            // Save the object
                            _data.create('checks', checkId, checkObject, function (err) {
                                if (!err) {
                                    // Add the chek id to user's object
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    // Save the new user data
                                    _data.update('users', userPhone, userData, function (err) {
                                        if (!err) {
                                            // Return the data about the new check
                                            callback(200, checkObject);
                                        } else {
                                            callback(500, 'Error', 'Could not update the user with the new checks')
                                        }
                                    })
                                } else {
                                    callback(500, { 'Error': 'Could not create new step' })
                                }
                            })
                        } else {
                            callback(400, { 'Error': 'The user already has the maximum number of checks (' + config.maxChecks + ')' });
                        }
                    } else {
                        callback('403', { 'Error': 'Not authorise' })
                    }
                })
            } else {
                callback(403, { 'Error': 'Not authorise' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required inputs, or inputs are invalid' });
    }

}

/**
 * Checks - get
 * Required data : id
 * Optional data : none
 * 
 */
checksHandlers._checks.get = function (data, callback) {
    // Check that the phone number is valid
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false
    if (id) {

        // look up the checks
        _data.read('checks', id, function (err, checkData) {
            if (!err && checkData) {
                //AUTHENTICATION - Get the token from the headers 
                var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
                // Verify that the given token is valid for and belong to the user who created the checks
                handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                    if (tokenIsValid) {
                        // Return the check data
                        callback(200, checkData)
                    } else {
                        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
                    }
                })
            } else {
                callback(404, { 'Error': 'Checks with this id does not exist' })
            }
        })
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
}

/**
 * Checks - put
 * Required data : id
 * Optional data : protocol, url,method, successCode, timeoutSeconds (one must be sent)
 * 
 */
checksHandlers._checks.put = function (data, callback) {
    // Check for the required string
    var id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false

    // Check for the optional field
    var protocol = typeof (data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false
    var method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false
    var timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    if (id) {
        // Checks to make sure one or more optional fields has been sent
        if (protocol || url || method || successCodes || timeoutSeconds) {
            // Lookup the checks
            _data.read('checks', id, function (err, checkData) {
                if (!err && checkData) {

                    //AUTHENTICATION - Get the token from the headers 
                    var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
                    // Verify that the given token is valid for and belong to the user who created the checks
                    handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                        if (tokenIsValid) {
                            // update the check where necessary
                            if (protocol) {
                                checkData.protocol = protocol
                            }
                            if (url) {
                                checkData.url = url
                            }
                            if (method) {
                                checkData.method = method
                            }
                            if (successCodes) {
                                checkData.successCodes = successCodes
                            }
                            if (timeoutSeconds) {
                                checkData.timeoutSeconds = timeoutSeconds
                            }

                            // store the new updates
                            _data.update('checks', id, checkData, function (err) {
                                if (!err) {
                                    callback(200)
                                } else {
                                    callback(500, { 'Error': 'Could not update the check' })
                                }
                            })
                        } else {
                            callback(403, { 'Error': 'Not authorise' })
                        }
                    })

                } else {
                    callback(400, { 'Error': 'Check ID do not exist' })
                }
            })
        } else {

        }
    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
}

/**
 * Checks - delete
 * Required data : id
 * Optional data : None
 * 
 */
checksHandlers._checks.delete = function (data, callback) {
    // Check that the phone number is valid
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 11 ? data.queryStringObject.id.trim() : false
    if (id) {

        // Lookup the check
        _data.read('checks', id, function (err, checkData) {
            if (err && checkData) {

                // AUTHENTICATION - Get the token from the headers 
                var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

                // Verify that the given token is valid for the phone number
                handlers._tokens.verifyToken(token, checkData.userPhone, function (tokenIsValid) {
                    if (tokenIsValid) {

                        // Delete the check data
                        _data.delete('checks', id, function (err) {
                            if (!err) {
                                // Lookup the user
                                _data.read('users', checkData.userPhone, function (err, userData) {
                                    if (!err && userData) {
                                        var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                                        // Remove the delete check from their list of checks
                                        var checkPosition = userChecks.indexOf(id);
                                        if (checkPosition > -1) {
                                            userChecks.splice(checkPosition, 1)
                                            // Re-save the user's data
                                            _data.update('users', checkData.userPhone, userData, function (err) {
                                                if (!err) {
                                                    callback(200, { 'Message': 'Specified user updated' });
                                                } else {
                                                    callback(500, { 'Error': 'Could not update the specified user' });
                                                }
                                            })
                                        } else {
                                            callback(500, { 'Error': 'Could not find the check on the users object, so could not remove it' })
                                        }

                                    } else {
                                        callback(500, { 'Message': "Could not find the user who created the check, so could not remove check from the check from the list of checks on the user object" })
                                    }
                                })
                            } else {
                                callback(500, { 'Error': 'COuld not delete the specified user' })
                            }
                        })
                    } else {
                        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
                    }

                })
            } else {
                callback(400, { 'Error': 'THe specified check ID does not exist ' });

            }
        })

    } else {
        callback(400, { 'Error': 'Missing required field' })
    }
};

module.exports = checksHandlers;
