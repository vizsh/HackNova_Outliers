/**
 * Intelligence Coordinator
 * 
 * Main coordinator service that orchestrates all intelligence modules.
 * Provides unified interface for decision-support features.
 * 
 * DECISION-SUPPORT ONLY: All outputs are explainable and advisory.
 * No automatic decisions or executions.
 */

const driverSkillProfile = require('./driverSkillProfile');
const routeRiskAnalyzer = require('./routeRiskAnalyzer');
const driverRouteFit = require('./driverRouteFit');
const delayPrediction = require('./delayPrediction');
const feedbackAttribution = require('./feedbackAttribution');
const overrideLearning = require('./overrideLearning');

/**
 * Get comprehensive intelligence analysis for a delivery decision
 * 
 * Combines all intelligence modules to provide complete decision-support analysis:
 * - Driver skill profile
 * - Route risk analysis
 * - Driver-route fit
 * - Delay prediction
 * 
 * DECISION-SUPPORT: Provides complete analysis but does NOT auto-assign.
 * Operator makes final decision based on recommendations.
 * 
 * @param {Object} request - Decision request
 * @param {Object} request.delivery - Delivery record or request
 * @param {Array} request.driverHistory - Optional: Driver's delivery history for skill profiling
 * @param {Array} request.allDeliveries - Optional: All deliveries for skill profiling
 * @param {string} request.driverId - Optional: Specific driver to analyze
 * @returns {Object} Comprehensive intelligence analysis
 */
function getComprehensiveAnalysis(request) {
    const {
        delivery,
        driverHistory = [],
        allDeliveries = [],
        driverId = null
    } = request;
    
    // 1. Analyze route risk
    const routeAnalysis = routeRiskAnalyzer.analyzeRouteRisk(delivery);
    
    // 2. Get driver skill profile (if driver specified or can infer)
    let driverProfile = null;
    if (driverId) {
        const driverDeliveries = allDeliveries.filter(d => d.rider_id === driverId);
        // Even with empty history, generate a profile (will use defaults)
        driverProfile = driverSkillProfile.computeDriverSkillProfile(driverDeliveries.length > 0 ? driverDeliveries : [], driverId);
    } else if (delivery.rider_id) {
        const driverDeliveries = allDeliveries.filter(d => d.rider_id === delivery.rider_id);
        driverProfile = driverSkillProfile.computeDriverSkillProfile(driverDeliveries.length > 0 ? driverDeliveries : [], delivery.rider_id);
    } else if (driverHistory && driverHistory.length > 0) {
        // Use provided driverHistory directly
        const inferredDriverId = driverHistory[0]?.rider_id || null;
        if (inferredDriverId) {
            driverProfile = driverSkillProfile.computeDriverSkillProfile(driverHistory, inferredDriverId);
        }
    }
    
    // 3. Calculate driver-route fit (if driver profile available)
    let fitAnalysis = null;
    if (driverProfile && routeAnalysis) {
        fitAnalysis = driverRouteFit.calculateDriverRouteFit(
            driverProfile,
            routeAnalysis,
            {
                delivery_urgency: delivery.delivery_urgency || 'medium',
                fatigue_index: delivery.fatigue_index || 0.0,
                goods_type: delivery.goods_type || 'standard'
            }
        );
    }
    
    // 4. Predict delay
    const delayPrediction_result = delayPrediction.predictDelay(
        routeAnalysis,
        driverProfile,
        {
            fatigue_index: delivery.fatigue_index || 0.0,
            base_distance_km: delivery.base_distance_km || null,
            scheduled_time_min: delivery.scheduled_time_min || null,
            delivery_urgency: delivery.delivery_urgency || 'medium',
            goods_type: delivery.goods_type || 'standard'
        }
    );
    
    // 5. Build comprehensive recommendation
    const recommendation = buildComprehensiveRecommendation(
        routeAnalysis,
        driverProfile,
        fitAnalysis,
        delayPrediction_result
    );
    
    return {
        delivery_id: delivery.order_id || delivery.tracking_number || 'unknown',
        route_analysis: routeAnalysis,
        driver_profile: driverProfile,
        driver_route_fit: fitAnalysis,
        delay_prediction: delayPrediction_result,
        recommendation: recommendation,
        decision_support_summary: buildDecisionSupportSummary(
            routeAnalysis,
            driverProfile,
            fitAnalysis,
            delayPrediction_result
        ),
        timestamp: new Date().toISOString()
    };
}

/**
 * Build comprehensive recommendation from all analyses
 * 
 * DECISION-SUPPORT: Combines all intelligence signals into unified recommendation
 * 
 * @param {Object} routeAnalysis - Route risk analysis
 * @param {Object} driverProfile - Driver skill profile (optional)
 * @param {Object} fitAnalysis - Driver-route fit analysis (optional)
 * @param {Object} delayPrediction - Delay prediction
 * @returns {Object} Comprehensive recommendation
 */
