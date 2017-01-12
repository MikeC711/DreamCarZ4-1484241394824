/*
 * Module dependencies.
 */

var express = require('express'), http = require('http'), https = require('https') ; // http/webapp related
genModel = require('./genModel'), utilFuncs = require('./utilFuncs') ;       // local javaScript helpers
var compression = require('compression') ;      // image related
var path = require('path'), fs = require('fs') ;     // File IO related
const forceSSL = require('express-force-ssl');
const util = require('util');
const cookieParser = require('cookie-parser');
// Logging is horizontal, not vertical. generalLog should always be on.  If banking, insurance, car, or watson are on ... those are considered to be at trace level
//  So all errors/warnings go to general regardless of context. Anything other than general used for trace only.
//  Some high level summary trace can go to general as well
const watsonLog = util.debuglog('watson'), bankLog = util.debuglog('banking'), insuranceLog = util.debuglog('insurance'),
    generalLog = util.debuglog('general'), carLog = util.debuglog('car') ;

var app = express();

// Cloudant needs 
var dcPersona, dcDealerInventory, cloudant;

var restPrefix, restHost = "cap-sg-stage-1.integration.ibmcloud.com", restPort = "15397", dcDebug = false, mainCall = {} ;
var dfltHttpHeaders = { "Connection" : "keep-alive", "Accept" : "application/json" } ; // Not used yet

var REST_DCDATA = '/api/dreamCarZ' ;
// Not used due to complexity of returns, but left here because base logic works
// var logonPairs = { firstname : 'FirstName', lastlogin : 'LastLogin' } ;

var insurerList = [ {id: 1, name: "GreatRates.com", baseRt: .08, ptAdj: .06, ythAdj: .09, maleAdj: .04, accAdj: .15, deductAdj: .11, maxAdj: .0011 }, 
                    {id: 2, name: "InsuranceNow.com", baseRt: .085, ptAdj: .05, ythAdj: .1, maleAdj: .05, accAdj: .15, deductAdj: .1, maxAdj: .001  }, 
                    {id: 3, name: "YRiskIt", baseRt: .09, ptAdj: .05, ythAdj: .1, maleAdj: .06, accAdj: .12, deductAdj: .12, maxAdj: .0012  }] ;

var lenderList = [ {name: "Service Oriented Finance", baseRt: 5, estAdj: .5, bnkruptAdj: 2, pmtAdj: .5, highbalAdj: 1.5, noDepositAdj: 1, incomeAdj: 1, termAdj : .014 }, 
                   {name: "Friendly Bank", baseRt: 5.5, estAdj: .7, bnkruptAdj: 1.5, pmtAdj: .4, highbalAdj: .1, noDepositAdj: .75, incomeAdj: .75, termAdj : .012  }, 
                   {name: "Nimbus Bank", baseRt: 5.25, estAdj: 1, bnkruptAdj: 1, pmtAdj: .3, highbalAdj: 1.25, noDepositAdj: .5, incomeAdj: .5, termAdj : .010  }] ;

watsonLog("App:Logging on for watson") ; bankLog("App: Logging on for banking") ; insuranceLog("App: Logging on for insurance") ;
generalLog("App: Logging on for general, bankTrace: %s  insurancetrace: %s   watsonTrace: %s  carTrace: %s", bankTrace, insuranceTrace, watsonTrace, carTrace) ;

app.use(compression());
app.use(function(req, res, next) {
    if(req.connection.localAddress === "::1" || req.connection.localAddress.startsWith("127.0.0.")) {
        next();
    } else {
        forceSSL(req, res, next);
    }
});
app.use(cookieParser());

// host/port/tls info for each touchPoint
var insuranceHost = "cap-sg-prd-3.integration.ibmcloud.com", insurancePort = "18274", insuranceDir = "sgInsurance", insUid = "SJBEAN", insPw = "work4ibm" ;

