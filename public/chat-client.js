var socket = io.connect('http://localhost:8080');
function connect() {
  console.log('attempting to connect');
  let jwt = document.getElementById('token').value;
  socket = io.connect('http://localhost:8080');
  socket.on('connect', () => {
    socket.emit('authenticate', { token: jwt })
      .on('authenticated', () => {
        console.log('authenticated!');
      })
      .on('unauthorized', (msg) => {
        console.log("unauthorized: " + JSON.stringify(msg.data));
        throw new Error(msg.data.type);
      })
  });

  // unicast
  socket.on('connected-friends', (data) => {
    console.log('connected-friends', data);
  });
  socket.on('joined-rooms', (data) => {
    console.log('joined-rooms', data);
  });
  socket.on('joined-room', (data) => {
    console.log('joined-room', data);
  });
  socket.on('send-friend-request-ack', (data) => {
    console.log('send-friend-request-ack', data);
  });
  socket.on('friend-request', (data) => {
    console.log('friend-request', data);
  });
  socket.on('response-friend-request', (data) => {
    console.log('response-friend-request', data);
  });
  socket.on('reply-friend-request-ack', (data) => {
    console.log('reply-friend-request-ack', data);
  });
  socket.on('remove-friend', (data) => {
    console.log('remove-friend', data);
  });
  socket.on('block-user-ack', (data) => {
    console.log('block-user-ack', data);
  });
  socket.on('add-guest-ack', (data) => {
    console.log('add-guest-ack', data);
  });
  socket.on('added-room', (data) => {
    socket.emit('join-room', data);
    console.log('added-room', data);
  });
  socket.on('removed-room', (data) => {
    console.log('removed-room', data);
  });
  socket.on('removed-guest-ack', (data) => {
    console.log('removed-guest-ack', data);
  });

  socket.on('error-manager', (data) => {
    console.log('ERROR', data);
  });

  // multicast
  socket.on('connection-friend', (data) => {
    console.log('connection-friend', data);
  });
  socket.on('connection-guest', (data) => {
    console.log('connection-guest', data);
  });
  socket.on('new-message', (data) => {
    console.log('new-message', data);
  });
  socket.on('new-guest', (data) => {
    console.log('new-guest', data);
  });
  socket.on('left-guest', (data) => {
    console.log('left-guest', data);
  });

}

function sendToThread() {
  const data = {
    content: document.getElementById('sendToThread_message').value,
    media: 'text',
    room_id: document.getElementById('sendToThread_room').value,
    thread_id: document.getElementById('sendToThread_thread').value
  }
  console.log('>', data);
  socket.emit('send-thread', data);
}

function sendFriendRequest() {
  const data = {
    requested_user: document.getElementById('sendFriendRequest_requested_user').value
  }
  socket.emit('send-friend-request', data);
}

function replyFriendRequest() {
  const data = {
    requester: document.getElementById('replyFriendRequest_requested_user').value,
    action: document.getElementById('replyFriendRequest_reply_action').value
  }
  socket.emit('reply-friend-request', data);
}

function blockUser() {
  const data = {
    user_block: document.getElementById('blockUser_user_block').value
  }
  socket.emit('block-user', data);
}

function addGuest() {
  const data = {
    room_id: document.getElementById('addGuest_room_id').value,
    add_user: document.getElementById('addGuest_add_user').value
  }
  socket.emit('add-guest', data);
}

function removeGuest() {
  const data = {
    room_id: document.getElementById('removeGuest_room_id').value,
    rm_user: document.getElementById('removeGuest_rm_user').value
  }
  socket.emit('remove-guest', data);
}