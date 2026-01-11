import io from 'socket.io-client';

// Singleton socket instance
const socket = io('http://localhost:3000', {
    autoConnect: true,
    reconnection: true
});

export default socket;
