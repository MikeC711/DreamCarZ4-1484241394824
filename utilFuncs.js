// Since this should not run in high volume, he will be somewhat verbose
const util = require('util');
const generalLog = util.debuglog('general'), watsonLog = util.debuglog('watson'), insuranceLog = util.debuglog('insurance'),
    bankLog = util.debuglog('banking'), carLog = util.debuglog('car') ;
const http = require('http'), https = require('https') ; // http/webapp related
const hour = 3600000 ;      // Milliseconds in an hour
const fs = require('fs');   // File related
http.globalAgent.maxSockets = 60 ;
https.globalAgent.maxSockets = 60 ;

var cloudant, dcDealerInventory, dcDealers, dcModels, dcModelOptions ;       // Needed for Cloudant
var bankOptions = {}, sparkCallback, bankBasePath ;
 
var REST_DCDATA = '/api/dreamCarZ', bankTrace = false, insuranceTrace = false, watsonTrace = false, carTrace = false ;
var dayLabel = [ "", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th", "13th", "14th", "15th", "16th", "17th", "18th", "19th", "20th",
                "21st", "22nd", "23rd", "24th", "25th", "26th", "27th", "28th", "29th", "30th", "31st" ] ;
var mthWord = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ] ;
var weekWord = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] ;

/*********************************************************************************************************************************
 Used to determine which Watson attributes weigh into which categories of car/gift combos 
*********************************************************************************************************************************/
var selectionFactors = [ 
    { id : "TruckSUV", gift : "Camping stove and Carhart hat",
        propList : [ "Dutifulness", "Modesty", "Morality", "Activity level" , "Cooperation", "Cautiousness", "Gregariousness", "Altruism",
            "Openness to change", "Hedonism", "Self-enhancement", "Self-transcendence", "Immoderation"] },
    { id : "Luxury", gift : "Bottle of Beaujolais, 1961 + 2 crystal glasses",
        propList : [ "Intellect", "Achievement striving", "Cautiousness", "Structure", "Self-enhancement", "Assertiveness" ] },
    { id : "sportsCar", gift : "2 tickets to indoor skydiving at the No Fear Zone",
        propList : [ "Self-efficacy", "Activity level", "Assertiveness", "Excitement-seeking", "Anger", "Immoderation", "Challenge",
            "Excitement", "Openness to change", "Hedonism", "Self-enhancement" ] },
    { id : "Economy", gift : "Maxine's Lollipop tablet with solar charger",
        propList : [ "Imagination", "Liberalism", "Challenge", "Excitement-seeking", "Immoderation", "Closeness", "Curiosity", "Excitement", "Stability",
            "Structure", "Openness to change", "Intellect", "Cautiousness", "Morality" ] },
    { id : "MiniVan", gift : "Dinner for 2 in private dining room at Chez Nouveau",
        propList : [ "Dutifulness", "Cheerfulness", "Gregariousness", "Cooperation", "Morality", "Cautiousness", "Activity level", "Altruism",
            "Self-efficacy", "Trust", "Conservation", "Intellect" ] }
] ;

// TODO replace getUid with Logon and provide only what is truly needed out of this as Spark has the rest
//  Look at what accounts will add in and what Spark provides
var users = [   { userName : "Stacia", firstName : "Stacia", lastName : "Sielowics", password : "Stacia", age : 38, uid : "4567",
                    bankInfo : {},
                    insuranceInfo : { deductible : 1000, maxCoverage : 300000, numAccidents : 1, gender : "Female", points : 0 },
                    financeHistory : { latePayments : 1, bankruptcies : 0, annualIncome : 140000 } },
                { userName : "Felicia", firstName : "Felicia", lastName : "Markham", password : "Felicia", age : 34, uid : "9111",
                    bankInfo : {},
                    insuranceInfo : { deductible : 2500, maxCoverage : 400000, numAccidents : 1, gender : "Female", points : 0 },
                    financeHistory : { latePayments : 1, bankruptcies : 0, annualIncome : 130000 } },
                { userName : "Susan", firstName : "Susan", lastName : "Cunningham", password : "Susan", age : 38, uid : "5432",
                    bankInfo : {},
                    insuranceInfo : { deductible : 3000, maxCoverage : 500000, numAccidents : 0, gender : "Female", points : 0 },
                    financeHistory : { latePayments : 0, bankruptcies : 0, annualIncome : 130000 } },
            ] ;

var dbCredentials = {   // Only needed for Cloudant case
    dcPersona : 'dc_personas', dcDealerInventory: 'dc_dealerinventory', dcDealers: 'dc_dealers', dcModels: 'dc_models', dcModelOptions: 'dc_modeloptions' };

var watsonInfo = { dfltHost : "gateway.watsonplatform.net", dfltPath : "/personality-insights/api/v2/profile",
    dfltUid : "096226c5-9360-4aa6-85ee-ec57e708175d", dfltPw : "HbBMst8gWV6M" } ;

var sparkOptions = { } ;
var sparkAPIcOptions = { host : "api.us.apiconnect.ibmcloud.com", method : 'GET',
    pathPref : "/mcasileusibmcom-dev/main-api-catalog/DreamCarZSparkInterface/dreamcars/customer/",
//    headers : { 'x-ibm-client-id': '6d922d4d-a8de-4dc3-a9fb-96c5fcd06eda' } } ;
    headers : {accept: 'application/json', 'content-type': 'application/json', 'x-ibm-client-id': '6d922d4d-a8de-4dc3-a9fb-96c5fcd06eda' } } ;

var envInfo = {}, useAPIC = false, bankSparkPath ;

