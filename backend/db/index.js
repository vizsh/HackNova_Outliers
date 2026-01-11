const bcrypt = require('bcryptjs');

// -- IN-MEMORY DATA STORE --
const users = [
    { id: 1, email: 'operator@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'operator' },
    // Drivers
    { id: 2, email: 'driver@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'driver', name: 'Ramesh Kumar', age: 34, experience: '5 Years' },
    { id: 4, email: 'driver2@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'driver', name: 'Suresh Patel', age: 42, experience: '12 Years' },
    { id: 5, email: 'driver3@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'driver', name: 'Vikram Singh', age: 28, experience: '3 Years' },
    // Customers
    { id: 3, email: 'customer@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'customer' },
    { id: 6, email: 'customer2@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'customer' },
    { id: 7, email: 'customer3@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'customer' }
];

const vehicles = [
    { id: 1, license_plate: 'MH-01-AB-1234', model: 'Tata Ace', type: 'road', capacity: '1500kg', storage_type: 'ambient', status: 'active', driver_id: 2 },
    { id: 2, license_plate: 'DL-02-CD-5678', model: 'Mahindra Bolero Pickup', type: 'road', capacity: '2000kg', storage_type: 'refrigerated', status: 'maintenance', driver_id: 4 },
    { id: 3, license_plate: 'KA-05-EF-9012', model: 'Ashok Leyland Dost', type: 'road', capacity: '1200kg', storage_type: 'ambient', status: 'active', driver_id: 5 },
    { id: 4, license_plate: 'VT-AIR-01', model: 'Cessna Caravan', type: 'air', capacity: '1000kg', storage_type: 'ambient', status: 'active', driver_id: null },
    { id: 5, license_plate: 'V-SEA-101', model: 'Cargo Ship Alpha', type: 'water', capacity: '50000kg', storage_type: 'container', status: 'docked', driver_id: null }
];

const shipments = [
    {
        id: 1, tracking_number: 'TRK-IN-1001',
        origin: 'Mumbai, MH', destination: 'Pune, MH',
        status: 'pending', driver_id: null, customer_id: 3,
        pickup_lat: 19.0760, pickup_lng: 72.8777, drop_lat: 18.5204, drop_lng: 73.8567,
        created_at: new Date('2023-01-01'), invoice_amount: 15000, payment_status: 'pending', payment_locked: false, delivery_code: '1234'
    },
    {
        id: 2, tracking_number: 'TRK-IN-1002',
        origin: 'New Delhi, DL', destination: 'Gurugram, HR',
        status: 'delivered', driver_id: 2, customer_id: 3,
        pickup_lat: 28.6139, pickup_lng: 77.2090, drop_lat: 28.4595, drop_lng: 77.0266,
        created_at: new Date('2023-01-02'), invoice_amount: 8500, payment_status: 'paid', payment_locked: false, delivery_code: '5678',
        pod_url: 'https://placehold.co/400'
    },
    {
        id: 3, tracking_number: 'TRK-IN-1003',
        origin: 'Bengaluru, KA', destination: 'Mysuru, KA',
        status: 'in_transit', driver_id: 4, customer_id: 6,
        pickup_lat: 12.9716, pickup_lng: 77.5946, drop_lat: 12.2958, drop_lng: 76.6394,
        created_at: new Date('2023-01-05'), invoice_amount: 12000, payment_status: 'pending', payment_locked: false, delivery_code: '9999'
    },
    {
        id: 4, tracking_number: 'TRK-IN-1004',
        origin: 'Chennai, TN', destination: 'Hyderabad, TS',
        status: 'assigned', driver_id: 5, customer_id: 7,
        pickup_lat: 13.0827, pickup_lng: 80.2707, drop_lat: 17.3850, drop_lng: 78.4867,
        created_at: new Date('2023-01-08'), invoice_amount: 25000, payment_status: 'pending', payment_locked: true, delivery_code: '1111'
    },
    {
        id: 5, tracking_number: 'TRK-IN-1005',
        origin: 'Ahmedabad, GJ', destination: 'Surat, GJ',
        status: 'pending', driver_id: null, customer_id: 3,
        pickup_lat: 23.0225, pickup_lng: 72.5714, drop_lat: 21.1702, drop_lng: 72.8311,
        created_at: new Date('2023-01-10'), invoice_amount: 9200, payment_status: 'pending', payment_locked: false, delivery_code: '2222'
    },
    {
        id: 6, tracking_number: 'TRK-AIR-IN-01',
        origin: 'Dubai, UAE', destination: 'Mumbai, India',
        status: 'in_transit', driver_id: null, customer_id: 6,
        pickup_lat: 25.276987, pickup_lng: 55.296249, drop_lat: 19.0760, drop_lng: 72.8777,
        created_at: new Date('2023-01-09'), invoice_amount: 150000, payment_status: 'pending', payment_locked: true, delivery_code: '3333'
    },
    {
        id: 7, tracking_number: 'TRK-SEA-IN-02',
        origin: 'Singapore, SG', destination: 'Chennai, India',
        status: 'in_transit', driver_id: null, customer_id: 7,
        pickup_lat: 1.3521, pickup_lng: 103.8198, drop_lat: 13.0827, drop_lng: 80.2707,
        created_at: new Date('2023-01-07'), invoice_amount: 450000, payment_status: 'pending', payment_locked: false, delivery_code: '4444'
    },
    {
        id: 8, tracking_number: 'TRK-IN-1008',
        origin: 'Kolkata, WB', destination: 'Bhubaneswar, OD',
        status: 'delivered', driver_id: 2, customer_id: 3,
        pickup_lat: 22.5726, pickup_lng: 88.3639, drop_lat: 20.2961, drop_lng: 85.8245,
        created_at: new Date('2023-01-03'), invoice_amount: 18500, payment_status: 'paid', payment_locked: false, delivery_code: '7777',
        pod_url: 'https://placehold.co/402'
    }
];

const notifications = [
    { id: 1, user_id: 1, message: 'New shipment created', type: 'info', read: false },
    { id: 2, user_id: 3, message: 'Your order TRK-1002 was delivered', type: 'success', read: true }
];

const driver_ratings = [
    { driver_id: 2, skill_index: 8.5, level: 'Advanced', route_familiarity: 4, skill_level: 8, vehicle_handling_capacity: 2000 },
    { driver_id: 4, skill_index: 9.8, level: 'ELITE', route_familiarity: 5, skill_level: 9.5, vehicle_handling_capacity: 3000 },
    { driver_id: 5, skill_index: 7.2, level: 'Standard', route_familiarity: 3, skill_level: 7, vehicle_handling_capacity: 1500 }
];

const driver_kpis = [
    { driver_id: 2, total_deliveries: 15, avg_rating: 4.5 },
    { driver_id: 4, total_deliveries: 42, avg_rating: 4.9 },
    { driver_id: 5, total_deliveries: 5, avg_rating: 4.0 }
];

const feedback = [];

const query = async (text, params) => {
    const sql = text;
    console.log('[DB] Query:', sql, params);

    // 1. AUTH: Get User by Email
    if (sql.includes('SELECT * FROM users WHERE email')) {
        const email = params && params[0] ? params[0] : null;
        if (!email) {
            console.log('[DB] No email provided in params');
            return { rows: [] };
        }
        const user = users.find(u => u.email === email);
        console.log('[DB] Found user for email:', email, user ? `YES (id: ${user.id}, role: ${user.role})` : 'NO');
        return { rows: user ? [user] : [] };
    }

    // 1.5 AUTH: Get User by ID
    if (sql.includes('SELECT * FROM users WHERE id')) {
        const user = users.find(u => u.id == params[0]);
        return { rows: user ? [user] : [] };
    }

    // 1.6 AUTH: Update User (for profile updates)
    if (sql.includes('UPDATE users SET')) {
        const userId = params.find((p, idx) => {
            // Find the user id param (usually last or specified by WHERE id = $N)
            return sql.includes(`WHERE id = $${idx + 1}`);
        }) || params[params.length - 1];
        
        const user = users.find(u => u.id == userId);
        if (user) {
            // Update name, age, experience if provided in params
            // Note: This is a simplified handler - adjust based on actual SQL structure
            if (params[0] !== undefined && typeof params[0] === 'string') user.name = params[0];
            if (params[1] !== undefined) user.age = params[1];
            if (params[2] !== undefined && typeof params[2] === 'string') user.experience = params[2];
            return { rows: [user] };
        }
        return { rows: [] };
    }

    // 2. AUTH: Create User
    if (sql.includes('INSERT INTO users')) {
        const newUser = {
            id: users.length + 1,
            email: params[0],
            password_hash: params[1],
            role: params[2]
        };
        users.push(newUser);

        // Initialize Driver Stats
        if (params[2] === 'driver') {
            driver_ratings.push({ 
                driver_id: newUser.id, 
                skill_index: 5.0, 
                level: 'Standard',
                route_familiarity: 3,
                skill_level: 5,
                vehicle_handling_capacity: 1500
            });
            driver_kpis.push({ driver_id: newUser.id, total_deliveries: 0, avg_rating: 0, on_time_rate: 85, pod_compliance: 95 });
        }

        return { rows: [newUser] };
    }

    // 3. DATA: Get Drivers (Enhanced)
    if (sql.includes("SELECT id, email, role FROM users WHERE role = 'driver'")) {
        const drivers = users.filter(u => u.role === 'driver');
        return {
            rows: drivers.map(u => {
                const rating = driver_ratings.find(r => r.driver_id == u.id);
                // Find shipments
                const driverShipments = shipments.filter(s => s.driver_id == u.id && s.status !== 'delivered');
                // FIXED: status 'assigned' ALSO means busy, not just 'in_transit'
                const active = driverShipments.find(s => s.status === 'in_transit' || s.status === 'assigned');
                const schedule = driverShipments.filter(s => s.status === 'pending'); // Future work

                return {
                    id: u.id,
                    email: u.email,
                    name: u.name || 'Unknown Driver',
                    age: u.age || 'N/A',
                    experience: u.experience || 'N/A',
                    role: u.role,
                    skill_index: rating ? rating.skill_index : 0,
                    level: rating ? rating.level : 'N/A',
                    route_familiarity: rating ? (rating.route_familiarity || 3) : 3,
                    skill_level: rating ? (rating.skill_level || 5) : 5,
                    vehicle_handling_capacity: rating ? (rating.vehicle_handling_capacity || 1500) : 1500,
                    active_shipment: active || null,
                    schedule: schedule,
                    status: active ? 'Busy' : 'Available'
                };
            })
        };
    }

    // 4. DATA: Get Customers
    if (sql.includes("SELECT id, email FROM users WHERE role = 'customer'")) {
        return { rows: users.filter(u => u.role === 'customer').map(u => ({ id: u.id, email: u.email })) };
    }

    // 5. DATA: Create Shipment
    if (sql.includes('INSERT INTO shipments')) {
        const newShipment = {
            id: shipments.length + 1,
            tracking_number: params[0],
            origin: params[1], destination: params[2],
            pickup_lat: params[3], pickup_lng: params[4],
            drop_lat: params[5], drop_lng: params[6],
            customer_id: params[7],
            status: 'pending',
            driver_id: null,
            created_at: new Date(),
            invoice_amount: 12000.00,
            payment_status: 'pending',
            payment_locked: params[8] === 'true' || params[8] === true,
            freight_type: params[9] || 'Standard',
            weight: params[10] || 0,
            deadline: params[11] ? new Date(params[11]) : null,
            delivery_code: Math.floor(1000 + Math.random() * 9000).toString()
        };
        shipments.push(newShipment);
        return { rows: [newShipment] };
    }

    // 6. DATA: Assign Driver
    if (sql.includes('UPDATE shipments SET driver_id')) {
        const shipment = shipments.find(s => s.id == params[1]);
        if (shipment) {
            shipment.driver_id = params[0];
            shipment.status = 'assigned';

            // Notification
            notifications.unshift({
                id: notifications.length + 1,
                user_id: shipment.customer_id,
                message: `Driver assigned to ${shipment.tracking_number}.`,
                type: 'info',
                read: false,
                created_at: new Date()
            });

            return { rows: [shipment] };
        }
        return { rows: [] };
    }

    // 7. DATA: Get All Shipments
    if (sql.includes('SELECT * FROM shipments')) {
        if (sql.includes('WHERE driver_id')) {
            // Filter by driver_id
            return { rows: shipments.filter(s => s.driver_id == params[0]) };
        }
        if (sql.includes('WHERE customer_id')) {
            // Filter by customer_id
            return { rows: shipments.filter(s => s.customer_id == params[0]) };
        }
        // Operator gets all
        return { rows: [...shipments].sort((a, b) => b.created_at - a.created_at) };
    }

    // NEW: Rating & Feedback System
    if (sql.includes('INSERT INTO feedback')) {
        const feedbackEntry = {
            id: feedback.length + 1,
            shipment_id: params[0],
            driver_id: params[1],
            rating: params[2],
            comment: params[3],
            created_at: new Date()
        };
        feedback.push(feedbackEntry);

        // Auto-update Driver KPI (Mock Logic)
        const kpi = driver_kpis.find(k => k.driver_id == params[1]);
        if (kpi) {
            // Re-calculate average
            const driverFeedback = feedback.filter(f => f.driver_id == params[1]);
            const totalRating = driverFeedback.reduce((acc, curr) => acc + curr.rating, 0);
            kpi.avg_rating = (totalRating / driverFeedback.length).toFixed(1);
            kpi.total_deliveries += 1;
        }

        return { rows: [feedbackEntry] };
    }

    if (sql.includes('SELECT * FROM driver_ratings')) {
        // Get specific driver rating
        if (sql.includes('WHERE driver_id')) {
            const rating = driver_ratings.find(r => r.driver_id == params[0]);
            const kpi = driver_kpis.find(k => k.driver_id == params[0]);
            const user = users.find(u => u.id == params[0]);
            // Merge for frontend convenience
            const merged = rating ? {
                ...rating,
                ...kpi,
                name: user?.name,
                age: user?.age,
                experience: user?.experience,
                route_familiarity: rating.route_familiarity || 3,
                skill_level: rating.skill_level || 5,
                vehicle_handling_capacity: rating.vehicle_handling_capacity || 1500
            } : null;
            return { rows: merged ? [merged] : [] };
        }
        return { rows: driver_ratings };
    }

    // NEW: KPI Handlers
    if (sql.includes('SELECT * FROM driver_kpis')) {
        const kpi = driver_kpis.find(k => k.driver_id == params[0]);
        return { rows: kpi ? [kpi] : [] };
    }

    if (sql.includes('UPDATE driver_kpis')) {
        const kpi = driver_kpis.find(k => k.driver_id == params[1]); // ID is 2nd param
        if (kpi) {
            kpi.total_deliveries = params[0];
            return { rows: [kpi] };
        }
        return { rows: [] };
    }

    // NEW: Update driver profile/ratings with new fields
    // Note: This handler is called from the route handler, but we can't directly update user fields here
    // since the route handler handles user field updates separately
    if (sql.includes('UPDATE driver_ratings SET')) {
        const driverId = params[5]; // driver_id is last param (6th param, 0-indexed as 5)
        const rating = driver_ratings.find(r => r.driver_id == driverId);
        if (rating) {
            // Update fields based on params order: skill_index, level, route_familiarity, skill_level, vehicle_handling_capacity, driver_id
            if (params[0] !== undefined) rating.skill_index = params[0];
            if (params[1] !== undefined) rating.level = params[1];
            if (params[2] !== undefined) rating.route_familiarity = params[2];
            if (params[3] !== undefined) rating.skill_level = params[3];
            if (params[4] !== undefined) rating.vehicle_handling_capacity = params[4];
            return { rows: [rating] };
        }
        return { rows: [] };
    }

    // NEW: Get Feedback for Driver
    if (sql.includes('SELECT * FROM feedback WHERE driver_id')) {
        return { rows: feedback.filter(f => f.driver_id == params[0]).sort((a, b) => b.created_at - a.created_at) };
    }

    // Others...
    if (sql.includes('SELECT * FROM vehicles')) return { rows: vehicles };

    // NEW: Add Vehicle
    if (sql.includes('INSERT INTO vehicles')) {
        const newVehicle = {
            id: vehicles.length + 1,
            make: params[0],
            model: params[0],
            license_plate: params[1],
            type: params[2],
            capacity: params[3],
            storage_type: params[4],
            status: 'active',
            driver_id: null
        };
        vehicles.push(newVehicle);
        return { rows: [newVehicle] };
    }

    if (sql.includes('SELECT * FROM notifications')) return { rows: notifications.filter(n => n.user_id == params[0]) };
    if (sql.includes('INSERT INTO issues')) return { rows: [{ id: 99 }] }; // Mock
    if (sql.includes('UPDATE shipments SET delivery_code')) {
        const s = shipments.find(x => x.id == params[1]);
        if (s) s.delivery_code = params[0];
        return { rows: [] };
    }
    if (sql.includes('UPDATE shipments SET status')) {
        const s = shipments.find(x => x.id == params[1]); // params[1] is id for update
        // Check which query it is (complete or pay)
        // ... simplistic handling for mock
        if (s && text.includes('delivered')) s.status = 'delivered';
        if (s && text.includes('paid')) s.payment_status = 'paid';
        return { rows: [s] };
    }

    if (sql.includes('DELETE FROM shipments')) {
        const id = params[0];
        const initialLength = shipments.length;
        // Filter out the shipment (Strict String Comparison)
        const newShipments = shipments.filter(s => String(s.id) !== String(id));

        if (newShipments.length < initialLength) {
            shipments.length = 0;
            shipments.push(...newShipments);
            return { rowCount: 1 };
        }
        return { rowCount: 0 };
    }

    return { rows: [] };
};

// Export query function for SQL-like access
module.exports = { query };

// Also export arrays directly for intelligence modules (backwards compatible)
module.exports.shipments = shipments;
module.exports.users = users;
module.exports.drivers = users.filter(u => u.role === 'driver');
module.exports.driver_ratings = driver_ratings;
module.exports.driver_kpis = driver_kpis;
module.exports.feedback = feedback;
module.exports.vehicles = vehicles;
