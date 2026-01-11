/**
 * Intelligence API Routes
 * 
 * Decision-support endpoints for intelligence modules.
 * 
 * IMPORTANT: These are DECISION-SUPPORT endpoints only.
 * They provide recommendations but do NOT auto-execute decisions.
 * All outputs are explainable for human decision-making.
 * 
 * DO NOT modify existing routes or functionality.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');
const intelligence = require('../services/intelligenceCoordinator');
const syntheticData = require('../services/syntheticDataGenerator');
const db = require('../db/index'); // Has shipments, users, driver_ratings, etc.

/**
 * Helper: Get enriched shipments from mock database
 * 
 * Uses synthetic data generator to add AI-enriched features
 */
async function getEnrichedShipments() {
    const shipments = db.shipments || [];
    return shipments.map(shipment => syntheticData.enrichShipment(shipment));
}

/**
 * Helper: Get enriched driver delivery history
 * 
 * @param {string} driverId - Driver ID in format "R2", "R4", etc.
 * @returns {Array} Array of enriched delivery records
 */
async function getDriverDeliveryHistory(driverId) {
    // Extract numeric driver ID from format "R2" -> 2
    const numericId = parseInt(driverId.replace('R', '')) || null;
    if (!numericId) return [];

    const driver = db.users.find(u => u.id === numericId && u.role === 'driver');
    if (!driver) return [];

    // Get driver's shipments
    const driverShipments = db.shipments.filter(s => s.driver_id === numericId);
    
    // Enrich driver with synthetic skill dimensions
    const enrichedDriver = syntheticData.enrichDriver(driver, driverShipments);
    
    return enrichedDriver.deliveryHistory || [];
}

/**
 * Helper: Get all enriched deliveries for driver comparison
 */
async function getAllEnrichedDeliveries() {
    const shipments = db.shipments || [];
    const deliveries = [];
    
    for (const shipment of shipments) {
        const enriched = syntheticData.enrichShipment(shipment);
        deliveries.push(enriched);
    }
    
    return deliveries;
}

/**
 * POST /api/intelligence/comprehensive-analysis
 * 
 * Get comprehensive intelligence analysis for a delivery decision.
 * Combines all intelligence modules.
 * 
 * Body: { delivery: {...}, driverId?: string }
 */
router.post('/comprehensive-analysis', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const { delivery, driverId, shipmentId } = req.body;
        
        // If shipmentId provided, load shipment from database and enrich
        let enrichedDelivery = delivery;
        if (shipmentId) {
            const shipment = db.shipments.find(s => s.id === shipmentId || s.tracking_number === shipmentId);
            if (shipment) {
                enrichedDelivery = syntheticData.enrichShipment(shipment);
            }
        } else if (delivery && delivery.id) {
            const shipment = db.shipments.find(s => s.id === delivery.id || s.tracking_number === delivery.tracking_number);
            if (shipment) {
                enrichedDelivery = syntheticData.enrichShipment(shipment);
            }
        } else if (delivery) {
            // Use provided delivery data as-is
            enrichedDelivery = delivery;
        } else {
            return res.status(400).json({ error: 'Delivery data or shipmentId is required' });
        }
        
        // Load driver history
        const resolvedDriverId = driverId || enrichedDelivery.rider_id;
        const driverHistory = resolvedDriverId 
            ? await getDriverDeliveryHistory(resolvedDriverId)
            : [];
        
        const allDeliveries = await getAllEnrichedDeliveries();
        
        const analysis = intelligence.getComprehensiveAnalysis({
            delivery: enrichedDelivery,
            driverHistory: driverHistory,
            allDeliveries: allDeliveries,
            driverId: resolvedDriverId
        });
        
        res.json(analysis);
    } catch (error) {
        console.error('Error in comprehensive analysis:', error);
        res.status(500).json({ error: 'Intelligence analysis failed', details: error.message });
    }
});

/**
 * POST /api/intelligence/driver-skill-profile
 * 
 * Get multi-dimensional skill profile for a driver.
 * 
 * Body: { driverId: string }
 */
