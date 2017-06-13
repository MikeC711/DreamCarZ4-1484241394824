// Since this should rarely be run, he will be somewhat verbose
const util = require('util');
const generalLog = util.debuglog('general'), verboseLog = util.debuglog('verbose') ;

var cloudant, dcDealerInventory, dcDealers, dcModels, dcModelOptions ;       // Needed for Cloudant
 
var dbCredentials = {} ;        // Provided in environment from core app
 
baseOptions = [ { description : "Leather interior package", priceMult : 2.5 },
                { description : "Special wheels", priceMult : 1 },
                { description : "Special trim", priceMult : .8 },
                { description : "Front spoiler", priceMult : 1.2 },
                { description : "Wheel locks", priceMult : .8 },
                { description : "Security system", priceMult : 1.1 },
                { description : "Cruise control", priceMult : .5 },
                { description : "Backup Camera", priceMult : .9 },
                { description : "Smart trip guidance", priceMult : 1.8 },
                { description : "InDash cellular", priceMult : .7 },
                { description : "MultiZone AC", priceMult : .9 },
                { description : "MP3 player", priceMult : .5 },
                { description : "Sirius/XM Radio",  priceMult : .4 } ] ;
truckOptions = [{ description : "8 foot bed", priceMult : 2.8 },
                { description : "4 wheel drive", priceMult : 2.5 },
                { description : "Towing Package", priceMult : .8 },
                { description : "Stepup aluminum running boards", priceMult : .4 } ] ;
SUVOptions = [  { description : "4 wheel drive", priceMult : 2.5 },
                { description : "Towing Package", priceMult : .8 } ] ;

