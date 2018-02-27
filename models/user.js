"use strict";
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  pseudo: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  activity: {
    socket: {
      type: String
    },
    online: {
      type: Boolean
    }
  },
  notifications: [{
    kind: {
      type: String,
      enum: ['friend', 'room', 'account', 'other']
    },
    emitter: {
      type: String
    },
    ack: {
      type: Boolean,
      default: false
    }
  }],
  friendrequest: [{
    type: String,
    ref: 'User'
  }],
  friends: [{
    type: String,
    ref: 'User'
  }],
  blocked: [{
    type: String,
    ref: 'User'
  }],
  rooms: [{
    type: String,
    ref: 'Room'
  }]
}, {
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  });

class User {

  constructor() {
    this.model = mongoose.model('User', UserSchema);
    this.prefix = { single: '/user', plural: '/users' };
    this._init(this.model);
  }

  _init(model) {
    UserSchema.virtual('username').get(function () {
      return this._id;
    });

    UserSchema.path('_id').validate({
      validator: (value) => {
        return new Promise((resolve, reject) => {
          const regex = /[a-zA-Z0-9_-]{3,20}/;
          resolve(regex.test(value));
        });
      }, msg: 'INVALID'
    });

    UserSchema.path('_id').validate({
      validator: (value) => {
        return new Promise(function (resolve, reject) {
          return model.findOne({ _id: value }).exec()
            .then((user) => {
              (user !== null) ? resolve(false) : resolve(true);
            })
            .catch((error) => {
              reject(error);
            });
        });
      }, msg: 'TAKEN'
    });

    UserSchema.path('email').validate({
      validator: (value) => {
        return new Promise(function (resolve, reject) {
          return model.findOne({ email: value }).exec()
            .then((user) => {
              (user !== null) ? resolve(false) : resolve(true);
            })
            .catch((error) => {
              reject(error);
            });
        });
      }, msg: 'TAKEN'
    });

    UserSchema.path('email').validate({
      validator: (value) => {
        return new Promise((resolve, reject) => {
          const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
          resolve(regex.test(value));
        });
      }, msg: 'INVALID'
    });

    UserSchema.path('pseudo').validate({
      validator: (value) => {
        return new Promise((resolve, reject) => {
          const regex = /[a-zA-Z0-9_-]{3,20}/;
          resolve(regex.test(value));
        });
      }, msg: 'INVALID'
    });
  }