router.post('/driver-skill-profile', authenticateToken, checkRole(['operator', 'driver']), async (req, res) => {
    try {
        const { driverId, userId } = req.body;
        
        // Support both rider_id format (R2) and numeric user ID (2)
        let resolvedDriverId = driverId;
        if (!resolvedDriverId && userId) {
            resolvedDriverId = `R${userId}`;
        }
        
        if (!resolvedDriverId) {
            return res.status(400).json({ error: 'Driver ID is required' });
        }
        
        // Get driver delivery history with synthetic enrichment
        const driverDeliveries = await getDriverDeliveryHistory(resolvedDriverId);
        
        if (driverDeliveries.length === 0) {
            // If no history, return a default profile with synthetic skills
            const numericId = parseInt(resolvedDriverId.replace('R', '')) || null;
            const driver = numericId ? db.users.find(u => u.id === numericId && u.role === 'driver') : null;
            
            if (!driver) {
                return res.status(404).json({ error: 'Driver not found' });
            }
            
            // Generate synthetic profile even without history
            const enrichedDriver = syntheticData.enrichDriver(driver, []);
            const syntheticDeliveries = Array(10).fill(null).map((_, i) => ({
                rider_id: resolvedDriverId,
                skill_fragile_handling: enrichedDriver.skillDimensions.fragile_handling,
                skill_urgency_handling: enrichedDriver.skillDimensions.urgency_handling,
                skill_night_driving: enrichedDriver.skillDimensions.night_driving,
                skill_weather_resilience: enrichedDriver.skillDimensions.weather_resilience,
                delay_recovery_time_min: 30 + Math.round((1 - enrichedDriver.skillDimensions.stress_recovery) * 30),
                delay_minutes: Math.round(Math.random() * 20),
                delivery_success: 1
            }));
            
            const profile = intelligence.driverSkillProfile.computeDriverSkillProfile(syntheticDeliveries, resolvedDriverId);
            res.json(profile);
            return;
        }
        
        const profile = intelligence.driverSkillProfile.computeDriverSkillProfile(driverDeliveries, resolvedDriverId);
        
        res.json(profile);
    } catch (error) {
        console.error('Error computing driver skill profile:', error);
        res.status(500).json({ error: 'Skill profile computation failed', details: error.message });
    }
});

/**
 * POST /api/intelligence/route-risk-analysis
 * 
 * Analyze route difficulty and risk.
 * 
 * Body: { delivery: {...} }
 */
router.post('/route-risk-analysis', authenticateToken, checkRole(['operator', 'driver']), async (req, res) => {
    try {
        const { delivery, shipmentId } = req.body;
        
        // If shipmentId provided, load from database and enrich
        let enrichedDelivery = delivery;
        if (shipmentId) {
            const shipment = db.shipments.find(s => s.id === shipmentId || s.tracking_number === shipmentId);
            if (shipment) {
                enrichedDelivery = syntheticData.enrichShipment(shipment);
            }
        } else if (delivery && delivery.id) {
            const shipment = db.shipments.find(s => s.id === delivery.id || s.tracking_number === delivery.tracking_number);
            if (shipment) {
                enrichedDelivery = syntheticData.enrichShipment(shipment);
            }
        } else if (!delivery) {
            return res.status(400).json({ error: 'Delivery data or shipmentId is required' });
        }
        
        // Ensure required fields are present
        if (!enrichedDelivery.route_difficulty_score) {
            enrichedDelivery.route_difficulty_score = 0.5;
        }
        if (!enrichedDelivery.traffic_volatility) {
            enrichedDelivery.traffic_volatility = 0.5;
        }
        if (!enrichedDelivery.weather_severity) {
            enrichedDelivery.weather_severity = 0.0;
        }
        if (!enrichedDelivery.delivery_urgency) {
            enrichedDelivery.delivery_urgency = 'medium';
        }
        
        const analysis = intelligence.routeRiskAnalyzer.analyzeRouteRisk(enrichedDelivery);
        
        res.json(analysis);
    } catch (error) {
        console.error('Error in route risk analysis:', error);
        res.status(500).json({ error: 'Route risk analysis failed', details: error.message });
    }
});

/**
 * POST /api/intelligence/driver-route-fit
 * 
 * Calculate driver-route fit and success probability.
 * 
 * Body: { driverProfile: {...}, routeAnalysis: {...}, deliveryContext: {...} }
 */
