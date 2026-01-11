console.log('Start Debug');
try {
    console.log('Req dotenv');
    require('dotenv').config();
    console.log('Req express');
    const express = require('express');
    console.log('Req http');
    const http = require('http');
    console.log('Req socket.io');
    const { Server } = require('socket.io');
    console.log('Req cors');
    const cors = require('cors');
    console.log('Req db');
    const db = require('./db');
    console.log('Req bcryptjs');
    const bcrypt = require('bcryptjs');
    console.log('Req jwt');
    const jwt = require('jsonwebtoken');
    console.log('Req auth route');
    const auth = require('./routes/auth');
    console.log('ALL GOOD');
} catch (e) {
    console.error('CRASHED AT REQUIRE:', e);
}
