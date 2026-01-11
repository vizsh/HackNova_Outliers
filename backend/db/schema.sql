-- Create Users Table with Roles
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('operator', 'driver', 'customer')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipments with coordinates
CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  tracking_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  origin VARCHAR(255) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  pickup_lat FLOAT,
  pickup_lng FLOAT,
  drop_lat FLOAT,
  drop_lng FLOAT,
  driver_id INTEGER REFERENCES users(id),
  customer_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  model VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active'
);