router.post('/driver-route-fit', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const { driverProfile, routeAnalysis, deliveryContext, driverId, shipmentId } = req.body;
        
        // Get driver profile if driverId provided
        let driverProfileData = driverProfile;
        if (driverId && !driverProfileData) {
            const driverDeliveries = await getDriverDeliveryHistory(driverId);
            driverProfileData = await intelligence.driverSkillProfile.computeDriverSkillProfile(driverDeliveries, driverId);
        }
        
        // Get route analysis if shipmentId provided
        let routeAnalysisData = routeAnalysis;
        let deliveryContextData = deliveryContext || {};
        if (shipmentId && !routeAnalysisData) {
            const shipment = db.shipments.find(s => s.id === shipmentId || s.tracking_number === shipmentId);
            if (shipment) {
                const enriched = syntheticData.enrichShipment(shipment);
                routeAnalysisData = await intelligence.routeRiskAnalyzer.analyzeRouteRisk(enriched);
                deliveryContextData = {
                    delivery_urgency: enriched.delivery_urgency || 'medium',
                    fatigue_index: enriched.fatigue_index || 0.0,
                    goods_type: enriched.goods_type || 'standard'
                };
            }
        }
        
        if (!driverProfileData || !routeAnalysisData) {
            return res.status(400).json({ error: 'Driver profile and route analysis are required (or provide driverId and shipmentId)' });
        }
        
        const fitAnalysis = intelligence.driverRouteFit.calculateDriverRouteFit(
            driverProfileData,
            routeAnalysisData,
            deliveryContextData
        );
        
        res.json(fitAnalysis);
    } catch (error) {
        console.error('Error calculating driver-route fit:', error);
        res.status(500).json({ error: 'Driver-route fit calculation failed', details: error.message });
    }
});

/**
 * POST /api/intelligence/delay-prediction
 * 
 * Predict expected delay for a delivery.
 * 
 * Body: { routeAnalysis: {...}, driverProfile?: {...}, deliveryContext: {...} }
 */
router.post('/delay-prediction', authenticateToken, checkRole(['operator', 'driver', 'customer']), async (req, res) => {
    try {
        const { routeAnalysis, driverProfile, deliveryContext, shipmentId, driverId } = req.body;
        
        // If shipmentId provided, get route analysis first
        let routeAnalysisData = routeAnalysis;
        let deliveryContextData = deliveryContext || {};
        
        if (shipmentId) {
            const shipment = db.shipments.find(s => s.id === shipmentId || s.tracking_number === shipmentId);
            if (shipment) {
                const enriched = syntheticData.enrichShipment(shipment);
                routeAnalysisData = await intelligence.routeRiskAnalyzer.analyzeRouteRisk(enriched);
                deliveryContextData = {
                    fatigue_index: enriched.fatigue_index || 0.0,
                    base_distance_km: enriched.base_distance_km || 50,
                    scheduled_time_min: enriched.scheduled_time_min || 300,
                    delivery_urgency: enriched.delivery_urgency || 'medium',
                    goods_type: enriched.goods_type || 'standard'
                };
            }
        }
        
        if (!routeAnalysisData) {
            return res.status(400).json({ error: 'Route analysis or shipmentId is required' });
        }
        
        // If driverId provided, get driver profile
        let driverProfileData = driverProfile;
        if (driverId && !driverProfileData) {
            try {
                const driverDeliveries = await getDriverDeliveryHistory(driverId);
                driverProfileData = await intelligence.driverSkillProfile.computeDriverSkillProfile(driverDeliveries, driverId);
            } catch (e) {
                console.warn('Could not load driver profile:', e.message);
            }
        }
        
        const prediction = intelligence.delayPrediction.predictDelay(
            routeAnalysisData,
            driverProfileData || null,
            deliveryContextData
        );
        
        res.json(prediction);
    } catch (error) {
        console.error('Error in delay prediction:', error);
        res.status(500).json({ error: 'Delay prediction failed', details: error.message });
    }
});

/**
 * POST /api/intelligence/compare-drivers
 * 
 * Compare multiple drivers for a delivery.
 * DECISION-SUPPORT: Provides ranked recommendations.
 * 
 * Body: { delivery: {...}, driverIds: [string, ...] }
 */