myModel = [     // TODO: For now bodyStyle more matches car type, can tweak later if needed. So Economy/TruckSUV/SportsCar/Luxury/MiniVan
// Adams
    {key : "SandPiper", brand : "Adams Automotive", bodyStyle : "Economy", safetyLevel : 3, minPrice : 17500, maxPrice : 25800,
        url : "/jpg/cars/AdamsSandPiper.jpg",
        cityMileage : 35, hwyMileage : 42, engineSize: [ 1.4, 2.2], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Hurricane", brand : "Adams Automotive", bodyStyle : "SportsCar", safetyLevel : 3, minPrice : 43000, maxPrice : 57300,
        url : "/jpg/cars/AdamsHurricane.jpg",
        cityMileage : 18, hwyMileage : 26, engineSize : [ 3.8, 4.6], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Machiavelli", brand : "Adams Automotive", bodyStyle : "Luxury", safetyLevel : 5, minPrice : 53000, maxPrice : 77300,
        url : "/jpg/cars/AdamsMachiavelli.jpg",
        cityMileage : 18, hwyMileage : 26, engineSize : [ 3.8, 4.6], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Serenity", brand : "Adams Automotive", bodyStyle : "MiniVan", safetyLevel : 5, minPrice : 32000, maxPrice : 42300,
        url : "/jpg/cars/AdamsSerenity.jpg",
        cityMileage : 25, hwyMileage : 32, engineSize : [ 2.8, 3.6], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Washington", brand : "Adams Automotive", bodyStyle : "TruckSUV", safetyLevel : 4, minPrice : 25900, maxPrice : 43500,
        url : "/jpg/cars/AdamsWashington.jpg",
        cityMileage : 18, hwyMileage : 28, engineSize : [ 4.3, 5.9], colors : ["Black", "Blue", "Gray", "Red", "White"]},
// Armstrong
    {key : "Carnataur", brand : "Armstrong Motor Company", bodyStyle : "TruckSUV", safetyLevel : 4, minPrice : 38200, maxPrice : 52750,
        url : "/jpg/cars/ArmstrongCarnataur.jpg",
        cityMileage : 14, hwyMileage : 19, engineSize : [ 5.0, 6.9], colors : ["Black", "Blue", "Gray", "White"]},
    {key : "Juice", brand : "Armstrong Motor Company", bodyStyle : "Economy", safetyLevel : 5, minPrice : 33200, maxPrice : 39750,
        url : "/jpg/cars/ArmstrongJuice.jpg",
        cityMileage : 90, hwyMileage : 85, engineSize : [ 1.0, 1.2], colors : ["Black", "Blue", "Gray", "White"]},
    {key : "Priah", brand : "Armstrong Motor Company", bodyStyle : "MiniVan", safetyLevel : 5, minPrice : 33200, maxPrice : 42750,
        url : "/jpg/cars/ArmstrongPriah.jpg",
        cityMileage : 26, hwyMileage : 35, engineSize : [ 2.2, 3.2], colors : ["Black", "Blue", "Gray", "White"]},
    {key : "Stanton", brand : "Armstrong Motor Company", bodyStyle : "Luxury", safetyLevel : 5, minPrice : 43200, maxPrice : 52750,
        url : "/jpg/cars/ArmstrongStanton.jpg",
        cityMileage : 21, hwyMileage : 27, engineSize : [ 2.8, 3.8], colors : ["Black", "Blue", "Gray", "White"]},
    {key : "Terrainadon", brand : "Armstrong Motor Company", bodyStyle : "TruckSUV", safetyLevel : 5, minPrice : 39700, maxPrice : 56350,
        url : "/jpg/cars/ArmstrongTerrainadon.jpg",
        cityMileage : 17, hwyMileage : 24, engineSize : [ 3.5, 4.7], colors : ["Black", "Blue", "Gray", "White"]},
// Benco
    {key : "Conestoga", brand : "Benco Motors", bodyStyle : "MiniVan", safetyLevel : 5, minPrice : 29999, maxPrice : 37500,
        url : "/jpg/cars/BencoConestoga.jpg",
        cityMileage : 24, hwyMileage : 30, engineSize : [ 2.6, 3.5], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Duke", brand : "Benco Motors", bodyStyle : "TruckSUV", safetyLevel : 4, minPrice : 29999, maxPrice : 37500,
        url : "/jpg/cars/BencoDuke.jpg",
        cityMileage : 18, hwyMileage : 24, engineSize : [ 2.4, 2.8], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Expresso", brand : "Benco Motors", bodyStyle : "Economy", safetyLevel : 3, minPrice : 19999, maxPrice : 27500,
        url : "/jpg/cars/BencoExpresso.jpg",
        cityMileage : 38, hwyMileage : 46, engineSize : [ 1.0, 1.6], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Eliana", brand : "Benco Motors", bodyStyle : "Luxury", safetyLevel : 5, minPrice : 48600, maxPrice : 58000,
        url : "/jpg/cars/BencoEliana.jpg",
        cityMileage : 19, hwyMileage : 25, engineSize : [ 3.8, 4.8], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Galaxy", brand : "Benco Motors", bodyStyle : "TruckSUV", safetyLevel : 5, minPrice : 48600, maxPrice : 58000,
        url : "/jpg/cars/BencoGalaxy.jpg",
        cityMileage : 20, hwyMileage : 26, engineSize : [ 3.8, 4.8], colors : ["Black", "Blue", "Gray", "Red", "White"]},
// Richardson Automotive
    {key : "FamPort", brand : "Richardson Automotive", bodyStyle : "MiniVan", safetyLevel : 5, minPrice : 36600, maxPrice : 42100,
        url : "/jpg/cars/RichardsonFamport.jpg",
        cityMileage : 22, hwyMileage : 28, engineSize : [ 2.8, 4.0], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Estate", brand : "Richardson Automotive", bodyStyle : "Luxury", safetyLevel : 5, minPrice : 56600, maxPrice : 73100,
        url : "/jpg/cars/RichardsonEstate.jpg",
        cityMileage : 19, hwyMileage : 24, engineSize : [ 3.8, 5.0], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Sparrow", brand : "Richardson Automotive", bodyStyle : "Economy", safetyLevel : 3, minPrice : 21700, maxPrice : 28300,
        url : "/jpg/cars/RichardsonSparrow.jpg",
        cityMileage : 36, hwyMileage : 45, engineSize : [ 1.2, 1.6], colors : ["Black", "Blue", "Gray", "Red", "White"]},
    {key : "Trekker", brand : "Richardson Automotive", bodyStyle : "TruckSUV", safetyLevel : 5, minPrice : 31700, maxPrice : 42300,
        url : "/jpg/cars/RichardsonTrekker.jpg",
        cityMileage : 19, hwyMileage : 25, engineSize : [ 4.2, 4.8], colors : ["Black", "Blue", "Gray", "Red", "White"]},
// Sawyer
    {key : "Cheetah", brand : "Sawyer Sport", bodyStyle : "SportsCar", safetyLevel : 3, minPrice : 54500, maxPrice : 78400,
        url : "/jpg/cars/SawyerCheetah.jpg",
        cityMileage : 14, hwyMileage : 18, engineSize : [ 4.2, 5.6], colors : ["Blue", "Indigo"]},
    {key : "Indigo", brand : "Sawyer Sport", bodyStyle : "SportsCar", safetyLevel : 3, minPrice : 44900, maxPrice : 59400,
        url : "/jpg/cars/SawyerIndigo.jpg",
        cityMileage : 17, hwyMileage : 22, engineSize : [ 3.4, 4.6], colors : ["Blue"]},
    {key : "Peregrine", brand : "Sawyer Sport", bodyStyle : "SportsCar", safetyLevel : 3, minPrice : 64900, maxPrice : 82500,
        url : "/jpg/cars/SawyerPeregrine.jpg",
        cityMileage : 15, hwyMileage : 20, engineSize : [ 4.1, 4.8], colors : ["Blue"]} ] ;

