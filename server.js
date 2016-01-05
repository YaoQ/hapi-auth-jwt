var Hapi        = require('hapi');
var hapiAuthJwt = require('./lib/index');
var jwt         = require('jsonwebtoken');
var mqtt        = require('mqtt');
var server      = new Hapi.Server();
var config      = require('./config'); // get our config file

    
// =======================
// configuration =========
// =======================
var port    = Number(process.env.PORT || 8080); // used to create, sign, and verify tokens

var client  = mqtt.connect(config.mqttserver);
server.connection({ port: port, routes: { cors: true} });

var privateKey = config.privateKey;

var accounts = {
    123: {
      id: 123,
      user: 'john',
      fullName: 'John Q Public'
    }
};

var token = jwt.sign({ accountId: 123 }, privateKey, { algorithm: 'HS256'});

// use this token to build your web request.  You'll need to add it to the headers as 'authorization'.  And you will need to prefix it with 'Bearer '
// console.log('token: ' + token);

var validate = function (request, decodedToken, callback) {

    console.log(decodedToken);  // should be {accountId : 123}.

    if (decodedToken) {
      console.log(decodedToken.accountId.toString());
    }

    var account = accounts[decodedToken.accountId];

    if (!account) {
      return callback(null, false);
    }

    return callback(null, true, account);
};


// =======================
// routes ================
// =======================

server.register(hapiAuthJwt, function () {

  server.auth.strategy('token', 'jwt', 
                { key: privateKey,
                validateFunc: validate,
                verifyOptions: { algorithms: [ 'HS256' ] }
  });

    //Get a token    
    server.route({
      // GET to http://localhost:8080/tokenRequired
      method: 'POST',
      path: '/tokenRequired',
      config: { auth: 'token' },
      handler: function(request, reply) {
      var deviceInfo = 'dev' + request.payload.deviceNum + '-' + request.payload.command;
        var replyObj = {text: 'I am a JSON response, and you needed a token to get me.', credentials: request.auth.credentials};
        reply(replyObj);
     
            console.log("Publish a message!");
            client.publish('device/control',deviceInfo, {retain: false, qa:1});}
        
    });

    server.route({
      // GET to http://localhost:8080/noTokenRequired
      // This get can be executed without sending any token at all
      method: "GET",
      path: "/noTokenRequired",
      config: { auth: false },
      handler: function(request, reply) {
        var replyObj = {text: 'I am a JSON response without token!'};
        reply(replyObj);
      }
    });

});

server.start((err) => {
  if (err) {
    throw err;
  }
  
  console.log('Server running at:', server.info.uri);
  console.log(`curl --header "Authorization: Bearer ${token}" ${server.info.uri}/tokenRequired`);

});