router.post('/compare-drivers', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const { delivery, driverIds, shipmentId } = req.body;
        
        if ((!delivery && !shipmentId) || !driverIds || !Array.isArray(driverIds) || driverIds.length < 2) {
            return res.status(400).json({ error: 'Delivery/shipmentId and at least 2 driver IDs are required' });
        }
        
        // Enrich delivery if shipmentId provided
        let enrichedDelivery = delivery;
        if (shipmentId) {
            const shipment = db.shipments.find(s => s.id === shipmentId || s.tracking_number === shipmentId);
            if (shipment) {
                enrichedDelivery = syntheticData.enrichShipment(shipment);
            }
        } else if (delivery && delivery.id) {
            const shipment = db.shipments.find(s => s.id === delivery.id || s.tracking_number === delivery.tracking_number);
            if (shipment) {
                enrichedDelivery = syntheticData.enrichShipment(shipment);
            }
        }
        
        if (!enrichedDelivery) {
            return res.status(400).json({ error: 'Could not find delivery/shipment' });
        }
        
        // Ensure required fields
        if (!enrichedDelivery.route_difficulty_score) enrichedDelivery.route_difficulty_score = 0.5;
        if (!enrichedDelivery.traffic_volatility) enrichedDelivery.traffic_volatility = 0.5;
        if (!enrichedDelivery.weather_severity) enrichedDelivery.weather_severity = 0.0;
        if (!enrichedDelivery.delivery_urgency) enrichedDelivery.delivery_urgency = 'medium';
        if (!enrichedDelivery.goods_type) enrichedDelivery.goods_type = 'standard';
        
        const allDeliveries = await getAllEnrichedDeliveries();
        const comparison = intelligence.compareDriversForDelivery(enrichedDelivery, driverIds, allDeliveries);
        
        res.json(comparison);
    } catch (error) {
        console.error('Error comparing drivers:', error);
        res.status(500).json({ error: 'Driver comparison failed', details: error.message });
    }
});

/**
 * POST /api/intelligence/feedback-attribution
 * 
 * Analyze customer feedback for attribution (driver vs system).
 * 
 * Body: { feedback: {...}, deliveryContext?: {...} }
 */
router.post('/feedback-attribution', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const { feedback, deliveryContext } = req.body;
        
        if (!feedback) {
            return res.status(400).json({ error: 'Feedback data is required' });
        }
        
        const attribution = intelligence.processFeedbackWithAttribution(feedback, deliveryContext || {});
        
        res.json(attribution);
    } catch (error) {
        console.error('Error in feedback attribution:', error);
        res.status(500).json({ error: 'Feedback attribution failed', details: error.message });
    }
});

/**
 * POST /api/intelligence/track-override
 * 
 * Track operator override for learning.
 * 
 * Body: { overrideEvent: {...}, originalRecommendation: {...}, actualDecision: {...} }
 */
router.post('/track-override', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const { overrideEvent, originalRecommendation, actualDecision } = req.body;
        
        if (!overrideEvent || !originalRecommendation || !actualDecision) {
            return res.status(400).json({ error: 'Override event, original recommendation, and actual decision are required' });
        }
        
        // Add operator ID from auth token
        if (!overrideEvent.operator_id && req.user) {
            overrideEvent.operator_id = req.user.id;
        }
        
        const learningSignal = intelligence.trackOperatorOverride(overrideEvent, originalRecommendation, actualDecision);
        
        // TODO: Store learning signal in database for future ML training
        // For now, just return it (don't store to maintain prototype simplicity)
        
        res.json({
            success: true,
            learning_signal: learningSignal,
            message: 'Override tracked successfully. Learning signal generated for future model improvement.'
        });
    } catch (error) {
        console.error('Error tracking override:', error);
        res.status(500).json({ error: 'Override tracking failed', details: error.message });
    }
});

/**
 * GET /api/intelligence/override-patterns
 * 
 * Analyze override patterns for insights.
 * NOTE: This would require stored override signals. For now, returns placeholder.
 * 
 * Body: { learningSignals?: [...] }
 */
router.post('/override-patterns', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const { learningSignals } = req.body;
        
        if (!learningSignals || !Array.isArray(learningSignals)) {
            return res.json({
                message: 'No override signals provided. Pattern analysis requires historical override data.',
                note: 'This endpoint will analyze patterns when override signals are stored in the database.'
            });
        }
        
        const patterns = intelligence.overrideLearning.analyzeOverridePatterns(learningSignals);
        
        res.json(patterns);
    } catch (error) {
        console.error('Error analyzing override patterns:', error);
        res.status(500).json({ error: 'Pattern analysis failed', details: error.message });
    }
});

module.exports = router;