// http/https options for the touchPoints
var insuranceOptions = { host : insuranceHost, port : insurancePort, method : 'GET', 
    headers : { 'Authorization': 'Basic ' + new Buffer( insUid + ':' + insPw).toString('base64')  } } ;
// all environments
app.set('port', process.env.PORT || 3000);
app.set('forceSSLOptions', {
  trustXFPHeader: true
});

/* app.use(function(req, res, next) {
    if(req.path === '/login.html') {
        if ('userName' in req.cookies) {
            res.redirect('/interstitial.html');
            return;
        }
    } else if (!(new RegExp('(.*(css|jpg|js|png|svg)|('+REST_DCDATA+'/.*))').test(req.path))) {
        if (!('userName' in req.cookies)) {
            res.redirect('/login.html');
            return;
        }
    }
    next();
}); */
app.use(express.static(path.join(__dirname, 'public')));

var envInfo = utilFuncs.initDBConnection();
var dbCredentials = envInfo.dbCredentials, watsonInfo = envInfo.watsonInfo, bankTrace = envInfo.bankTrace, insuranceTrace = envInfo.insuranceTrace,
    watsonTrace = envInfo.watsonTrace, carTrace = envInfo.carTrace ;
// TODO: Clean up un-needed/reFactored code. ie: I don't think watsonInfo is needed in here anymore
// TODO: Add in get gift (which is in cookies)

cloudant = require('cloudant')(dbCredentials.url);
dcDealerInventory = cloudant.use(dbCredentials.dcDealerInventory);
dcPersona = cloudant.use(dbCredentials.dcPersona);
genModel.setEnvironment(dbCredentials) ;