// This is modified by this gvim cmd: (did have to make St. Paul St Paul (take out the dot).
//  .,+82s/^ \([A-Z]\+\)\/\([A-Za-z ]\+\): \([0-9\.]\+\)\/\(.*\)$/ { "State" : "\1", "City" : "\2", "geoLatitude" : \3, "geoLongitude" : \4 },
myCities = [
 { State : "AL", City : "Birmingham", geoLatitude : 33.5, geoLongitude : -86.8 },
 { State : "AL", City : "Montgomery", geoLatitude : 32.37, geoLongitude : -86.3 },
 { State : "AK", City : "Juneau", geoLatitude : 58.3, geoLongitude : -134.4 },
 { State : "AK", City : "Anchorage", geoLatitude : 61.2, geoLongitude : -149.9 },
 { State : "AZ", City : "Phoenix", geoLatitude : 33.45, geoLongitude : -112.1 },
 { State : "AR", City : "Little Rock", geoLatitude : 34.7, geoLongitude : -92.29 },
 { State : "CA", City : "Sacramento", geoLatitude : 38.58, geoLongitude : -121.49 },
 { State : "CA", City : "LA", geoLatitude : 34.05, geoLongitude : -118.24 },
 { State : "CO", City : "Denver", geoLatitude : 39.74, geoLongitude : -104.99 },
 { State : "CT", City : "Hartford", geoLatitude : 41.76, geoLongitude : -72.685 },
 { State : "CT", City : "Bridgeport", geoLatitude : 41.19, geoLongitude : -73.195 },
 { State : "DE", City : "Dover", geoLatitude : 39.16, geoLongitude : -75/52 },
 { State : "DE", City : "Wilmington", geoLatitude : 39.74, geoLongitude : -75/54 },
 { State : "FL", City : "Tallahassee", geoLatitude : 30.44, geoLongitude : -84/28 },
 { State : "FL", City : "Jacksonville", geoLatitude : 30.33, geoLongitude : -81.66 },
 { State : "GA", City : "Atlanta", geoLatitude : 33.75, geoLongitude : -84.39 },
 { State : "HI", City : "Honoloulu", geoLatitude : 21.31, geoLongitude : -157.86 },
 { State : "ID", City : "Boise", geoLatitude : 43.62, geoLongitude : -116.21 },
 { State : "IL", City : "Springfield", geoLatitude : 39.78, geoLongitude : -89.65 },
 { State : "IL", City : "Chicago", geoLatitude : 41.88, geoLongitude : -87.63 },
 { State : "IN", City : "Indianapolis", geoLatitude : 39.77, geoLongitude : -86.16 },
 { State : "IA", City : "DesMoines", geoLatitude : 41.6, geoLongitude : -93.61 },
 { State : "KS", City : "Topeka", geoLatitude : 39.1, geoLongitude : -95.69 },
 { State : "KS", City : "Wichita", geoLatitude : 37.69, geoLongitude : -97.33 },
 { State : "KY", City : "Frankfort", geoLatitude : 38.2, geoLongitude : -84.87 },
 { State : "KY", City : "Louisville", geoLatitude : 38.25, geoLongitude : -85.76 },
 { State : "LA", City : "Baton Rouge", geoLatitude : 30.46, geoLongitude : -91.14 },
 { State : "LA", City : "New Orleans", geoLatitude : 29.95, geoLongitude : -90.1 },
 { State : "ME", City : "Augusta", geoLatitude : 44.31, geoLongitude : -69.78 },
 { State : "ME", City : "Portland", geoLatitude : 43.66, geoLongitude : -70.26 },
 { State : "MD", City : "Annapolis", geoLatitude : 38.98, geoLongitude : -76.49 },
 { State : "MD", City : "Baltimore", geoLatitude : 39.29, geoLongitude : -76.61 },
 { State : "MA", City : "Boston", geoLatitude : 42.36, geoLongitude : -71.06 },
 { State : "MI", City : "Lansing", geoLatitude : 42.73, geoLongitude : -84.56 },
 { State : "MI", City : "Detroit", geoLatitude : 42.33, geoLongitude : -83.05 },
 { State : "MN", City : "St Paul", geoLatitude : 44.95, geoLongitude : -93.09 },
 { State : "MN", City : "Minneapolis", geoLatitude : 44.98, geoLongitude : -93.27 },
 { State : "MS", City : "Jackson", geoLatitude : 32.299, geoLongitude : -90.184 },
 { State : "MO", City : "Jefferson City", geoLatitude : 38.58, geoLongitude : -92.17 },
 { State : "MO", City : "Kansas City", geoLatitude : 39.1, geoLongitude : -94.58 },
 { State : "MT", City : "Helena", geoLatitude : 46.59, geoLongitude : -112.02 },
 { State : "MT", City : "Billings", geoLatitude : 45.78, geoLongitude : -108.5 },
 { State : "NE", City : "Lincoln", geoLatitude : 40.83, geoLongitude : -96.69 },
 { State : "NE", City : "Omaha", geoLatitude : 41.25, geoLongitude : -96 },
 { State : "NV", City : "Carson City", geoLatitude : 39.16, geoLongitude : -119.77 },
 { State : "NV", City : "Las Vegas", geoLatitude : 36.17, geoLongitude : -115.14 },
 { State : "NH", City : "Concord", geoLatitude : 43.21, geoLongitude : -71.54 },
 { State : "NH", City : "Manchester", geoLatitude : 43.0, geoLongitude : -71.464 },
 { State : "NJ", City : "Trenton", geoLatitude : 40.22, geoLongitude : -74.74 },
 { State : "NJ", City : "Newark", geoLatitude : 40.74, geoLongitude : -74.17 },
 { State : "NM", City : "Santa Fe", geoLatitude : 35.69, geoLongitude : -105.94 },
 { State : "NM", City : "Albuquerkque", geoLatitude : 35.09, geoLongitude : -106.61 },
 { State : "NY", City : "Albany", geoLatitude : 42.65, geoLongitude : -73.76 },
 { State : "NY", City : "NY", geoLatitude : 40.7, geoLongitude : -74 },
 { State : "NC", City : "Charlotte", geoLatitude : 35.23, geoLongitude : -80.84 },
 { State : "NC", City : "Raleigh", geoLatitude : 35.78, geoLongitude : -78.64 },
 { State : "ND", City : "Bismarck", geoLatitude : 46.81, geoLongitude : -100.78 },
 { State : "ND", City : "Fargo", geoLatitude : 46.88, geoLongitude : -96.78 },
 { State : "OH", City : "Columbus", geoLatitude : 39.96, geoLongitude : -83 },
 { State : "OK", City : "Oklahoma City", geoLatitude : 35.47, geoLongitude : -97.52 },
 { State : "OR", City : "Salem", geoLatitude : 44.94, geoLongitude : -123.04 },
 { State : "OR", City : "Portland", geoLatitude : 45.52, geoLongitude : -122.67 },
 { State : "PA", City : "Harrisburg", geoLatitude : 40.27, geoLongitude : -76.89 },
 { State : "PA", City : "Philadelphia", geoLatitude : 39.05, geoLongitude : -75.17 },
 { State : "RI", City : "Providence", geoLatitude : 41.82, geoLongitude : -71.41 },
 { State : "SC", City : "Columbia", geoLatitude : 34, geoLongitude : -81.03 },
 { State : "SD", City : "Pierre", geoLatitude : 44.37, geoLongitude : -100.35 },
 { State : "SD", City : "Sioux Falls", geoLatitude : 43.54, geoLongitude : -96.73 },
 { State : "TN", City : "Nashville", geoLatitude : 36.16, geoLongitude : -86.78 },
 { State : "TN", City : "Memphis", geoLatitude : 35.15, geoLongitude : -90.05 },
 { State : "TX", City : "Austin", geoLatitude : 30.27, geoLongitude : -97.74 },
 { State : "TX", City : "Houston", geoLatitude : 29.76, geoLongitude : -95.37 },
 { State : "UT", City : "Salt Lake City", geoLatitude : 40.76, geoLongitude : -111.89 },
 { State : "VT", City : "Montpelier", geoLatitude : 44.26, geoLongitude : -72.58 },
 { State : "VT", City : "Burlington", geoLatitude : 44.47, geoLongitude : -73.21 },
 { State : "VA", City : "Richmond", geoLatitude : 37.54, geoLongitude : -77.44 },
 { State : "VA", City : "Virginia Beach", geoLatitude : 36.85, geoLongitude : -75.98 },
 { State : "WA", City : "Olympia", geoLatitude : 47.04, geoLongitude : -122.90 },
 { State : "WA", City : "Seattle", geoLatitude : 47.61, geoLongitude : -122.33 },
 { State : "WV", City : "Charleston", geoLatitude : 38.35, geoLongitude : -81.63 },
 { State : "WI", City : "Madison", geoLatitude : 43.07, geoLongitude : -89.40 },
 { State : "WI", City : "Milwaukee", geoLatitude : 43.04, geoLongitude : -87.91 },
 { State : "WY", City : "Cheyenne", geoLatitude : 41.14, geoLongitude : -104.82 },
 { State : "India", City : "Chennai", geoLatitude : 13.06, geoLongitude : 80.25 },
 { State : "India", City : "Bangalore", geoLatitude : 12.97, geoLongitude : 77.59 },
 { State : "India", City : "Mysore", geoLatitude : 12.97, geoLongitude : 76.64 },
 { State : "India", City : "New Delhi", geoLatitude : 28.64, geoLongitude : 77.23 },
 { State : "Thailand", City : "Bangkok", geoLatitude : 13.75, geoLongitude : 100.49 },
 { State : "UAE", City : "Dubai", geoLatitude : 25.27, geoLongitude : 55.31 },
 { State : "Brazil", City : "Brasilla", geoLatitude : -15.78, geoLongitude : -47.93 },
 { State : "UK", City : "London", geoLatitude : 51.51, geoLongitude : -0.13 },
 { State : "Australia", City : "Sydney", geoLatitude : -33.87, geoLongitude : 151.21 },
 { State : "New Zealand", City : "Auckland", geoLatitude : -36.85, geoLongitude : 174.76 },
 { State : "Belgium", City : "Brussels", geoLatitude : 50.85, geoLongitude : 4.35 },
 { State : "France", City : "Paris", geoLatitude : 48.86, geoLongitude : 2.35 },
 { State : "Japan", City : "Tokyo", geoLatitude : 35.689, geoLongitude : 139.692 },
 { State : "Japan", City : "Osaka", geoLatitude : 34.686, geoLongitude : 135.52 },
 { State : "Japan", City : "Sapporo", geoLatitude : 43.06, geoLongitude : 141.35 },
 { State : "Germany", City : "Berlin", geoLatitude : 52.52, geoLongitude : 13.41 } ] ;