/*********************************************************************************************************************************
 Cloudant connection setup
*********************************************************************************************************************************/
initDBConnection = function () {
    generalLog("UF:initDBConnection Entry DB Conn: head URL: %s", REST_DCDATA) ;
    if(process.env.VCAP_SERVICES) {
        var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
        if(vcapServices.cloudantNoSQLDB) {
            dbCredentials.host = vcapServices.cloudantNoSQLDB[0].credentials.host;
            dbCredentials.port = vcapServices.cloudantNoSQLDB[0].credentials.port;
            dbCredentials.user = vcapServices.cloudantNoSQLDB[0].credentials.username;
            dbCredentials.password = vcapServices.cloudantNoSQLDB[0].credentials.password;
            dbCredentials.url = vcapServices.cloudantNoSQLDB[0].credentials.url;
        }
        if(vcapServices.personality_insights) {
            var wpiCredentials = vcapServices.personality_insights[0].credentials ;
            var uriParts = wpiCredentials.url.split("/") ;
            watsonInfo.dfltHost = uriParts[2] ;
            watsonInfo.dfltPath = uriParts[3] + "/" + uriParts[4] + "/v2/profile" ;
            watsonInfo.dfltUid = wpiCredentials.username ;
            watsonInfo.dfltPw = wpiCredentials.password ;
        }
    }
    envInfo.bankingHost = process.env.bankingHost || "cap-sg-prd-5.integration.ibmcloud.com" ;
    envInfo.bankingPort = process.env.bankingPort || "16953" ;
    bankBasePath = process.env.bankingPath || "/dreamcarzdemo2/" ;
//    envInfo.bankingDir  = process.env.bankingDir  || "sgBank" ;
    envInfo.bankingCertFile = process.env.bankingCertFile || "keys/sgBank/q3XKbfNZep8_e7J_destCert.pem" ;
    envInfo.bankingKeyFile = process.env.bankingKeyFile || "keys/sgBank/q3XKbfNZep8_e7J_destKey.pem" ;
    envInfo.bankSparkHost = process.env.bankSparkHost || "cap-sg-prd-5.integration.ibmcloud.com" ;
    envInfo.bankSparkPort = process.env.bankSparkPort || "16173" ;
    envInfo.bankSparkPath = process.env.bankSparkPath || "/DreamCarZSparkInterface/dreamcars/customer/" ;
    bankSparkPath = envInfo.bankSparkPath ;
    bankOptions = { host : envInfo.bankingHost, port : envInfo.bankingPort, method : 'GET',
        key: fs.readFileSync(envInfo.bankingKeyFile), cert: fs.readFileSync(envInfo.bankingCertFile) } ;
    generalLog("UF: bankOptions host: %s  bankOptions port: %d  certFileNm: %s  keyFileName: %s", bankOptions.host, bankOptions.port, envInfo.bankingCertFile, envInfo.bankingKeyFile) ;
    sparkOptions = { host : envInfo.bankSparkHost, port : envInfo.bankSparkPort, method : 'GET' } ;
    generalLog("UF: sparkOptions %s", JSON.stringify(sparkOptions)) ;
    var traceStr = process.env.NODE_DEBUG ;
    console.log(traceStr);
    bankTrace = (traceStr.indexOf("bank") >= 0) ;
    insuranceTrace = (traceStr.indexOf("insurance") >= 0) ;
    watsonTrace = (traceStr.indexOf("watson") >= 0) ;
    carTrace = (traceStr.indexOf("car") >= 0) ;
    if (watsonTrace)  watsonLog("UF: initDBConn VCAP parm: %s", JSON.stringify(process.env.VCAP_SERVICES)); // Using traceGuard to save cycles
    useAPIC = (process.env.APIConnect) ? true : false ;     // Don't want value in assign, so just existence of var

    cloudant = require('cloudant')(dbCredentials.url);

    dcPersona = cloudant.use(dbCredentials.dcPersona);
    dcUserPersona = cloudant.use(dbCredentials.dcUserPersona);
    dcDealerInventory = cloudant.use(dbCredentials.dcDealerInventory);
    dcDealers = cloudant.use(dbCredentials.dcDealers);
    dcModels = cloudant.use(dbCredentials.dcModels);
    envInfo.dbCredentials = dbCredentials ;   envInfo.watsonInfo = watsonInfo ;  envInfo.bankTrace = bankTrace,
        envInfo.insuranceTrace = insuranceTrace, envInfo.watsonTrace = watsonTrace, envInfo.carTrace = carTrace ;
    return envInfo ;
}

/*********************************************************************************************************************************
 Used to create proper URL components from javaScript data structures
*********************************************************************************************************************************/
objectToQuery = function(map){
    var enc = encodeURIComponent, pairs = [];
    for(var name in map){
        var value = map[name];
        var assign = enc(name) + "=";
        if(value && (value instanceof Array || typeof value == 'array')){
            for(var i = 0, len = value.length; i < len; ++i){
                pairs.push(assign + enc(value[i]));
            }
        }else{
            pairs.push(assign + enc(value));
        }
    }
    return pairs.join("&");
} ;

/*********************************************************************************************************************************
 Watson helpers
*********************************************************************************************************************************
 Apply this property to all appropriate categories
*********************************************************************************************************************************/
applySelection = function(userSelect, propNm, pct) {
    for (var sf = 0; sf < userSelect.length; sf++) {
        var factor = userSelect[sf].selectFactors ;
        var pl = 0 ;
        for (pl = 0; (pl < factor.propList.length && factor.propList[pl] != propNm); pl++) ;
        if (pl < factor.propList.length) {
            userSelect[sf].weight += pct ;
            if (watsonTrace) watsonLog("UF: applySelection Factor: %s pct %d category: %s", propNm, pct, factor.id ) ;
        }
    }
}

/*********************************************************************************************************************************
 Parse thru list of children for this item to apply rules and categorizations
*********************************************************************************************************************************/
weighChildren = function(userSelect, curList, varList) {
    for (var i = 0; i < curList.length; i++) {
        var curObj = curList[i] ;
        var j = 0 ;
        for (j = 0; (j < varList.length && varList[i] != curObj.id); j++) ;
        if (j <= varList.length) {
            applySelection(userSelect, curObj.id, curObj.percentage) ;
        } else {
            generalLog("UF: weighChildren Error with curObj.id: %s", curObj.id) ;
        }
    }
}

