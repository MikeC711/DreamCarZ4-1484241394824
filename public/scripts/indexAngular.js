// indexAngular.js
// create our angular app and inject ngAnimate and ui-router 
// =============================================================================
var REST_DCDATA = '/api/dreamCarZ';
const mthArr = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ] ;

// TODO: Consider https and need for a trustStore for self-signed cert
// TODO: For now, client functions containable in here, future is to find out how to expand out of here and still have Angular environment/features
// TODO: Look at minifying for production
// TODO: Calendar function and mapping function for TestDrive screen
// TODO: Figure out why some of the dealer lookups not working (Cloudant)
// TODO: Pretty up lots of the screens (grow picture on nextBest)
// TODO: Make loan quote and insurance quote calls.  With data now known, I don't think loan call goes past node
// TODO: Clean up explainData ... look at a widget to expand a complex object iteratively
var app = angular.module('DreamCarZApp', ['ngAnimate', 'ui.router', 'ngMaterial']) ;

app.factory("GeolocationService", ['$q', '$window', '$rootScope', function ($q, $window, $rootScope) {
    return function () {
        var deferred = $q.defer();

        if (!$window.navigator) {
            $rootScope.$apply(function() {
                deferred.reject(new Error("Geolocation is not supported"));
            });
        } else {
            $window.navigator.geolocation.getCurrentPosition(function (position) {
                $rootScope.$apply(function() {
                    deferred.resolve(position);
                });
            }, function (error) {
                $rootScope.$apply(function() {
                    deferred.reject(error);
                });
            });
        }
        return deferred.promise;
    }
}]);


// configuring our routes 
// =============================================================================
app.config(function($stateProvider, $urlRouterProvider) {
    
    $stateProvider
    
        // route to show our basic form (/form)
        .state('form', {
            url: '/form',
            templateUrl: 'form.html',
            controller: 'formController'
        })
        
        // nested states 
        // each of these sections will have their own view
        // url will be nested (/form/profile)
        .state('form.loginScreen', {
            url: '/loginScreen',
            templateUrl: 'form-loginScreen.html'
        })
        
        // url will be /form/nextBestAction
        .state('form.nextBestAction', {
            url: '/nextBestAction',
            templateUrl: 'form-nextBestAction.html'
        })
        
        // url will be /form/cars
        .state('form.carsAndFilters', {
            url: '/cars',
            templateUrl: 'form-cars.html'
        })
        
        // url will be /form/testDrive
        .state('form.testDrive', {
            url: '/testDrive',
            templateUrl: 'form-testDrive.html'
        })
        
        // url will be /form/loans
        .state('form.getLoan', {
            url: '/loans',
            templateUrl: 'form-loans.html'
        })
        
        // url will be /form/insurance
        .state('form.getInsurance', {
            url: '/insurance',
            templateUrl: 'form-insurance.html'
        })
        
        // url will be /form/reviewProcess
        .state('form.reviewProcess', {
            url: '/reviewProcess',
            templateUrl: 'form-reviewProcess.html'
        })
        
        // url will be /form/congrats
        .state('form.congratsScreen', {
            url: '/congrats',
            templateUrl: 'form-congrats.html'
        });
        
    // catch all route
    // send users to the form page 
    $urlRouterProvider.otherwise('/form/loginScreen');
})