brands = [
    {name : "Adams Automotive", parentGroup : "Adams International" },
    {name : "Armstrong Motor Company",  parentGroup : "PetroChem" },
    {name : "Benco Motors",  parentGroup : "Cox Motor Group" },
    {name : "Richardson Automotive",  parentGroup : "Nimbus Worldwide" },
    {name : "Sawyer Sport",  parentGroup : "2Hot Inc." } ] ;

var modelOptList = [] ;                 // Stored here as after it is generated, it is needed for other data generation

var setEnvironment = function(cloudantCredentials) {
    verboseLog("genModel setting environment") ;
    dbCredentials = cloudantCredentials ;

    cloudant = require('cloudant')(dbCredentials.url);
}

var loadData = function() {
    verboseLog("LoadData pre dropTables: %s", new Date()) ;
    dropTables() ;
    setTimeout(loadModels, 60000) ;      // Give the other guys 60 seconds before this starts up
    setTimeout(loadDealerInventory, 70000) ;     // Yes, better ways to do this, but in a hurry and this works
}

var cre8OptionList = function() {        // Merge options and models and create a total list, load it into Cloudant
    generalLog("Into cre8OptionList: %s", new Date()) ;     // This will add more time for Cloudant, postCre8
    for (var mIdx = 0; mIdx < myModel.length; mIdx++) {
        var dModel = myModel[mIdx] ;
        var oIdx = 0 ;
        for (var oIdx = 0; oIdx < baseOptions.length; oIdx++) {
            var opt1 = baseOptions[oIdx] ;
            modelOptList.push( { key : dModel.key+oIdx, model : dModel.key, brand : dModel.brand, price : (dModel.minPrice * opt1.priceMult / 100) ,
                description : opt1.description } ) ;
        }
        modelOptList.push( { key : dModel.key+(oIdx++), model : dModel.key, brand : dModel.brand, price : (dModel.minPrice * 2 / 100) ,
            description : "Large engine option: upgrade to "+dModel.engineSize[1] } ) ;
        var curCnt = modelOptList.length ;
        if (curCnt % 100 == 0)  verboseLog("CurRows: %d  This Row: ", curCnt, modelOptList[--curCnt]) ;
        if (dModel.bodyStyle == "Truck") {
            for (var tIdx = 0; tIdx < truckOptions.length; tIdx++) {
                var opt1 = truckOptions[tIdx] ;
                modelOptList.push( { key : dModel.key+(oIdx++), model : dModel.key, brand : dModel.brand, price : (dModel.minPrice * opt1.priceMult / 100) ,
                    description : opt1.description } ) ;
            }
        } else {
            if (dModel.bodyStyle == "SUV") {
                for (var sIdx = 0; sIdx < SUVOptions.length; sIdx++) {
                    var opt1 = SUVOptions[sIdx] ;
                    modelOptList.push( { key : dModel.key+(oIdx++), model : dModel.key, brand : dModel.brand, price : (dModel.minPrice * opt1.priceMult / 100) ,
                        description : opt1.description } ) ;
                }
            }
        }
    }
    loadOptionList() ;
}