function buildComprehensiveRecommendation(routeAnalysis, driverProfile, fitAnalysis, delayPrediction) {
    const recommendation = {
        overall_assessment: 'moderate',
        risk_level: routeAnalysis.risk_level || 'medium',
        confidence: 0.5,
        key_factors: [],
        recommendations: [],
        warnings: [],
        decision_support: {
            proceed: null, // null = no automatic decision
            caution_required: false,
            alternative_suggested: false
        }
    };
    
    // Determine overall assessment
    if (fitAnalysis && fitAnalysis.success_probability >= 0.7) {
        recommendation.overall_assessment = 'positive';
        recommendation.decision_support.proceed = true;
    } else if (fitAnalysis && fitAnalysis.success_probability < 0.4) {
        recommendation.overall_assessment = 'negative';
        recommendation.decision_support.proceed = false;
        recommendation.decision_support.caution_required = true;
    } else {
        recommendation.overall_assessment = 'conditional';
        recommendation.decision_support.caution_required = true;
    }
    
    // Calculate overall confidence (average of available analyses)
    const confidences = [];
    if (fitAnalysis && fitAnalysis.confidence_level) confidences.push(fitAnalysis.confidence_level);
    if (delayPrediction && delayPrediction.prediction_confidence) confidences.push(delayPrediction.prediction_confidence);
    if (driverProfile && driverProfile.metadata?.profile_confidence) confidences.push(driverProfile.metadata.profile_confidence);
    
    if (confidences.length > 0) {
        recommendation.confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    }
    
    // Collect key factors
    if (routeAnalysis.key_contributors && routeAnalysis.key_contributors.length > 0) {
        recommendation.key_factors.push(`Route risk: ${routeAnalysis.key_contributors.map(c => c.factor).join(', ')}`);
    }
    
    if (fitAnalysis) {
        recommendation.key_factors.push(`Success probability: ${(fitAnalysis.success_probability * 100).toFixed(1)}%`);
    }
    
    if (delayPrediction) {
        recommendation.key_factors.push(`Predicted delay: ${delayPrediction.predicted_delay_minutes} minutes (${delayPrediction.delay_risk_band})`);
    }
    
    // Collect recommendations
    if (routeAnalysis.recommendations) {
        recommendation.recommendations.push(...routeAnalysis.recommendations);
    }
    
    if (fitAnalysis && fitAnalysis.recommendations) {
        recommendation.recommendations.push(...fitAnalysis.recommendations);
    }
    
    if (delayPrediction && delayPrediction.recommendations) {
        recommendation.recommendations.push(...delayPrediction.recommendations);
    }
    
    // Collect warnings
    if (routeAnalysis.risk_level === 'critical') {
        recommendation.warnings.push('CRITICAL ROUTE RISK: Route review strongly recommended');
    }
    
    if (fitAnalysis && fitAnalysis.success_probability < 0.4) {
        recommendation.warnings.push('LOW SUCCESS PROBABILITY: Driver-route mismatch identified');
    }
    
    if (delayPrediction && delayPrediction.delay_risk_band === 'high') {
        recommendation.warnings.push('HIGH DELAY RISK: Significant delays expected');
    }
    
    // Build explanation
    recommendation.explanation = buildRecommendationExplanation(recommendation, fitAnalysis, delayPrediction);
    
    return recommendation;
}

/**
 * Build recommendation explanation
 */
function buildRecommendationExplanation(recommendation, fitAnalysis, delayPrediction) {
    let summary = `Overall Assessment: ${recommendation.overall_assessment.toUpperCase()}. `;
    
    if (fitAnalysis) {
        summary += `Success probability: ${(fitAnalysis.success_probability * 100).toFixed(1)}%. `;
    }
    
    if (delayPrediction) {
        summary += `Predicted delay: ${delayPrediction.predicted_delay_minutes} minutes (${delayPrediction.delay_risk_band} risk). `;
    }
    
    summary += `Confidence: ${(recommendation.confidence * 100).toFixed(0)}%.`;
    
    return {
        summary: summary,
        assessment_interpretation: {
            positive: 'Strong recommendation to proceed. All factors align favorably.',
            conditional: 'Conditional recommendation. Proceed with monitoring and caution.',
            negative: 'Recommendation against proceeding. Significant risks identified. Consider alternatives.',
            moderate: 'Moderate recommendation. Standard monitoring recommended.'
        },
        key_considerations: recommendation.key_factors,
        warnings: recommendation.warnings.length > 0 ? recommendation.warnings : ['No critical warnings'],
        note: 'This is decision-support only. Final decision rests with operator. All recommendations are advisory.'
    };
}

/**
 * Build decision support summary
 */
