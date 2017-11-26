'use strict';

const express = require("express");
const http = require('http');
const socketio = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const passport = require('passport');
const mongoose = require('mongoose');

const config = require('./utils/config');
const restRoutes = require('./routes/rest-routes');
const socketRoutes = require('./routes/socket-routes');

class Server {

  constructor() {
    this.port = process.env.PORT || config.port;
    this.host = `localhost`;

    this.mongoose = mongoose;

    this.app = express();
    this.http = http.Server(this.app);
    this.socket = socketio(this.http);
  }

  appConfig() {
    this.app.use(bodyParser.json());
    this.app.use(cors());
    this.app.use(express.static('public'));
    this.passportMiddleware();

  }

  passportMiddleware() {
    this.app.use(passport.initialize());
    this.app.use(passport.session());
    require('./utils/passport')(passport);
  }

  dbConfig() {
    this.mongoose.Promise = global.Promise;
    this.mongoose.connect(process.env.MONGODB_URI || config.database, {
      useMongoClient: true
    })
      .then(() => {
        console.log('Connected to db');
      }).
      catch((err) => {
        console.log('Couldn\'t connect to db:', err);
      });

  }

  includeRoutes() {
    new restRoutes(this.app).routesConfig();
    new socketRoutes(this.socket).socketConfig();
  }

  errorMiddleware() {
    this.app.use((error, request, response, next) => {
      if (response.headersSent) {
        return next(error);
      }
      console.log('sarouel');
      response.status(500).json({
        error: error.message
      });
    });
  }

  appExecute() {

    this.appConfig();
    this.dbConfig();
    this.includeRoutes();
    // this.errorMiddleware();


    this.http.listen(this.port, this.host, () => {
      console.log(`Listening on http://${this.host}:${this.port}`);
    });
  }

}

const app = new Server();
app.appExecute();