var dropTables = function() {
    generalLog("Into dropTables: %s", new Date()) ;
    var dropCnt = 0 ;
    cloudant.db.destroy(dbCredentials.dcDealerInventory, function (err, res) {
        if (!err || err.statusCode == 404) {
            dropCnt++ ;
            if (dropCnt >= 4)  cre8Tables() ;
            else  generalLog("Dropped dcDealerInventory for drop count: %d", dropCnt) ;
        } else generalLog("Failed to destroy table %s, error: %s", dbCredentials.dcDealerInventory, JSON.stringify(err)) ;
    });
    cloudant.db.destroy(dbCredentials.dcDealers, function (err, res) {
        if (!err || err.statusCode == 404) {
            dropCnt++ ;
            if (dropCnt >= 4)  cre8Tables() ;
            else  generalLog("Dropped dcDealers for drop count: %d", dropCnt) ;
        } else generalLog("Failed to destroy table %s, error: %s", dbCredentials.dcDealers, JSON.stringify(err)) ;
    });
    cloudant.db.destroy(dbCredentials.dcModels, function (err, res) {
        if (!err || err.statusCode == 404) {
            dropCnt++ ;
            if (dropCnt >= 4)  cre8Tables() ;
            else  generalLog("Dropped dcModels for drop count: %d", dropCnt) ;
        } else generalLog("Failed to destroy table %s, error: %s", dbCredentials.dcModels, JSON.stringify(err)) ;
    });
    cloudant.db.destroy(dbCredentials.dcModelOptions, function (err, res) {
        if (!err || err.statusCode == 404) {
            dropCnt++ ;
            if (dropCnt >= 4)  cre8Tables() ;
            else  generalLog("Dropped dcModelOptions for drop count: %d", dropCnt) ;
        } else generalLog("Failed to destroy table %s, error: %s", dbCredentials.dcModelOptions, JSON.stringify(err)) ;
    });
}

