/**
 * Delay Prediction Module
 * 
 * Predicts expected delay in minutes based on route characteristics and driver state.
 * 
 * DECISION-SUPPORT ONLY: Provides delay estimates but does NOT modify ETAs automatically.
 * All predictions are explainable and include confidence intervals.
 * 
 * This is a heuristic model (ML-ready) that can be replaced with trained ML model later.
 */

/**
 * Predict delay for a delivery
 * 
 * @param {Object} routeRiskAnalysis - Route risk analysis from routeRiskAnalyzer
 * @param {Object} driverSkillProfile - Driver skill profile (optional, for driver-specific prediction)
 * @param {Object} deliveryContext - Delivery context (fatigue, urgency, etc.)
 * @returns {Object} Delay prediction with risk band and explanation
 */
function predictDelay(routeRiskAnalysis, driverSkillProfile = null, deliveryContext = {}) {
    const {
        fatigue_index = 0.0,
        base_distance_km = null,
        scheduled_time_min = null
    } = deliveryContext;
    
    const routeDifficulty = routeRiskAnalysis.normalized_difficulty || 0.5;
    const trafficVolatility = routeRiskAnalysis.risk_contributors?.traffic_volatility?.raw_score || 0.5;
    const weatherSeverity = routeRiskAnalysis.risk_contributors?.weather_severity?.raw_score || 0.0;
    
    // Base delay calculation
    const baseDelay = calculateBaseDelay(
        routeDifficulty,
        trafficVolatility,
        weatherSeverity,
        base_distance_km,
        scheduled_time_min
    );
    
    // Fatigue impact on delay (fatigued drivers take longer)
    const fatigueDelay = calculateFatigueDelay(fatigue_index, baseDelay);
    
    // Driver skill adjustment (if driver profile provided)
    const skillAdjustment = driverSkillProfile 
        ? calculateSkillBasedAdjustment(driverSkillProfile.skill_vector, routeRiskAnalysis)
        : { adjustment_minutes: 0, adjustment_factor: 1.0 };
    
    // Calculate predicted delay
    const predictedDelay = Math.max(0, baseDelay + fatigueDelay + skillAdjustment.adjustment_minutes);
    
    // Calculate delay risk band
    const delayRiskBand = categorizeDelayRisk(predictedDelay, scheduled_time_min || 0);
    
    // Build explanation
    const explanation = buildDelayExplanation(
        baseDelay,
        fatigueDelay,
        skillAdjustment,
        predictedDelay,
        delayRiskBand,
        routeRiskAnalysis,
        driverSkillProfile
    );
    
    // Generate recommendations
    const recommendations = generateDelayRecommendations(predictedDelay, delayRiskBand, routeRiskAnalysis);
    
    return {
        predicted_delay_minutes: Math.round(predictedDelay),
        delay_risk_band: delayRiskBand,
        delay_components: {
            base_delay: Math.round(baseDelay),
            fatigue_delay: Math.round(fatigueDelay),
            skill_adjustment: Math.round(skillAdjustment.adjustment_minutes)
        },
        prediction_confidence: calculatePredictionConfidence(routeRiskAnalysis, driverSkillProfile),
        explanation: explanation,
        recommendations: recommendations,
        timestamp: new Date().toISOString()
    };
}

/**
 * Calculate base delay from route characteristics
 * 
 * Base delay formula:
 * base_delay = (route_difficulty * base_factor) + (traffic_volatility * traffic_factor) + (weather_severity * weather_factor)
 * 
 * Factors are calibrated to typical delay ranges:
 * - route_difficulty 0.5 → ~15-20 min delay
 * - traffic_volatility 0.5 → ~10-15 min delay
 * - weather_severity 0.5 → ~10-15 min delay
 * 
 * @param {number} routeDifficulty - Normalized route difficulty (0-1)
 * @param {number} trafficVolatility - Traffic volatility (0-1)
 * @param {number} weatherSeverity - Weather severity (0-1)
 * @param {number} baseDistanceKm - Base distance in km (optional, for distance-based scaling)
 * @param {number} scheduledTimeMin - Scheduled time in minutes (optional, for percentage-based delay)
 * @returns {number} Base delay in minutes
 */