/*********************************************************************************************************************************
 Parse thru Watson data
*********************************************************************************************************************************/
weighWatsonAttributes = function(userSelect, wpiJson) {
    var lvl1List = wpiJson.tree.children ;
    for (var i1 = 0; i1 < lvl1List.length; i1++) {
        var lvl1Child = lvl1List[i1] ;
        var lvl2List = lvl1Child.children ;
        switch (lvl1Child.id) {
            case "personality":
                watsonLog("UF: weighWatsonAttribs *****************Under personality****************") ;
                for (var i2 = 0; i2 < lvl2List.length; i2++) {
                    var lvl2Child = lvl2List[i2] ;
                    if (lvl2Child.id != "Conscientiousness_parent" && lvl2Child.id != "Agreeableness_parent" && lvl2Child.id != "Openness_parent") {
                        generalLog("UF:weighWatsonAttribs Invalid personality child of: %s", lvl2Child.id) ;
                    } else {
                        var lvl3List = lvl2Child.children ;
                        for (var i3 = 0; i3 < lvl3List.length; i3++) {
                            var lvl3Child = lvl3List[i3] ;
                            var lvl4List = lvl3Child.children ;
                            switch(lvl3Child.id) {
                                case "Openness":  weighChildren(userSelect, lvl4List,
                                    ["Adventurousness", "Artistic interests", "Emotionality", "Imagination", "Intellect", "Liberalism"]) ; break ;
                                case "Conscientiousness":  weighChildren(userSelect, lvl4List,
                                    ["Achievement striving", "Cautiousness", "Dutifulness", "Orderliness", "Self-discipline", "Self-efficacy"]) ; break ;
                                case "Extraversion": weighChildren(userSelect, lvl4List,
                                    ["Activity level", "Assertiveness", "Cheerfulness", "Excitement-seeking", "Friendliness", "Gregariousness"]) ; break ;
                                case "Agreeableness": weighChildren(userSelect, lvl4List, ["Altruism", "Cooperation", "Modesty", "Morality", "Sympathy", "Trust"]) ; break ;
                                case "Neuroticism":  weighChildren(userSelect, lvl4List, ["Anger", "Anxiety", "Depression", "Immoderation", "Self-consciousness", "Vulnerability"]) ; break ;
                                default: generalLog("UF:weighWatsonAttribs Invalid child: %s", lvl3Cihld.id) ;
                            }
                        }
                    }
                }
                break ;
            case "needs":
                watsonLog("UF:weighWatsonAttribs *****************Under needs****************") ;
                var lvl2Child = lvl2List[0] ;
                var lvl3List = lvl2Child.children ;
                weighChildren(userSelect, lvl3List,
                    ["Challenge", "Closeness, Curiosity", "Excitement, Harmony", "Ideal, Liberty", "Love, Practicality", "Self-expression, Stability", "Structure"]) ; break ;
            case "values":
                watsonLog("UF:weighWatsonAttribs *****************Under values****************") ;
                var lvl2Child = lvl2List[0] ;
                var lvl3List = lvl2Child.children ;
                weighChildren(userSelect, lvl3List, ["Conservation", "Openness to change", "Hedonism", "Self-enhancement", "Self-transcendence"]) ; break ;
            default:  watsonLog("UF:weighWatsonAttribsBad lvl1Child.id of: %s", lvl1Child.id) ;
        }
    }

    if (watsonTrace) {
        for (var sf = 0; sf < userSelect.length; sf++) {
            watsonLog("UF:weighWatsonAttribs Selection: %s  Weight: %d", userSelect[sf].selectFactors.id, userSelect[sf].weight) ;
        }
    }
}

/*********************************************************************************************************************************
 Parse thru Watson data
*********************************************************************************************************************************/
getSelectionStructure = function() {
    userSelect = [] ;
    for (var i = 0; i < selectionFactors.length; i++) userSelect.push({ weight : 0, selectFactors : selectionFactors[i]}) ;        // Shallow copy of R/O factors
    return userSelect ;
}

