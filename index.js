var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var request = require('request');
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird');
var async = require('async');
var net = require('net')
var fs = require('fs')

var client = new net.Socket()
require('mongoose-double')(mongoose);
var dp = require('./config/default.parameters.js')
var SchemaTypes = mongoose.Schema.Types;

var figlet = require('figlet');
var moment = require('moment-timezone');

/*var routes = require('./routes/index');
 var users = require('./routes/users');*/

figlet('CEPS', function(err, data) {
    if (err) {
        console.log('CEPS...');
        console.dir(err);
        return;
    }
    console.log(data)
});
mongoose.connect('mongodb://localhost/ceps');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    console.log("Database Connected " + moment().tz("Asia/Kolkata").format().toString());
});

var db_schema = new mongoose.Schema({
    command: Number,
    device_id: String,
    voltage: SchemaTypes.Double,
    e1: SchemaTypes.Double,
    e2: SchemaTypes.Double,
    e3: SchemaTypes.Double,
    e4: SchemaTypes.Double,
    e5: SchemaTypes.Double,
    date_time: String
});

var sms_schema = mongoose.Schema({
    device_id: String,
    mobile_no: String
})



var error_schema = mongoose.Schema({
    error_string: String,
    date_time: String
});

var DB = mongoose.model("DB", db_schema);
var ERROR_DATA = mongoose.model("errorData", error_schema);
var SMS = mongoose.model('sms', sms_schema)
var clients = [];

net.createServer(function(socket) {
    socket.name = socket.remoteAddress + ":" + socket.remotePort
    console.log(socket.name)
    socket.on('data', (data) => {
        var sample = data.toString().replace(/[$#]/g, '')
        var xsample = data.toString().replace(/[$#\r]/g, '')
        console.log("DATA=>" + xsample)
        var array = xsample.split(',')
        console.log(array)
        if (array.length === 8) {
            async.parallel({
                one: function(callback) {
                    SMS.findOne({ device_id : array[1]},function(err,data) {
                        if(err){
                            console.log(err)
                        }else{
                            var ddata = JSON.parse(JSON.stringify(data))
                            console.log(ddata)
                            for (var i = 3; i < 8; i++) {
                                if (parseFloat(array[i]) >= dp.voltage) {
                                    var earth_pit = i - 2
                                    console.log("-----------------------")
                                    console.log("TOO HEAVY Voltage" + "E->" + earth_pit + "\tVOLTS->" + array[i])
                                    console.log("-----------------------")
                                    var sms_url = "http://login.aonesms.com/sendurlcomma.aspx?user=20064619&pwd=6xuxkn&senderid=PAPAYA&mobileno="+ ddata.mobile_no +"&msgtext=High Voltage alert. The earth pit CEP053 connected to device Earth pit " + earth_pit + " at RailTel is reporting high voltage of " + array[i] + " volts. This is above the threshold and needs your attention&smstype=0"
                                    request(sms_url, function(error, response, body) {
                                        if (!error && response.statusCode == 200) {
                                            //console.log("ERROR =>" + error + "\tResponse =>" + response.statusCode + "\tBody=>" + body); // Show the HTML for the Google homepage.
                                            //callback(null, "SMS SENT");
                                            console.log("SMS SENT")
                                        } else {
                                            console.log("SMS NOT SENT" + "\t ERRRRRRRRR" + error)
                                        }
                                    })
                                }
                            }
                        }
                    })
                    callback(null, "SMS SENT")

                },
                two: function(callback) {
                    var db_data = new DB({
                        command: array[0],
                        device_id: array[1],
                        voltage: array[2],
                        e1: array[3],
                        e2: array[4],
                        e3: array[5],
                        e4: array[6],
                        e5: array[7],
                        date_time: moment().tz("Asia/Kolkata").format().toString()
                    });
                    db_data.save(function(err, results) {
                        if (err) {
                            callback(err, null);
                        } else {
                            callback(null, results);
                        }
                    });
                },
                three: function(callback) {
                    //sendTcp.sendTcp("$00,SIPL,254.00,00.00,00.00,00.00,00.00,00.00#")
                    // client.connect(8081, '183.82.99.67', function() {
                    //     console.log('Connected')
                    //     client.write("$00,SIPL,254.00,00.00,00.00,00.00,00.00,00.00#")
                    // })
                    callback(null, "OK TCP")

                }
            }, function(err, results) {
                console.log("-----------------------")
                console.log("ERROR=>" + err + "\tREsults OF ASYNC=>" + results.three)
                console.log("-----------------------")
            })
        }
        if (array.length !== 8) {
            var error_dataa = new ERROR_DATA({
                error_string: array,
                date_time: moment().tz("Asia/Kolkata").format().toString()
            });
            error_dataa.save(function(err, results) {
                console.log("-----------------------")
                console.log("ERROR=>" + err + "\t DATA SAVED ERROR LENGTH OF PACKET 8 =>" + results)
                console.log("-----------------------")
            });
        }
        //socket.destroy()
    });
    socket.on('end', function() {
        clients.splice(clients.indexOf(socket), 1);
    });
    /*socket.on('close', function() {
        console.log('Connection closed');
        clients.splice(clients.indexOf(socket), 1);
    });*/
}).listen(9002)