function calculateBaseDelay(routeDifficulty, trafficVolatility, weatherSeverity, baseDistanceKm = null, scheduledTimeMin = null) {
    // Base delay factors (calibrated to typical delay ranges)
    const ROUTE_DIFFICULTY_FACTOR = 30; // Max ~30 min delay from difficulty
    const TRAFFIC_VOLATILITY_FACTOR = 20; // Max ~20 min delay from traffic
    const WEATHER_SEVERITY_FACTOR = 25; // Max ~25 min delay from weather
    
    // Calculate delay components
    const difficultyDelay = routeDifficulty * ROUTE_DIFFICULTY_FACTOR;
    const trafficDelay = trafficVolatility * TRAFFIC_VOLATILITY_FACTOR;
    const weatherDelay = weatherSeverity * WEATHER_SEVERITY_FACTOR;
    
    let baseDelay = difficultyDelay + trafficDelay + weatherDelay;
    
    // Distance-based adjustment (if distance provided)
    // Longer distances have more opportunity for delays
    if (baseDistanceKm && baseDistanceKm > 0) {
        const distanceDelayFactor = Math.min(baseDistanceKm / 100, 1.5); // Cap at 1.5x for very long distances
        baseDelay *= (1 + (distanceDelayFactor - 1) * 0.3); // 30% distance scaling
    }
    
    // Percentage-based adjustment (if scheduled time provided)
    // Delays often scale with scheduled time
    if (scheduledTimeMin && scheduledTimeMin > 0) {
        const percentageDelay = baseDelay / scheduledTimeMin;
        // If delay is more than 50% of scheduled time, cap the delay
        if (percentageDelay > 0.5) {
            baseDelay = scheduledTimeMin * 0.5;
        }
    }
    
    return baseDelay;
}

/**
 * Calculate delay increase due to fatigue
 * 
 * Fatigue increases delay:
 * - fatigue_index 0.0 → 0% delay increase
 * - fatigue_index 0.5 → ~15% delay increase
 * - fatigue_index 1.0 → ~30% delay increase
 * 
 * @param {number} fatigueIndex - Fatigue index (0-1)
 * @param {number} baseDelay - Base delay in minutes
 * @returns {number} Additional delay due to fatigue (in minutes)
 */
function calculateFatigueDelay(fatigueIndex, baseDelay) {
    const normalizedFatigue = Math.max(0, Math.min(1, fatigueIndex || 0));
    
    // Fatigue impact: non-linear increase
    // fatigue 0.0 = 0% delay increase
    // fatigue 0.5 = 15% delay increase
    // fatigue 1.0 = 30% delay increase
    const fatigueMultiplier = normalizedFatigue * 0.3;
    
    const additionalDelay = baseDelay * fatigueMultiplier;
    
    return additionalDelay;
}

/**
 * Calculate delay adjustment based on driver skills
 * 
 * Higher skills reduce delay:
 * - Consistent drivers → reduce delay variance
 * - Weather-resilient drivers → reduce weather delays
 * - Stress-recovery capable → reduce traffic delays
 * 
 * @param {Object} skillVector - Driver skill vector
 * @param {Object} routeRiskAnalysis - Route risk analysis
 * @returns {Object} Skill-based adjustment
 */
function calculateSkillBasedAdjustment(skillVector, routeRiskAnalysis) {
    if (!skillVector) {
        return { adjustment_minutes: 0, adjustment_factor: 1.0 };
    }
    
    const routeDifficulty = routeRiskAnalysis.normalized_difficulty || 0.5;
    const trafficVolatility = routeRiskAnalysis.risk_contributors?.traffic_volatility?.raw_score || 0.5;
    const weatherSeverity = routeRiskAnalysis.risk_contributors?.weather_severity?.raw_score || 0.0;
    
    // Consistency reduces delay variance (harder to quantify, approximate as 5-10% reduction)
    const consistencyBonus = skillVector.consistency * 0.1; // Up to 10% delay reduction
    
    // Weather resilience reduces weather-related delays
    const weatherBonus = weatherSeverity > 0.3 
        ? skillVector.weather_resilience * weatherSeverity * 0.3 // Up to 30% of weather delay
        : 0;
    
    // Stress recovery reduces traffic-related delays
    const trafficBonus = trafficVolatility > 0.5
        ? skillVector.stress_recovery * trafficVolatility * 0.2 // Up to 20% of traffic delay
        : 0;
    
    // Calculate base delay for percentage calculations
    const baseDelay = calculateBaseDelay(routeDifficulty, trafficVolatility, weatherSeverity);
    
    // Total reduction in minutes (negative = delay reduction)
    const totalReduction = -(baseDelay * consistencyBonus + weatherSeverity * 25 * weatherBonus + trafficVolatility * 20 * trafficBonus);
    
    // Adjustment factor (for percentage-based adjustments)
    const adjustmentFactor = 1 - consistencyBonus - (weatherSeverity > 0.3 ? weatherBonus : 0) - (trafficVolatility > 0.5 ? trafficBonus : 0);
    
    return {
        adjustment_minutes: totalReduction,
        adjustment_factor: Math.max(0.7, Math.min(1.0, adjustmentFactor)), // Cap between 0.7-1.0
        breakdown: {
            consistency_reduction: -(baseDelay * consistencyBonus),
            weather_reduction: -(weatherSeverity * 25 * weatherBonus),
            traffic_reduction: -(trafficVolatility * 20 * trafficBonus)
        }
    };
}

