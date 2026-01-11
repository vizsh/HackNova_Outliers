const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');
// Operator Routes
router.get('/shipments', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM shipments ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/shipments', authenticateToken, checkRole(['operator']), async (req, res) => {
    const { tracking_number, origin, destination, pickup_lat, pickup_lng, drop_lat, drop_lng, customer_id, payment_locked, freight_type, weight, deadline } = req.body;
    try {
        const result = await db.query(
            `INSERT INTO shipments (tracking_number, origin, destination, pickup_lat, pickup_lng, drop_lat, drop_lng, customer_id, payment_locked, freight_type, weight, deadline, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending') RETURNING *`,
            [tracking_number, origin, destination, pickup_lat, pickup_lng, drop_lat, drop_lng, customer_id, payment_locked || false, freight_type, weight, deadline]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/shipments/:id/assign', authenticateToken, checkRole(['operator']), async (req, res) => {
    const { id } = req.params;
    const { driver_id } = req.body;
    try {
        const result = await db.query(
            "UPDATE shipments SET driver_id = $1, status = 'assigned' WHERE id = $2 RETURNING *",
            [driver_id, id]
        );
        
        // NEW: Generate OTP when order transitions to "assigned" (Out for Delivery)
        // CRITICAL: OTP must be generated when order is ready for delivery
        if (result.rows[0]) {
            try {
                const otpService = require('../services/otpService');
                const customerNotificationService = require('../services/customerNotificationService');
                
                // Generate OTP for this order
                const otpData = await otpService.generateOTP(id);
                
                // Send OTP to customer via notification
                if (result.rows[0].customer_id) {
                    await customerNotificationService.sendDriverAssignmentNotification(
                        result.rows[0].customer_id,
                        id,
                        driver_id
                    );
                    
                    // Emit OTP to customer (via socket)
                    const io = req.app.get('io');
                    const emitCustomerNotification = req.app.get('emitCustomerNotification');
                    if (emitCustomerNotification) {
                        emitCustomerNotification(result.rows[0].customer_id, id, {
                            type: 'otp_generated',
                            message: `Your delivery code for shipment #${result.rows[0].tracking_number} is: ${otpData.otp_code}. Share this with the driver upon delivery.`
                        });
                    }
                }
            } catch (otpErr) {
                // Non-blocking: log but don't fail assignment
                console.error('Error generating OTP:', otpErr);
            }
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.delete('/shipments/:id', authenticateToken, checkRole(['operator']), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM shipments WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        res.sendStatus(204);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 6. Complete Delivery (with OTP & POD)
// UPDATED: Now requires OTP verification + geo-tagged photo proof
router.post('/shipments/:id/complete', authenticateToken, checkRole(['driver']), async (req, res) => {
    const { otp, photo_url, photo_latitude, photo_longitude, photo_timestamp } = req.body;
    try {
        const otpService = require('../services/otpService');
        const podPhotoService = require('../services/podPhotoService');
        
        // 1. Fetch shipment
        const shipmentRes = await db.query(
            'SELECT * FROM shipments WHERE id = $1',
            [req.params.id]
        );
        const shipment = shipmentRes.rows[0];

        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        // 2. Verify OTP (CRITICAL: Delivery cannot complete without valid OTP)
        if (!otp) {
            return res.status(400).json({ 
                error: 'OTP is required',
                step: 'otp_verification',
                message: 'Please enter the OTP provided by the customer.'
            });
        }

        const otpVerification = await otpService.verifyOTP(req.params.id, otp);
        
        if (!otpVerification.valid) {
            return res.status(400).json({ 
                error: otpVerification.error || 'Invalid OTP',
                step: 'otp_verification',
                locked: otpVerification.locked || false,
                attempts_remaining: otpVerification.attempts_remaining || 0,
                expired: otpVerification.expired || false
            });
        }

        // 3. Validate and store geo-tagged photo (CRITICAL: Photo with GPS required)
        if (!photo_url || !photo_latitude || !photo_longitude) {
            return res.status(400).json({ 
                error: 'Geo-tagged photo is required',
                step: 'photo_upload',
                message: 'Please upload a photo with GPS location enabled.'
            });
        }

        if (!shipment.drop_lat || !shipment.drop_lng) {
            return res.status(400).json({ 
                error: 'Drop location coordinates not available',
                step: 'photo_validation'
            });
        }

        // Validate photo with GPS metadata
        const photoValidation = await podPhotoService.validateGeoTaggedPhoto(
            {
                url: photo_url,
                latitude: photo_latitude,
                longitude: photo_longitude,
                timestamp: photo_timestamp || new Date().toISOString()
            },
            req.params.id,
            shipment.drop_lat,
            shipment.drop_lng
        );

        if (!photoValidation.valid) {
            return res.status(400).json({ 
                error: photoValidation.error || 'Photo validation failed',
                step: 'photo_validation',
                distance: photoValidation.distance,
                acceptable_radius: photoValidation.acceptable_radius
            });
        }

        // Store POD photo
        const podPhoto = await podPhotoService.storePODPhoto(
            req.params.id,
            req.user.id,
            photoValidation
        );

        // 4. Mark as Delivered and Update KPIs
        // DELIVERY COMPLETION GATE: Only completes after OTP + photo are verified
        const result = await db.query(
            `UPDATE shipments 
             SET status = 'delivered', 
                 pod_url = $1, 
                 delivery_timestamp = NOW(),
                 pod_photo_lat = $2,
                 pod_photo_lng = $3,
                 pod_photo_timestamp = $4,
                 pod_photo_distance = $5
             WHERE id = $6 
             RETURNING *`,
            [
                photo_url,
                photoValidation.latitude,
                photoValidation.longitude,
                photoValidation.timestamp,
                photoValidation.distance,
                req.params.id
            ]
        );
        const updatedShipment = result.rows[0];

        // Log delivery completion (immutable audit)
        await otpService.logOTPEvent({
            order_id: req.params.id,
            event_type: 'delivery_completed',
            metadata: {
                driver_id: req.user.id,
                otp_verified: true,
                photo_uploaded: true,
                photo_distance: photoValidation.distance,
                completed_at: new Date().toISOString()
            }
        });

        // 4. Update Driver KPIs (Mock Logic)
        const kpiRes = await db.query("SELECT * FROM driver_kpis WHERE driver_id = $1", [req.user.id]);
        if (kpiRes.rows.length > 0) {
            const newTotal = kpiRes.rows[0].total_deliveries + 1;
            await db.query("UPDATE driver_kpis SET total_deliveries = $1 WHERE driver_id = $2", [newTotal, req.user.id]);
        }

        // 5. Emit Socket Event for Real-time Update
        const io = req.app.get('io');
        if (io) {
            console.log(`[Socket] Emitting shipment:updated for ${updatedShipment.tracking_number} to Delivered`);
            io.emit('shipment:updated', updatedShipment);
            // Deprecated but kept for safety
            io.emit('dashboard:update', { type: 'shipment', action: 'complete', data: updatedShipment });
        }

        res.json({
            ...updatedShipment,
            otp_verified: true,
            photo_uploaded: true,
            pod_photo: {
                url: podPhoto.url,
                latitude: podPhoto.latitude,
                longitude: podPhoto.longitude,
                distance: podPhoto.distance
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 7. Pay for Shipment
router.post('/shipments/:id/pay', authenticateToken, checkRole(['customer']), async (req, res) => { // Changed authenticateToken to verifyToken, checkRole(['customer'])
    try {
        const result = await db.query(
            "UPDATE shipments SET payment_status = 'paid' WHERE id = $1 RETURNING *",
            [req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/drivers', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const result = await db.query("SELECT id, email, role FROM users WHERE role = 'driver'");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/customers', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const result = await db.query("SELECT id, email FROM users WHERE role = 'customer'");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/vehicles', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM vehicles');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/vehicles', authenticateToken, checkRole(['operator']), async (req, res) => {
    const { model, license_plate, type, capacity, storage_type } = req.body;
    try {
        const result = await db.query(
            "INSERT INTO vehicles (model, license_plate, type, capacity, storage_type) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [model, license_plate, type, capacity, storage_type]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Driver Routes
router.get('/assigned-shipments', authenticateToken, checkRole(['driver']), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM shipments WHERE driver_id = $1', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Customer Routes
router.get('/my-shipments', authenticateToken, checkRole(['customer']), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM shipments WHERE customer_id = $1', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// NEW: Driver - Proof of Delivery
// Route merged into /complete

// NEW: Customer - Payment
router.post('/shipments/:id/pay', authenticateToken, checkRole(['customer']), async (req, res) => {
    const { id } = req.params;
    // Mock Stripe Charge Logic Here
    const paymentId = 'ch_' + Math.random().toString(36).substr(2, 9);

    try {
        const result = await db.query(
            "UPDATE shipments SET payment_status = 'paid', payment_id = $1, payment_timestamp = NOW() WHERE id = $2 RETURNING *",
            [paymentId, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

// NEW: Operator - Upload Document
router.post('/documents', authenticateToken, checkRole(['operator']), async (req, res) => {
    const { shipment_id, type, url } = req.body;
    try {
        await db.query('INSERT INTO documents (shipment_id, type, url) VALUES ($1, $2, $3)', [shipment_id, type, url]);
        res.sendStatus(201);
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// NEW: Customer - Generate OTP
router.post('/shipments/:id/otp', authenticateToken, checkRole(['customer']), async (req, res) => {
    const { id } = req.params;
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        // Verify ownership (mock) - in real app, check if shipment belongs to req.user.id
        await db.query("UPDATE shipments SET delivery_code = $1 WHERE id = $2", [newCode, id]);
        res.json({ delivery_code: newCode });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

// NEW: Driver Performance & Feedback
router.post('/shipments/:id/feedback', authenticateToken, checkRole(['customer']), async (req, res) => {
    const { id } = req.params;
    const { driver_id, rating, comment } = req.body;
    try {
        await db.query("INSERT INTO feedback (shipment_id, driver_id, rating, comment) VALUES ($1, $2, $3, $4)",
            [id, driver_id, rating, comment]);
        res.sendStatus(201);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

router.get('/drivers/:id/stats', authenticateToken, async (req, res) => { // Open to ops and driver
    try {
        const result = await db.query("SELECT * FROM driver_ratings WHERE driver_id = $1", [req.params.id]);
        const feedbackRes = await db.query("SELECT * FROM feedback WHERE driver_id = $1", [req.params.id]);
        const kpiRes = await db.query("SELECT * FROM driver_kpis WHERE driver_id = $1", [req.params.id]);
        const userRes = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });

        const data = result.rows[0];
        const user = userRes.rows[0];
        
        // Merge user info
        if (user) {
            data.name = user.name || '';
            data.age = user.age || '';
            data.experience = user.experience || '';
            data.email = user.email || '';
        }
        
        data.feedback = feedbackRes.rows;
        
        // Merge KPI data
        if (kpiRes.rows.length > 0) {
            data.avg_rating = parseFloat(kpiRes.rows[0].avg_rating) || 0;
            data.total_deliveries = kpiRes.rows[0].total_deliveries || 0;
            data.on_time_rate = kpiRes.rows[0].on_time_rate || 85;
            data.pod_compliance = kpiRes.rows[0].pod_compliance || 95;
        } else {
            // Initialize defaults if KPI doesn't exist
            data.avg_rating = 0;
            data.total_deliveries = 0;
            data.on_time_rate = 85;
            data.pod_compliance = 95;
        }
        
        // Ensure new fields have defaults if not set
        data.route_familiarity = data.route_familiarity || 3;
        data.skill_level = data.skill_level || 5;
        data.vehicle_handling_capacity = data.vehicle_handling_capacity || 1500;

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

// Update driver profile
router.put('/drivers/:id/profile', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, age, experience, route_familiarity, skill_level, vehicle_handling_capacity } = req.body;
    
    // Ensure driver can only update their own profile unless operator
    if (req.user.role !== 'operator' && parseInt(req.user.id) !== parseInt(id)) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
    }

    try {
        // Update user info (name, age, experience stored in users or driver_ratings)
        // For now, we'll update driver_ratings and calculate new skill_index
        const routeFam = parseFloat(route_familiarity) || 3;
        const skillLvl = parseFloat(skill_level) || 5;
        const vehicleCap = parseFloat(vehicle_handling_capacity) || 1500;
        
        // Calculate performance score based on new fields
        // Base score from skill level (0-10) -> scaled to 0-5
        // Route familiarity (1-5) -> scaled to 0-2
        // Vehicle capacity normalized (500-10000) -> scaled to 0-3
        const skillScore = (skillLvl / 10) * 5; // Max 5 points
        const routeScore = (routeFam / 5) * 2; // Max 2 points
        const capacityScore = Math.min((vehicleCap / 10000) * 3, 3); // Max 3 points
        
        // Total skill_index out of 10
        const newSkillIndex = Math.min((skillScore + routeScore + capacityScore), 10);
        
        // Determine level based on skill_index
        let level = 'Standard';
        if (newSkillIndex >= 9) level = 'ELITE';
        else if (newSkillIndex >= 7.5) level = 'Advanced';
        else if (newSkillIndex >= 6) level = 'Intermediate';
        
        // Update driver_ratings with new fields
        await db.query(
            `UPDATE driver_ratings SET 
                skill_index = $1, 
                level = $2,
                route_familiarity = $3,
                skill_level = $4,
                vehicle_handling_capacity = $5
            WHERE driver_id = $6`,
            [newSkillIndex, level, routeFam, skillLvl, vehicleCap, id]
        );
        
        // Update user info in users array (in-memory mock)
        // Since db.query returns references to objects in the in-memory array,
        // modifying the returned object will modify the original
        if (name || age || experience) {
            const userUpdateRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
            if (userUpdateRes.rows.length > 0) {
                const user = userUpdateRes.rows[0];
                // Update user object directly (this modifies the original in the users array)
                if (name !== undefined && name !== null && name !== '') user.name = name;
                if (age !== undefined && age !== null && age !== '') user.age = age;
                if (experience !== undefined && experience !== null && experience !== '') user.experience = experience;
            }
        }
        
        const updated = await db.query("SELECT * FROM driver_ratings WHERE driver_id = $1", [id]);
        const feedbackRes = await db.query("SELECT * FROM feedback WHERE driver_id = $1", [id]);
        const kpiRes = await db.query("SELECT * FROM driver_kpis WHERE driver_id = $1", [id]);
        const userRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        
        const data = updated.rows[0];
        const user = userRes.rows[0];
        
        // Merge user info
        data.name = name || user?.name || '';
        data.age = age || user?.age || '';
        data.experience = experience || user?.experience || '';
        data.feedback = feedbackRes.rows;
        
        if (kpiRes.rows.length > 0) {
            data.avg_rating = parseFloat(kpiRes.rows[0].avg_rating) || 0;
            data.total_deliveries = kpiRes.rows[0].total_deliveries || 0;
            data.on_time_rate = kpiRes.rows[0].on_time_rate || 85;
            data.pod_compliance = kpiRes.rows[0].pod_compliance || 95;
        } else {
            // Initialize KPI if missing
            data.avg_rating = 0;
            data.total_deliveries = 0;
            data.on_time_rate = 85;
            data.pod_compliance = 95;
        }
        
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB Error' });
    }
});

module.exports = router;