// our controller for the form
// =============================================================================
app.controller('formController', ['$scope', '$log', '$http', 'GeolocationService', function($scope, $log, $http, geolocation) {

    // TODO: Look at removing explainData in favor of actionArr

    $scope.getEl = function(key) {
        for (var j = 0; j < $scope.breadCrumbs.length; j++) {
            if ($scope.breadCrumbs[j].key == key)  return $scope.breadCrumbs[j] ;
        }
    }

    $scope.formData = {}; $scope.explainData = {}; $scope.userInfo = {} ; $scope.financeData = {} ; $scope.accountData = {} ;
    $scope.loanData = {} ; $scope.carData = {} ; $scope.insuranceData = {} ; $scope.showBreadCrumbs = false ;  $scope.breadCrumbCount = 0 ;
        // Set up as an array of objects containing an array for best ng-repeat functionality
    $scope.breadCrumbs = [ { key : "watson", descrip : "Watson Personality Insights", count : 0, active : false, actionArr : [] },
        { key : "ims", descrip : "IMS", count : 0, active : false, gExpand : false, actionArr : [] },
        { key : "spark", descrip : "Spark on z/OS", count : 0, active : false, gExpand : false, actionArr : [] },
        { key : "cics", descrip : "CICS", count : 0, active : false, gExpand : false, actionArr : [] },
        { key : "zcee", descrip : "z/OS Connect", count : 0, active : false, gExpand : false, actionArr : [] },
        { key : "apic", descrip : "API Connect", count : 0, active : false, gExpand : false, actionArr : [] },
        { key : "liberty", descrip : "Liberty z/OS", count : 0, active : false, gExpand : false, actionArr : [] },
        { key : "general", descrip : "Other components", count : 0, active : false, gExpand : false, actionArr : [] }
        ] ;

    $scope.bcEls = {} ;     // Immediate refs to the internal arrays for quicker access to populate
    $scope.bcEls.ims = $scope.getEl("ims") ; $scope.bcEls.spark = $scope.getEl("spark") ; $scope.bcEls.watson = $scope.getEl("watson") ;
    $scope.bcEls.cics = $scope.getEl("cics") ; $scope.bcEls.zcee = $scope.getEl("zcee") ; $scope.bcEls.apic = $scope.getEl("apic") ;
    $scope.bcEls.liberty = $scope.getEl("liberty") ; $scope.bcEls.general = $scope.getEl("general") ;

    $scope.explainData.geoPosition = {} ; $scope.explainData.curStatMsg = "Determining gelocation...";


// =============================================================================
// If geoLocation available, retrieve and store it
// =============================================================================
    geolocation().then(function (position) {
        $scope.userInfo.latitude = position.coords.latitude ;
        $scope.userInfo.longitude = position.coords.longitude ;
        $scope.explainData.geoPosition.latitude = position.coords.latitude ;        // For explanations
        $scope.explainData.geoPosition.longitude = position.coords.longitude ;
        $scope.explainData.curStatMsg = "Got geoLocation" ;
        $log.info("Retrieved GeoLocation latitude: "+ position.coords.latitude +" longitude: "+position.coords.longitude) ;
        $scope.geoOK = true ;
        $scope.bcEls.general.count++ ; $scope.breadCrumbCount++ ;
        $scope.bcEls.general.actionArr.push($scope.breadCrumbCount+" Retrieved GeoLocation using mobile or browser or APIs: latitude: "+$scope.userInfo.latitude+
            " and longitude: "+$scope.userInfo.longitude ) ;
        if ($scope.financeOK) $scope.carRecommendations() ;       // If GeoLocation and finance ready, call for recommendation
    }, function (reason) {
        $scope.explainData.curStatMsg = "GeLocation could not be determined."
    });
$scope.date = '...';
$scope.time = '...';
// =============================================================================
// Handle the test drive
// =============================================================================
    $scope.showTestDrive = function(date,starttime) {
        $scope.carData.testDriveDate = date;
        $scope.carData.testDriveTime = starttime;
        $scope.date = date;
        $scope.time = starttime;
        //alert('Great, we will see you at: '+$scope.carData.curDealer.name+" at: "+$scope.carData.testDriveStart) ;
    };

     
// =========================================================================================================================================================
// Log the user in and retrieve the financial information to identify a next best offer is available.  If so, retrieve the current account info as well
// =========================================================================================================================================================
    $scope.userLogin = function() {
        // TODO: Could clear active states here
        $scope.explainData.curStatMsg = "Starting login."
        $http.get(REST_DCDATA+ '/user?username='+$scope.userInfo.username)
            .success(function(result) {
                $scope.userInfo.uid = result.uid ;
                $scope.bcEls.general.count++ ; $scope.breadCrumbCount++ ;
                $scope.bcEls.general.actionArr.push($scope.breadCrumbCount+" Called server and logged in: userName: "+$scope.userInfo.username+
                    " internal uid: "+$scope.userInfo.uid ) ;

        // =====================================================================================================================================
                $http.get(REST_DCDATA+ '/financialSummary')     // If logged in OK, see if they qualify for  a next best offer
                    .success(function(fsresult) {
                        $scope.financeData = fsresult ;
                        $scope.bcEls.apic.count++ ; $scope.breadCrumbCount++ ;
                        $scope.bcEls.apic.actionArr.push($scope.breadCrumbCount+" Used API Connect to call Liberty to access DB2 info stored after Spark analysis") ;
                        $scope.bcEls.liberty.count++ ; $scope.breadCrumbCount++ ;
                        $scope.bcEls.liberty.actionArr.push($scope.breadCrumbCount+" Drove a REST entry into Liberty on z/OS (this instance in CICS) to retrieve Spark analytics data") ;
                        $scope.bcEls.spark.count++ ; $scope.breadCrumbCount++ ;
                        $scope.bcEls.spark.actionArr.push($scope.breadCrumbCount+" Retrieved Spark Data: debt2Asset : "+fsresult.customer.d2aratio+" , debt2Income: "+
                            fsresult.customer.d2iratio+" , carLoanBal : "+fsresult.customer.clcurbl+" If debt2Income < 10 ... then automobile offer makes sense" ) ;
                                                            // This is crucial test to see if they are eligible for offer based on financial status
                        if ($scope.financeData.customer.d2iratio < 10)   return ;
                        $scope.financeOK = true ;
                        if ($scope.geoOK) $scope.carRecommendations() ;       // If finance and geoLocation OK, call for recommendation

            // =================================================================================================================================
                        $http.get(REST_DCDATA+ '/depositAccounts')     // Knowing that they qualify ... start gathering key info asynchronously
                            .success(function(daresult) {
                                $scope.accountData = daresult.ACCOUNTSOperationResponse.account_summary_area ;
                                $scope.accountData.totalBal = 0 ;
                                var i = 0, acctArray = $scope.accountData.account_summary_table.AccSummaryDetails ;
                                for (i = 0; (i < acctArray.length && acctArray[i].AccID > 0); i++) $scope.accountData.totalBal += acctArray[i].Balance ;
                                $scope.accountData.account_summary_table.AccSummaryDetails = acctArray.slice(0, $scope.accountData.AccountCount) ;
                                $scope.bcEls.zcee.count++ ; $scope.breadCrumbCount++ ;
                                $scope.bcEls.zcee.actionArr.push($scope.breadCrumbCount+" z/OS Connect driven (via REST) to call CICS (could also have been IMS)"+
                                    " to retrieve banking deposit accounts") ;
                                $scope.bcEls.cics.count++ ; $scope.breadCrumbCount++ ;
                                $scope.bcEls.cics.actionArr.push($scope.breadCrumbCount+" Called CICS for DepositInfo: Number of Accts: "+acctArray.length+
                                    " Sum of balance in all deposit accounts: "+ $scope.accountData.totalBal+"<b>Account Data details: "+
                                    JSON.stringify($scope.accountData.account_summary_table.AccSummaryDetails) ) ;
                                $scope.explainData.depositAccts = $scope.accountData;
                            }) .error(function(dadata, dastatus) {
                                $log.error("Error with retrieving deposit account info: status: "+dastatus+" Data: "+dadata.toString()) ;
                                $scope.explainData.curStatMsg = "Error retreiving deposit account info: "+dastatus ;
                            })

            // =================================================================================================================================
                        $http.get(REST_DCDATA+ '/loanAccounts')     // Knowing that they qualify ... start gathering key info asynchronously
                            .success(function(laresult) {
                                $scope.loanData = laresult.CBLOANOperationResponse.loan_summary_area ;
                                $scope.explainData.curStatMsg = "Retrieved loan account information" ;
                                $scope.loanData.totalBal = 0 ;
                                var i = 0, loanArray = $scope.loanData.loan_summary_table.LoanSummaryDetails ;
                                for (i = 0; (i < loanArray.length && loanArray[i].LAccID > 0); i++) $scope.loanData.totalBal += loanArray[i].LBalance ;
                                $scope.loanData.loan_summary_table.LoanSummaryDetails = loanArray.slice(0, $scope.loanData.LoanCount) ;
                                $scope.bcEls.zcee.count++ ; $scope.breadCrumbCount++ ;
                                $scope.bcEls.zcee.actionArr.push($scope.breadCrumbCount+" z/OS Connect driven (via REST) to call CICS (could also have been IMS)"+
                                    " to retrieve banking loan accounts") ;
                                $scope.bcEls.cics.count++ ; $scope.breadCrumbCount++ ;
                                $scope.bcEls.cics.actionArr.push($scope.breadCrumbCount+" Called CICS for LoanInfo: Number of Accts: "+loanArray.length+
                                    " Sum of balance in all loan accounts: "+ $scope.loanData.totalBal+"<b>Loan Data details: "+
                                    JSON.stringify($scope.loanData.loan_summary_table.LoanSummaryDetails) ) ;

                                $scope.explainData.loanAccts = $scope.loanData ;
                            }) .error(function(ladata, lastatus) {
                                $log.error("Error with retrieving loan account info: status: "+lastatus+" Data: "+ladata.toString()) ;
                                $scope.explainData.curStatMsg = "Error retreiving deposit account info: "+lastatus ;
                            })

                    }) .error(function(fsdata, fsstatus) {
                        $log.error("Error w/ retrieving financial summary info: status: "+status+" Data: "+fsdata.toString()) ;
                        $scope.explainData.curStatMsg = "Error retrieving financial summary data: "+fsstatus ;
                    })
            }) .error(function(uldata, status) {
                $log.error("Error with Login: status: "+status+" Data: "+uldata.toString()) ;
                $scope.explainData.curStatMsg = "Error Logging in: "+status ;
            })
    } ;
    
// =========================================================================================================================================================
// With current information, get top recommendations, and get some cool sportscars and SUVs for the display
// =========================================================================================================================================================
    $scope.carRecommendations = function() {
        $scope.explainData.curStatMsg = "Getting vehicle recommendation."
        $log.info("Called recommend w/userInfo: "+JSON.stringify($scope.userInfo)) ;
        $http.get(REST_DCDATA+ '/recommendation?geolatitude='+$scope.userInfo.latitude+'&geolongitude='+$scope.userInfo.longitude+
            '&limit=2&d2iratio='+$scope.financeData.customer.d2iratio)
            .success(function(result) {
            // TODO: Figure out how to parse and what to do with this and query output
                $scope.explainData.curStatMsg = "Successfully retrieved recommendations based on Watson et al" ;
                $scope.carData.recommendList = result ;
                $scope.carData.gift = result[0].gift ;
                $scope.bcEls.watson.count++ ; $scope.breadCrumbCount++ ;
                    // TODO: Have call be NOT dependent on GPS, have it select type(s) and have it return high attributes and types selected
                $scope.bcEls.watson.actionArr.push($scope.breadCrumbCount+" Used Cloudant stored social media data to drive Watson Personality Insights to"+
                    " identify several options for a vehicle for this person based on their personality type") ;    
                $scope.bcEls.spark.count++ ; $scope.breadCrumbCount++ ;
                $scope.bcEls.spark.actionArr.push($scope.breadCrumbCount+" Used Spark retrieved data to help identify a price range for the model selected (Spark"+
                    " and Watson working together)") ;
                $scope.bcEls.general.count++ ; $scope.breadCrumbCount++ ;
                $scope.bcEls.general.actionArr.push($scope.breadCrumbCount+" Along with Watson and Spark on z/OS ... we also use GPS info to find and ideal car close to home") ;

                $scope.explainData.recommendOut = result ;
            }) .error(function(data, status) {
                $log.error("Error retrieving recommendation: status: "+status+" Data: "+data.toString()) ;
                $scope.explainData.curStatMsg = "Error getting recommendation: "+status ;
            }) 


        $http.get(REST_DCDATA+ '/queryInventory?geolatitude='+$scope.userInfo.latitude+'&geolongitude='+$scope.userInfo.longitude+
            '&limit=6&bodystyle=TruckSUV&bodystyle=Luxury&bodystyle=SportsCar&minprice=35000')
            .success(function(qresult) {
                $scope.explainData.curStatMsg = "Successfully retrieved query results" ;
                $scope.explainData.queryOut = qresult ;
                $scope.carData.queryList = qresult ;

                $scope.bcEls.general.count++ ; $scope.breadCrumbCount++ ;
                $scope.bcEls.general.actionArr.push($scope.breadCrumbCount+" Along with cognitive/Analytics to find right car, also used GPS to find additional selection"+
                    " of great cars nearby") ;

                $scope.carData.qRow1 = qresult.slice(0,3) ;
                $scope.carData.qRow2 = qresult.slice(3,6) ;
            }) .error(function(qdata, qstatus) {
                $log.error("Error with query of inventory: status: "+qstatus+" Data: "+JSON.stringify(qdata)) ;
                $scope.explainData.curStatMsg = "Error querying inventory: "+qstatus ;
            })

    } ;

// =========================================================================================================================================================
// Get loan quotes now that key info is known
// =========================================================================================================================================================
    $scope.getLoanQuotes = function() {
        $http.get(REST_DCDATA+ '/loanQuotes?totalCost='+$scope.carData.curCar.price+"&downPayment="+$scope.loanData.loanTerms.downPmt+"&loanTerm="+$scope.loanData.loanTerms.loanTerm)
            .success(function(result) {
                $scope.loanData.quotes = result ;
                $scope.bcEls.cics.count++ ; $scope.breadCrumbCount++ ;
                $scope.bcEls.cics.actionArr.push($scope.breadCrumbCount+" Called out for loan quotes to various banks ... could be on CICS or IMS as they are behind z/OS Connect") ;
                $scope.bcEls.ims.count++ ; $scope.breadCrumbCount++ ;
                $scope.bcEls.ims.actionArr.push($scope.breadCrumbCount+" Called out for loan quotes to various banks ... could be on IMS or CICS as they are behind z/OS Connect") ;
                $log.debug("JSON loanQuote result: "+JSON.stringify(result)) ;
            }) .error(function(data, status) {
                $log.error("Error getting loan quotes: status: "+status+" Data: "+data.toString()) ;
                $scope.explainData.curStatMsg = "Error retrieving loan quotes: "+status ;
            })
    } ;

    $scope.saveLoan = function(loanIdx) {
        $scope.loanData.curLoan = $scope.loanData.quotes[loanIdx] ;
        $log.debug("SaveLoan new curLoan: "+JSON.stringify($scope.loanData.curLoan)) ;
    } ;

// =========================================================================================================================================================
// Get loan quotes now that key info is known
// =========================================================================================================================================================
    $scope.getInsuranceQuotes = function() {
        $log.info("InsQuotes w/currentLoan info: "+JSON.stringify($scope.loanData.curLoan)) ;
        $http.get(REST_DCDATA+ '/userInfo')
            .success(function(uinfo) {
                $log.debug("JSON userInfo result1: "+JSON.stringify(uinfo)) ;
                $scope.userInfo.insuranceInfo = uinfo.userInfo.insuranceInfo ;
                $log.debug("JSON userInfo result: "+JSON.stringify($scope.userInfo.insuranceInfo)) ;

                $http.get(REST_DCDATA+ '/insurance?totalCost='+$scope.carData.curCar.price+"&deductible="+
                    $scope.userInfo.insuranceInfo.deductible+"&maxCoverage="+$scope.userInfo.insuranceInfo.maxCoverage)
                    .success(function(result) {
                        $scope.insuranceData.quotes = result ;
                        $scope.bcEls.ims.count++ ; $scope.breadCrumbCount++ ;
                        $scope.bcEls.ims.actionArr.push($scope.breadCrumbCount+" Called out for insurance quotes to various insurance companies ... could be on IMS or"+
                            " CICS as they are behind z/OS Connect") ;
                        $log.debug("JSON insuranceQuote result: "+JSON.stringify($scope.insuranceData.quotes)) ;
                    }) .error(function(data, status) {
                        $log.error("Error getting loan quotes: status: "+status+" Data: "+data.toString()) ;
                        $scope.explainData.curStatMsg = "Error retrieving loan quotes: "+status ;
                    })

            }) .error(function(data, status) {
                $log.error("Error getting user information: status: "+status+" Data: "+data.toString()) ;
                $scope.explainData.curStatMsg = "Error retrieving insurance quotes: "+status ;
            })

    } ;

    $scope.saveInsurance= function(insuranceIdx) {
        $scope.insuranceData.curInsurance = $scope.insuranceData.quotes[insuranceIdx] ;
        $log.debug("SaveInsurance new curInsurance : "+JSON.stringify($scope.insuranceData.curInsurance)) ;
    } ;


// =========================================================================================================================================================
// With current information, get top recommendations, and get some cool sportscars and SUVs for the display
// =========================================================================================================================================================
    $scope.getVinInfo = function(type, idx) {
        $scope.carData.curCar = (type == 1) ? $scope.carData.recommendList[idx] : $scope.carData.queryList[idx] ;
        $http.get(REST_DCDATA+ '/dealerc?id='+$scope.carData.curCar.dealer)    // Get dealer info for this car
            .success(function(result) {
                $scope.carData.curCar.dealerName = result.name ;
                $scope.carData.curDealer = result ;
                $scope.bcEls.general.count++ ; $scope.breadCrumbCount++ ;
                $scope.bcEls.general.actionArr.push($scope.breadCrumbCount+" For selected car, call out to retrieve dealer details (dealer API emulated with data in"+
                    " Cloudant in Bluemix) Dealer: "+JSON.stringify($scope.carData.curDealer)) ;
                $scope.explainData.curDealer = result ;
            }) .error(function(data, status) {
                $log.error("Error retrieving dealer id: "+$scope.carData.curCar.dealer+" status: "+status+" Data: "+data.toString()) ;
                $scope.explainData.curStatMsg = "Error retrieving current dealer: "+status ;
            })

        $log.info("Car price: "+$scope.carData.curCar.price+" Type: "+type+" idx: "+idx+" recL[idx]: "+$scope.carData.recommendList[idx].price) ;
        $scope.carData.testDriveTimes = [] ;                    // Clear any prior input
        $http.get(REST_DCDATA+ '/testdrive?vin='+$scope.carData.curCar.vin)    // Get available test drive times
            .success(function(tresult) {
                $scope.carData.testDriveTimes = tresult ;
                $scope.bcEls.general.count++ ; $scope.breadCrumbCount++ ;
                $scope.bcEls.general.actionArr.push($scope.breadCrumbCount+" Retrieved available test drive times. Would have used API to dealer, but this is emulated here"+
                    " in Cloudant on Bluemix") ;
                $log.info("Tresults: %s", JSON.stringify($scope.carData.testDriveTimes)) ;
                $scope.explainData.testDrives = $scope.carData.testDriveTimes ;
            }) .error(function(data, status) {
                $log.error("Error retrieving test drive times: status: "+status+" Data: "+data.toString()) ;
                $scope.explainData.curStatMsg = "Error retrieving test drive times: "+status ;
            })

        $scope.loanData.loanTerms = { minDownPmt : ($scope.carData.curCar.price * .05), downPmt : ($scope.carData.curCar.price * .1), minTerm : 2, maxTerm : 5, loanTerm : 3 } ;

        $scope.getLoanQuotes() ;
        $scope.getInsuranceQuotes() ;
    } ;

    $scope.echoSliderDollar = function() {
        $scope.getLoanQuotes() ;
    } ;
    $scope.echoSliderTerm = function() {
        $scope.getLoanQuotes() ;
    } ;

    $scope.echoSliderDeductible = function() {
        $scope.getInsuranceQuotes() ;
    } ;
    $scope.echoSliderLiability = function() {
        $scope.getInsuranceQuotes() ;
    } ;
}]) ;