/**
 * Categorize delay risk band
 * 
 * @param {number} predictedDelay - Predicted delay in minutes
 * @param {number} scheduledTimeMin - Scheduled time in minutes
 * @returns {string} Delay risk band (low/medium/high)
 */
function categorizeDelayRisk(predictedDelay, scheduledTimeMin) {
    if (scheduledTimeMin > 0) {
        // Percentage-based categorization
        const delayPercentage = (predictedDelay / scheduledTimeMin) * 100;
        
        if (delayPercentage >= 30) return 'high';
        if (delayPercentage >= 15) return 'medium';
        return 'low';
    }
    
    // Absolute-based categorization (fallback)
    if (predictedDelay >= 45) return 'high';
    if (predictedDelay >= 20) return 'medium';
    return 'low';
}

/**
 * Calculate prediction confidence
 * 
 * @param {Object} routeRiskAnalysis - Route risk analysis
 * @param {Object} driverSkillProfile - Driver skill profile (optional)
 * @returns {number} Confidence level (0-1)
 */
function calculatePredictionConfidence(routeRiskAnalysis, driverSkillProfile = null) {
    // Base confidence from route analysis completeness
    let confidence = 0.7; // Default moderate confidence
    
    // Increase confidence if route analysis has key contributors identified
    if (routeRiskAnalysis.key_contributors && routeRiskAnalysis.key_contributors.length > 0) {
        confidence += 0.15;
    }
    
    // Increase confidence if driver profile is available and has sufficient data
    if (driverSkillProfile && driverSkillProfile.metadata) {
        const driverConfidence = driverSkillProfile.metadata.profile_confidence || 0.5;
        confidence = (confidence + driverConfidence) / 2; // Average
    }
    
    // Cap at 0.95 (never 100% certain)
    return Math.min(0.95, Math.round(confidence * 100) / 100);
}

/**
 * Build delay explanation
 * 
 * @param {number} baseDelay - Base delay in minutes
 * @param {number} fatigueDelay - Fatigue delay in minutes
 * @param {Object} skillAdjustment - Skill adjustment details
 * @param {number} predictedDelay - Total predicted delay
 * @param {string} delayRiskBand - Delay risk band
 * @param {Object} routeRiskAnalysis - Route risk analysis
 * @param {Object} driverSkillProfile - Driver skill profile (optional)
 * @returns {Object} Explanation object
 */
function buildDelayExplanation(baseDelay, fatigueDelay, skillAdjustment, predictedDelay, delayRiskBand, routeRiskAnalysis, driverSkillProfile) {
    const summary = `Predicted delay: ${Math.round(predictedDelay)} minutes (${delayRiskBand.toUpperCase()} risk)`;
    
    const details = [];
    
    details.push(`Base delay: ${Math.round(baseDelay)} minutes from route characteristics`);
    
    if (fatigueDelay > 5) {
        details.push(`Fatigue impact: +${Math.round(fatigueDelay)} minutes (driver fatigue increases delay)`);
    } else if (fatigueDelay > 0) {
        details.push(`Fatigue impact: +${Math.round(fatigueDelay)} minutes (minimal)`);
    }
    
    if (skillAdjustment.adjustment_minutes < -5) {
        details.push(`Skill bonus: ${Math.round(Math.abs(skillAdjustment.adjustment_minutes))} minutes reduction (driver skills reduce delay)`);
    } else if (skillAdjustment.adjustment_minutes > 5) {
        details.push(`Skill impact: +${Math.round(skillAdjustment.adjustment_minutes)} minutes (skill gaps increase delay)`);
    }
    
    // Identify primary delay contributors
    const contributors = [];
    const routeDifficulty = routeRiskAnalysis.normalized_difficulty || 0.5;
    const trafficVolatility = routeRiskAnalysis.risk_contributors?.traffic_volatility?.raw_score || 0.5;
    const weatherSeverity = routeRiskAnalysis.risk_contributors?.weather_severity?.raw_score || 0.0;
    
    if (routeDifficulty > 0.6) {
        contributors.push(`Route difficulty (${(routeDifficulty * 100).toFixed(0)}%)`);
    }
    if (trafficVolatility > 0.6) {
        contributors.push(`Traffic volatility (${(trafficVolatility * 100).toFixed(0)}%)`);
    }
    if (weatherSeverity > 0.5) {
        contributors.push(`Weather severity (${(weatherSeverity * 100).toFixed(0)}%)`);
    }
    
    if (contributors.length > 0) {
        details.push(`Primary delay contributors: ${contributors.join(', ')}`);
    }
    
    // Risk band interpretation
    const riskInterpretation = {
        low: 'Low delay risk (<15% of scheduled time). Minimal buffer time needed.',
        medium: 'Medium delay risk (15-30% of scheduled time). Moderate buffer time recommended.',
        high: 'High delay risk (>30% of scheduled time). Significant buffer time required or route review needed.'
    };
    
    return {
        summary: summary,
        detailed_breakdown: details,
        risk_band_interpretation: riskInterpretation[delayRiskBand],
        delay_components_explained: {
            base_delay: `Route characteristics contribute ${Math.round(baseDelay)} minutes`,
            fatigue_delay: fatigueDelay > 0 ? `Fatigue adds ${Math.round(fatigueDelay)} minutes` : 'No fatigue impact',
            skill_adjustment: skillAdjustment.adjustment_minutes !== 0 
                ? `Driver skills ${skillAdjustment.adjustment_minutes < 0 ? 'reduce' : 'increase'} delay by ${Math.round(Math.abs(skillAdjustment.adjustment_minutes))} minutes`
                : 'No significant skill-based adjustment'
        }
    };
}

