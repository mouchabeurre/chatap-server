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
      console.log(username, 'connected');

      this.init(username, socket)
        .catch((error) => {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'authenticate',
            error: error
          });
        });

      socket.on('create-room', (data) => {
        if (!data.name) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'create-room',
            error: 'invalid parameters'
          });
        } else {
          this.room_model.createRoom(data.name, username)
            .then((room) => {
              if (data.guests) {
                this.io.to(socket.id).emit('create-room-ack', {
                  success: true,
                  room_id: room._id,
                  room_name: room.name,
                  room_date: room.date,
                  guests: data.guests
                });
              } else {
                this.io.to(socket.id).emit('create-room-ack', {
                  success: true,
                  room_id: room._id,
                  room_name: room.name,
                  room_date: room.date
                });
              }
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'create-room',
                error: error
              });
            });
        }
      });

      socket.on('get-room', (data) => {
        if (!data.room_id) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'get-room',
            error: 'invalid parameters'
          });
        } else {
          this.room_model.getRoom(username, data.room_id)
            .then((room) => {
              this.io.to(socket.id).emit('get-room-ack', {
                success: true,
                room: room
              });
              const guests = room.guests.map(guest => {
                return this.user_model.isConnectedUser(guest.user);
              });
              return Promise.all(guests);
            })
            .then((guests) => {
              const loadout = guests.map(guest => {
                return {
                  user: guest.username,
                  status: guest.online
                };
              });
              this.io.to(socket.id).emit('get-guests-ack', {
                success: true,
                guests: loadout
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'get-room',
                error: error
              });
            });
        }
      });

      socket.on('rename-room', (data) => {
        if (!data.room_id || !data.new_name) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'rename-room',
            error: 'invalid parameters'
          });
        } else {
          this.room_model.renameRoom(username, data.room_id, data.new_name)
            .then((room_name) => {
              this.io.to(data.room_id).emit('rename-room-ack', {
                success: true,
                room_id: data.room_id,
                room_name: room_name
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'rename-room',
                error: error
              });
            });
        }
      });

      socket.on('delete-room', (data) => {
        if (!data.room_id) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'delete-room',
            error: 'invalid parameters'
          });
        } else {
          this.room_model.deleteRoom(username, data.room_id)
            .then((guests) => {
              const promises = guests.map(guest => {
                return this.user_model.isConnectedUser(guest);
              });
              return Promise.all(promises);
            })
            .then((connected_guests) => {
              connected_guests.map(guest => {
                if (guest.online) {
                  this.io.to(guest.socket_id).emit('removed-room', {
                    success: true,
                    room_id: data.room_id
                  });
                }
              });
              this.io.to(socket.id).emit('delete-room-ack', {
                success: true,
                room_id: data.room_id
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'delete-room',
                error: error
              });
            });
        }
      });

      socket.on('get-thread', (data) => {
        if (!data.thread_id || !data.room_id) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'get-thread',
            error: 'invalid parameters'
          });
        } else {
          this.thread_model.getThread(username, data.room_id, data.thread_id, { feed: 0 })
            .then((thread) => {
              this.io.to(socket.id).emit('get-thread-ack', {
                success: true,
                thread: thread
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'get-thread',
                error: error
              });
            });
        }
      });

      socket.on('get-stream', (data) => {
        if (!data.thread_id || !data.room_id || data.offset === undefined) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'get-stream',
            error: 'invalid parameters'
          });
        } else {
          this.message_model.getStream(username, data.room_id, data.thread_id, data.offset)
            .then((stream) => {
              this.io.to(socket.id).emit('get-stream-ack', {
                success: true,
                stream: stream
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'get-stream',
                error: error
              });
            });
        }
      });

      socket.on('rename-thread', (data) => {
        if (!data.room_id || !data.thread_id || !data.new_name) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'rename-thread',
            error: 'invalid parameters'
          });
        } else {
          this.thread_model.renameThread(username, data.room_id, data.thread_id, data.new_name)
            .then((thread_name) => {
              this.io.to(socket.id).emit('rename-thread-ack', {
                success: true
              });
              this.io.to(data.room_id).emit('thread-renamed', {
                success: true,
                room_id: data.room_id,
                thread_id: data.thread_id,
                thread_name: thread_name
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'rename-thread',
                error: error
              });
            });
        }
      });

      socket.on('delete-thread', (data) => {
        if (!data.room_id || !data.thread_id) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'delete-thread',
            error: 'invalid parameters'
          });
        } else {
          this.thread_model.deleteThread(username, data.room_id, data.thread_id)
            .then((deleted) => {
              this.io.to(socket.id).emit('delete-thread-ack', {
                success: true
              });
              this.io.to(data.room_id).emit('deleted-thread', {
                success: true,
                room_id: data.room_id,
                thread_id: data.thread_id
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'delete-thread',
                error: error
              });
            });
        }
      });

      socket.on('create-thread', (data) => {
        if (!data.title || !data.room_id) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'create-thread',
            error: 'invalid parameters'
          });
        } else {
          this.room_model.addThread(username, data.room_id, data.title)
            .then((thread) => {
              this.io.to(socket.id).emit('create-thread-ack', {
                success: true
              });
              this.io.to(data.room_id).emit('new-thread', {
                success: true,
                room_id: data.room_id,
                _id: thread._id,
                title: thread.title
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'create-thread',
                error: error
              });
            });
        }
      });

      socket.on('send-thread', (data) => {
        if (!data.content || !data.room_id || !data.thread_id || !data.media) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'send-thread',
            error: 'invalid parameters'
          });
        } else {
          this.thread_model.addMessage(username, data.room_id, data.thread_id, data.media, data.content)
            .then((new_message) => {
              this.io.to(socket.id).emit('send-thread-ack', {
                success: true
              });
              this.io.to(data.room_id).emit('new-message', {
                thread_id: new_message.thread,
                room_id: data.room_id,
                message: new_message
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'send-thread',
                error: error
              });
            });
        }
      });

      socket.on('send-friend-request', (data) => {
        if (!data.requested_user) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'send-friend-request',
            error: 'invalid parameters'
          });
        } else {
          this.user_model.requestFriend(username, data.requested_user)
            .then((result) => {
              if (!result.requested) {
                this.io.to(socket.id).emit('send-friend-request-ack', {
                  success: true,
                  requested: data.requested_user
                });
              } else {
                this.io.to(socket.id).emit('send-friend-request-ack', {
                  success: true,
                  requested: data.requested_user
                });
                return this.user_model.isConnectedUser(data.requested_user);
              }
            })
            .then((requested) => {
              if (requested.online) {
                this.io.to(requested.socket_id).emit('friend-request', {
                  success: true,
                  requester: username
                });
              }
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'send-friend-request',
                error: error
              });
            });
        }
      });

      socket.on('reply-friend-request', (data) => {
        if (!data.action || !data.requester) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'reply-friend-request',
            error: 'invalid parameters'
          });
        } else {
          this.user_model.replyRequestFriend(username, data.requester, data.action)
            .then((result) => {
              return this.user_model.isConnectedUser(data.requester);
            })
            .then((requester) => {
              if (requester.online) {
                if (data.action === 'deny') {
                  this.io.to(requester.socket_id).emit('response-friend-request', {
                    success: true,
                    requested: data.requester,
                    accepted: false
                  });
                } else {
                  this.io.to(requester.socket_id).emit('response-friend-request', {
                    success: true,
                    requested: data.requester,
                    accepted: true
                  });
                }
              }
              this.io.to(socket.id).emit('reply-friend-request-ack', {
                success: true,
                requested: data.requested_user
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'reply-friend-request',
                error: error
              });
            });
        }
      });

      socket.on('block-user', (data) => {
        if (!data.user_block) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'block-user',
            error: 'invalid parameters'
          });
        } else {
          this.user_model.blockUser(username, data.user_block)
            .then((result) => {
              return this.user_model.isConnectedUser(data.user_block);
            })
            .then((user_blocked) => {
              if (user_blocked.online) {
                this.io.to(user_blocked.socket_id).emit('remove-friend', {
                  success: true,
                  unfriend: username
                });
              }
              this.io.to(socket.id).emit('block-user-ack', {
                success: true,
                blocked: data.user_block
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'block-user',
                error: error
              });
            });
        }
      });

      socket.on('search-user', (data) => {
        if (!data.room_id || !data.query) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'search-user',
            error: 'invalid parameters'
          });
        } else {
          this.user_model.searchUsers(username, data.query)
            .then((result) => {
              this.io.to(user_blocked.socket_id).emit('search-user-ack', {
                success: true,
                users: result
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'search-user',
                error: error
              });
            });
        }
      });

      socket.on('add-guest', (data) => {
        if (!data.room_id || !data.add_user) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'add-guest',
            error: 'invalid parameters'
          });
        } else {
          let guest_socket;
          this.room_model.addGuest(username, data.add_user, data.room_id)
            .then(() => {
              this.io.to(socket.id).emit('add-guest-ack', {
                success: true
              });
              this.io.to(data.room_id).emit('new-guest', {
                success: true,
                room_id: data.room_id,
                guest: data.add_user
              });
              return this.user_model.isConnectedUser(data.add_user);
            })
            .then((user) => {
              if (user.online) {
                guest_socket = user.socket_id;
                return this.room_model.getRoom(username, data.room_id, { _id: 1, name: 1, date: 1 });
              }
            })
            .then((room) => {
              this.io.to(guest_socket).emit('added-room', {
                success: true,
                room_name: room.name,
                room_id: room._id,
                room_date: room.date
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'add-guest',
                error: error
              });
            });
        }
      });

      socket.on('join-room', (data) => {
        if (!data.room_id) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'join-room',
            error: 'invalid parameters'
          });
        } else {
          this.room_model.isGuest(username, data.room_id)
            .then((is_guest) => {
              if (!is_guest) {
                this.io.to(socket.id).emit('error-manager', {
                  success: false,
                  path: 'join-room',
                  error: 'cannot join room'
                });
              } else {
                return this.room_model.getRoom(username, data.room_id, { _id: 1, name: 1 });
              }
            })
            .then((room) => {
              socket.join(data.room_id, () => {
                this.io.to(socket.id).emit('join-room-ack', {
                  success: true,
                  room_name: room.name,
                  room_id: room._id
                });
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'join-room',
                error: error
              });
            });
        }
      });

      socket.on('leave-room', (data) => {
        if (!data.room_id) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'leave-room',
            error: 'invalid parameters'
          });
        } else {
          socket.leave(data.room_id, () => {
            this.room_model.leaveGuest(username, data.room_id)
              .then(() => {
                this.io.to(socket.id).emit('leave-room-ack', {
                  success: true,
                  room_id: data.room_id
                });
                this.io.to(data.room_id).emit('left-guest', {
                  success: true,
                  guest: username
                });
              })
              .catch((error) => {
                this.io.to(socket.id).emit('error-manager', {
                  success: false,
                  path: 'leave-room',
                  error: error
                });
              });
          });
        }
      });

      socket.on('remove-guest', (data) => {
        if (!data.room_id || !data.rm_user) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'remove-guest',
            error: 'invalid parameters'
          });
        } else {
          this.user_model.isConnectedUser(data.rm_user)
            .then((user) => {
              if (user.online) {
                // disconnect user from room
                // user.socket_id.leave(data.room_id, () => {
                //   this.io.to(user.socket_id).emit('removed-room', {
                //     success: true,
                //     room_id: data.room_id
                //   });
                // });
              }
              return this.room_model.removeGuest(username, data.rm_user, data.room_id);
            })
            .then((room_guests) => {
              this.io.to(socket.id).emit('remove-guest-ack', {
                success: true
              });
              this.io.to(data.room_id).emit('left-guest', {
                success: true,
                guest: data.rm_user
              });
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'remove-guest',
                error: error
              });
            });
        }
      });

      socket.on('whitelist-guest', (data) => {
        if (!data.room_id || !data.wl_user) {
          this.io.to(socket.id).emit('error-manager', {
            success: false,
            path: 'whitelist-guest',
            error: 'invalid parameters'
          });
        } else {
          this.user_model.isConnectedUser(data.wl_user)
            .then((user) => {
              if (user.online) {
                user.socket_id.leave(data.room_id, () => { // meh
                  this.io.to(user.socket_id).emit('removed-room', {
                    success: true,
                    room_id: data.room_id
                  });
                });
              }
              return this.room_model.whitelistGuest(username, data.wl_user, data.room_id);
            })
            .then((room_loadout) => {
              const loadout = {
                success: true,
                guest: data.wl_user,
              }
              this.io.to(socket.id).emit('whitelist-guest-ack', loadout);
              this.io.to(data.room_id).emit('whitelisted-guest', loadout);
            })
            .catch((error) => {
              this.io.to(socket.id).emit('error-manager', {
                success: false,
                path: 'whitelist-guest',
                error: error
              });
            });
        }
      });

      socket.on('disconnect', () => {
        const loadout = {
          user: username,
          online: false
        }
        this.user_model.updateStatus(username, socket.id, 'logout')
          .then(() => {
            return this.broadcastRooms(username, socket, 'connection-guest', loadout)
          })
          .then(() => {
            return this.broadcastFriends(username, 'connection-friend', loadout);
          })
          .then(() => {
            console.log(username, 'disconnected');
          })
          .catch((error) => {
            console.log('a plus socket, pô quoi savoir faire');
          });
      });
    });
  }

  init(username, socket) {
    return new Promise((resolve, reject) => {
      this.user_model.updateStatus(username, socket.id, 'login')
        .then((user) => {
          let tmp = [];
          tmp.push(this.getOnlineFriends(username, socket.id));
          tmp.push(this.joinRooms(username, socket));
          tmp.push(this.broadcastFriends(username, 'connection-friend', {
            user: username,
            online: true
          }));
          tmp.push(this.broadcastRooms(username, socket, 'connection-guest', {
            user: username,
            online: true
          }));
          return Promise.all(tmp);
        })
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  broadcastRooms(username, socket, path, loadout) {
    return new Promise((resolve, reject) => {
      this.user_model.getUser(username, { rooms: 1 })
        .then((user) => {
          let tmp = [];
          for (let i = 0; i < user.rooms.length; i++) {
            loadout.room_id = user.rooms[i];
            tmp.push(new Promise((resolve, reject) => {
              resolve(socket.to(user.rooms[i]).emit(path, loadout));
            }));
          }
          return Promise.all(tmp);
        })
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  broadcastFriends(username, path, loadout) {
    return new Promise((resolve, reject) => {
      this.user_model.getUser(username, { friends: 1 })
        .then((user) => {
          let tmp = [];
          for (let i = 0; i < user.friends.length; i++) {
            tmp.push(this.user_model.isConnectedUser(user.friends[i]));
          }
          return Promise.all(tmp);
        })
        .then((friends_status) => {
          let send = [];
          for (let i = 0; i < friends_status.length; i++) {
            if (friends_status[i].online) {
              send.push(new Promise((resolve, reject) => {
                resolve(this.io.to(friends_status[i].socket_id).emit(path, loadout));
              }));
            }
          }
          return Promise.all(send);
        })
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  joinRooms(username, socket) {
    return new Promise((resolve, reject) => {
      let roomsToJoin;
      this.user_model.getUser(username, { rooms: 1 })
        .then((user) => {
          if (!user.rooms) {
            this.io.to(socket.id).emit('joined-rooms', {
              success: true,
              rooms: null
            });
          } else {
            roomsToJoin = user.rooms;
            let tmp = [];
            for (let i = 0; i < user.rooms.length; i++) {
              tmp.push(this.room_model.getRoom(username, user.rooms[i], { _id: 1, name: 1, date: 1 }));
            }
            return Promise.all(tmp);
          }
        })
        .then((rooms) => {
          socket.join(roomsToJoin, () => {
            this.io.to(socket.id).emit('joined-rooms', {
              success: true,
              rooms: rooms
            });
          });
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  getOnlineFriends(username, socket_id) {
    return new Promise((resolve, reject) => {
      this.user_model.getUser(username, { friends: 1 })
        .then((user) => {
          let tmp = [];
          for (let i = 0; i < user.friends.length; i++) {
            tmp.push(this.user_model.isConnectedUser(user.friends[i]));
          }
          return Promise.all(tmp);
        })
        .then((friends) => {
          this.io.to(socket_id).emit('connected-friends', {
            success: true,
            friends_status: friends
          });
          resolve();
        })
        .catch((error) => {
          reject(error);
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