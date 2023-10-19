// @ts-nocheck
'use strict';

/*
 * Created with @iobroker/create-adapter v2.5.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const express = require('express');
const serveIndex = require('serve-index');
const sqlite3 = require('sqlite3').verbose();
const fs =      require('fs');
const jsonfile = require('jsonfile');
const cors = require('cors');
const allowMethods = require('allow-methods');
const path = require('path');

let myalarm;
let indexHtml;
let webServer   = null;
let jsondataforalarmcreater;
const obj = {
    table: []
};
const lang = 'en';
let self;
// Load your modules here, e.g.:
// const fs = require("fs");

class MyAlarm extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'my-alarm',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        self = this;
        // Reset the connection indicator during startup
        this.setState('info.connection', true, true);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        /*this.log.info('config option1: ' + this.config.option1);
        this.log.info('config option2: ' + this.config.option2);*/

        /*
        For every state in the system there has to be also an object of type state
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */

        this.setObject('info.AlarmJson', {
            type: 'state',
            common: {
                name: 'AlarmJson',
                type: 'string',
                role: 'value'
            },
            native: {}
        });


        this.setObject('info.AlarmSound', {
            type: 'state',
            common: {
                name: 'AlarmSound',
                type: 'string',
                role: 'value'
            },
            native: {}
        });

        this.setObject('info.isAlarm', {
            type: 'state',
            common: {
                name: 'isAlarm',
                type: 'boolean',
                role: 'value'
            },
            native: {}
        });

        this.setObject('info.AlarmType', {
            type: 'state',
            common: {
                name: 'AlarmType',
                type: 'string',
                role: 'value'
            },
            native: {}
        });

        this.setObject('info.AcknowledgeId', {
            type: 'state',
            common: {
                name: 'AlarmType',
                type: 'number',
                role: 'value'
            },
            native: {}
        });

        this.setObject('info.AlarmMessage', {
            type: 'state',
            common: {
                name: 'AlarmType',
                type: 'string',
                role: 'value'
            },
            native: {}
        });
        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        //this.subscribeStates('testVariable');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        //this.subscribeStates('my-alarm.'+this.instance+'.*');
        this.subscribeForeignStates('*');
        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync('admin', 'iobroker');
        this.log.info('check user admin pw iobroker: ' + result);

        result = await this.checkGroupAsync('admin', 'admin');
        this.log.info('check group user admin group admin: ' + result);
        webServer = this.initWebServer(this.config,this);
        this.Run();
    }

    initWebServer(settings,self) {
        const server = {
            app:       null,
            server:    null,
            io:        null,
            settings:  settings
        };
        //adapter.subscribeForeignObjects('system.config');

        //settings.ttl = parseInt(settings.ttl, 10) || 3600;
        //if (!settings.whiteListEnabled && settings.whiteListSettings) delete settings.whiteListSettings;

        //settings.defaultUser = settings.defaultUser || 'system.user.admin';
        //if (!settings.defaultUser.match(/^system\.user\./)) settings.defaultUser = 'system.user.' + settings.defaultUser;

        if (settings.port) {
            if (settings.secure) {
                if (!settings.certificates) {
                    return null;
                }
            }
            server.app = express();
            //app.configure ->
            server.app.set( 'views', __dirname + '/views');
            server.app.set('view engine', 'html');
            server.app.use(express.static(__dirname + '/admin'));
            server.app.use('/admin', serveIndex(__dirname + '/'));
            /*server.app.use(function (req, res, next) {
                const AllLayers = server.app._router.stack;
                const Layers = AllLayers.filter(x => x.name === 'bound dispatch' && x.regexp.test(req.path))
                const Methods = [];
                Layers.forEach(layer => {
                    for (let method in layer.route.methods) {
                        if (layer.route.methods[method] === true) {
                            Methods.push(method.toUpperCase());
                        }
                    }
                });
                if (Layers.length !== 0 && !Methods.includes(req.method)) {
                    res.setHeader('Allow', Methods.join(','));
                    if (req.method === "OPTIONS") {
                        return res.send(Methods.join(', '));
                    }
                    else {
                        return res.sendStatus(405);
                    }
                }
                else {
                    next();
                }
            });*/
            server.app.use(function (req, res, next) {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, *');

                // intercept OPTIONS method
                if ('OPTIONS' === req.method) {
                    res.status(200).send(200);
                } else {
                    next();
                }
            });
            /*server.app.use(cors({
                origin: '*'
            }));*/


            //------------------------------------------------------Http Operations -----------------------------------------------------------

            const readJson= jsonfile.readFileSync(__dirname +'/alarms/alarm.json');
            jsondataforalarmcreater=readJson;

            server.app.get('/alarms/add', function (req, res) {
                const tagname= req.query.TagName;
                const alarmtype = req.query.AlarmType;
                const alarmdescription = req.query.AlarmDescription;
                //var limittype = req.query.LimitType;
                const lowlimit = req.query.LowLimit;
                const lowlimitmessage = req.query.LowLimitMessage;
                const lowalarmsound = req.query.LowAlarmSound;
                //var lowreftagname = req.query.LowRefTagName;
                const highlimit = req.query.HighLimit;
                const highlimitmessage = req.query.HighLimitMessage;
                //var highreftagname = req.query.HighRefTagName;
                const highalarmsound = req.query.HighAlarmSound;
                const alarmactive = req.query.AlarmActive;
                self.dbAddAlarm(tagname,alarmtype,alarmdescription,lowlimit,lowlimitmessage,lowalarmsound,highlimit,highlimitmessage,highalarmsound,alarmactive);

                res.format({
                    'text/plain': function(){
                        res.send('1');
                    }
                });
            });

            server.app.get('/alarms/update', function (req, res) {
                const alarmid = req.query.AlarmID;
                const tagname= req.query.TagName;
                const alarmtype = req.query.AlarmType;
                const alarmdescription = req.query.AlarmDescription;
                //var limittype = req.query.LimitType;
                const lowlimit = req.query.LowLimit;
                const lowlimitmessage = req.query.LowLimitMessage;
                const lowalarmsound = req.query.LowAlarmSound;
                //var lowreftagname = req.query.LowRefTagName;
                const highlimit = req.query.HighLimit;
                const highlimitmessage = req.query.HighLimitMessage;
                //var highreftagname = req.query.HighRefTagName;
                const highalarmsound = req.query.HighAlarmSound;
                const alarmactive = req.query.AlarmActive;
                self.dbUpdateAlarm(tagname,alarmtype,alarmdescription,lowlimit,lowlimitmessage,lowalarmsound,highlimit,highlimitmessage,highalarmsound,alarmactive,alarmid);

                res.format({
                    'text/plain': function(){
                        res.send('1');
                    }
                });
            });

            server.app.get('/alarms/delete', function (req, res) {
                const alarmid = req.query.AlarmID;
                self.dbDeleteAlarm(alarmid);

                res.format({
                    'text/plain': function(){
                        res.send('1');
                    }
                });
            });

            server.app.get('/alarms/Getalarms', function (req, res) {
                const dttype = req.query.pq_datatype;
                const curpage = req.query.pq_curpage;
                const rpp= req.query.pq_rpp;
                const x= req.query._;
                let dbjson;
                self.dbgetAlarm(function(err, all) {
                    dbjson = all;
                    res.format({
                        'text/plain': function(){
                            const dbdatatojson='{"data":'+JSON.stringify(dbjson)+'}';
                            res.send(dbdatatojson);
                        }
                    });
                });

            });

            server.app.get('/alarms/getSoundsName', function (req, res) {
                const sounds =self.getSoundsName();
                res.format({
                    'text/plain': function(){
                        //var dbdatatojson="{\"data\":"+JSON.stringify(dbjson)+"}";
                        res.send(sounds);
                    }
                });
            });

            server.app.post('/alarms/SoundFilesToVis', function (req, res) {

                res.format({
                    'text/plain': function(){
                        self.copysoundfilestovis(settings.AlarmSoundUrl);
                    }
                });
                self.genjs();

            });

            server.app.post('/alarms/genjs', function (req, res) {
                res.format({
                    'text/plain': function(){
                        res.send('1');
                    }
                });
                self.genjs();
            });

            /*if (server.server) {
                settings.port = parseInt(settings.port, 10);
                this.getPort(settings.port,  (port) => {
                    port = parseInt(port, 10);
                    if (port !== settings.port && !settings.findNextPort) {
                        this.log.error('port ' + settings.port + ' already in use');
                        process.exit(1);
                    }
                    server.server.listen(port, (!settings.bind || settings.bind === '0.0.0.0') ? undefined : settings.bind || undefined);
                    this.log.info('http' + (settings.secure ? 's' : '') + ' server listening on port ' + port);
                });
            }*/
        }

        if (server.app) {
            // deliver web files from objectDB
            server.app.use('/',  (req, res) => {
                const url = decodeURI(req.url);

                /*if (server.api && server.api.checkRequest(url)) {
                    server.api.restApi(req, res);
                    return;
                }*/

                if (url === '/' || url === '/index.html') {
                    this.getListOfAllAdapters(function (err, data) {
                        if (err) {
                            res.status(500).send('500. Error' + e);
                        } else {
                            //res.sendFile(__dirname + '/admin/Table.html');
                            res
                                .set('Content-Type', 'text/html')
                                .status(200)
                                .send(data);
                        }
                    });
                    return;
                }
            });
            const detect = require('detect-port');
            /**
 * use as a promise
 */

            detect(settings.port)
                .then(_port => {
                    if (settings.port == _port) {
                        server.app.listen(parseInt(settings.port, 10),'127.0.0.1');
                    } else {
                        //console.log(`port: ${settings.port} was occupied, try port: ${_port}`);
                        this.log.info(`port: ${settings.port} was occupied, try port: ${_port}`);
                    }
                })
                .catch(err => {
                    console.log(err);
                });
        }

        if (server) {
            return server;
        } else {
            return null;
        }
    }


    getListOfAllAdapters(callback) {
        try {
            // read all instances
            this.getObjectView('system', 'instance', {}, function (err, instances) {
                indexHtml = /*indexHtml || */fs.readFileSync(__dirname + '/admin/Table.html').toString();
                //let text = 'systemLang = "' + lang + '";\n';
                // text += 'list = ' + JSON.stringify(list, null, 2) + ';\n';
                // if login
                //text += 'var authEnabled = ' + this.config.auth + ';\n';
                callback(null, indexHtml/*.replace('// -- PLACE THE LIST HERE --', text)*/);
            });
        } catch (e) {
            callback(e);
        }
    }
    //-----------------------------------------------------------END Http Operations -------------------------------------------

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            //this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if(jsondataforalarmcreater!=null)
            {
                if(id=='my-alarm.'+this.instance+'.info.AcknowledgeId')
                {
                    this.dbUpdateLogAlarmAck(state.val);
                }
                const arrayFound = jsondataforalarmcreater.findByValueOfObject('TagName', id);//jsondataforalarmcreater.filter(function(value){ return value.TagName==id;})
                if(arrayFound.length!=0)
                {
                    this.Setalarm(arrayFound,state.val);
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }
    //----------------------------------------------------SQLITE DB Operations CRUD---------------------------------------------
    dbgetAlarmFULL (callback) {
        let jsondb;
        const db = new sqlite3.Database(__dirname + '/alarms/alarm.db', (err) => {
            const sql = 'select AlarmID, TagName, AlarmType, AlarmDescription, LowLimit, LowLimitMessage, LowAlarmSound, LowRefTagName, HighLimit, HighLimitMessage, HighRefTagName, HighAlarmSound, AlarmActive from alarm';
            //let playlistId = 1;
            db.all(sql, (err, row) =>
            {
                if (err)
                {
                    //throw err;
                    return console.error(err.message);
                }
                jsondb=JSON.stringify(row);
                callback(err, row);
            });
            db.close();
        });
    }



    dbgetAlarm (callback) {
        let jsondb;
        const db = new sqlite3.Database(__dirname + '/alarms/alarm.db', (err) => {
            const sql = 'select AlarmID, TagName, AlarmType, AlarmDescription, LowLimit, LowLimitMessage, LowAlarmSound, HighLimit, HighLimitMessage, HighAlarmSound, AlarmActive from alarm';
            //let playlistId = 1;
            db.all(sql, (err, row) =>
            {
                if (err)
                {
                    //throw err;
                    return console.error(err.message);
                }
                jsondb=JSON.stringify(row);
                callback(err, row);
            });
            db.close();
        });
    }


    dbAddAlarm(tagname, alarmtype, alarmdescription,lowlimit,lowlimitmessage,lowalarmsound,highlimit,highlimitmessage,highalarmsound,alarmactive) {
        let jsondb;
        const db = new sqlite3.Database(__dirname + '/alarms/alarm.db');//, (err) => {
        // open the database connection
        const sql = 'INSERT INTO alarm( TagName, AlarmType, AlarmDescription, LowLimit, LowLimitMessage, LowAlarmSound, LowRefTagName, HighLimit, HighLimitMessage ,HighRefTagName, HighAlarmSound ,AlarmActive) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)';
        // output the INSERT statement
        const lowreftag  = tagname.split('.').join('_') +'_Low';
        const highreftag = tagname.split('.').join('_') +'_High';
        //var low
        db.run(sql, [tagname,alarmtype,alarmdescription,lowlimit,lowlimitmessage,lowalarmsound,lowreftag,highlimit,highlimitmessage,highreftag,highalarmsound,alarmactive], function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Rows inserted ${this.changes}`);
            self.genjs();
        });
        // close the database connection
        db.close();
    }


    dbUpdateAlarm(tagname,alarmtype,alarmdescription,lowlimit,lowlimitmessage,lowalarmsound,highlimit,highlimitmessage,highalarmsound,alarmactive,alarmid) {
        let jsondb;
        const db = new sqlite3.Database(__dirname + '/alarms/alarm.db');
        const lowreftag  = tagname.split('.').join('_') +'_Low';
        const highreftag = tagname.split('.').join('_') +'_High';
        const data = [tagname,alarmtype,alarmdescription,lowlimit,lowlimitmessage,lowalarmsound,lowreftag,highlimit,highlimitmessage,highreftag,highalarmsound,alarmactive,alarmid];
        // open the database connection
        const sql = 'UPDATE alarm SET  TagName=?, AlarmType=?, AlarmDescription=?, LowLimit=?, LowLimitMessage=?, LowAlarmSound=?, LowRefTagName=?, HighLimit=?, HighLimitMessage=?,HighRefTagName=? ,HighAlarmSound=?, AlarmActive=? WHERE AlarmID = ?';
        // output the INSERT statement
        db.run(sql,data, function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Rows inserted ${this.changes}`);
            self.genjs();
        });
        // close the database connection
        db.close();
    }

    dbDeleteAlarm(alarmid) {
        let jsondb;
        const db = new sqlite3.Database(__dirname + '/alarms/alarm.db');//, (err) => {
        // open the database connection
        const sql = 'Delete from alarm where AlarmID =?';
        // output the INSERT statement
        db.run(sql, [alarmid], function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Rows inserted ${this.changes}`);
            self.genjs();
        });
        // close the database connection
        db.close();
    }

    dbAddLogAlarm(tagname, alarmtype, alarmdescription, limit, limitmessage,highorlow, alarmtime, alarmvalue) {
        let jsondb;
        const db = new sqlite3.Database(__dirname + '/alarms/alarm.db');//, (err) => {
        // open the database connection
        const sql = 'INSERT INTO alarmlog( Tagname, Alarmtype, Description, LimitValue, Limitmessage,HIGH_LOW, AlarmTime, AlarmValue,Acknowledge) VALUES(?,?,?,?,?,?,?,?,?)';

        db.run(sql, [tagname,alarmtype,alarmdescription,limit,limitmessage,highorlow, alarmtime, alarmvalue,'unack'], function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Rows inserted ${this.changes}`);
        });
        // close the database connection
        db.close();
    }

    dbgetLogAlarm(callback) {
        let jsondb;
        const db = new sqlite3.Database(__dirname + '/alarms/alarm.db', (err) => {
            const sql = 'SELECT id,Tagname,Alarmtype, datetime(AlarmTime/1000,\'unixepoch\',\'localtime\') as alarmtime, Description,LimitValue,Limitmessage,HIGH_LOW,AlarmTime,AlarmValue,Acknowledge, datetime(AcknowledgeTime/1000,\'unixepoch\',\'localtime\') as acknowledgetime  FROM alarmlog WHERE date(AlarmTime/1000,\'unixepoch\',\'localtime\') > strftime(\'%Y-%m-%d\', \'now\', \'-1 day\');';
            //let playlistId = 1;
            db.all(sql, (err, row) =>
            {
                if (err)
                {
                //throw err;
                    return console.error(err.message);
                }
                jsondb=JSON.stringify(row);
                callback(err, jsondb);
            });
            db.close();
        });
    }




    dbUpdateLogAlarmAck(alarmid) {
        const moment = require('moment');
        const formattedDate = moment().valueOf();
        const contondate = moment(formattedDate).format('LLL');

        let jsondb;
        const db = new sqlite3.Database(__dirname + '/alarms/alarm.db');

        const data = [alarmid];
        // open the database connection
        const sql = 'UPDATE alarmlog SET  Acknowledge=\'ack\',AcknowledgeTime='+formattedDate+'  WHERE id = ?';
        // output the INSERT statement
        db.run(sql,data, function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`Rows inserted ${this.changes}`);
        });
        // close the database connection
        db.close();
    }


    //--------------------------------------END SQLITE DB Operations CRUD---------------------------------------------

    writeForFile(fileName,data,callback)
    {
        fs.writeFile(fileName, data, function (err, data)
        {
            callback();
        });
    }



    SetObjectFromJson(element)
    {
        if (element.HighRefTagName != null) {

            this.setObject(element.HighRefTagName, {
                type: 'state',
                common: {
                    name: element.HighRefTagName,
                    type: 'string',
                    role: 'value'
                },
                native: {}
            });
            this.setState(element.HighRefTagName, {val: '0', ack: true});
        }
        if (element.LowRefTagName != null) {
            this.setObject(element.LowRefTagName, {
                type: 'state',
                common: {
                    name: element.LowRefTagName,
                    type: 'string',
                    role: 'value'
                },
                native: {}
            });
            this.setState(element.LowRefTagName, {val: '0', ack: true});
        }
    }




    createStatesFromJson(data) {
        data.forEach(function(element) {
            self.SetObjectFromJson(element);
        });
    }

    //generate json file and set createstates from json
    genjs() {
        let dbjson;
        this.dbgetAlarmFULL(function (err, all) {
            dbjson =JSON.stringify(all);

            self.writeForFile(__dirname +'/alarms/alarm.json',dbjson,function()
            {
            //It is now safe to write/read to alarm.json
                const file = __dirname +'/alarms/alarm.json';
                jsonfile.readFile(file, function(err, obj) {
                    self.createStatesFromJson(obj);
                    const readJson= jsonfile.readFileSync(__dirname +'/alarms/alarm.json');
                    jsondataforalarmcreater=readJson;
                });
            });
        });
    }

    //get sound name to list
    getSoundsName() {

        let element = {},sounds =[];
        const soundsfolder = path.join(__dirname,'admin','sounds');//__dirname + '/admin/sounds/';
        const fs = require('fs');
        fs.readdirSync(soundsfolder).forEach(file => {
        //console.log(file);
            element = {};
            element.value = '';
            element.text = file;
            sounds.push(element);
        });
        const jsonvalue = JSON.stringify(sounds);
        return jsonvalue;
    }

    copysoundfilestovisxxx()
    {
    /*var path = require('path');
    var ncp = require('ncp').ncp;

    ncp.limit = 16;

    var srcPath = __dirname +'\\www\\sounds'
    //path.dirname('www/sounds'); //current folder
    var myexchangepath = webServer.settings.AlarmSoundUrl.replace("/", "\'");
    var destPath = 'C:\\Users\\windows10\\Desktop\\iobroker\\iobroker-data\\files\\vis' //Any destination folder

    console.log('Copying files...');
    ncp(srcPath, destPath, function (err) {
        if (err) {
            return console.error(err);
        }
        console.log('Copying files complete.');
    });*/


    }

    async  copysoundfilestovis (url) {
        const path = require('path');
        const srcPath = __dirname +'\\admin\\sounds';
        const destPath = url +'\\sounds'; //Any destination folder
        const fs = require('fs-extra');
        try {
            await fs.copy(srcPath, destPath);
            console.log('success!');
        } catch (err) {
            console.error(err);
        }
    }



    //polling to AlarmJson
    getalarmforinterval() {
        this.dbgetLogAlarm(function(err, all) {
        //if(all!='[]') {
            self.setState('info.AlarmJson', {val: all, ack: true});
        //}
        });
    }

    //setInterval(getalarmforinterval, 3000);

    Run(){
        const self1 = this;
        self1.interval = setInterval(function() { self1.getalarmforinterval(); },3000);
    }




    Setalarm(element,value)
    {
        const moment = require('moment');
        const formattedDate = moment().valueOf();
        const contondate = moment(formattedDate).format('LLL');


        if (element[0].AlarmActive == 'true') {
            let limitmessage;
            let limit;
            this.getState(element[0].LowRefTagName, function (err, state)
            {

                if (state.val=='0' || state.val != 'ack')
                {
                    if (value <= element[0].LowLimit)
                    {
                        limitmessage = element[0].LowLimitMessage;
                        limit = element[0].LowLimit;
                        self.setState(element[0].LowRefTagName, {val: value, ack: true});
                        const jo = {
                            Tagname: element[0].TagName,
                            Alarmdescription: element[0].AlarmDescription,
                            limitmessage: limitmessage,
                            alarmvalue: value,
                            Limit: limit,
                            Alarmtype:element[0].AlarmType
                        };


                        self.dbgetLogAlarm(function(err, all) {
                            self.setState('info.AlarmJson', {val: all, ack: true});
                        });

                        self.setState('info.AlarmMessage', {val: element[0].LowLimitMessage, ack: true});
                        self.setState('info.AlarmSound', {val: element[0].LowAlarmSound, ack: true});
                        self.setState('info.isAlarm', {val: true, ack: true});
                        self.setState('info.AlarmType', {val: element[0].AlarmType, ack: true});
                        self.dbAddLogAlarm(element[0].TagName, element[0].AlarmType, element[0].AlarmDescription, element[0].LowLimit,element[0].LowLimitMessage,'low',formattedDate,value);
                    }
                }
            });

            this.getState(element[0].HighRefTagName,function (err, state)
            {
                if (state.val=='0' || state.val != 'ack')
                {
                    if (value >= element[0].HighLimit)
                    {
                        limitmessage = element[0].HighLimitMessage;
                        limit = element[0].HighLimit;
                        self.setState(element[0].HighRefTagName, {val: value, ack: true});
                        const jo = {
                            Tagname: element[0].TagName,
                            Alarmdescription: element[0].AlarmDescription,
                            limitmessage: limitmessage,
                            alarmvalue: value,
                            Limit: limit,
                            Alarmtype:element[0].AlarmType
                        };


                        self.dbgetLogAlarm(function(err, all) {
                            self.setState('info.AlarmJson', {val: all, ack: true});
                        });
                        self.setState('info.AlarmMessage', {val: element[0].HighLimitMessage, ack: true});
                        self.setState('info.AlarmSound', {val: element[0].HighAlarmSound, ack: true});
                        self.setState('info.isAlarm', {val: true, ack: true});
                        self.setState('info.AlarmType', {val: element[0].AlarmType, ack: true});
                        self.dbAddLogAlarm(element[0].TagName, element[0].AlarmType, element[0].AlarmDescription, element[0].HighLimit, element[0].HighLimitMessage,'high',formattedDate, value);
                    }
                }
            });


            //reset 0
            this.getState(element[0].TagName,function (err, state)
            {
                if (value <= element[0].HighLimit && value >= element[0].LowLimit)
                {
                    self.setState('info.AlarmMessage', {val: 0, ack: true});
                    self.setState(element[0].LowRefTagName, {val: '0', ack: true});
                    self.setState(element[0].HighRefTagName, {val: '0', ack: true});
                    self.setState('info.isAlarm', {val: false, ack: true});
                    self.setState('info.AlarmType', {val: '0', ack: true});
                    self.setState('info.AlarmSound', {val: '0', ack: true});
                }
            });
        }
    }



    //--------------------------------End Alarm Creater JSON CRUD-------------------------------------------
    //--------------------------------End Alarm Creater JSON CRUD-------------------------------------------
    //--------------------------------End Alarm Creater JSON CRUD-------------------------------------------
    //--------------------------------End Alarm Creater JSON CRUD-------------------------------------------



}

Array.prototype.findByValueOfObject = function(key, value) {
    return this.filter(function(item) {
        return (item[key] === value);
    });
};

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new MyAlarm(options);
} else {
    // otherwise start the instance directly
    new MyAlarm();
}