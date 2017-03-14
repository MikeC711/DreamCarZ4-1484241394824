#!/bin/bash
echo "Setting up development environment for DCAngular"
export NODE_DEBUG=watson,banking,insurance,general,verbose,car
#export NODE_DEBUG=general
export PORT=8080
export bankingHost=cap-sg-prd-5.integration.ibmcloud.com
export bankingPort=16953 
export bankingPath=/dreamcarzdemo2/
# export bankingDir=sgBank
# Only specify this if API Connect truly is on
# export APIConnect=true
export bankingCertFile=keys/sgBank/q3XKbfNZep8_e7J_destCert.pem
export bankingKeyFile=keys/sgBank/q3XKbfNZep8_e7J_destKey.pem
export bankSparkHost=cap-sg-prd-5.integration.ibmcloud.com
export bankSparkPort=16173
export bankSparkPath=/DreamCarZSparkInterface/dreamcars/customer/
export VCAP_SERVICES='{ "cloudantNoSQLDB": [ { "name": "DreamCarZ-cloudantNoSQLDB", "label": "cloudantNoSQLDB", "plan": "Shared", "credentials": { "username": "3e0f51ef-f543-46c7-bbb5-dbd6fcdc2e95-bluemix", "password": "676c77a8e5eebfbcaa7707632e75c53daed925f537a85b910b04a9525f98cd72", "host": "3e0f51ef-f543-46c7-bbb5-dbd6fcdc2e95-bluemix.cloudant.com", "port": 443, "url": "https://3e0f51ef-f543-46c7-bbb5-dbd6fcdc2e95-bluemix:676c77a8e5eebfbcaa7707632e75c53daed925f537a85b910b04a9525f98cd72@3e0f51ef-f543-46c7-bbb5-dbd6fcdc2e95-bluemix.cloudant.com" } } ], "personality_insights": [ { "name": "Personality Insights-26", "label": "personality_insights", "plan": "tiered", "credentials": { "url": "https://gateway.watsonplatform.net/personality-insights/api", "password": "sm1lYCOs4eEE", "username": "2f06d185-aef6-4d4a-94e9-864eb30ff579" } } ] }'

echo "All done - now just run node start to run the application"
