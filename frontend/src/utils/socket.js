import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

// Singleton socket instance
const socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true
});

export default socket;