/*********************************************************************************************************************************
 User related functions
 *********************************************************************************************************************************
 Log a user in and stash user info into cookies (if we get more than 2 cookies, will create a session state
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/user', function(request, response) {    // This handles list and logon depending on if userid is sent
    var userName = request.query.username ;
    generalLog("App:getUser: Users userid: %s  url: %s", userName, request.url) ;
    var userInfo = utilFuncs.getUserInfo(userName, null) ;
    generalLog("App:getUser: Users userid: %s  uid: %d   url: %s", userName, userInfo.uid, request.url) ;
    response.setHeader('Set-Cookie', ['userName='+userName+'; path=/; domain='+request.hostname, 'uid='+userInfo.uid+'; path=/; domain='+request.hostname]) ;
    response.write(JSON.stringify({statusCode : 200, userMessage : "", userName : userName, uid : userInfo.uid})) ;
    response.end() ;
}) ;

app.get(REST_DCDATA + '/userInfo', function(request, response) {    // This handles list and logon depending on if userid is sent
    var userName = request.cookies.userName ;
    var userInfo = utilFuncs.getUserInfo(userName, null) ;
    generalLog("App:getUserInfo: Users userid: %s  uid: %d   url: %s", userName, userInfo.uid, request.url) ;
    response.write(JSON.stringify({statusCode : 200, userMessage : "", userInfo : userInfo})) ;
    response.end() ;
}) ;

/*********************************************************************************************************************************
 Retrieve info from Spark to see if this customer should receive any special offers
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/financialSummary', function(request, response) {
    var cookieList = utilFuncs.parseCookies(request) ;
    var uid = cookieList["uid"] ;
    var userInfo = utilFuncs.getUserInfo(null, uid) ;

    generalLog("App: financialSummary Retrieving fincialSummary (generated by Spark) for uid: %s", uid) ;
    utilFuncs.getFinancialSummary(uid, function(err, doc) {
        if (err) {
            generalLog("App:financialSummary Error getting financial data from Spark: %s", JSON.stringify(err)) ;
            response.write(JSON.stringify(err)) ;
        } else {          
            if (bankTrace)  bankLog("App:financialSummary retrieved JSON: %s", JSON.stringify(doc)) ;
            userInfo.bankInfo.sparkData = doc ;
            response.write(JSON.stringify(doc)) ;
        }
        response.end() ;
    }) ;
}) ;
 

/*********************************************************************************************************************************
 Miscellaneous, in this case, load the data
 *********************************************************************************************************************************
 Load all data. Takes data in genModel and generates the dealers and their inventory, also stored model info and a few other insundries
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/loadData', function(request, response) {
    generalLog("App:loadData: loading data") ;
    genModel.loadData() ;
    response.write(JSON.stringify({statusCode: 200, message : "Back I think" })) ;
    response.end() ;
});


/*********************************************************************************************************************************
 Car/Dealer selection related functions
 *********************************************************************************************************************************
 Form Watson call and call Watson for analysis on that. Also call to get the Spark data and use it for price work
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/recommendation', function(request, response) {      // To test this, must do /user first to stash cookie
    var geoLatitude = request.query.geolatitude ;
    var geoLongitude = request.query.geolongitude ;
    var limit = request.query.limit ;
    var d2iratio = request.query.d2iratio ;
    var numLimit = (limit) ? Number(limit) : 1 ;

    var cookieList = utilFuncs.parseCookies(request) ;
    var uid = cookieList["uid"] ;
    generalLog("App:recom: : user: %s  geoLat: %s  geoLong: %s  limit: %s  d2iratio %s", uid, geoLatitude, geoLongitude, limit, d2iratio) ;

    dcPersona.get(uid, function(err, doc) {          // Retrieve a list of personas available for this user
        if (err) {
            generalLog("App:recom Error retrieving Persona data: %s", JSON.stringify(err)) ;
            response.write("Persona Error: " + err)
            response.end();
        } else {                                        // On success, randomly choose a persona from the list and retrieve
            utilFuncs.getWatsonRecommendation(geoLatitude, geoLongitude, numLimit, d2iratio, doc, function(ferr, fdata) {
                if (ferr) {
                    generalLog("App:recom Error back from getWatsonRecommendation: %s", JSON.stringify(ferr)) ;
                    response.write(JSON.stringify(ferr)) ;
                    response.end() ;
                } else {
                    if (watsonTrace) watsonLog("App:recom successful recommendation of: %s", JSON.stringify(fdata)) ;
                    response.setHeader('Set-Cookie', ['gift='+fdata[0].gift+'; path=/; domain='+request.hostname]) ;
                    response.write(JSON.stringify(fdata)) ;
                    response.end() ;
                }
            }) ;
        }
    });
}) ;

/*********************************************************************************************************************************
 Retrieve models matching the filter criteria and return them (new version, uses Cloudant)
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/modelsc', function(request, response) {
    var bodyStyle = request.query.bodystyles || [] ;
    var safetyLevel = request.query.safetylevel ;
    var minPrice = request.query.minprice || 0 ;
    var maxPrice = request.query.maxprice || Infinity ;
    var colors = request.query.colors || [] ;
    generalLog("App:modelsc models Method:  %s  URL: %s  bodyStyle %s  safetyLvl: %s  minPrice: %s  maxPrice: %s  colors: %s",
        request.method, request.url, bodyStyle, safetyLevel, minPrice, maxPrice, JSON.stringify(colors)) ;
    var modelList = utilFuncs.filterModels(bodyStyle, safetyLevel, minPrice, maxPrice, colors, function(err, doc) {
        if (err) {
            generalLog("App:modelsc Error handling models, err is: %s", JSON.stringify(err)) ;
            response.write(JSON.stringify(err)) ;
        } else {
            response.write(JSON.stringify(doc)) ;
        }
        response.end() ;
    }) ;
}) ;

/*********************************************************************************************************************************
 This queries the inventory data which is stored in Cloudant (new version of what was /cars)
   TODO: Should take in statusnew, statusold
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/queryInventory', function(request, response) {
    var bodyStyle = request.query.bodystyle ;
    var minPrice = request.query.minprice ;
    var maxPrice = request.query.maxprice ;
    var color = request.query.color ;
    var brand = request.query.brand ;
    var geoLatitude = request.query.geolatitude ;
    var geoLongitude = request.query.geolongitude ;
    var safetyLevel = request.query.safetylevel ;
    var minMileage = request.query.minmileage ;
    var maxMileage = request.query.maxmileage ;
    if (maxMileage == "Infinity")  maxMileage = 999999999 ;
    var limit = request.query.limit ;
    var numLimit = (limit) ? Number(limit) : 1 ;
    generalLog("App:queryInventory w/bodyStyle: %s  minPrice: %s  maxPrice: %s  color: %s, brand: %s, geoLat: %s  geoLong: %s  limit: %d",
        bodyStyle, minPrice, maxPrice, color, brand, geoLatitude, geoLongitude, numLimit) ;
    generalLog("App:queryInventory w/safety: %s  minMileage: %s  maxMileage: %s", safetyLevel, minMileage, maxMileage) ;
    utilFuncs.filterCars(bodyStyle, minPrice, maxPrice, color, brand, geoLatitude, geoLongitude, minMileage, maxMileage, safetyLevel, numLimit, function(err, data) {
        if (err) {
            generalLog("App:queryInventory Error in queryInventory: %s", JSON.stringify(err)) ;
            response.write(JSON.stringify(err)) ;
        } else {
            generalLog("App:queryInventory Number of rows: %d", data.length) ;
            response.write(JSON.stringify(data)) ;
        }
        response.end() ;
    }) ;
}) ;

/*********************************************************************************************************************************
 Retrieve a dealer by id, vin (ie: dealer where that vin is located) or by geoLocation and brand
 (ie: dealer of that brand closest to that geoLocation)
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/dealerc', function(request, response) {
    var vin = request.query.vin, dealerID = request.query.id ;
    generalLog("App:dealerc method: %s  URL: %s  vin: %s  dealerId: %s", request.method, request.url, vin, dealerID) ;
    if (dealerID) {
        utilFuncs.getDealerFromId(dealerID, function(err, data) {
            if (err) {
                generalLog("App:dealerc Failed to get dealer: id: %s  Err: %s", dealerID, JSON.stringify(err)) ;
                response.write(JSON.stringify(err)) ;
                response.end() ;
            } else {
                response.write(JSON.stringify(data)) ;
                response.end() ;
            }
        }) ;
    } else {
        if (vin) {
            utilFuncs.getDealerFromVin(vin, function(err, data) {
                if (err) {
                    generalLog("App:dealerc Failed to get dealer from vin: %s  Err: %s", vin, JSON.stringify(err)) ;
                    response.write(JSON.stringify(err)) ;
                    response.end() ;
                } else {
                    response.write(JSON.stringify(data)) ;
                    response.end() ;
                }
            }) ;
        } else {
            var latitude = request.query.latitude, longitude = request.query.longitude, brand = request.query.brand ;
            generalLog("App:dealerc geoLat: %s  geoLong: %s  brand: %s", latitude, longitude, brand) ;
            if (latitude && longitude && brand) {
                utilFuncs.getDealerFromBrandLoc(latitude, longitude, brand, 4, function(err, data) {
                    if (err) {
                        generalLog("App:dealerc Failed to get dealer from brand: %s  latitude: %s  longitude: %s Err: %s",
                            brand, latitude, longitude, JSON.stringify(err)) ;
                        response.write(JSON.stringify(err)) ;
                        response.end() ;
                    } else {
                        response.write(JSON.stringify(data)) ;
                        response.end() ;
                    }
                }) ;
            } else {
                response.write(JSON.stringify({statusCode : 404, statusMessage : "No ID or VIN or Brand Location passed in, cannot proceed"})) ;
                response.end() ;
            }
        }
    }
}) ;

/*********************************************************************************************************************************
 Return the schedule of next available test drive times
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/testdrive', function(request, response) {
    var vin = request.query.vin ;
    var returnSlots = utilFuncs.getTestDriveTimes(vin) ;
    generalLog("App: Rtn from UF: %s", JSON.stringify(returnSlots)) ;
    if (returnSlots) {
        response.write(JSON.stringify(returnSlots)) ;
    } else {
        response.write(JSON.stringify({ statusCode : 100, errorMessage : "No slots available or error: " })) ;
    }
    response.end();
});

/*********************************************************************************************************************************
 Having fielded the requests and retrieved data from CICS, generate loan quotes
*********************************************************************************************************************************/
getLoanQuotes = function(response, totalCost, downPayment, loanTerm, uid, userInfo) {
    var loanAmount = totalCost - downPayment ;
    if (loanTerm < 24)  loanTerm *= 12 ;        // Not sure if they're passing years or months, but this should handle either
    bankLog("App:getLoanQuotes w/uinfo: %s", JSON.stringify(userInfo)) ;
    var financeHistory = userInfo.financeHistory ;
    var bankQuotes = lenderList.map(function(lender) {
        var intRate = lender.baseRt, loanAmt = totalCost, explanations = [] ;
        explanations.push("Base rate is: "+intRate) ;

        if (financeHistory.bankruptcies > 0) {
            intRate += financeHistory.bankruptcies * lender.bnkruptAdj ;                          // Add for bankruptcies
            explanations.push("Increasing rate by: "+lender.bnkruptAdj+" for each of your: "+financeHistory.bankruptcies+" bankruptcies") ;
        }
        if (financeHistory.latePayments > 0) {
            intRate += financeHistory.latePayments * lender.pmtAdj ;                               // Add for missed or late payments
            explanations.push("Increasing rate by: "+lender.pmtAdj+" for each of your: "+financeHistory.latePayments+" missed or late payments") ;
        }
        if (financeHistory.depositTotal > totalCost) {
            intRate -= lender.highbalAdj ;                                              // High amount on deposit = loan rate decrease
            explanations.push("Decreasing rate by: "+lender.highbalAdj+" due to high deposit balance of: "+financeHistory.depositTotal) ;
        }
        if (financeHistory.loanTotal > 500000) {
            intRate += lender.highbalAdj ;                                              // High amount on loan = loan rate increase
            explanations.push("Increasing rate by: "+lender.highbalAdj+" due to high loan balance of: "+financeHistory.loanTotal) ;
        }
        if (downPayment > financeHistory.depositTotal) {                    // Not enough for downPayment
            intRate += lender.noDepositAdj ;
            explanations.push("Increasing rate by: "+lender.noDepositAdj+" due to insufficient funds for a "+downPayment+" downPayment") ;
        }
        if (financeHistory.annualIncome > 100000) {
            intRate -= lender.incomeAdj ;                                           // Lower rate for higher income
            explanations.push("Decreasing rate by: "+lender.incomeAdj+" due to high annual income of: "+financeHistory.annualIncome) ;
        }
        if (financeHistory.annualIncome < 20000) {
            intRate += lender.incomeAdj ;
            explanations.push("Increasing rate by: "+lender.incomeAdj+" due to modest annual income of: "+financeHistory.annualIncome) ;
        }
        var mthsFromBase = loanTerm - 48 ;
        intRate += mthsFromBase * lender.termAdj ;
        explanations.push("Changing rate by: "+lender.termAdj+" for each month great or lesser than normal 48 month term: "+mthsFromBase) ;

        var mthlyInterest = (loanAmount * intRate / 1200) ;
        var totInterestPaid = mthlyInterest * loanTerm * .8 ;       // No big calculation just take some off for payment as you go
        var monthlyPayment = (loanAmount + totInterestPaid) / loanTerm ;
        generalLog("App:getLoanQuotes: comp: %s  interest: %s  Pmt: %s  LoanAmt: %s  Term: %s  Cost: %s  DownPmt: %s", 
            lender.name, intRate, monthlyPayment, loanAmount, loanTerm, totalCost, downPayment) ;
        return {quoteId: (Math.random() * 1000000), company: lender.name, companyImage: "/svg/placeholder.svg", interest: intRate.toFixed(2), payment: monthlyPayment.toFixed(2),
            loanAmount : loanAmount, explanations: explanations} ;
    }) ;

    response.write(JSON.stringify(bankQuotes)) ;
    response.end() ;
}