var cre8Tables = function() {
    generalLog("Into cre8Tables: %s", new Date()) ;
    var cre8Cnt = 0 ;
    verboseLog("         pre cre8Tables: %s", new Date()) ;
    cloudant.db.create(dbCredentials.dcDealerInventory, function (err, res) {
        if (err) generalLog("Failed to create table %s, error: %s", dbCredentials.dcDealerInventory, JSON.stringify(err)) ;
        else {
            cre8Cnt++ ;
            if (cre8Cnt >= 4)  cre8OptionList() ;
            else  generalLog("Created dcDealerInventory for create count: %d", cre8Cnt) ;
        }
    });
    cloudant.db.create(dbCredentials.dcDealers, function (err, res) {
        if (err) generalLog("Failed to create table %s, error: %s", dbCredentials.dcDealers, JSON.stringify(err)) ;
        else {
            cre8Cnt++ ;
            if (cre8Cnt >= 4)  cre8OptionList() ;
            else  generalLog("Created dcDealers for create count: %d", cre8Cnt) ;
        }
    });
    cloudant.db.create(dbCredentials.dcModels, function (err, res) {
        if (err) generalLog("Failed to create table %s, error: %s", dbCredentials.dcModels, JSON.stringify(err)) ;
        else {
            cre8Cnt++ ;
            if (cre8Cnt >= 4)  cre8OptionList() ;
            else  generalLog("Created dcModels for create count: %d", cre8Cnt) ;
        }
    });
    cloudant.db.create(dbCredentials.dcModelOptions, function (err, res) {
        if (err) generalLog("Failed to create table %s, error: %s", dbCredentials.dcModelOptions, JSON.stringify(err)) ;
        else {
            cre8Cnt++ ;
            if (cre8Cnt >= 4)  cre8OptionList() ;
            else  generalLog("Created dcModelOptions for create count: %d", cre8Cnt) ;
        }
    });
}

