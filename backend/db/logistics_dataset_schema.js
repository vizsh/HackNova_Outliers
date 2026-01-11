/**
 * Logistics AI Enriched Dataset Schema Definition
 * 
 * This file defines the internal data model for the logistics_ai_enriched_dataset.csv
 * and maps it to the existing prototype's data structures.
 * 
 * DO NOT MODIFY EXISTING FUNCTIONALITY - This is a compatibility layer only.
 */

/**
 * Raw CSV Row Schema (as imported from CSV)
 * Each row represents one delivery attempt with AI-enriched features
 */
class LogisticsDatasetRow {
    constructor(row) {
        // Core Identifiers (maps to existing shipment fields)
        this.order_id = row.order_id || null;                    // Maps to: shipment.tracking_number
        this.order_date = row.order_date || null;                // Maps to: shipment.created_at
        this.rider_id = row.rider_id || null;                    // Maps to: shipment.driver_id (needs mapping)
        this.city = row.city || 'Unknown';
        this.country = row.country || 'India';
        
        // Geographic Coordinates (direct mapping)
        this.pickup_lat = parseFloat(row.pickup_lat) || null;    // Maps to: shipment.pickup_lat
        this.pickup_lon = parseFloat(row.pickup_lon) || null;    // Maps to: shipment.pickup_lng
        this.drop_lat = parseFloat(row.drop_lat) || null;        // Maps to: shipment.drop_lat
        this.drop_lon = parseFloat(row.drop_lon) || null;        // Maps to: shipment.drop_lng
        
        // Vehicle & Transport (maps to existing vehicle system)
        this.vehicle_type = row.vehicle_type || 'bike';          // Maps to: vehicle.type
        
        // Driver Skill Dimensions (0-1 scale) - NEW DATA
        // These will enhance existing driver_ratings structure
        this.skill_fragile_handling = parseFloat(row.skill_fragile_handling) || 0.5;
        this.skill_urgency_handling = parseFloat(row.skill_urgency_handling) || 0.5;
        this.skill_night_driving = parseFloat(row.skill_night_driving) || 0.5;
        this.skill_weather_resilience = parseFloat(row.skill_weather_resilience) || 0.5;
        
        // Route & Environment Intelligence - NEW DATA
        // These will be stored as route metadata for ML training
        this.route_difficulty_score = parseFloat(row.route_difficulty_score) || 0.5;  // Normalized 0-1
        this.traffic_volatility = parseFloat(row.traffic_volatility) || 0.5;          // Traffic instability 0-1
        this.weather_severity = parseFloat(row.weather_severity) || 0.0;              // Impact-based 0-1
        
        // Delivery Context (maps to existing shipment fields)
        this.delivery_urgency = row.delivery_urgency || 'medium'; // low/medium/high
        this.goods_type = row.goods_type || 'standard';           // standard/fragile/high_value/perishable
                                                                    // Maps to: shipment.freight_type
        
        // Behavioral & Stress Signals - NEW DATA
        // For ML training and driver performance analytics
        this.fatigue_index = parseFloat(row.fatigue_index) || 0.0; // Pre-delivery fatigue 0-1
        this.delay_recovery_time_min = parseInt(row.delay_recovery_time_min) || 0;
        this.override_by_dispatch = parseInt(row.override_by_dispatch) || 0; // 0/1 boolean
        
        // Actual Delivery Metrics
        this.scheduled_time_min = parseInt(row.scheduled_time_min) || 0;
        this.actual_time_min = parseInt(row.actual_time_min) || 0;
        this.base_distance_km = parseFloat(row.base_distance_km) || 0.0;
        this.fuel_cost_est = parseFloat(row.fuel_cost_est) || 0.0;
        this.delivery_status = row.delivery_status || 'pending';  // Maps to: shipment.status
                                                                   // Values: on-time, delayed
        
        // Customer Feedback (maps to existing feedback system)
        this.customer_rating = parseFloat(row.customer_rating) || null;     // Maps to: feedback.rating
        this.customer_feedback_text = row.customer_feedback_text || '';     // Maps to: feedback.comment
        
        // Training Targets - For ML model training (NOT stored in production DB)
        this.delivery_success = parseInt(row.delivery_success) || 0;        // 0/1 boolean - Target variable
        this.delay_minutes = parseFloat(row.delay_minutes) || 0.0;          // Numeric - Target variable
    }
    
