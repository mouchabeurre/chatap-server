"use strict";
const mongoose = require('mongoose');
const shortid = require('shortid');

const Message = require('./message');

const ThreadSchema = mongoose.Schema({
  _id: {
    type: String,
    default: shortid.generate
  },
  room: {
    type: String,
    ref: 'Room',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  feed: [{
    type: String,
    ref: 'Message'
  }],
  date: {
    type: Date,
    default: Date.now
  }
});

class Thread {

  constructor() {
    this.model = mongoose.model('Thread', ThreadSchema);
    this.message_model = Message;
    this.prefix = { single: '/thread', plural: '/threads' };
    this._init();
  }

  _init() {
  }

  createThread(room_id, title) {
    return new Promise((resolve, reject) => {
      const newThread = new this.model({
        room: room_id,
        title: title
      });
      return newThread.save()
        .then((thread) => {
          resolve(thread);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  addMessage(performer, room_id, thread_id, media, content) {
    return new Promise((resolve, reject) => {
      let response;
      require('./room').isGuest(performer, room_id)
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('invalid parameters');
          } else {
            return this.isThreadOfRoom(thread_id, room_id);
          }
        })
        .then((is_thread) => {
          if (!is_thread) {
            throw new Error('no such thread in room');
          } else {
            return this.message_model.createMessage(performer, thread_id, media, content);
          }
        })
        .then((message) => {
          response = message;
          return this.model.findOneAndUpdate({ _id: thread_id },
            {
              $push: {
                feed: message._id
              }
            }).exec();
        })
        .then(() => {
          resolve(response);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  isThreadOfRoom(thread_id, room_id) {
    return new Promise((resolve, reject) => {
      this.model.findOne({ _id: thread_id, room: room_id }).exec()
        .then((thread) => {
          (thread === null) ? resolve(false) : resolve(true);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  getThread(performer, room_id, thread_id, options = {}) {
    return new Promise((resolve, reject) => {
      require('./room').isGuest(performer, room_id)
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('invalid parameters');
          } else {
            return this.model.findOne({ _id: thread_id }, options)
              .populate({
                path: 'feed',
                sort: {
                  date: -1
                }
              })
              .exec();
          }
        })
        .then((thread) => {
          if (!thread) {
            throw new Error('no such thread in db');
          } else {
            resolve(thread);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  renameThread(performer, room_id, thread_id, new_name) {
    return new Promise((resolve, reject) => {
      require('./room').isGuest(performer, room_id)
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('you cannot perform this action');
          } else {
            return require('./room').getPrivilege(performer, room_id);
          }
        })
        .then((privilege) => {
          if (privilege == 'basic') {
            throw new Error('not enough privilege');
          } else {
            return this.model.findOneAndUpdate({ _id: thread_id }, {
              $set: {
                title: new_name
              }
            }, { new: true }).exec();
          }
        })
        .then((thread) => {
          resolve(thread.title);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  deleteThread(performer, room_id, thread_id) {
    return new Promise((resolve, reject) => {
      require('./room').getPrivilege(performer, room_id)
        .then((privilege) => {
          if (privilege == 'basic') {
            throw new Error('not enough privilege');
          } else {
            return this.model.findOne({ _id: thread_id }).exec();
          }
        })
        .then((thread) => {
          let messages = [];
          for (let i = 0; i < thread.feed.length; i++) {
            messages.push(this.message_model.deleteMessage(thread.feed[i]));
          }
          return Promise.all(messages);
        })
        .then((messages) => {
          return this.model.remove({ _id: thread_id }).exec();
        })
        .then((thread) => {
          resolve(true);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

}
module.exports = new Thread();