var prompt = require("prompt");
var colors = require("colors/safe");
var replace = require("replace-in-file");
var fs = require("fs");
var srcDir = "./";
var pattern = "IdP_Pattern_1A_OIDC";

var schema = {
    properties: {
      org: {
        description: colors.yellow("Please provide the Apigee Edge Organization name"),
        message: colors.red("Apigee Edge Organization name cannot be empty!"),
        required: true
      },
      env: {
        description: colors.yellow("Please provide the Apigee Edge Environment name"),
        message: colors.red("Apigee Edge Environment name cannot be empty!"),
        required: true
      },
      proxy_name: {
        description: colors.yellow("Please provide the Proxy name"),
        message: colors.red("Proxy name cannot be empty!"),
        required: true
      },
      proxy_basepath: {
        description: colors.yellow("Please provide the Proxy basepath, for example '/v1/auth'"),
        message: colors.red("Proxy basepath cannot be empty!"),
        required: true
      },
      kvm_idp_config_name: {
        description: colors.yellow("Please provide the Apigee KeyValueMap name where the IDP configurations will be stored"),
        message: colors.red("Key Value Map name cannot be empty!"),
        required: true
      },
      username: {
        description: colors.yellow("Please provide the Apigee Edge username"),
        message: colors.red("Apigee Edge username cannot be empty!"),
        required: true
      },
      password: {
        description: colors.yellow("Please provide the Apigee Edge password"),
        message: colors.red("Apigee Edge password cannot be empty!"),
        hidden: true,  
        replace: '*',
        required: true
      }
    }
  };
 
//
// Start the prompt
//
prompt.start();

prompt.get(schema, async function (err, options) {
  await deleteExistingDevApp(srcDir, options);
  await deployProxyAndDependencies(srcDir, options);
});

async function deleteExistingDevApp(srcDir, options){
  const mvn = require('maven').create({
      cwd: srcDir,
      debug: false
  });
  options["apigee.config.options"]= "delete";
  options["apigee.config.file"]= "./target/edge.json";
  await mvn.execute(['clean','process-resources','apigee-config:apps'], options);
  console.log("Cleaning complete !");
}

async function deployProxyAndDependencies(srcDir, options) {
  const mvn = require('maven').create({
    cwd: srcDir,
    profiles: ["deploy"],
    debug: false
  });
  options["apigee.config.options"]= "update";
  options["apigee.config.file"]= "./target/edge.json";
  await mvn.execute(['clean', 'install'], options);
    var apps = require('./target/devAppKeys.json');
    var edge = require('./target/edge.json');

    var prodName = edge.orgConfig.apiProducts[0].name;
    var developer = edge.orgConfig.developers[0].email;
    var appName = edge.orgConfig.developerApps[developer][0].name;

    var clientId;
    apps.forEach(function(app) {
      if(app.name === appName){
        var credentials = app.credentials;
        credentials.forEach(function(credential){
          var apiProducts = credential.apiProducts;
          apiProducts.forEach(function(apiProduct){
            if(apiProduct.apiproduct === prodName)
              clientId = credential.consumerKey;
          })
        });
      }
    });
  console.log('Client Id: '+ clientId);
  updateConfigFile(clientId, options);
  console.log("Successfully configured!");
}

function updateConfigFile(clientId, options){
  var configFile = require('./target/'+pattern+'.json');
  var configItems = configFile[pattern].configItems;
  configItems.forEach(function(item) {
    if(item.key === "clientId")
      item.value = clientId;
    if(item.key === "hostName")
      item.value = options.org+"-"+options.env+".apigee.net";
    if(item.key === "tokenURI")
      item.value = options.proxy_basepath+"/authorize";
    if(item.key === "tokenInfoURI")
      item.value = options.proxy_basepath+"/tokeninfo";
    if(item.key === "protectedApiURI")
      item.value = options.proxy_basepath+"/protected";
    if(item.key === "noAccessApiURI")
      item.value = options.proxy_basepath+"/unprotected";
  });
  fs.writeFileSync('./target/'+pattern+'-export.json', JSON.stringify(configFile, null, '\t'));
    console.log('Please upload '+process.cwd()+'/target/'+pattern+'-export.json to https://apigeedemo.net/config');
}