    /**
     * Validate the row data
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validate() {
        const errors = [];
        
        // Required fields
        if (!this.order_id) errors.push('order_id is required');
        if (!this.rider_id) errors.push('rider_id is required');
        if (this.pickup_lat === null || this.pickup_lon === null) {
            errors.push('pickup coordinates are required');
        }
        if (this.drop_lat === null || this.drop_lon === null) {
            errors.push('drop coordinates are required');
        }
        
        // Range validations
        if (this.pickup_lat < -90 || this.pickup_lat > 90) {
            errors.push('pickup_lat must be between -90 and 90');
        }
        if (this.drop_lat < -90 || this.drop_lat > 90) {
            errors.push('drop_lat must be between -90 and 90');
        }
        if (this.pickup_lon < -180 || this.pickup_lon > 180) {
            errors.push('pickup_lon must be between -180 and 180');
        }
        if (this.drop_lon < -180 || this.drop_lon > 180) {
            errors.push('drop_lon must be between -180 and 180');
        }
        
        // Skill dimensions validation (0-1 scale)
        const skillFields = [
            'skill_fragile_handling', 'skill_urgency_handling', 
            'skill_night_driving', 'skill_weather_resilience'
        ];
        skillFields.forEach(field => {
            if (this[field] < 0 || this[field] > 1) {
                errors.push(`${field} must be between 0 and 1`);
            }
        });
        
        // Route/Environment scores (0-1 scale)
        if (this.route_difficulty_score < 0 || this.route_difficulty_score > 1) {
            errors.push('route_difficulty_score must be between 0 and 1');
        }
        if (this.traffic_volatility < 0 || this.traffic_volatility > 1) {
            errors.push('traffic_volatility must be between 0 and 1');
        }
        if (this.weather_severity < 0 || this.weather_severity > 1) {
            errors.push('weather_severity must be between 0 and 1');
        }
        if (this.fatigue_index < 0 || this.fatigue_index > 1) {
            errors.push('fatigue_index must be between 0 and 1');
        }
        
        // Enum validations
        const validUrgency = ['low', 'medium', 'high'];
        if (!validUrgency.includes(this.delivery_urgency)) {
            errors.push(`delivery_urgency must be one of: ${validUrgency.join(', ')}`);
        }
        
        const validGoodsType = ['standard', 'fragile', 'high_value', 'perishable'];
        if (!validGoodsType.includes(this.goods_type)) {
            errors.push(`goods_type must be one of: ${validGoodsType.join(', ')}`);
        }
        
        const validStatus = ['on-time', 'delayed', 'pending', 'assigned', 'in_transit', 'delivered'];
        if (!validStatus.includes(this.delivery_status)) {
            errors.push(`delivery_status must be one of: ${validStatus.join(', ')}`);
        }
        
        // Customer rating validation
        if (this.customer_rating !== null && (this.customer_rating < 0 || this.customer_rating > 5)) {
            errors.push('customer_rating must be between 0 and 5');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

/**
 * Convert CSV row to existing Shipment structure
 * Maintains backward compatibility with existing prototype
 * 
 * @param {LogisticsDatasetRow} datasetRow - The enriched dataset row
 * @param {Object} options - Mapping options
 * @param {number} options.customer_id - Default customer ID if not mapped
 * @param {Function} options.riderIdMapper - Function to map rider_id to driver_id
 * @returns {Object} Shipment object compatible with existing system
 */
function mapToShipment(datasetRow, options = {}) {
    const {
        customer_id = null,
        riderIdMapper = (riderId) => {
            // Default: Extract numeric ID from rider_id (e.g., "R4110" -> 4110)
            const match = riderId.match(/\d+/);
            return match ? parseInt(match[0]) : null;
        }
    } = options;
    
    // Map delivery_status to existing shipment status values
    const statusMap = {
        'on-time': 'delivered',
        'delayed': 'delivered',
        'pending': 'pending',
        'assigned': 'assigned',
        'in_transit': 'in_transit',
        'delivered': 'delivered'
    };
    
    // Map goods_type to existing freight_type
    const goodsTypeMap = {
        'standard': 'Standard',
        'fragile': 'Fragile',
        'high_value': 'High Value',
        'perishable': 'Perishable'
    };
    
    const mappedStatus = statusMap[datasetRow.delivery_status] || 'pending';
    const mappedFreightType = goodsTypeMap[datasetRow.goods_type] || 'Standard';
    
    // Construct origin from city, country (pickup location)
    // Note: CSV only has pickup city, destination city must be derived from drop coordinates
    // For now, we'll use coordinates-based naming or a generic format
    const origin = `${datasetRow.city || 'Unknown'}, ${datasetRow.country || 'India'}`;
    
    // Destination: Since CSV doesn't have destination city, use a coordinate-based identifier
    // In production, you might use reverse geocoding to get destination city name
    // For compatibility, we'll use a format that can be updated later
    const destination = datasetRow.drop_lat && datasetRow.drop_lon 
        ? `Location (${datasetRow.drop_lat.toFixed(4)}, ${datasetRow.drop_lon.toFixed(4)})`
        : `${datasetRow.city || 'Unknown'}, ${datasetRow.country || 'India'}`; // Fallback to origin if coords missing
    
    return {
        // Core fields (direct mapping)
        tracking_number: datasetRow.order_id,
        origin: origin,
        destination: destination,
        status: mappedStatus,
        pickup_lat: datasetRow.pickup_lat,
        pickup_lng: datasetRow.pickup_lon,
        drop_lat: datasetRow.drop_lat,
        drop_lng: datasetRow.drop_lon,
        driver_id: riderIdMapper(datasetRow.rider_id),
        customer_id: customer_id,
        created_at: datasetRow.order_date ? new Date(datasetRow.order_date) : new Date(),
        
        // Extended fields (compatible with existing structure)
        freight_type: mappedFreightType,
        weight: 0, // Not in CSV, will need to be estimated or set to default
        deadline: null, // Not directly in CSV, could be calculated from scheduled_time_min
        
        // Additional fields from dataset (new, but backward compatible)
        _metadata: {
            // AI-enriched features (for ML training, not displayed in UI yet)
            route_difficulty_score: datasetRow.route_difficulty_score,
            traffic_volatility: datasetRow.traffic_volatility,
            weather_severity: datasetRow.weather_severity,
            delivery_urgency: datasetRow.delivery_urgency,
            fatigue_index: datasetRow.fatigue_index,
            delay_recovery_time_min: datasetRow.delay_recovery_time_min,
            override_by_dispatch: datasetRow.override_by_dispatch === 1,
            
            // Actual metrics
            scheduled_time_min: datasetRow.scheduled_time_min,
            actual_time_min: datasetRow.actual_time_min,
            base_distance_km: datasetRow.base_distance_km,
            fuel_cost_est: datasetRow.fuel_cost_est,
            delay_minutes: datasetRow.delay_minutes,
            
            // Training targets (for ML models, not for production use)
            delivery_success: datasetRow.delivery_success === 1,
            
            // Source tracking
            source: 'logistics_ai_enriched_dataset',
            original_rider_id: datasetRow.rider_id,
            vehicle_type: datasetRow.vehicle_type
        },
        
        // Legacy fields (for backward compatibility)
        invoice_amount: datasetRow.fuel_cost_est * 10 || 12000, // Estimate from fuel cost
        payment_status: mappedStatus === 'delivered' ? 'paid' : 'pending',
        payment_locked: false,
        delivery_code: Math.floor(1000 + Math.random() * 9000).toString()
    };
}

/**
 * Convert CSV row to Driver Skills structure
 * Enhances existing driver_ratings with new skill dimensions
 * 
 * @param {LogisticsDatasetRow} datasetRow - The enriched dataset row
 * @param {Function} riderIdMapper - Function to map rider_id to driver_id
 * @returns {Object} Driver ratings object compatible with existing system
 */
function mapToDriverSkills(datasetRow, riderIdMapper) {
    const driverId = riderIdMapper(datasetRow.rider_id);
    if (!driverId) return null;
    
    // Calculate skill_index from skill dimensions (average or weighted)
    // This maintains compatibility with existing skill_index field
    const skillIndex = (
        datasetRow.skill_fragile_handling * 0.25 +
        datasetRow.skill_urgency_handling * 0.25 +
        datasetRow.skill_night_driving * 0.25 +
        datasetRow.skill_weather_resilience * 0.25
    ) * 10; // Scale 0-1 to 0-10 to match existing system
    
    // Determine level based on skill_index (matching existing logic)
    let level = 'Standard';
    if (skillIndex >= 9) level = 'ELITE';
    else if (skillIndex >= 7.5) level = 'Advanced';
    else if (skillIndex >= 6) level = 'Intermediate';
    
    return {
        driver_id: driverId,
        skill_index: skillIndex,
        level: level,
        
        // Existing fields (set defaults)
        route_familiarity: 3, // Not in CSV, default
        skill_level: skillIndex, // Use calculated skill_index
        vehicle_handling_capacity: 1500, // Not in CSV, default
        
        // New skill dimensions (for future ML features)
        _skill_dimensions: {
            fragile_handling: datasetRow.skill_fragile_handling,
            urgency_handling: datasetRow.skill_urgency_handling,
            night_driving: datasetRow.skill_night_driving,
            weather_resilience: datasetRow.skill_weather_resilience
        }
    };
}

/**
 * Convert CSV row to Customer Feedback structure
 * Maps to existing feedback system
 * 
 * @param {LogisticsDatasetRow} datasetRow - The enriched dataset row
 * @param {number} shipmentId - The shipment ID this feedback belongs to
 * @param {Function} riderIdMapper - Function to map rider_id to driver_id
 * @returns {Object} Feedback object compatible with existing system
 */
function mapToFeedback(datasetRow, shipmentId, riderIdMapper) {
    if (!datasetRow.customer_rating && !datasetRow.customer_feedback_text) {
        return null; // No feedback data
    }
    
    const driverId = riderIdMapper(datasetRow.rider_id);
    if (!driverId) return null;
    
    return {
        shipment_id: shipmentId,
        driver_id: driverId,
        rating: datasetRow.customer_rating || 0,
        comment: datasetRow.customer_feedback_text || '',
        created_at: datasetRow.order_date ? new Date(datasetRow.order_date) : new Date()
    };
}

/**
 * Map vehicle_type from CSV to existing vehicle structure
 * 
 * @param {string} vehicleType - Vehicle type from CSV (bike, scooter, van)
 * @returns {string} Vehicle type compatible with existing system (road/air/water)
 */
function mapVehicleType(vehicleType) {
    const vehicleMap = {
        'bike': 'road',
        'scooter': 'road',
        'van': 'road',
        'truck': 'road',
        'car': 'road'
    };
    
    return vehicleMap[vehicleType?.toLowerCase()] || 'road';
}

module.exports = {
    LogisticsDatasetRow,
    mapToShipment,
    mapToDriverSkills,
    mapToFeedback,
    mapVehicleType
};
