'use strict';

const socketioJwt = require('socketio-jwt');
const secret = require('../utils/config').secret;

const User = require('../models/user');
const Room = require('../models/room');
const Message = require('../models/message');
const Thread = require('../models/thread');

class Socket {

  constructor(socket) {
    this.io = socket;
    this.user_model = User;
    this.room_model = Room;
    this.message_model = Message;
    this.thread_model = Thread;
  }

  socketEvents() {

    this.io.on('connect', socketioJwt.authorize({
      secret: secret,
      timeout: 15000
    })).on('authenticated', (socket) => {
      const username = socket.decoded_token.userIdentity;

      this.user_model.updateStatus(username, socket, 'login')
        .then((user) => {
          let friends = [];
          for (let i = 0; i < user.friends.length; i++) {
            friends.push(this.user_model.isConnectedUser(user.friends[i]));
          }
          return Promise.all(friends);
        })
        .then((friends) => {
          const loadout = {
            friends: friends
          }
          this.io.to(socket.id).emit('online-friends', loadout);
        })
        .catch((error) => {
          const loadout = {
            success: false,
            error: error
          }
          this.io.to(socket.id).emit('error-manager', loadout);
        });

      socket.on('join-rooms', () => {
        this.user_model.getUser(username, { rooms: 1 })
          .then((user) => {
            let rooms_joined = [];
            for (let i = 0; i < user.rooms.length; i++) {
              rooms_joined.push(new Promise((resolve, reject) => {
                socket.join(user.rooms[i], () => {
                  resolve(user.rooms[i]);
                });
              }));
            }
            return Promise.all(rooms_joined);
          })
          .then((rooms) => {
            const loadout = {
              rooms: rooms
            }
            this.io.to(socket.id).emit('join-rooms-ack', loadout);
          })
          .catch((error) => {
            const loadout = {
              success: false,
              error: error
            }
            this.io.to(socket.id).emit('error-manager', loadout);
          });
      });

      socket.on('send-thread', (data) => {
        if (!data.content || !data.room_id || !data.thread_id || !data.media) {
          const loadout = {
            success: false,
            error: 'invalid parameters'
          }
          this.io.to(socket.id).emit('error-manager', loadout);
        } else {
          this.thread_model.addMessage(username, data.room_id, data.thread_id, data.media, data.content)
            .then((new_message) => {
              const loadout = {
                message: new_message
              }
              this.io.to(data.room_id).emit('new-message', loadout);
            })
            .catch((error) => {
              console.log(error);
              const loadout = {
                success: false,
                error: error
              }
              this.io.to(socket.id).emit('error-manager', loadout);
            });
        }
      });

      socket.on('logout', (data) => {
        this.user_model.updateStatus(username, socket, 'logout')
          .then((user) => {
            this.io.to(socket.id).emit('logout-response', {
              success: true
            });

          })
        helper.logout(userId, false, (error, result) => {



          socket.broadcast.emit('chat-list-response', {
            error: false,
            userDisconnected: true,
            socketId: socket.id
          });
        });
      });

      socket.on('disconnect', () => {
        socket.broadcast.emit('chat-list-response', {
          error: false,
          userDisconnected: true,
          socketId: socket.id
        });
      });

    });

  }

  socketConfig() {
    // this.io.use((socket) => {
    //   const opts = {
    //     jwtFromRequest: socket.request._query['auth_token'],
    //     secretOrKey: process.env.SECRET || secret
    //   };
    //   return new JwtStrategy(opts, (jwt_payload, done) => {
    //     user_model.getUser(jwt_payload.userIdentity, { username: 1 })
    //       .then((user) => {
    //         return this.user_model.updateStatus(user._id, 'login');
    //       })
    //       .then((user) => {
    //         return done(null, user);
    //       })
    //       .catch((error) => {
    //         return done(error, false);
    //       });
    //   });
    // });

    this.socketEvents();
  }
}
module.exports = Socket;