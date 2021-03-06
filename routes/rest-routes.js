'use strict';

const passport = require('passport');
const jwt = require('jsonwebtoken');
const config = require('../utils/config');

const User = require('../models/user');
const Room = require('../models/room');
const Message = require('../models/message');

class Routes {

  constructor(app) {
    this.app = app;
    this.user_model = User;
    this.room_model = Room;
    this.message_model = Message;
    this.base = '/api';
  }


  /* creating app Routes starts */
  appRoutes() {

    this.app.get(`${this.base}${this.user_model.prefix.single}/usernamecheck/:username`, (request, response, next) => {
      const username = request.params.username;
      if (!username) {
        let loadout = {
          success: false,
          method: 'post',
          path: 'user/usernamecheck',
          error: 'missing parameter(s)'
        }
        response.status(412).json(loadout);
      } else {
        this.user_model.usernameAvailable(username)
          .then((available) => {
            if (available) {
              let loadout = {
                success: true,
                available: true
              }
              response.status(200).json(loadout);
            } else {
              let loadout = {
                success: true,
                available: false
              }
              response.status(200).json(loadout);
            }
          })
          .catch((error) => {
            next(error);
          });
      }
    });

    this.app.get(`${this.base}${this.user_model.prefix.single}/emailcheck`, (request, response, next) => {
      const email = request.params.email;
      if (!email) {
        let loadout = {
          success: false,
          method: 'post',
          path: 'user/emailcheck',
          error: 'missing parameter(s)'
        }
        response.status(412).json(loadout);
      } else {
        this.user_model.emailAvailable(email)
          .then((available) => {
            if (available) {
              let loadout = {
                success: true,
                available: true
              }
              response.status(200).json(loadout);
            } else {
              let loadout = {
                success: true,
                available: false
              }
              response.status(200).json(loadout);
            }
          })
          .catch((error) => {
            next(error);
          });
      }
    });

    this.app.post(`${this.base}${this.user_model.prefix.single}/register`, (request, response, next) => {
      const username = request.body.username;
      const email = request.body.email;
      const pseudo = request.body.pseudo;
      const password = request.body.password;
      if (!username || !email || !pseudo || !password) {
        let loadout = {
          success: false,
          method: 'post',
          path: 'user/register',
          error: 'missing parameter(s)'
        }
        response.status(412).json(loadout);
      } else {
        this.user_model.createUser(username, email, pseudo, password)
          .then((user) => {
            let loadout = {
              success: true
            }
            response.status(201).json(loadout);
          })
          .catch((error) => {
            next(error);
          });
      }
    });

    this.app.post(`${this.base}${this.user_model.prefix.single}/authenticate`, (request, response, next) => {
      const username = request.body.username;
      const password = request.body.password;

      if (!username || !password) {
        const loadout = {
          success: false,
          method: 'post',
          path: 'user/authenticate',
          error: 'invalid request'
        }
        response.status(400).json(loadout);
      } else {
        this.user_model.isConnectedUser(username)
          .then((status) => {
            if (status.online) {
              const loadout = {
                success: false,
                method: 'post',
                path: 'user/authenticate',
                error: 'user already connected'
              }
              response.status(412).json(loadout);
            } else {
              return this.user_model.getUser(username);
            }
          })
          .then((user) => {
            if(!user) {
              const loadout = {
                success: false,
                method: 'post',
                path: 'user/authenticate',
                error: 'wrong username or password'
              }
              response.status(412).json(loadout);
            }
            return this.user_model.comparePassword(password, user.password);
          })
          .then((isMatch) => {
            if (isMatch) {
              const secret = process.env.SECRET || config.secret
              const token = jwt.sign({
                userIdentity: username
              }, secret, {
                  expiresIn: 604800 // 1 week
                });
              const loadout = {
                success: true,
                token: token
              }
              response.status(200).json(loadout);
            } else {
              const loadout = {
                success: false,
                method: 'post',
                path: 'user/authenticate',
                error: 'wrong parameter(s)'
              }
              response.status(412).json(loadout);
            }
          })
          .catch((error) => {
            next(error);
          });
      }
    });
  }

  routesConfig() {
    this.appRoutes();
  }
}
module.exports = Routes;