/*********************************************************************************************************************************
 Loan and insurance section
 *********************************************************************************************************************************
  Retrieve information for all deposit accounts
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/depositAccounts', function(request, response) {
    var cookieList = utilFuncs.parseCookies(request) ;
    var uid = cookieList["uid"] ;
    var userInfo = utilFuncs.getUserInfo(null, uid) ;

    utilFuncs.getAccountData(uid, function(err, doc) {
        if (err) {
            generalLog("App:depositAccts Error getting account data: %s", JSON.stringify(err)) ;
            userInfo.bankInfo.depositAccts = [ { acctNum : uid * 100 + 1, acctType : 's', acctBal : 100 } ] ;
            response.write(JSON.stringify(err)) ;
            response.end() ;
        } else {          
            response.write(JSON.stringify(doc)) ;
            response.end() ;        // Send results, but also summarize them up here

            userInfo.bankInfo.depositAccts = [ ] ;
            userInfo.financeHistory.depositTotal = 0 ;
            var acctArray = doc.ACCOUNTSOperationResponse.account_summary_area.account_summary_table.AccSummaryDetails ;
            for (var i = 0; i < acctArray.length; i++) {
                if (acctArray[i].AccID > 0) {
                    userInfo.bankInfo.depositAccts.push({acctNum : acctArray[i].AccID, acctType : acctArray[i].AccType, acctBal : acctArray[i].Balance }) ;
                    userInfo.financeHistory.depositTotal += acctArray[i].Balance ;
                }
            }
            if (bankTrace) bankLog("App:depositAccts Post getAccounts finalUserInfo: %s", JSON.stringify(userInfo)) ;
        }
    }) ;
});

/*********************************************************************************************************************************
  Retrieve information for all loan accounts
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/loanAccounts', function(request, response) {
    var cookieList = utilFuncs.parseCookies(request) ;
    var uid = cookieList["uid"] ;
    var userInfo = utilFuncs.getUserInfo(null, uid) ;

    utilFuncs.getLoanData(uid, function(err, doc) {
        if (err) {
            generalLog("App:loanAccts Error getting loan data: %s", JSON.stringify(err)) ;
            userInfo.bankInfo.loanAccts = [ { acctNum : uid * 100 + 11, acctType : 'm', acctBal : 250000 } ] ;
            response.write(JSON.stringify(err)) ;
            response.end() ;
        } else {          
            response.write(JSON.stringify(doc)) ;
            response.end() ;        // Send results, but also summarize them up here

            userInfo.bankInfo.loanAccts = [ ] ;
            userInfo.financeHistory.loanTotal = 0 ;
            var loanArray = doc.CBLOANOperationResponse.loan_summary_area.loan_summary_table.LoanSummaryDetails ;
            for (var i = 0; i < loanArray.length; i++) {
                if (loanArray[i].LAccID > 0) {
                    userInfo.bankInfo.loanAccts.push({acctNum : loanArray[i].LAccID, acctType : loanArray[i].LoanType, acctBal : loanArray[i].LBalance }) ;
                    userInfo.financeHistory.loanTotal += loanArray[i].LBalance ;
                }
            }
            if (bankTrace) bankLog("App:loanAccts Post loanAccounts finalUserInfo: %s", JSON.stringify(userInfo)) ;
        }
    }) ;
});

/*********************************************************************************************************************************
 Get financing quotes
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/loanquotes', function(request, response) {
    var totalCost = request.query.totalCost ;           // Pull info from query string
    var downPayment = request.query.downPayment ;
    var loanTerm = request.query.loanTerm;

    var cookieList = utilFuncs.parseCookies(request) ;
    var uid = cookieList["uid"] ;

    var restReturns = 0, neededReturns = 2, loanQuotes ;
    var userInfo = utilFuncs.getUserInfo(null, uid) ;

    generalLog("App: loanquotes LQ: TC: %s  DownPmt: %s  loanTerm: %s  bankruptcies: %d  BadPmts: %d",
        totalCost, downPayment, loanTerm, userInfo.financeHistory.bankruptcies, userInfo.financeHistory.latePayments) ;
    loanQuotes = getLoanQuotes(response, totalCost, downPayment, loanTerm, uid, userInfo) ;
});

/*********************************************************************************************************************************
 Get list of potential insurers
   deprecated ??
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/insuranceList', function(request, response) {
    var returnList = [] ;
    insuranceLog("App:insuranceList Num Insurers: %d", insurerList.length) ;
    for (var insIdx = 0; insIdx < insurerList.length; insIdx++) {
        returnList.push({id: insurerList[insIdx].id, company: insurerList[insIdx].name}) ;
    }
    response.write(JSON.stringify(returnList)) ;
    response.end() ;
});

/*********************************************************************************************************************************
 Get insurance quotes from the insurers in the list
 For now, we are only using this locally as we are having an SGI/zCEE comms problem getting this to run
*********************************************************************************************************************************/
/* app.get(REST_DCDATA + '/insurance', function(request, response) {
    var totalCost = request.query.totalCost ;
    var insDeduct = request.query.deductible ;
    var insMaxCoverage = request.query.maxCoverage ;

    var cookieList = utilFuncs.parseCookies(request) ;      // Get uid cookie
    var uid = cookieList["uid"] ;
    var userInfo = utilFuncs.getUserInfo(null, uid) ;

    var restReturns = 0, neededReturns = insurerList.length, insQuotes = [] ;

    if (!insDeduct)  insDeduct = userInfo.insuranceInfo.deductible ;
    if (!insMaxCoverage)  insMaxCoverage = userInfo.insuranceInfo.maxCoverage ;

    var pathJson = { AGE : userInfo.age, GENDER : userInfo.insuranceInfo.gender.substring(0,1), NUMBEROFACCIDENTS : userInfo.insuranceInfo.numAccidents,
        LICENSEPOINTS : userInfo.insuranceInfo.points, CARBASECOST : totalCost, INSDEDUCT : insDeduct, INSLIMIT : insMaxCoverage } ;

    insuranceLog("App:insurance Called insurance: tCost: %s licensePts: %s  driverAge: %s  driverGender: %s  numAcc: %s  insDeduct: %s  insMaxCov: %s",
        totalCost, userInfo.insuranceInfo.points, userInfo.age, userInfo.insuranceInfo.gender, userInfo.insuranceInfo.numAccidents, insDeduct, insMaxCoverage) ;

    if (insuranceTrace)  insuranceLog("App:Insurance options: %s insurerList: %s", JSON.stringify(insuranceOptions), JSON.stringify(insurerList)) ;
    for (var iIdx = 0; iIdx < insurerList.length; iIdx++) {
        var waitTime= iIdx * 1000 ;
        utilFuncs.getInsuranceQuote(uid, insuranceOptions, pathJson, insurerList[iIdx], function(err, doc) {
            if (err) {
                bankLog("App:insurance Error getting account data: %s", JSON.stringify(err)) ;
            } else {          
                insQuotes.push(doc) ;
            }
            if (++restReturns >= neededReturns)
                response.write(JSON.stringify(insQuotes)) ;
        }) ;
    }
}) ;  */


