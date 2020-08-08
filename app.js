import express from 'express';
import http from 'http';
import { middlewares } from 'sc-common';
import socketIo from 'socket.io';
import BaseStartup from './startup.js';

export default class BaseGameApp {
    /**
     * @param {BaseStartup} startup
     */
    constructor(
        gameName,
        storage,
        appConfigs,
        startup,
        initSocketRouterFunc,
        initAdminSocketRouterFunc,
        initHttpRouterFunc,
        socketOptions = { socketIOPingInterval: 6 * 3600 * 1000, socketIOPingTimeout: 60 * 1000 }
    ) {
        this.gameName = gameName;
        this.hostingPort = appConfigs.hostingPort;
        this.appConfigs = appConfigs;
        this.initSocketRouterFunc = initSocketRouterFunc;
        this.initAdminSocketRouterFunc = initAdminSocketRouterFunc;
        this.initHttpRouterFunc = initHttpRouterFunc;
        this.storage = storage;
        this.startup = startup ?? new BaseStartup(appConfigs, storage);
        this.socketIOPingInterval = socketOptions.socketIOPingInterval;
        this.socketIOTimeout = socketOptions.socketIOPingTimeout;
    }

    run = async () => {
        const app = express();
        const httpServer = http.createServer(app);
        const socketServer = socketIo(httpServer, {
            pingInterval: this.socketIOPingInterval,
            pingTimeout: this.socketIOPingTimeout,
        });

        await this.startup.configureServices(app);

        app.set('port', process.env.PORT || this.hostingPort);
        app.get('/', function (req, res, next) {
            res.send('Hello');
        });
        this.initHttpRouterFunc(app);

        socketServer.of(`/user/${this.gameName}`).on('connection', (socketClient) => {
            this.initSocketRouterFunc(socketClient);
        });

        socketServer.of(`/admin/${this.gameName}`).on('connection', (socketClient) => {
            this.initAdminSocketRouterFunc(socketClient);
        });

        socketServer.origins((origin, callback) => {
            if (!this.appConfigs.enableCorsWs) {
                callback(null, true);
                return;
            }

            if ((this.appConfigs.corsUrls && this.appConfigs.corsUrls.indexOf(origin) !== -1) || !origin) {
                callback(null, true);
            } else {
                callback(`Not allowed by CORS ${origin}`, false);
            }
        });

        httpServer.listen(app.get('port'), async () => {
            console.log('Express server started and running!');
            await this.startup.start();
        });

        middlewares.processErrorHandler.handle(httpServer, process);
    };
}