  usernameAvailable(username) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: username }).exec()
        .then((user) => {
          if (user) {
            resolve(false);
          } else {
            resolve(true);
          }
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  emailAvailable(email, callback) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ email: email }, { "email": 1 }).exec()
        .then((user) => {
          if (user) {
            resolve(false);
          } else {
            resolve(true);
          }
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  getUser(username, options = {}) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: username }, options).exec()
        .then((user) => {
          if (!user) {
            throw new Error('No such user in db');
          } else {
            resolve(user);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  isConnectedUser(username) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: username, 'activity.online': true }).exec()
        .then((user) => {
          if (!user) {
            const loadout = {
              username: username,
              online: false
            }
            resolve(loadout);
          } else {
            const loadout = {
              username: username,
              online: true,
              socket_id: user.activity.socket
            }
            resolve(loadout);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  isUser(username) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: username }).exec()
        .then((user) => {
          (user == null) ? resolve(false) : resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    })
  }

  isFriend(performer, username) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: performer, friends: username }).exec()
        .then((user) => {
          (user == null) ? resolve(false) : resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    })
  }

  isBlocked(performer, username) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: username, friendrequest: performer }).exec()
        .then((is_blocked) => {
          (is_blocked == null) ? resolve(false) : resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  isRequestingFriend(performer, username) {
    return new Promise((resolve, reject) => {
      this.model.findOne({
        _id: username,
        friendrequest: performer
      }, { notifications: 1 }).exec()
        .then((is_requesting) => {
          (is_requesting == null) ? resolve(false) : resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  createUser(username, email, pseudo, password) {
    return new Promise((resolve, reject) => {
      this.usernameAvailable(username)
        .then((is_available) => {
          if (!is_available) {
            throw new Error('username already in use');
          } else {
            return this.emailAvailable(email);
          }
        })
        .then((is_available) => {
          if (!is_available) {
            throw new Error('email already in use');
          } else {
            bcrypt.genSalt(10, (err, salt) => {
              bcrypt.hash(password, salt, (error, hash) => {
                if (error) {
                  reject(error);
                } else {
                  const newUser = new this.model({
                    _id: username,
                    email: email,
                    pseudo: pseudo,
                    password: hash
                  });
                  return newUser.save();
                }
              });
            });
          }
        })
        .then((user) => {
          resolve(user);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  comparePassword(candidatePassword, hash) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(candidatePassword, hash, (error, isMatch) => {
        if (error) {
          reject(error);
        }
        resolve(isMatch);
      });
    });
  }

  blockUser(performer, username) {
    return new Promise((resolve, reject) => {
      let is_user_performer = this.isUser(performer);
      let is_user_username = this.isUser(username);
      Promise.all([is_user_performer, is_user_username])
        .then((is_user_results) => {
          if (!is_user_results[0] || !is_user_results[1]) {
            throw new Error('invalid parameters');
          } else {
            return this.isFriend(performer, username);
          }
        })
        .then((is_friend) => {
          if (is_friend) {
            return this.unfriendUser(performer, username);
          } else {
            return this.model.findOneAndUpdate({ _id: performer }, {
              $push: {
                blocked: username
              }
            }, { upsert: true, new: true }).exec();
          }
        })
        .then((mystery_promise) => {
          if (mystery_promise.unfriended) {
            return this.model.findOneAndUpdate({ _id: performer }, {
              $push: {
                blocked: username
              }
            }, { upsert: true, new: true }).exec();
          } else {
            resolve({ blocked: username });
          }
        })
        .then((updated_performer) => {
          resolve({ blocked: username });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  unfriendUser(performer, username) {
    return new Promise((resolve, reject) => {
      let is_user_performer = this.isUser(performer);
      let is_user_username = this.isUser(username);
      Promise.all([is_user_performer, is_user_username])
        .then((is_user_results) => {
          if (!is_user_results[0] || !is_user_results[1]) {
            throw new Error('invalid parameters');
          } else {
            return this.isFriend(performer, username);
          }
        })
        .then((is_friend) => {
          if (!is_friend) {
            throw new Error('user not friend in the first place');
          } else {
            let remove_performer = this.model.findOneAndUpdate({ _id: username }, {
              $pull: {
                friends: performer
              }
            }, { upsert: true, new: true }).exec();
            let remove_username = this.model.findOneAndUpdate({ _id: performer }, {
              $pull: {
                friends: username
              }
            }, { upsert: true, new: true }).exec();
            return Promise.all([remove_performer, remove_username]);
          }
        })
        .then(() => {
          resolve({ unfriended: username });
        })
        .catch((error) => {
          reject(error);
        });
    })
  }

  requestFriend(performer, username) {
    return new Promise((resolve, reject) => {
      let is_user_performer = this.isUser(performer);
      let is_user_username = this.isUser(username);
      Promise.all([is_user_performer, is_user_username])
        .then((is_user_results) => {
          if (!is_user_results[0] || !is_user_results[1]) {
            throw new Error('invalid parameters');
          } else {
            return this.isFriend(performer, username);
          }
        })
        .then((is_friend) => {
          if (is_friend) {
            throw new Error('user already in friend list');
          } else {
            return this.isRequestingFriend(performer, username);
          }
        })
        .then((is_requesting) => {
          if (is_requesting) {
            throw new Error('friend request already sent to user');
          } else {
            return this.isBlocked(performer, username);
          }
        })
        .then((is_blocked) => {
          if (is_blocked) {
            resolve({ requested: false });
          } else {
            return this.model.findOneAndUpdate({ _id: username }, {
              $push: {
                friendrequest: performer
              }
            }).exec();
          }
        })
        .then((requested_user) => {
          resolve({ requested: true });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  replyRequestFriend(performer, username, action) {
    return new Promise((resolve, reject) => {
      let is_user_performer = this.isUser(performer);
      let is_user_username = this.isUser(username);
      Promise.all([is_user_performer, is_user_username])
        .then((is_user_results) => {
          if (!is_user_results[0] || !is_user_results[1]) {
            throw new Error('invalid parameters');
          } else {
            return this.isFriend(performer, username);
          }
        })
        .then((is_friend) => {
          if (is_friend) {
            throw new Error('user already in friend list');
          } else {
            return this.isRequestingFriend(username, performer);
          }
        })
        .then((is_requesting) => {
          if (!is_requesting) {
            throw new Error('no user invitation to reply to');
          } else {
            switch (action) {
              case 'accept':
                let add_performer = this.model.findOneAndUpdate({ _id: username }, {
                  $push: {
                    friends: performer
                  }
                }, { upsert: true, new: true }).exec();
                let add_username = this.model.findOneAndUpdate({ _id: performer }, {
                  $push: {
                    friends: username
                  },
                  $pull: {
                    friendrequest: username
                  }
                }, { upsert: true, new: true }).exec();
                return Promise.all([add_performer, add_username]);
                break;
              case 'deny':
                return this.model.findOneAndUpdate({ _id: username }, {
                  $pull: {
                    friendrequest: performer
                  }
                }, { upsert: true, new: true }).exec();
                break;
              default:
                throw new Error('unknown action');
                break;
            }
          }
        })
        .then((add_results) => {
          resolve({ user: username, action: action });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  updateRooms(username, room_id, action) {
    return new Promise((resolve, reject) => {
      let update = {};
      switch (action) {
        case 'add':
          update = {
            $push: {
              rooms: room_id
            }
          }
          break;
        case 'remove':
          update = {
            $pull: {
              rooms: room_id
            }
          }
          break;
        default:
          throw new Error('missing or incorrect action');
          break;
      }
      this.model.findOneAndUpdate({ _id: username }, update, { upsert: true, new: true }).exec()
        .then((user) => {
          if (!user) {
            throw new Error('couldn\'t update rooms');
          } else {
            resolve(user);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  updateStatus(username, socket_id, action) {
    return new Promise((resolve, reject) => {
      let update = {};
      switch (action) {
        case 'logout':
          update = {
            $set: {
              activity: {
                online: false
              }
            }
          }
          break;
        case 'login':
          update = {
            $set: {
              activity: {
                socket: socket_id,
                online: true
              }
            }
          }
          break;
        default:
          throw new Error('missing or incorrect action');
          break;
      }
      this.model.findOneAndUpdate({ _id: username }, update, { new: true }).exec()
        .then((user) => {
          if (!user) {
            throw new Error('couldn\'t update status');
          } else {
            resolve(user);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  searchUsers(username, room_id, query) {
    return new Promise((resolve, reject) => {
      let results;
      return require('./room').isGuest(username, room_id)
        .then((is_user) => {
          if (!is_user) {
            throw new Error('cannot perform this action');
          } else {
            // query = '/' + query + '/i';
            return this.model.find({ _id: { $regex: query }, }, { _id: 1, blocked: 1, rooms: 1 }).exec()
          }
        })
        .then((users) => {
          if (!users) {
            resolve(null);
          } else {
            results = users;
            let whitelisted = results.map(user => {
              return require('./room').isWhitelisted(user._id, room_id);
            });
            return Promise.all(whitelisted);
          }
        })
        .then((are_whitelisted) => {
          for (let i = 0; i < results.length; i++) {
            if (are_whitelisted[i]) {
              results.splice(i, 1);
            }
          }
          if (results.length == 0) {
            resolve(null);
          } else {
            let guests = results.map(user => {
              return require('./room').isGuest(user._id, room_id);
            });
            return Promise.all(guests);
          }
        })
        .then((are_guests) => {
          for (let i = 0; i < results.length; i++) {
            if (are_guests[i]) {
              results.splice(i, 1);
            }
          }
          if (results.length == 0) {
            resolve(null);
          } else {
            let loadout = [];
            for (let i = 0; i < results.length; i++) {
              if (results[i]) {
                loadout.push({ user: results[i]._id });
              }
            }
            resolve(loadout);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

}
module.exports = new User();