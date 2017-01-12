//utilities
var intUtil = require('./util') ;

// For simple mapping (root level), this is not called
exports.mapComplex = function (data, key, newKey, delim) {
    var val2Move = intUtil.removeVal(data, key, delim) ;        // Remove value from old position and retrieve it
    intUtil.addVal(data, newKey, val2Move, delim) ;             // Add it to new position
} ;

exports.mapNames = function (data, replList, addList) {            // For all replacements and additions
    var delim1 = "??" ;                                 // Delimiter for multiPart name is ??
    for (var key in replList) {                         // For each key to replace
        var rKey = String(replList[key]) ;              // Get the replacement key value
        if (key.indexOf(delim1) > -1 || rKey.indexOf(delim1) > -1) intUtil.mapComplex(data, key, rKey, delim1) ;
        else {                      // If complex key or repl key, call mapComplex, otherwise just do it quickly here
            data[rKey] = data[key] ;                    // Move value of old key to new key location
            delete data[key] ;                          // Delete value from old location
        }
    }
    for (key in addList) {                              // For each added value, just add it
        intUtil.addVal(data, key, addList[key], delim1) ;
    }
}