function buildDecisionSupportSummary(routeAnalysis, driverProfile, fitAnalysis, delayPrediction) {
    return {
        route_risk: routeAnalysis.risk_level || 'unknown',
        driver_available: driverProfile !== null,
        fit_available: fitAnalysis !== null,
        success_probability: fitAnalysis?.success_probability || null,
        predicted_delay: delayPrediction?.predicted_delay_minutes || null,
        delay_risk: delayPrediction?.delay_risk_band || null,
        overall_confidence: calculateOverallConfidence(routeAnalysis, driverProfile, fitAnalysis, delayPrediction),
        primary_concern: identifyPrimaryConcern(routeAnalysis, fitAnalysis, delayPrediction)
    };
}

/**
 * Calculate overall confidence from all analyses
 */
function calculateOverallConfidence(routeAnalysis, driverProfile, fitAnalysis, delayPrediction) {
    const confidences = [];
    
    if (routeAnalysis) confidences.push(0.8); // Route analysis generally high confidence
    if (driverProfile?.metadata?.profile_confidence) confidences.push(driverProfile.metadata.profile_confidence);
    if (fitAnalysis?.confidence_level) confidences.push(fitAnalysis.confidence_level);
    if (delayPrediction?.prediction_confidence) confidences.push(delayPrediction.prediction_confidence);
    
    if (confidences.length === 0) return 0.5;
    
    return Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100;
}

/**
 * Identify primary concern from analyses
 */
function identifyPrimaryConcern(routeAnalysis, fitAnalysis, delayPrediction) {
    const concerns = [];
    
    if (routeAnalysis && routeAnalysis.risk_level === 'critical') {
        concerns.push({ level: 'critical', concern: 'Route risk is critical' });
    }
    
    if (fitAnalysis && fitAnalysis.success_probability < 0.4) {
        concerns.push({ level: 'high', concern: 'Low success probability' });
    }
    
    if (delayPrediction && delayPrediction.delay_risk_band === 'high') {
        concerns.push({ level: 'high', concern: 'High delay risk' });
    }
    
    if (concerns.length === 0) {
        return { level: 'none', concern: 'No major concerns identified' };
    }
    
    // Return highest priority concern
    const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    concerns.sort((a, b) => priorityOrder[b.level] - priorityOrder[a.level]);
    
    return concerns[0];
}

/**
 * Compare multiple drivers for a delivery
 * 
 * DECISION-SUPPORT: Provides ranked driver recommendations
 * 
 * @param {Object} delivery - Delivery record
 * @param {Array} driverIds - Array of driver IDs to compare
 * @param {Array} allDeliveries - All deliveries for skill profiling
 * @returns {Object} Driver comparison result
 */
function compareDriversForDelivery(delivery, driverIds, allDeliveries) {
    const routeAnalysis = routeRiskAnalyzer.analyzeRouteRisk(delivery);
    
    const driverAnalyses = driverIds.map(driverId => {
        const driverDeliveries = allDeliveries.filter(d => d.rider_id === driverId);
        const driverProfile = driverSkillProfile.computeDriverSkillProfile(driverDeliveries, driverId);
        const fitAnalysis = driverRouteFit.calculateDriverRouteFit(
            driverProfile,
            routeAnalysis,
            {
                delivery_urgency: delivery.delivery_urgency || 'medium',
                fatigue_index: delivery.fatigue_index || 0.0,
                goods_type: delivery.goods_type || 'standard'
            }
        );
        
        return fitAnalysis;
    });
    
    return driverRouteFit.compareDriversForRoute(driverAnalyses);
}

/**
 * Process feedback with attribution analysis
 * 
 * @param {Object} feedback - Feedback record
 * @param {Object} deliveryContext - Delivery context
 * @returns {Object} Feedback with attribution
 */
function processFeedbackWithAttribution(feedback, deliveryContext = {}) {
    return feedbackAttribution.analyzeFeedbackAttribution(
        feedback.customer_feedback_text || feedback.comment || '',
        deliveryContext
    );
}

/**
 * Track operator override for learning
 * 
 * @param {Object} overrideEvent - Override event
 * @param {Object} originalRecommendation - Original recommendation
 * @param {Object} actualDecision - Actual decision
 * @returns {Object} Learning signal
 */
function trackOperatorOverride(overrideEvent, originalRecommendation, actualDecision) {
    return overrideLearning.trackOverride(overrideEvent, originalRecommendation, actualDecision);
}

module.exports = {
    getComprehensiveAnalysis,
    compareDriversForDelivery,
    processFeedbackWithAttribution,
    trackOperatorOverride,
    // Expose individual modules for direct use if needed
    driverSkillProfile,
    routeRiskAnalyzer,
    driverRouteFit,
    delayPrediction,
    feedbackAttribution,
    overrideLearning
};