var loadOptionList = function() {
    generalLog("Into loadOptionList: %s", new Date()) ;
	dcModelOptions = cloudant.use(dbCredentials.dcModelOptions);
    verboseLog("         pre loadOptionList: %s", new Date()) ;
    for (var oIdx = 0; oIdx < modelOptList.length; oIdx++) {
        var curOpt = modelOptList[oIdx] ;
        dcModelOptions.insert(curOpt, curOpt.key, function(err, body) {
            if (err)  generalLog("Error loading model option: %s. Err: %s", JSON.stringify(curOpt), JSON.stringify(err)) ;
        });
    }
}

var loadModels = function() {
    generalLog("Into loadModels: %s", new Date()) ;
	dcModels = cloudant.use(dbCredentials.dcModels) ;
    verboseLog("         pre loadModels: %s", new Date()) ;
    for (var mIdx = 0; mIdx < myModel.length; mIdx++) {
        curModel = myModel[mIdx] ;
        dcModels.insert(curModel, curModel.key, function(err, body) {
            if (err)  generalLog("Error loading model: %s. Err: %s", JSON.stringify(curModel), JSON.stringify(err)) ;
        });
    }
}

var loadDealerInventory = function() {
    generalLog("Into loadDealerInventory: %s", new Date()) ;
	dcDealerInventory = cloudant.use(dbCredentials.dcDealerInventory);
	dcDealers = cloudant.use(dbCredentials.dcDealers) ;
    verboseLog("         pre loadDealerInventory: %s", new Date()) ;
    var dealerCnt = -1 ;
    for (var bIdx = 0; bIdx < brands.length; bIdx++) {
        var curBrand = brands[bIdx] ;
        verboseLog("Working on brand: %s", JSON.stringify(curBrand)) ;
        for (var cIdx = 0; cIdx < myCities.length; cIdx++) {
            var curLoc = myCities[cIdx] ;
            var curDealer = { id : ++dealerCnt, brand : curBrand.name, name : curBrand.name+" of "+curLoc.City, City : curLoc.City,
                State : curLoc.State, Latitude : curLoc.geoLatitude, Longitude : curLoc.geoLongitude }
            dcDealers.insert(curDealer, ""+curDealer.id+"", function(err, body) {     // TODO: Not sure why dealer ID is hosed. curDealer.id is accurate
                if (err)  generalLog("Error loading dealer: %s. Err: %s", JSON.stringify(curDealer), JSON.stringify(err)) ;
            }) ;
                // Get the models for this dealer
            var model4dealer = Math.trunc(Math.random() * 4) ;       // Identify how many of each model to create
            var option4model = Math.trunc(Math.random() * 8) ;       // How many options per car
//            if (cIdx % 100 == 0)  verboseLog("City: %s  model4dealer: %d  option4model: %d", curLoc.City, model4dealer, option4model) ;
            for (var mIdx = 0; mIdx < myModel.length; mIdx++) {
                var dModel = myModel[mIdx] ;
                if (dModel.brand == curBrand.name) {
                    if (dModel.bodyStyle == "Truck") {
                        option4model += 2 ;
                    } else {
                        if (dModel.bodyStyle == "SUV")  option4model += 1 ;
                    }
                    var o4m = 0 ;
                    opts4ThisModel = [] ;
                    for (var oIdx = 0; oIdx < modelOptList.length; oIdx++) {    // Find list of options for this model
                        var curOpt = modelOptList[oIdx] ;
                        if (curOpt.model == dModel.key) {
                            opts4ThisModel.push(curOpt) ;
                        }
                    }
                    for (var mdIdx = 0; mdIdx < model4dealer; mdIdx++) {                // For each instance of this model for this dealer
                                                                                        // TODO ... should be random, taking first n for now
                        var opts4ThisInst = opts4ThisModel.slice(0, option4model) ;     // New list with randon n options tied to this model
                        var optKeys = [] ; optCost = 0 ; bigEngine = false ;
                        for (var omIdx = 0; omIdx < opts4ThisInst.length; omIdx++) {
                            var iOpt = opts4ThisInst[omIdx] ;
                            optKeys.push({key : iOpt.key }) ;
                            optCost += iOpt.price ;
                            if (iOpt.description.substring(0,20) == "Large engine option:")    bigEngine = true ;
                        }
//                        verboseLog("OptsLen: %d  Opts4InstLen: %d  minCost: %s  optKeysLen: %d  optCost: %d",
//                            opts4ThisModel.length, opts4ThisInst.length, dModel.minPrice, optKeys.length, optCost) ;
                        var colorOpt = dModel.colors[Math.trunc(Math.random() * dModel.colors.length)] ;
                        var engineSz = (bigEngine) ? dModel.engineSize[1] : dModel.engineSize[0] ;        // big or small engine
                        var curCar = { dealer : dealerCnt, vin : curBrand.name.substring(0,3)+dModel.key.substr(0,2)+Math.trunc(Math.random() * 99000),
                            model : dModel.key, engine : engineSz, price : dModel.minPrice + optCost, disposition : "new", options : optKeys,
                            mileage : 30, color : colorOpt, geoLatitude : curDealer.Latitude, geoLongitude : curDealer.Longitude, safetyLevel : dModel.safetyLevel,
                            bodyStyle : dModel.bodyStyle, url : dModel.url} ;
                        dcDealerInventory.insert(curCar, curCar.vin, function(err, body) {
                            if (err) {
                                if (err.statusCode == 409) {
                                    dcDealerInventory.insert(curCar, curCar.vin, function(err, body) {
                                        if (err) generalLog("Error retrying dealerInventory: %s. Err: %s", JSON.stringify(curCar), JSON.stringify(err)) ;
                                    }) ;
                                } else {
                                    generalLog("Error loading dealerInventory: %s. Err: %s", JSON.stringify(curCar), JSON.stringify(err)) ;
                                }
                            }
                        });
                    }
                }
            }
        }
    }
}
    
module.exports = {
    setEnvironment,
    loadData
};      // End of module exports

