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
  friends: [{
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
    this._initSchema(this.model);
  }

  _initSchema(model) {
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
              socket_id: user.socket
            }
          }
        })
    })
  }

  isUser(username) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: username }).exec()
        .then((user) => {
          (user == null) ? resolve(false) : resolve(true);
        })
    })
  }

  isFriend(performer, username) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: performer, friends: username }).exec()
        .then((user) => {
          (user == null) ? resolve(false) : resolve(true);
        })
    })
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

  updateFriends(performer, username, action) {
    return new Promise((resolve, reject) => {
      let is_user_performer = this.isUser(performer);
      let is_user_username = this.isUser(username);
      return Promise.all([is_user_performer, is_user_username]);
    })
      .then((is_user_results) => {
        if (!is_user_results[0] || !is_user_results[1]) {
          throw new Error('invalid parameters');
        } else {
          return this.isFriend(performer, username);
        }
      })
      .then((is_friend) => {
        if (!is_friend) {
          throw new Error('user already in friend list');
        } else {
          let update = {};
          switch (action) {
            case 'add':
              update = {
                $push: {
                  friends: username
                }
              }
              break;
            case 'remove':
              update = {
                $pull: {
                  friends: username
                }
              }
              break;
            default:
              throw new Error('missing or incorrect action');
              break;
          }
          return this.model.findByIdAndUpdate({ _id: performer }, update, { upsert: true, new: true }).exec();
        }
      })
      .then((user) => {
        resolve(user.friends);
      })
      .catch((error) => {
        reject(error);
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
                online: false
              }
            }
          }
          break;
        default:
          throw new Error('missing or incorrect action');
          break;
      }
      this.model.findOneAndUpdate({ _id: username }, update, { upsert: true, new: true })
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

}
module.exports = new User();