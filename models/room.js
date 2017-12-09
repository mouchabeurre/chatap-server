"use strict";
const mongoose = require('mongoose');
const shortid = require('shortid');

const User = require('./user');

const RoomSchema = mongoose.Schema({
  _id: {
    type: String,
    default: shortid.generate
  },
  name: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  mainthread: {
    type: String,
    ref: 'Thread'
  },
  threads: [{
    type: String,
    ref: 'Thread'
  }],
  guests: [{
    user: {
      type: String,
      ref: 'User'
    },
    privilege: {
      type: String,
      enum: ['owner', 'super', 'basic'],
      default: 'basic'
    }
  }],
  suggestions: [{
    kind: {
      type: String,
      enum: ['add', 'remove', 'whitelist', 'grant']
    },
    user: {
      type: String,
      ref: 'User'
    },
    message: {
      type: String
    }
  }],
  whitelisted: [{
    type: String,
    ref: 'User'
  }]
}, {
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
  });

class Room {

  constructor() {
    this.model = mongoose.model('Room', RoomSchema);;
    this.user_model = User;
    this.prefix = { single: '/room', plural: '/rooms' };
    this._init();
  }

  _init() {
    RoomSchema.virtual('room_id').get(function () {
      return this._id;
    });

    RoomSchema.path('name').validate({
      validator: (value) => {
        return new Promise((resolve, reject) => {
          const regex = /[a-zA-Z0-9_-]{2,20}/;
          resolve(regex.test(value));
        });
      }, msg: 'INVALID'
    });
  }

