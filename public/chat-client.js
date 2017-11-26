var socket = io.connect('http://localhost:8080');
function connect() {
  console.log('attempting to connect');
  let jwt = document.getElementById('token').value;
  socket = io.connect('http://localhost:8080');
  socket.on('connect', () => {
    socket.emit('authenticate', { token: jwt })
      .on('authenticated', () => {
        console.log('authenticated!');

        socket.emit('join-rooms')
          .on('join-rooms-ack', (data) => {
            console.log(data.rooms);
          });
      })
      .on('unauthorized', (msg) => {
        console.log("unauthorized: " + JSON.stringify(msg.data));
        throw new Error(msg.data.type);
      })
  });
  socket.on('online-friends', (data) => {
    for(let i=0;i<data.friends.length; i++){
      if(data.friends[i].online){
        console.log(data.friends[i].username, 'connected as', data.friends[i].socket_id);
      } else {
        console.log(data.friends[i].username, 'not connected');
      }
    }
  });
  socket.on('new-message', (data) => {
    console.log(data.message.author + ': ' + data.message.loadout.content);
  });
  socket.on('error-manager', (data) => {
    console.log(data);
  });
}

function send() {
  const data = {
    content: document.getElementById('message').value,
    media: 'text',
    room_id: document.getElementById('room').value
  }
  socket.emit('send-room', data);
}