/*********************************************************************************************************************************
 Parse thru inventory of cars based on search criteria
*********************************************************************************************************************************/
filterCars = function(bodyStyle, minPrice, maxPrice, color, brand, geoLatitude, geoLongitude, minMileage, maxMileage, safetyLevel, limit, callback) {
    var checkGeo = (geoLatitude && geoLongitude) ? true : false, doneInside = false, bodyCount = 0 ;
    generalLog("UF:filterCars Entry limit: %d  checkGeo: %s", limit, checkGeo) ;
    if (!limit)  limit = 50 ;                               // Large number of cars if no limit specified
    if (bodyStyle) {
        bodyStyle = [].concat(bodyStyle) ;          // Treat it as list in all cases
        for (bodyCount = 0; bodyCount < bodyStyle.length; bodyCount++) {        // Until GUI syncs, do mapping here
            switch (bodyStyle[bodyCount]) {
                case "SUV":
                case "Truck":  bodyStyle[bodyCount] = "TruckSUV" ; break ;
                case "Sedan":  bodyStyle[bodyCount] = "Luxury" ; break ;
                case "Hatchback":  bodyStyle[bodyCount] = "Economy" ; break ;
                case "Sport":  bodyStyle[bodyCount] = "SportsCar" ; break ;
                case "Wagon":  bodyStyle[bodyCount] = "MiniVan" ; break ;
            }
            if (carTrace) carLog("UF:FC bodyStyle["+bodyCount+"] = "+bodyStyle[bodyCount]) ;
        }
    }
    var lastModel = "xxx" ;     // Quick way not to get too many of the same model, don't allow 2 in a row
    dcDealerInventory.list({ "include_docs" : true }, function(err, result) {
        if (err) {
            generalLog("UF:filterCars Error in filterCars sent to parent") ;
            callback(err, null) ;
        } else {
            var filter1Results = [], rawCount = 0, filterCount = 0 ;
            if (carTrace) carLog("Number of rows: %d", result.length) ;
            var bodyCnt = 0, minPCnt = 0, maxPCnt = 0, colorCnt = 0, safetyCnt = 0, minMCnt = 0, maxMCnt = 0, brandCnt = 0, dupModCnt = 0 ;
            for (var rIdx = 0; (rIdx < result.rows.length && !doneInside); rIdx++) {
                doc = result.rows[rIdx] ;
                if (doneInside)  return ;       // Quick fix to do nothing for the rest of these rows, better to jump out TODO
                var inDoc = doc.doc, bodyGood = false ; ;
                var debug = false ;
                if (carTrace && ++rawCount % 100 == 0) debug = true ; // hereiam, change this back to 100 TODO
                if (debug) carLog("UF:filterCars 100th row: %d  bodyStyle: %s  bStyleLen: %d doc.bodyStyle: %s  vin: ", rawCount, bodyStyle, bodyStyle.length, inDoc.bodyStyle, inDoc.vin ) ;
                if (!bodyStyle)  bodyGood = true ;
                else {
                    for (bodyCount = 0; (bodyCount < bodyStyle.length && inDoc.bodyStyle != bodyStyle[bodyCount]); bodyCount++) ;
                    if (bodyCount < bodyStyle.length) bodyGood = true ;
                    if (debug) carLog("UF:filterCars: bodyStyleCk: bodyCount: %d  bodyGood: %s", bodyCount, bodyGood) ;
//                    generalLog("UF: MJC: filterCars: inDoc.bodyStyle: %s bodyCount: %d bodyGood: %s", inDoc.bodyStyle, bodyCount, bodyGood) ;
                }
                if (bodyGood) {
                    bodyCnt++ ;
//                    generalLog("UF: MJC: filterCars: Into body good should incr bodyCnt which is now: %d", bodyCnt) ;
                    if (!minPrice || Number(minPrice) <= inDoc.price) {
                        minPCnt++ ;
                        if (debug) carLog("UF:filterCars Thru minPrice id: %s", inDoc.price) ;
                        if (!maxPrice || Number(maxPrice) >= inDoc.price) {
                            maxPCnt++ ;
                            if (!color || color == inDoc.color) {
                                colorCnt++ ;
                                if (debug)  carLog("UF:FilterCars: Thru color id: %s", inDoc.color) ;
                                if (!safetyLevel || safetyLevel <= inDoc.safetyLevel) {
                                    safetyCnt++ ;
                                    if (!minMileage || minMileage <= inDoc.mileage) {
                                        minMCnt++ ;
                                        if (debug)  carLog("UF:FilterCars: FilterCars: Thru minMileage id: %s", inDoc.mileage) ;
                                        if (!maxMileage || maxMileage >= inDoc.mileage) {
                                            maxMCnt++ ;
                                            if (debug)  carLog("UF:FilterCars: FilterCars: Thru maxMileage id: %s", inDoc.mileage) ;
                                            if (!brand || brand == inDoc.brand) {
                                                brandCnt++ ;
                                                if (++filterCount % 20 == 0)  
                                                    if (carTrace) carLog("UF:FilterCars: Filtered 20th: %s", JSON.stringify(inDoc)) ;
                                                if (checkGeo) {
                                                    inDoc.geoDiff = Math.abs(inDoc.geoLatitude - Number(geoLatitude)) + Math.abs(inDoc.geoLongitude - Number(geoLongitude)) ;
                                                }       // Put in a dup-check on model, but that wreaked havoc
                                                filter1Results.push(inDoc) ;
                                                if (debug)  carLog("UF:filterCars: pushed car #: %d", filter1Results.length) ;
                                                if (!checkGeo && filter1Results.length >= limit) {
                                                    generalLog("UF:FilterCars: Hit limit early w/no geoLoc so finishing") ;
                                                    callback(null, filter1Results) ;
                                                    doneInside = true ;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
//            }) ;
            }
            generalLog("UF:MJC:Filter: OrigLen: %d  body: %d  MinPrc: %d  maxPrc: %d  color: %d  saft: %d  minMl: %d  maxMl: %d  brand: %d  dupMod: %d",
                result.rows.length, bodyCnt, minPCnt, maxPCnt, colorCnt, safetyCnt, minMCnt, maxMCnt, brandCnt, dupModCnt) ;
                
            if (geoLatitude) {              // TODO since we don't need full list, a manual insertion type sort with pop may be faster
                filter1Results.sort(function(a, b) {
                    return a.geoDiff - b.geoDiff ;
                }) ;
            }
            if (!doneInside) {
                generalLog("UF:FilterCars: Filtered and got %d rows which limit to %s", filter1Results.length, limit) ;
                callback(null, filter1Results.slice(0, Number(limit))) ;
            }
        }
    }) ;
}

/*********************************************************************************************************************************
 Go thru entire models table and apply the filter criteria to bring back a subset of cars
*********************************************************************************************************************************/
filterModels = function(bodyStyle, safetyLevel, minPrice, maxPrice, colors, callback) {
    generalLog("UF:filterModels Entry minPrice: %d", minPrice) ;
    dcModels.list({ "include_docs" : true }, function(err, result) {
        if (err) {
            generalLog("UF:filterModels Error in filterModels sent to parent") ;
            callback(err, null) ;
        } else {
            var filter1Results = [], rawCount = 0, filterCount = 0 ;
            result.rows.forEach(function(doc) {
                var inDoc = doc.doc, colorCount, bodyCount, bodyGood = false, colorGood = false ;
                if (carTrace && ++rawCount %10 == 0)  carLog("UF:filterModels Doc: %s", JSON.stringify(inDoc)) ;
                if (!safetyLevel || inDoc.safetyLevel >= safetyLevel) {
                    if (!minPrice || inDoc.maxPrice > minPrice) {        // If maxPrice on model > minPrice filter, then minPrice in range
                        if (!maxPrice || inDoc.minPrice < maxPrice) {    // In range
                            if (!bodyStyle)  bodyGood = true ;
                            else {
                                bodyStyle = [].concat(bodyStyle) ;          // Treat it as list in all cases
                                for (bodyCount = 0; (bodyCount < bodyStyle.length && inDoc.bodyStyle != bodyStyle[bodyCount]); bodyCount++) ;
                                if (bodyCount < bodyStyle.length) bodyGood = true ;
                            }
                            if (bodyGood) {
                                if (!colors)  colorGood = true ;
                                else {
                                    colors = [].concat(colors) ;    // Treat it as list in all cases
                                    for (var pCol = 0; (pCol < colors.length && !colorGood); pCol++) {
                                        var rowColor = inDoc.colors ;
                                        for (colorCount = 0; (colorCount < rowColor.length && rowColor[colorCount] != colors[pCol]); colorCount++) ;
                                        if (colorCount < rowColor.length) colorGood = true ;
                                    }
                                }
                                if (colorGood)  filter1Results.push(inDoc) ;
                            }
                        }
                    }
                }
            }) ;
            callback(null, filter1Results) ;
        }
    }) ;
}


/*********************************************************************************************************************************
 Function to handle results is defined separately since called under http for straight to REST and https for APIConnect
                                                                            // Now we know about car type, get price range
*********************************************************************************************************************************/
var handleSparkData = function(sres) {
    var srsltStr = '', dfltResponse = {}, successFlag = true ;
    if (sres.statusCode >= 400) {
        successFlag = false ;
        generalLog("UF:handleSparkData got bad return code: %d  Msg: %s", sres.statusCode, sres.statusMessage);
        dfltResponse = { status : sres.statusCode, statusText : sres.statusMessage } ; 
    }
    if (bankTrace) bankLog("UF:handleSparkData got response in reqGet:status: %d  msg: %s", sres.statusCode, sres.statusMessage); 
    sres.setEncoding('utf8');
    sres.on('data', function(d2) {
        if (successFlag) srsltStr += d2 ;
        else dfltResponse.statusText += d2 ;
    });
    sres.on('end', function() {
        if (successFlag) {
            var jsonData2 = JSON.parse(srsltStr) ;
            if (bankTrace) bankLog("UF:handleSparkData Spark data: %s", JSON.stringify(jsonData2)) ;
            sparkCallback(null, jsonData2) ;
        } else sparkCallback(dfltResponse, null) ;
    })
} ;

/*********************************************************************************************************************************
 Service to use API Connect and retrieve information stored in Spark
*********************************************************************************************************************************/
getFinancialSummary = function(uid, callback) {
    var sparkOpts, reqGet ;
    sparkCallback = callback ;              // Allow common code (handleSparkData) to drive callback (no longer threadSafe?)
    if (useAPIC) {
        sparkOpts = sparkAPIcOptions ;
        sparkOpts.path = sparkAPIcOptions.pathPref+uid ;
        if (bankTrace) bankLog("UF:getFinSumm Spark APIC: options preCall: %s", JSON.stringify(sparkOpts)) ;
        var srsltStr = '', dfltResponse = {}, successFlag = true ;
        reqGet = https.request(sparkOpts, handleSparkData) ;
        reqGet.on('error', function(e3) {
            callback(e3, null) ;
        });
        reqGet.end() ;
    } else {            // Non API Connect
        sparkOpts = sparkOptions ;
        sparkOpts.path = bankSparkPath+uid ;
        if (bankTrace) bankLog("UF:getFinancialSummary Spark http: options preCall: %s", JSON.stringify(sparkOpts)) ;
        reqGet = http.request(sparkOpts, handleSparkData) ;
        reqGet.on('error', function(e3) {
            callback(e3, null) ;
        });
        reqGet.end() ;
    }
} ;

 
/*********************************************************************************************************************************
 Send socialMedia data into Watson, get car type and gift 
*********************************************************************************************************************************/
getWatsonRecommendation = function(geoLatitude, geoLongitude, numLimit, d2iratio, smData, callback) {
    var userSelect = getSelectionStructure() ;    // embed R/O criteria into R/W structure calculating the weights
    if (watsonTrace) watsonLog("UF:getWatsRec Entry Called getWatsonRecommendation: Persona: %s", JSON.stringify(smData));
                                                                // Now prep and call Watson
    socialMediaJson = JSON.stringify({ contentItems : [{ content : smData.Text}]}) ;

    var watsonPIOptions = { host : watsonInfo.dfltHost, method : 'POST', path : watsonInfo.dfltPath, auth : watsonInfo.dfltUid + ":" + watsonInfo.dfltPw,
        headers : { 'Content-Length': socialMediaJson.length,  'Content-Type': 'application/json' } } ;
    if (watsonTrace)
        watsonLog("UF:getWatsRec WPI for uid: %s  Options: %s  DataLen: %d", smData._id, JSON.stringify(watsonPIOptions), socialMediaJson.length) ;
    var successFlag = true ;
    var dfltResponse = { status : 200, statusText : "OK" } ;
    var reqPost = https.request(watsonPIOptions, function(res) {        // Start request to Watson
        var rsltStr = '' ;

        if (res.statusCode >= 400) {
            generalLog("UF:getWatsRec watson Got bad return code: %d  %s", res.statusCode, res.statusMessage);
            successFlag = false ;
            dfltResponse = { status : res.statusCode, statusText : res.statusMessage, persona : smData.persona } ;
        }
        if (watsonTrace)  watsonLog("UF:getWatsRec watson: Got response in reqPost: status: %d  Msg: %s  Hdrs: %s", res.statusCode, res.statusMessage, JSON.stringify(res.headers)); 
        res.setEncoding('utf8');
        res.on('data', function(d) {
            if (successFlag) rsltStr += d ;
            else dfltResponse.statusText += d ;
            if (watsonTrace)  watsonLog("UF:getWatsRec watson Put result with on data function d  %s", d);
        });
        res.on('end', function() {
            if (successFlag) {
                var jsonData = JSON.parse(rsltStr) ;
                jsonData.uid = smData._id ;
                if (watsonTrace)  watsonLog("UF:getWatsRec watson End result jsonData: %s",JSON.stringify(jsonData)) ;     // TODO will first analyze it here and include reasoning
                weighWatsonAttributes(userSelect, jsonData) ;
                userSelect.sort(function(a, b) {
                    return b.weight - a.weight ;
                }) ;
                userSelect[0].persona = smData.persona ;

                var priceFactor = 40 - Number(d2iratio) ;       // This is where we use the Spark stored info to identify a price range
                var minSelect = 15000 + (500 * priceFactor) ;
                var maxSelect = 30000 + (1000 * priceFactor) ;

                filterCars(userSelect[0].selectFactors.id, minSelect, maxSelect, null, null, geoLatitude, geoLongitude, null, null, null, numLimit, function(ferr, fdata) {
                    if (ferr) {
                        generalLog("UF:getWatsRec Error in queryInventory: %s", JSON.stringify(ferr)) ;
                        callback(ferr, null) ;
                    } else {
                        watsonLog("UF:getWatsRec Number of rows from filterCars: %d", fdata.length) ;
                        fdata[0].selectFactors = userSelect[0].selectFactors.propList ;
                        fdata[0].debt2Income = d2iratio ;
                        fdata[0].gift = userSelect[0].selectFactors.gift ;
                            // TODO: userSelect[0] and other factors can be added additionally here.
                        callback(null, fdata) ;
                    }
                }) ;
            }
        })
    });
    reqPost.on('error', function(e) {
        generalLog("UF:getWatsRec watson Got error: %s", e.message);
        callback(e, null) ;
    });
    reqPost.write(socialMediaJson) ;
    reqPost.end() ;
}

/*********************************************************************************************************************************
 Retrieve a dealer by id
*********************************************************************************************************************************/
getDealerFromId = function(id, callback) {
    dcDealers.get(id, function(err, doc) {          // Retrieve a list of personas available for this user
        if (err) {
            generalLog("UF:getDealerFromId  Error retrieving Dealer: %s, Error: %s", id, JSON.stringify(err)) ;
            callback(err, null) ;
        } else {                                        // On success, randomly choose a persona from the list and retrieve
            callback(null, doc) ;
        }
    }) ;
}

/*********************************************************************************************************************************
 Retrieve a dealer by vin
*********************************************************************************************************************************/
getDealerFromVin = function(vin, callback) {
    dcDealerInventory.get(vin, function(err, doc) {
        if (err) {
            generalLog("UF:getDealerFromVin Error retrieving Vehicle vin: %s, Error: %s", vin, JSON.stringify(err)) ;
            callback(err, null) ;
        } else {                                        // On success, randomly choose a persona from the list and retrieve
            dcDealers.get(doc.dealer, function(derr, ddoc) {        // Retrieve a list of personas available for this user
                if (derr) {
                    generalLog("UF:getDealerFromVin Error retrieving Dealer: %s from vin: %s, Error: %s", doc.dealer, vin, JSON.stringify(derr)) ;
                    callback(derr, null) ;
                } else {                                        // On success, randomly choose a persona from the list and retrieve
                    callback(null, ddoc) ;
                }
            }) ;
        }
    }) ;
}

/*********************************************************************************************************************************
 Retrieve a dealer by brand and geoLocation
*********************************************************************************************************************************/
getDealerFromBrandLoc = function(geoLatitude, geoLongitude, brand, limit, callback) {
    dcDealers.list({ "include_docs" : true }, function(err, result) {
        if (err) {              // Ideally, a 2nd index on brand would be used here, but small enough set that perf not crucial
            generalLog("UF:getDealerFromBrandLoc Error in retrieving list of dealers to filter on brand") ;
            callback(err, null) ;
        } else {
            var filter1Results = [], rawCount = 0, filterCount = 0 ;
            result.rows.forEach(function(doc) {
                if (carTrace && rawCount == 0) carLog("UF:getDealerFromBrandLoc DealerRow: %s", JSON.stringify(doc)) ;
                var inDoc = doc.doc ;
                rawCount++ ;
                if (!brand || inDoc.brand == brand) {
                    filterCount++ ;
                    inDoc.geoDiff = Math.abs(inDoc.Latitude - Number(geoLatitude)) + Math.abs(inDoc.Longitude - Number(geoLongitude)) ;
                    filter1Results.push(inDoc) ;
                }
            }) ;
            filter1Results.sort(function(a, b) {
                return a.geoDiff - b.geoDiff;
            }) ;
            callback(null, filter1Results.slice(0, limit)) ;
        }
    }) ;
}

/*********************************************************************************************************************************
 Retrieve info as it is returned async from insurance calls.  Aggregate the data and send back when it is all done.
*********************************************************************************************************************************/
returnInsuranceQuote = function(response, successFlag, jsonData, errObj, dfltResponse, insurerName, companyImage, insMaxCoverage, annualRate,
    loopDone, insQuotes, idx, quoteId ) {
    if (insuranceTrace) insuranceLog('UF:rtnInsQuote Entry: %d  Str: %s', idx, JSON.stringify(jsonData)) ;
    if (successFlag) {
        if (insuranceTrace)  insuranceLog("UF:rtnInsQuote End result: %d  %d  %s", idx, successFlag, (jsonData) ? JSON.stringify(jsonData) : "null" ) ;
        insQuotes[idx] = {quoteId: quoteId, company: insurerName, companyImage: companyImage, limit: insMaxCoverage, payment: annualRate/12,
            explanations: [ "Will add back in explanations later" ]} ;
    } else {
        generalLog("UF:rtnInsQuote ERROR: %d  Sending JSON object: code: %d  and Msg: %s ", idx, dfltResponse.status, dfltResponse.statusText) ;
        insQuotes[idx] = dfltResponse ;
        if (errObj) for (var attrname in errObj) { insQuotes[idx][attrname] = errObj[attrname]; }
    }
    loopDone[idx] = true ;     // Yes, possible race condition here
    var i = 0 ;
    for (i = 0; (i < loopDone.length && loopDone[i]); i++) ;        // See if all true
    if (i >= loopDone.length) {                                     // This was last one to finish
        response.write(JSON.stringify(insQuotes));
        response.end();
    } else {
        insuranceLog('UF:rtnInsQuote completed for: %d  but not all, i: %d  len: %d  0: %s  1: %s  2: %s',  idx, i, loopDone.length, loopDone[0], loopDone[1], loopDone[2]) ;
    }
}

/*********************************************************************************************************************************
 Do the actual https request for the insurance quotes
*********************************************************************************************************************************/
getInsuranceQuote = function(uid, insuranceOpts, pathJson, insurer, callback) {
    generalLog("UF:GetInsQuote: uid: %s", uid, pathJson) ;
    if (insuranceTrace)  insuranceLog("UF:getInsQuote Entry: insurer: %s Opts: %s  pathJson: %s",
        JSON.stringify(insurer), JSON.stringify(insuranceOpts), JSON.stringify(pathJson)) ;
        // trying to create containing block for each call so idx stays constant w/in block
    var successFlag = true ;
    var dfltResponse = { status : 200, statusText : "OK" } ;

    pathJson.COMPANY = insurer.name ;
    var encodeQString = objectToQuery(pathJson) ;
    insuranceOpts.path = "/IMSDreamCar/insquotes1/?"+encodeQString ;
    if (insuranceTrace)  insuranceLog("UF:getInsQuote Making call to IMS, path: %s  Date: %d", insuranceOpts.path, Date.now()) ;
    var reqGet = https.request(insuranceOpts, function(res) {
        if (insuranceTrace)  insuranceLog("UF:getInsQuote Resp from IMS, name: %s Code: %d  path: %s", insurer.name, res.statusCode, insuranceOpts.path) ;
        var rsltStr = '' ;
        if (res.statusCode >= 400) {
            generalLog("UF:getInsQuote for company: %s Got bad return code: %d  Msg: %s", insurer.name, res.statusCode, res.statusMessage);
            successFlag = false ;
            dfltResponse.status = res.statusCode ;
            dfltResponse.statusText = res.statusMessage ;       // TODO make sure this flows thru to the error and see that it hits error
        }
        if (insuranceTrace) insuranceLog("UF:getInsQuote Got response in reqGet: name: %s  status: %d  msg: %s  Hdrs: %s",
            insurer.name, res.statusCode, res.statusMessage,  JSON.stringify(res.headers)); 
        res.setEncoding('utf8');
        res.on('data', function(d) {
            if (successFlag) rsltStr += d ;
            else dfltResponse.statusText += d ;
        });
        res.on('end', function() {
            if (successFlag) {
                var rsltJson = JSON.parse(rsltStr).OUTPUT_MSG ;
                rsltJson.company = insurer.name ;
                callback(null, rsltJson) ;
//                callback(null, JSON.parse(rsltStr).OUTPUT_MSG) ;
            } else callback(dfltResponse, null) ;
        })
    });
    reqGet.on('error', function(e) {
        callback(e, null) ;
        //returnInsuranceQuote(response, false, null, e, dfltResponse, insurerList[iIdx].name, "/svg/placeholder.svg", insMaxCoverage, 0, loopDone, insQuotes, iIdx, -1) ;
    });
    reqGet.end() ;
}


/*********************************************************************************************************************************
 Do the actual https request for the insurance quotes
*********************************************************************************************************************************/
callInsurance = function(insuranceOpts, insurer, insMaxCoverage, callback) {
    insuranceLog("UF:callIns Entry calling IMS, idx: %d  path: %s  Date: %d", iIdx, insuranceOpts.path, Date.now()) ;
        // trying to create containing block for each call so idx stays constant w/in block
    var successFlag = true ;
    var dfltResponse = { status : 200, statusText : "OK" } ;

    var reqGet = https.request(insuranceOpts, function(res) {
        if (insuranceTrace)  insuranceLog("UF:callIns %d resp from IMS, code: %d  path: %s", iIdx, res.statusCode, insuranceOpts.path) ;
        var rsltStr = '' ;
        if (res.statusCode >= 400) {
            generalLog("UF:callIns Got bad return code: %d  Code: %d  Msg: %s", iIdx, res.statusCode, res.statusMessage);
            successFlag = false ;
            dfltResponse.status = res.statusCode ;
            dfltResponse.statusText = res.statusMessage ;       // TODO make sure this flows thru to the error and see that it hits error
        }
        if (insuranceTrace) insuranceLog("UF:callIns Got response in reqGet: %d  status: %d  msg: %s  Hdrs: %s",
            iIdx, res.statusCode, res.statusMessage,  JSON.stringify(res.headers)); 
        res.setEncoding('utf8');
        res.on('data', function(d) {
            if (successFlag) rsltStr += d ;
            else dfltResponse.statusText += d ;
        });
        res.on('end', function() {
            var jsonData = (successFlag) ? JSON.parse(rsltStr).OUTPUT_MSG : null ;
            var annualRate = (jsonData) ? jsonData.COST : 0 ;
            var quoteId = (jsonData) ? jsonData.QUOTEID : (Math.random() * 1000000) ;
            if (insuranceTrace) insuranceLog("UF:callIns OnEnd: %s  success: %s  rsltStr: %s  jsonData: %s", iIdx, successFlag, rsltStr, JSON.stringify(jsonData)) ;
            returnInsuranceQuote(response, successFlag, jsonData, null, dfltResponse, insurerList[iIdx].name, "/svg/placeholder.svg", insMaxCoverage, annualRate,
                loopDone, insQuotes, iIdx, quoteId) ;
        })
    });
    reqGet.on('error', function(e) {
        returnInsuranceQuote(response, false, null, e, dfltResponse, insurerList[iIdx].name, "/svg/placeholder.svg", insMaxCoverage, 0, loopDone, insQuotes, iIdx, -1) ;
    });
    reqGet.end() ;
}

/*********************************************************************************************************************************
 Pull cookies from request
*********************************************************************************************************************************/
parseCookies = function(request) {
    var list = {},
        rc = request.headers.cookie;

    if (bankTrace) bankLog("UF:parseCookies Cookie header: %s", rc) ;
    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = decodeURI(parts.join('='));
    });

    return list;
}

/*********************************************************************************************************************************
 Retrieve a cookie from the cookie list
*********************************************************************************************************************************/
getCookie = function(cookieData, varName) {
    if (bankTrace) bankLog("UF:getCookie with var: %s", varName) ;
    returnVal = (varName in cookieData) ? cookieData[varName] : null ;
}

getDateString = function(cDate) {
    return weekWord[cDate.getDay()]+" "+dayLabel[cDate.getDate()]+" "+mthWord[cDate.getMonth()]+" "+cDate.getFullYear() ;
}

/*********************************************************************************************************************************
 Retrieve times for test drives. Right now just does random
*********************************************************************************************************************************/
getTestDriveTimes = function(vin) {
    var curDate = new Date() ;
    var thisMorning = new Date(curDate.getYear() + 1900, curDate.getMonth(), curDate.getDate(), 8, 0, 0) ;         // 8AM today
    var tomorrowMorn = thisMorning.getTime() + (24 * hour) ;                                                       // 8AM tomorrow
    var rtnDates = [ new Date(tomorrowMorn), new Date(tomorrowMorn + (24 * hour)) ] ;
    var hourOffsets = [ 8, 14 ] ;                                       // 2 days broken into half days

    var hourRandoms = [ (Math.round(Math.random() * 5)), (Math.round(Math.random() * 5)) ] ;
    if (hourRandoms[0] = hourRandoms[1]) hourRandoms[1] += 1 ;
    tomorrowDate = new Date(tomorrowMorn) ;
    nextDate = new Date(tomorrowMorn + (24 * hour)) ;
    var rtnObj =  [ { tdDate : getDateString(tomorrowDate), tdTimes : []}, { tdDate : getDateString(nextDate), tdTimes : []} ] ;
    if (carTrace) carLog("UF: getTestDrTimes vin: "+vin+" curRtn: "+JSON.stringify(rtnObj)+" hourOffLen: "+hourOffsets.length) ;
    for (var dateIdx = 0; dateIdx < rtnObj.length; dateIdx++) {                 // For each date
        for (var slotIdx = 0; slotIdx < hourOffsets.length; slotIdx++) {        // For each time slot in day (morning or afternoon)
            for (var tDriveIdx = 0; tDriveIdx < 2; tDriveIdx++) {               // For each available test drive in the time slot
                var startTm = hourOffsets[slotIdx] + (hourRandoms[tDriveIdx]) ;
                rtnObj[dateIdx].tdTimes.push({ startTime: startTm+":00", endTime : (startTm+1)+":00" }) ;
            }
       }
    }
    for (var i = 0; i < rtnObj.length; i++) {
        rtnObj[i].tdTimes.sort(function(a, b) {
            return a.startTm > b.startTm ;
        }) ;
    }
    return rtnObj ;
}

/*********************************************************************************************************************************
 Take in a text user name and return the associated uid
*********************************************************************************************************************************/
getUserInfo = function(userName, uid) {
    for (var i = 0; i < users.length; i++) {
        if (userName && users[i].userName === userName) return users[i] ;
        if (uid && users[i].uid === uid) return users[i] ;
    }
    return null ;
}

/*********************************************************************************************************************************
 Retrieve online banking type info (account summaries et al) for a given user
*********************************************************************************************************************************/
getAccountData = function(uid, callback) {        // Must have run /user first to stash uid cookie
    var getAccountOpts = bankOptions ;

    getAccountOpts.path = bankBasePath+'accounts/'+uid ;
    bankLog("UF: getAcctData Host: %s  port:  %s  method: %s  Path: %s", getAccountOpts.host, getAccountOpts.port, getAccountOpts.method, getAccountOpts.path) ;
    var successFlag = true ;
    var dfltResponse = { status : 200, statusText : "OK" } ;
    var reqGet = https.request(getAccountOpts, function(res) {
        var rsltStr = '' ;
        if (res.statusCode >= 400) {
            generalLog("UF:GetAccount Got bad return code: %d Msg: %s", res.statusCode, res.statusMessage);
            successFlag = false ;
            dfltResponse.status = res.statusCode ;
            dfltResponse.statusText = res.statusMessage ;       // TODO make sure this flows thru to the error and see that it hits error
        }
        if (bankTrace)  bankLog("UF:getAccount Got response in reqGet: status: %d Msg: %s Headers: %s", res.statusCode, res.statusMessage, JSON.stringify(res.headers)); 
        res.setEncoding('utf8');
        res.on('data', function(d) {
            if (successFlag) rsltStr += d ;
            else dfltResponse.statusText += d ;
        });
        res.on('end', function() {
            if (successFlag) {
                var jsonData = JSON.parse(rsltStr) ;
                if (bankTrace)  bankLog('UF:getAccount Returning: %s' + rsltStr) ;
                callback(null, jsonData) ;
            } else {
                generalLog("UF:getAcctData ERROR: Sending JSON object: code: %d  Msg: %s", dfltResponse.status, dfltResponse.statusText) ;
                callback(dfltResponse, null) ;
            }
        })
    });
    reqGet.on('error', function(e) {
        generalLog("UF:getAccount Got error: %s", e.message);
        callback(e, null) ;
    });
    reqGet.end() ;
}

/*********************************************************************************************************************************
 Retrieve online banking type info (loan summaries et al) for a given user
*********************************************************************************************************************************/
getLoanData = function(uid, callback) {        // Must have run /user first to stash uid cookie
    var getLoanOpts = bankOptions ;

    getLoanOpts.path = bankBasePath+'loans/'+uid ;
    generalLog("UF:getLoan Host: %s  port:  %s  method: %s  Path: %s", getLoanOpts.host, getLoanOpts.port, getLoanOpts.method, getLoanOpts.path) ;
    var successFlag = true ;
    var dfltResponse = { status : 200, statusText : "OK" } ;
    var reqGet = https.request(getLoanOpts, function(res) {
        var rsltStr = '' ;
        if (res.statusCode >= 400) {
            generalLog("UF:GetLoan Got bad return code: %d Msg: %s", res.statusCode, res.statusMessage);
            successFlag = false ;
            dfltResponse.status = res.statusCode ;
            dfltResponse.statusText = res.statusMessage ;       // TODO make sure this flows thru to the error and see that it hits error
        }
        if (bankTrace)  bankLog("UF:getLoan Got response in reqGet: status: %d Msg: %s Headers: %s", res.statusCode, res.statusMessage, JSON.stringify(res.headers)); 
        res.setEncoding('utf8');
        res.on('data', function(d) {
            if (successFlag) rsltStr += d ;
            else dfltResponse.statusText += d ;
        });
        res.on('end', function() {
            if (successFlag) {
                var jsonData = JSON.parse(rsltStr) ;
                if (bankTrace)  bankLog('UF:getLoan Returning: %s' + rsltStr) ;
                callback(null, jsonData) ;
            } else {
                generalLog("UF:getLoan ERROR: Sending JSON object: code: %d  Msg: %s", dfltResponse.status, dfltResponse.statusText) ;
                callback(dfltResponse, null) ;
            }
        })
    });
    reqGet.on('error', function(e) {
        generalLog("UF:getLoan Got error: %s", e.message);
        callback(e, null) ;
    });
    reqGet.end() ;
}

function showTestDrive(){

    alert("CAHOOT");
}

            // TODO: Do lowGeo which takes list and limit and keeps limit rows w/lowest geoDiff (faster than sort of all)
/*********************************************************************************************************************************
 If we want to have emulation if IMS is not working,, this does the basic job, probably needs some tweaking
*********************************************************************************************************************************/
/*    var insQuotes = insurerList.map(function(insurer) {
        var insBase = 0, insAdjust = 0, explanations = [] ;
        insBase = totalCost * 1 * insurer.baseRt * 1 ;
        explanations.push("Base is: "+insBase+" based on total dream car cost of: "+totalCost) ;
        if (licensePts > 0) {
            insAdjust = insBase * licensePts * insurer.ptAdj ;         // 5% added per license point
            explanations.push("Increased base by: "+insurer.ptAdj+" for each of your: "+licensePts+" license points") ;
        }
        if (driverAge < 21) {
            insAdjust += insBase * insurer.ythAdj ;                                     // 10% youthful driver surcharge
            explanations.push("Increased base by: "+insurer.ythAdj+" for youthful driver surcharge") ;
        }
        if (driverGender === "male") {
            insAdjust += insBase * insurer.maleAdj ;                                    // 5% male surcharge
            explanations.push("Increased base by: "+insurer.maleAdj+" because you're a guy") ;
        }
        if (numAccidents > 0) {
            insAdjust += insBase * numAccidents * insurer.accAdj ;        // 15% surcharge per accident
            explanations.push("Increased base by: "+insurer.accAdj+" for each of your: "+numAccidents+" accidents") ;
        }
        var deductExtra = insDeduct - 2500 ;            // Positive or negative based on your level of deduction
        insAdjust -= deductExtra * insurer.deductAdj ;  // Higher number = lower rate, so we use minus
        explanations.push("Changed base because deductible was: "+deductExtra+" different than base") ;

        var extraCoverage = insMaxCoverage - 300000 ;   // Amount of coverage higher or lower
        insAdjust += extraCoverage * insurer.maxAdj ;
        explanations.push("Changed base because maxCoverage was: "+extraCoverage+" different than norm") ;

            // { quoteId: "372814563", company: "Nimbus Insurance", companyImage: "/svg/placeholder.svg", limit: "$300,000 limit per accident", payment: "$35 per month" },
        console.log("insurance quote: insurer: "+insurer.name+" Rate: "+(insBase + insAdjust)+" BaseRate: "+insBase) ;
        return ({quoteId: (Math.random() * 1000000), company: insurer.name, companyImage: "/svg/placeholder.svg", limit: insMaxCoverage, payment: ((insBase + insAdjust)/12),
            explanations: explanations}) ;
    }) ;
    response.write(JSON.stringify(insQuotes)) ;
    response.end() ; */

module.exports = {
    filterCars,
    filterModels,
    getAccountData,
    getCookie,
    getDealerFromBrandLoc,
    getDealerFromId,
    getDealerFromVin, 
    getFinancialSummary,
    getInsuranceQuote,
    getLoanData,
    getTestDriveTimes ,
    getUserInfo,
    getWatsonRecommendation,
    initDBConnection,
    parseCookies
};      // End of module exports