/*********************************************************************************************************************************
 Temporary internal insurance quote while IMS concurrency issue is resolved (could be Secure Gateway)
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/insurance', function(request, response) {
    var totalCost = request.query.totalCost ;
    var insDeduct = request.query.deductible ;
    var insMaxCoverage = request.query.maxCoverage ;

    var cookieList = utilFuncs.parseCookies(request) ;      // Get uid cookie
    var uid = cookieList["uid"] ;
    var userInfo = utilFuncs.getUserInfo(null, uid) ;

    var restReturns = 0, neededReturns = insurerList.length, insQuotes = [] ;

    if (!insDeduct)  insDeduct = userInfo.insuranceInfo.deductible ;
    if (!insMaxCoverage)  insMaxCoverage = userInfo.insuranceInfo.maxCoverage ;

/*********************************************************************************************************************************
 Temporarily doing emulated IMS for India conference
*********************************************************************************************************************************/
    var insQuotes = insurerList.map(function(insurer) {
        var insBase = 0, insAdjust = 0, explanations = [] ;
        insBase = totalCost * 1 * insurer.baseRt * 1 ;
        explanations.push("Base is: "+insBase+" based on total dream car cost of: "+totalCost) ;
        if (userInfo.insuranceInfo.points > 0) {
            insAdjust = insBase * userInfo.insuranceInfo.points * insurer.ptAdj ;         // 5% added per license point
            explanations.push("Increased base by: "+insurer.ptAdj+" for each of your: "+userInfo.insuranceInfo.points+" license points") ;
        }
        if (userInfo.age < 21) {
            insAdjust += insBase * insurer.ythAdj ;                                     // 10% youthful driver surcharge
            explanations.push("Increased base by: "+insurer.ythAdj+" for youthful driver surcharge") ;
        }
        if (userInfo.insuranceInfo.gender === "male") {
            insAdjust += insBase * insurer.maleAdj ;                                    // 5% male surcharge
            explanations.push("Increased base by: "+insurer.maleAdj+" because you're a guy") ;
        }
        if (userInfo.insuranceInfo.numAccidents > 0) {
            insAdjust += insBase * userInfo.insuranceInfo.numAccidents * insurer.accAdj ;        // 15% surcharge per accident
            explanations.push("Increased base by: "+insurer.accAdj+" for each of your: "+userInfo.insuranceInfo.numAccidents+" accidents") ;
        }
        var deductExtra = insDeduct - 2500 ;            // Positive or negative based on your level of deduction
        insAdjust -= deductExtra * insurer.deductAdj ;  // Higher number = lower rate, so we use minus
        explanations.push("Changed base because deductible was: "+deductExtra+" different than base") ;

        var extraCoverage = insMaxCoverage - 300000 ;   // Amount of coverage higher or lower
        insAdjust += extraCoverage * insurer.maxAdj ;
        explanations.push("Changed base because maxCoverage was: "+extraCoverage+" different than norm") ;

        console.log("insurance quote: insurer: "+insurer.name+" Rate: "+(insBase + insAdjust)+" BaseRate: "+insBase) ;
        return ({quoteId: (Math.random() * 1000000), company: insurer.name, companyImage: "/svg/placeholder.svg", limit: insMaxCoverage, payment: ((insBase + insAdjust)/12),
            explanations: explanations}) ;
    }) ;
    response.write(JSON.stringify(insQuotes)) ;
    response.end() ;
}) ;

/*********************************************************************************************************************************
 Gift associated with personality
*********************************************************************************************************************************/
app.get(REST_DCDATA + '/gift', function(request, response) {
    var cookieList = utilFuncs.parseCookies(request) ;
    var gift = cookieList["gift"] ;

    if (!gift)  gift = "Bottle of Beaujolais, 1961 + 2 crystal glasses" ;       // Not provided otherwise at this point, so this is truly an error

    response.write(JSON.stringify({ statusCode : 200, statusText : "", gift : gift })) ;
    response.end() ;
});


/*********************************************************************************************************************************
 Start the express appServer going
*********************************************************************************************************************************/
http.createServer(app).listen(app.get('port'), function() {
    generalLog('App:createServer Express server listening on port %s', app.get('port'));
});

