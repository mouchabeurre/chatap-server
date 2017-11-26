"use strict";
const mongoose = require('mongoose');
const shortid = require('shortid');

const MessageSchema = mongoose.Schema({
  _id: {
    type: String,
    default: shortid.generate
  },
  room: {
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
    this._initSchema();
  }

  _initSchema() {
  }

  createMessage(performer, room_id, media, content) {
    return new Promise((resolve, reject) => {
      const newMessage = new this.model({
        room: room_id,
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

}
module.exports = new Message();