/**
 * Generate delay-based recommendations
 * 
 * @param {number} predictedDelay - Predicted delay in minutes
 * @param {string} delayRiskBand - Delay risk band
 * @param {Object} routeRiskAnalysis - Route risk analysis
 * @returns {Array} Array of recommendation strings
 */
function generateDelayRecommendations(predictedDelay, delayRiskBand, routeRiskAnalysis) {
    const recommendations = [];
    
    if (delayRiskBand === 'high') {
        recommendations.push('⚠ HIGH DELAY RISK: Significant buffer time required');
        recommendations.push('Consider route optimization or alternative route');
        recommendations.push('Set conservative ETA with customer');
        recommendations.push('Enable real-time monitoring for proactive intervention');
    } else if (delayRiskBand === 'medium') {
        recommendations.push('⚠ MODERATE DELAY RISK: Moderate buffer time recommended');
        recommendations.push('Set ETA with appropriate buffer time');
        recommendations.push('Monitor delivery progress for any delays');
    } else {
        recommendations.push('✓ LOW DELAY RISK: Standard ETA should be sufficient');
        recommendations.push('Minimal buffer time needed');
    }
    
    // Specific recommendations based on route factors
    if (routeRiskAnalysis.risk_contributors?.traffic_volatility?.raw_score > 0.7) {
        recommendations.push('High traffic volatility: Consider traffic-aware routing');
        recommendations.push('Driver with strong stress recovery preferred');
    }
    
    if (routeRiskAnalysis.risk_contributors?.weather_severity?.raw_score > 0.6) {
        recommendations.push('Severe weather conditions: Delay likely, inform customer');
        recommendations.push('Driver with high weather resilience required');
    }
    
    return recommendations;
}

/**
 * Batch predict delays for multiple deliveries
 * 
 * DECISION-SUPPORT: Helps operator plan for multiple deliveries
 * 
 * @param {Array<Object>} deliveries - Array of delivery objects with route analysis
 * @param {Object} driverSkillProfile - Driver skill profile (optional, same for all)
 * @returns {Array} Array of delay predictions
 */
function predictBatchDelays(deliveries, driverSkillProfile = null) {
    return deliveries.map(delivery => {
        const routeAnalysis = delivery.route_risk_analysis || {};
        const deliveryContext = {
            fatigue_index: delivery.fatigue_index || 0.0,
            base_distance_km: delivery.base_distance_km || null,
            scheduled_time_min: delivery.scheduled_time_min || null,
            delivery_urgency: delivery.delivery_urgency || 'medium',
            goods_type: delivery.goods_type || 'standard'
        };
        
        return {
            delivery_id: delivery.order_id || delivery.tracking_number || 'unknown',
            prediction: predictDelay(routeAnalysis, driverSkillProfile, deliveryContext)
        };
    });
}

module.exports = {
    predictDelay,
    predictBatchDelays,
    // Expose helper functions for testing
    calculateBaseDelay,
    calculateFatigueDelay,
    categorizeDelayRisk
};