  getRoom(performer, room_id, options = {}) {
    return new Promise((resolve, reject) => {
      this.isGuest(performer, room_id)
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('not allowed to access');
          } else {
            return this.model.findOne({ room_id: room_id }, options).exec();
          }
        })
        .then((room) => {
          if (!room) {
            throw new Error('no such room in db');
          } else {
            resolve(room);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  createRoom(name, owner) {
    return new Promise((resolve, reject) => {
      let response;
      this.user_model.isUser(owner)
        .then((is_user) => {
          if (!is_user) {
            throw new Error('no such user in db');
          } else {
            const newRoom = new this.model({
              name: name,
              owner: owner,
              guests: [{
                user: owner,
                privilege: 'owner'
              }]
            });
            return newRoom.save();
          }
        })
        .then((room) => {
          response = room;
          return require('./thread').createThread(room._id, 'Main thread');
        })
        .then((thread) => {
          return this.model.findOneAndUpdate({ _id: response._id },
            {
              $set: {
                mainthread: thread._id
              }
            }).exec();
        })
        .then((room) => {
          response = room;
          return this.user_model.updateRooms(owner, room._id, 'add');
        })
        .then(() => {
          resolve(response);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  addGuest(performer, username, room_id, privilege = 'basic') {
    return new Promise((resolve, reject) => {
      this.isGuest(performer, room_id)
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('you cannot perform this action');
          } else {
            return this.getPrivilege(performer, room_id);
          }
        })
        .then((privilege) => {
          if (privilege === 'basic') {
            throw new Error('not enough privilege');
          } else {
            return this.isWhitelisted(username, room_id);
          }
        })
        .then((is_whitelisted) => {
          if (is_whitelisted) {
            throw new Error('is whitelisted in this room');
          } else {
            return this.user_model.isUser(username);
          }
        })
        .then((is_user) => {
          if (!is_user) {
            throw new Error('no such user in db');
          } else {
            return this.isGuest(username, room_id);
          }
        })
        .then((is_guest) => {
          if (is_guest) {
            throw new Error('is already guest in this room');
          } else {
            let user_update = this.user_model.updateRooms(username, room_id, 'add');
            let room_update = this.model.findOneAndUpdate({ _id: room_id },
              {
                $push: {
                  guests: {
                    user: username,
                    privilege: privilege
                  }
                }
              }, { upsert: true, new: true }).exec();
            return Promise.all([user_update, room_update]);
          }
        })
        .then((update_result) => {
          resolve(update_result[1].guests);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  removeGuest(performer, username, room_id) {
    return new Promise((resolve, reject) => {
      this.isGuest(performer, room_id)
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('you cannot perform this action');
          } else {
            return this.getPrivilege(performer, room_id);
          }
        })
        .then((privilege) => {
          if (privilege === 'basic') {
            throw new Error('not enough privilege');
          } else {
            return this.isGuest(username, room_id);
          }
        })
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('no such guest to remove');
          } else {
            return this.getPrivilege(username, room_id);
          }
        })
        .then((privilege) => {
          if (privilege === 'owner') {
            throw new Error('you cannot remove owner');
          } else {
            let user_update = this.user_model.updateRooms(username, room_id, 'remove');
            let room_update = this.model.findOneAndUpdate({ _id: room_id },
              {
                $pull: {
                  guests: { user: username }
                }
              }, { upsert: true, new: true }).exec();
            return Promise.all([user_update, room_update]);
          }
        })
        .then((update_result) => {
          resolve(update_result[1].guests);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  whitelistGuest(performer, username, room_id) {
    return new Promise((resolve, reject) => {
      this.isGuest(performer, room_id)
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('you cannot perform this action');
          } else {
            return this.getPrivilege(performer, room_id);
          }
        })
        .then((privilege) => {
          if (privilege === 'basic') {
            throw new Error('not enough privilege');
          } else {
            return this.isWhitelisted(username, room_id);
          }
        })
        .then((is_whitelisted) => {
          if (is_whitelisted) {
            throw new Error('user already in whitelist');
          } else {
            return this.isGuest(username, room_id);
          }
        })
        .then((is_guest) => {
          if (!is_guest) {
            return this.model.findOneAndUpdate({ _id: room_id },
              {
                $push: {
                  whitelisted: username
                }
              }, { upsert: true, new: true }).exec();
          } else {
            return this.getPrivilege(username, room_id);
          }
        })
        .then((room_or_privilege) => {
          if (!(typeof (room_or_privilege) === 'string')) {
            const loadout = {
              guests: room_or_privilege.guests
            }
            resolve(loadout);
          } else {
            if (room_or_privilege === 'owner') {
              throw new Error('you cannot whitelist owner');
            } else {
              let user_update = this.user_model.updateRooms(username, room_id, 'remove');
              let room_update = this.model.findOneAndUpdate({ _id: room_id },
                {
                  $pull: {
                    guests: { user: username }
                  },
                  $push: {
                    whitelisted: username
                  }
                }, { upsert: true, new: true }).exec();
              return Promise.all([user_update, room_update]);
            }
          }
        })
        .then((update_result) => {
          const loadout = {
            guests: update_result[1].guests,
            whitelisted: update_result[1].whitelisted
          }
          resolve(loadout);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  addThread(performer, room_id, title) {
    return new Promise((resolve, reject) => {
      let response;
      this.getPrivilege(performer, room_id)
        .then((privilege) => {
          if (privilege === 'basic') {
            throw new Error('you cannot perform this action')
          } else {
            return require('./thread').createThread(room_id, title)
          }
        })
        .then((thread) => {
          response = thread;
          return this.model.findOneAndUpdate({ _id: room_id },
            {
              $push: {
                threads: thread._id
              }
            }).exec()
        })
        .then(() => {
          resolve(response);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  getPrivilege(username, room_id) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: room_id, "guests.user": username }, {
        guests: {
          $elemMatch: { user: username }
        }
      }).exec()
        .then((room) => {
          resolve(room.guests[0].privilege)
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  isGuest(username, room_id) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: room_id, "guests.user": username }).exec()
        .then((room) => {
          (room === null) ? resolve(false) : resolve(true);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  isWhitelisted(username, room_id) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: room_id, whitelisted: username }).exec()
        .then((room) => {
          (room === null) ? resolve(false) : resolve(true);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

}
module.exports = new Room();