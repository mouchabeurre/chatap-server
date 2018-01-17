"use strict";
const mongoose = require('mongoose');
const shortid = require('shortid');

const MessageSchema = mongoose.Schema({
  _id: {
    type: String,
    default: shortid.generate
  },
  thread: {
    type: String,
    ref: 'Room',
    required: true
  },
  loadout: {
    media: {
      type: String,
      enum: ['link', 'image', 'text'],
      required: true
    },
    content: {
      type: String,
      required: true
    }
  },
  author: {
    type: String,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

class Message {

  constructor() {
    this.model = mongoose.model('Message', MessageSchema);
    this.prefix = { single: '/message', plural: '/messages' };
    this._init();
  }

  _init() {
  }

  createMessage(performer, thread_id, media, content) {
    return new Promise((resolve, reject) => {
      const newMessage = new this.model({
        thread: thread_id,
        author: performer,
        loadout: {
          media: media,
          content: content
        }
      });
      return newMessage.save()
        .then((message) => {
          resolve(message);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  deleteMessage(message_id) {
    return new Promise((resolve, reject) => {
      this.model.remove({ _id: message_id }).exec()
        .then((message) => {
          resolve(true)
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  getStream(performer, room_id, thread_id, offset) {
    return new Promise((resolve, reject) => {
      require('./room').isGuest(performer, room_id)
        .then((is_guest) => {
          if (!is_guest) {
            throw new Error('invalid parameters');
          } else {
            return this.model.find({ thread: thread_id }).sort({ date: -1 }).limit(12).skip(offset).exec();
          }
        })
        .then((stream) => {
          resolve(stream);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

}
module.exports = new Message();