/**
 * Driver × Route Fit Model
 * 
 * Estimates probability of successful delivery by matching driver skills to route requirements.
 * 
 * DECISION-SUPPORT ONLY: Provides fit score and recommendations but does NOT auto-assign drivers.
 * All outputs are explainable for human decision-making.
 * 
 * This is a heuristic model (ML-ready) that can be replaced with trained ML model later
 * without changing the interface.
 */

/**
 * Calculate driver-route fit and success probability
 * 
 * @param {Object} driverSkillProfile - Driver's skill profile from driverSkillProfile module
 * @param {Object} routeRiskAnalysis - Route risk analysis from routeRiskAnalyzer module
 * @param {Object} deliveryContext - Additional delivery context (urgency, fatigue, etc.)
 * @returns {Object} Fit analysis with success probability and explanation
 */
function calculateDriverRouteFit(driverSkillProfile, routeRiskAnalysis, deliveryContext = {}) {
    const {
        delivery_urgency = 'medium',
        fatigue_index = 0.0,
        goods_type = 'standard'
    } = deliveryContext;
    
    const skillVector = driverSkillProfile.skill_vector || {};
    const routeRisk = routeRiskAnalysis.route_risk_score || 0.5;
    const riskContributors = routeRiskAnalysis.risk_contributors || {};
    
    // Calculate skill match for route requirements
    const skillMatch = calculateSkillMatch(skillVector, routeRiskAnalysis, deliveryContext);
    
    // Calculate fatigue impact (higher fatigue = lower success probability)
    const fatigueImpact = calculateFatigueImpact(fatigue_index);
    
    // Calculate overall success probability
    const successProbability = calculateSuccessProbability(
        skillMatch,
        routeRisk,
        fatigueImpact,
        delivery_urgency
    );
    
    // Calculate confidence level in the prediction
    const confidenceLevel = calculateFitConfidence(
        driverSkillProfile.metadata?.profile_confidence || 0.5,
        routeRiskAnalysis
    );
    
    // Build explainable recommendation
    const explanation = buildFitExplanation(
        skillMatch,
        routeRisk,
        fatigueImpact,
        successProbability,
        driverSkillProfile,
        routeRiskAnalysis
    );
    
    // Generate recommendations
    const recommendations = generateFitRecommendations(
        successProbability,
        skillMatch,
        fatigueImpact,
        deliveryContext
    );
    
    return {
        driver_id: driverSkillProfile.rider_id,
        success_probability: successProbability,
        confidence_level: confidenceLevel,
        fit_score: skillMatch.overall_match,
        skill_match_breakdown: skillMatch,
        route_risk_score: routeRisk,
        fatigue_impact: fatigueImpact,
        explanation: explanation,
        recommendations: recommendations,
        decision_support: {
            recommended: successProbability >= 0.7,
            caution_required: successProbability < 0.6 && successProbability >= 0.4,
            not_recommended: successProbability < 0.4,
            reasoning: getDecisionReasoning(successProbability, skillMatch, fatigueImpact)
        },
        timestamp: new Date().toISOString()
    };
}

/**
 * Calculate skill match between driver and route requirements
 * 
 * Matches driver skills to route challenges:
 * - Fragile goods → fragile_handling skill
 * - Urgent delivery → urgency_handling skill
 * - Night route → night_driving skill
 * - Weather severity → weather_resilience skill
 * - Route difficulty → consistency skill
 * - Traffic volatility → stress_recovery skill
 * 
 * @param {Object} skillVector - Driver's skill vector
 * @param {Object} routeRiskAnalysis - Route risk analysis
 * @param {Object} deliveryContext - Delivery context
 * @returns {Object} Skill match breakdown
 */
function calculateSkillMatch(skillVector, routeRiskAnalysis, deliveryContext) {
    const {
        goods_type = 'standard',
        delivery_urgency = 'medium'
    } = deliveryContext;
    
    const riskContributors = routeRiskAnalysis.risk_contributors || {};
    
    // Match fragile goods requirement
    let fragileMatch = 0.5; // Neutral if not applicable
    if (goods_type === 'fragile' || goods_type === 'Fragile') {
        fragileMatch = skillVector.fragile_handling || 0.5;
    }
    
    // Match urgency requirement
    let urgencyMatch = 0.5;
    if (delivery_urgency === 'high' || delivery_urgency === 'medium') {
        urgencyMatch = skillVector.urgency_handling || 0.5;
    }
    
    // Match weather severity (high weather severity requires high weather resilience)
    const weatherSeverity = riskContributors.weather_severity?.raw_score || 0.0;
    const weatherMatch = weatherSeverity > 0.3
        ? skillVector.weather_resilience || 0.5
        : 0.7; // Weather not a concern
    
    // Match route difficulty with consistency (difficult routes need consistent drivers)
    const routeDifficulty = riskContributors.route_difficulty?.raw_score || 0.5;
    const consistencyMatch = routeDifficulty > 0.6
        ? skillVector.consistency || 0.5
        : 0.7; // Easy route, consistency less critical
    
    // Match traffic volatility with stress recovery (volatile traffic needs recovery ability)
    const trafficVolatility = riskContributors.traffic_volatility?.raw_score || 0.5;
    const recoveryMatch = trafficVolatility > 0.5
        ? skillVector.stress_recovery || 0.5
        : 0.7; // Stable traffic, recovery less critical
    
    // Overall match (weighted average)
    const weights = {
        fragile: goods_type === 'fragile' ? 0.3 : 0.1,
        urgency: delivery_urgency === 'high' ? 0.3 : 0.15,
        weather: weatherSeverity > 0.3 ? 0.2 : 0.1,
        consistency: routeDifficulty > 0.6 ? 0.2 : 0.1,
        recovery: trafficVolatility > 0.5 ? 0.2 : 0.1
    };
    
    const overallMatch = (
        fragileMatch * weights.fragile +
        urgencyMatch * weights.urgency +
        weatherMatch * weights.weather +
        consistencyMatch * weights.consistency +
        recoveryMatch * weights.recovery
    ) / (weights.fragile + weights.urgency + weights.weather + weights.consistency + weights.recovery);
    
    return {
        fragile_handling_match: Math.round(fragileMatch * 100) / 100,
        urgency_handling_match: Math.round(urgencyMatch * 100) / 100,
        weather_resilience_match: Math.round(weatherMatch * 100) / 100,
        consistency_match: Math.round(consistencyMatch * 100) / 100,
        stress_recovery_match: Math.round(recoveryMatch * 100) / 100,
        overall_match: Math.round(overallMatch * 100) / 100,
        match_details: {
            fragile_weight: weights.fragile,
            urgency_weight: weights.urgency,
            weather_weight: weights.weather,
            consistency_weight: weights.consistency,
            recovery_weight: weights.recovery
        }
    };
}

/**
 * Calculate fatigue impact on success probability
 * 
 * Higher fatigue reduces success probability:
 * - fatigue_index 0.0 → no impact (1.0 multiplier)
 * - fatigue_index 0.5 → moderate impact (0.8 multiplier)
 * - fatigue_index 1.0 → severe impact (0.5 multiplier)
 * 
 * @param {number} fatigueIndex - Fatigue index (0-1)
 * @returns {Object} Fatigue impact details
 */
function calculateFatigueImpact(fatigueIndex) {
    const normalizedFatigue = Math.max(0, Math.min(1, fatigueIndex || 0));
    
    // Exponential decay: fatigue impact increases non-linearly
    // fatigue 0.0 = 1.0 (no impact)
    // fatigue 0.5 = ~0.75 (moderate impact)
    // fatigue 1.0 = 0.5 (severe impact)
    const impactMultiplier = 1 - (normalizedFatigue * 0.5);
    
    let impactLevel = 'none';
    if (normalizedFatigue >= 0.7) impactLevel = 'severe';
    else if (normalizedFatigue >= 0.4) impactLevel = 'moderate';
    else if (normalizedFatigue >= 0.2) impactLevel = 'low';
    
    return {
        fatigue_index: normalizedFatigue,
        impact_multiplier: Math.round(impactMultiplier * 100) / 100,
        impact_level: impactLevel,
        explanation: getFatigueExplanation(normalizedFatigue)
    };
}

/**
 * Calculate overall success probability
 * 
 * Success probability = f(skill_match, route_risk, fatigue, urgency)
 * 
 * Formula: success_prob = (skill_match * (1 - route_risk)) * fatigue_multiplier * urgency_factor
 * 
 * @param {Object} skillMatch - Skill match breakdown
 * @param {number} routeRisk - Route risk score (0-1)
 * @param {Object} fatigueImpact - Fatigue impact details
 * @param {string} deliveryUrgency - Delivery urgency
 * @returns {number} Success probability (0-1)
 */
function calculateSuccessProbability(skillMatch, routeRisk, fatigueImpact, deliveryUrgency) {
    // Base probability: skill match weighted by inverse of route risk
    // Higher skill match + lower risk = higher success probability
    const baseProbability = skillMatch.overall_match * (1 - routeRisk);
    
    // Apply fatigue impact (multiplicative)
    const fatigueAdjusted = baseProbability * fatigueImpact.impact_multiplier;
    
    // Apply urgency modifier (high urgency slightly reduces probability due to stress)
    const urgencyModifier = getUrgencyProbabilityModifier(deliveryUrgency);
    const urgencyAdjusted = fatigueAdjusted * urgencyModifier;
    
    // Ensure result is in 0-1 range
    const successProb = Math.max(0, Math.min(1, urgencyAdjusted));
    
    return Math.round(successProb * 100) / 100; // Round to 2 decimals
}

/**
 * Get urgency modifier for success probability
 * 
 * @param {string} urgency - Delivery urgency
 * @returns {number} Modifier (0-1)
 */
function getUrgencyProbabilityModifier(urgency) {
    // High urgency adds stress, slightly reducing success probability
    const modifiers = {
        'low': 1.0,      // No stress impact
        'medium': 0.95,  // Slight stress impact
        'high': 0.90     // Moderate stress impact
    };
    
    return modifiers[urgency?.toLowerCase()] || 0.95;
}

/**
 * Calculate confidence level in the fit prediction
 * 
 * Confidence depends on:
 * - Driver profile confidence (more historical data = higher confidence)
 * - Route risk certainty (well-analyzed routes = higher confidence)
 * 
 * @param {number} driverConfidence - Driver profile confidence (0-1)
 * @param {Object} routeRiskAnalysis - Route risk analysis
 * @returns {number} Overall confidence level (0-1)
 */
function calculateFitConfidence(driverConfidence, routeRiskAnalysis) {
    // Route analysis confidence (assumed 0.8 if route data is complete)
    const routeConfidence = routeRiskAnalysis.key_contributors?.length > 0 ? 0.8 : 0.5;
    
    // Combined confidence: geometric mean (conservative)
    const combinedConfidence = Math.sqrt(driverConfidence * routeConfidence);
    
    return Math.round(combinedConfidence * 100) / 100;
}

/**
 * Get fatigue explanation
 */
function getFatigueExplanation(fatigueIndex) {
    if (fatigueIndex >= 0.7) {
        return 'Severe fatigue detected. High risk of performance degradation.';
    } else if (fatigueIndex >= 0.4) {
        return 'Moderate fatigue detected. Monitor driver performance closely.';
    } else if (fatigueIndex >= 0.2) {
        return 'Low fatigue detected. Minimal impact expected.';
    }
    return 'Driver is well-rested. No fatigue concerns.';
}

/**
 * Build human-readable fit explanation
 * 
 * @param {Object} skillMatch - Skill match breakdown
 * @param {number} routeRisk - Route risk score
 * @param {Object} fatigueImpact - Fatigue impact
 * @param {number} successProbability - Success probability
 * @param {Object} driverProfile - Driver skill profile
 * @param {Object} routeAnalysis - Route risk analysis
 * @returns {Object} Explanation object
 */
function buildFitExplanation(skillMatch, routeRisk, fatigueImpact, successProbability, driverProfile, routeAnalysis) {
    const fitLevel = successProbability >= 0.7 ? 'excellent' 
                   : successProbability >= 0.5 ? 'good'
                   : successProbability >= 0.4 ? 'moderate'
                   : 'poor';
    
    const summary = `Driver-Route Fit: ${fitLevel.toUpperCase()} (${(successProbability * 100).toFixed(1)}% success probability)`;
    
    const details = [];
    
    if (skillMatch.overall_match >= 0.7) {
        details.push(`Strong skill match (${(skillMatch.overall_match * 100).toFixed(1)}%). Driver skills align well with route requirements.`);
    } else if (skillMatch.overall_match < 0.5) {
        details.push(`Weak skill match (${(skillMatch.overall_match * 100).toFixed(1)}%). Driver may lack required capabilities.`);
    }
    
    if (routeRisk >= 0.5) {
        details.push(`High route risk (${(routeRisk * 100).toFixed(1)}%) requires exceptional driver capability.`);
    } else {
        details.push(`Route risk is manageable (${(routeRisk * 100).toFixed(1)}%).`);
    }
    
    if (fatigueImpact.impact_level === 'severe') {
        details.push(`Severe fatigue impact (${(fatigueImpact.fatigue_index * 100).toFixed(1)}%). Performance degradation likely.`);
    } else if (fatigueImpact.impact_level === 'moderate') {
        details.push(`Moderate fatigue impact (${(fatigueImpact.fatigue_index * 100).toFixed(1)}%). Monitor performance.`);
    }
    
    // Identify strongest and weakest matches
    const matches = [
        { name: 'Fragile Handling', value: skillMatch.fragile_handling_match },
        { name: 'Urgency Handling', value: skillMatch.urgency_handling_match },
        { name: 'Weather Resilience', value: skillMatch.weather_resilience_match },
        { name: 'Consistency', value: skillMatch.consistency_match },
        { name: 'Stress Recovery', value: skillMatch.stress_recovery_match }
    ];
    
    const sortedMatches = [...matches].sort((a, b) => b.value - a.value);
    const strongest = sortedMatches[0];
    const weakest = sortedMatches[sortedMatches.length - 1];
    
    if (strongest.value > 0.7) {
        details.push(`Strongest match: ${strongest.name} (${(strongest.value * 100).toFixed(1)}%)`);
    }
    
    if (weakest.value < 0.5 && weakest.value < strongest.value - 0.2) {
        details.push(`Weakest match: ${weakest.name} (${(weakest.value * 100).toFixed(1)}%). Consider this gap.`);
    }
    
    return {
        summary: summary,
        detailed_explanations: details,
        fit_interpretation: {
            excellent: 'Success probability ≥70%: Strongly recommended for this route',
            good: 'Success probability 50-70%: Suitable for this route with monitoring',
            moderate: 'Success probability 40-50%: Caution required, consider alternatives',
            poor: 'Success probability <40%: Not recommended without significant route modifications'
        }
    };
}

/**
 * Generate fit-based recommendations
 * 
 * @param {number} successProbability - Success probability
 * @param {Object} skillMatch - Skill match breakdown
 * @param {Object} fatigueImpact - Fatigue impact
 * @param {Object} deliveryContext - Delivery context
 * @returns {Array} Array of recommendation strings
 */
function generateFitRecommendations(successProbability, skillMatch, fatigueImpact, deliveryContext) {
    const recommendations = [];
    
    if (successProbability >= 0.7) {
        recommendations.push('✓ RECOMMENDED: Driver is well-suited for this route');
        recommendations.push('Expected success probability is high');
    } else if (successProbability >= 0.5) {
        recommendations.push('⚠ CONDITIONAL: Driver can handle route with monitoring');
        recommendations.push('Enable real-time tracking and status updates');
    } else if (successProbability >= 0.4) {
        recommendations.push('⚠ CAUTION: Success probability is moderate');
        recommendations.push('Consider alternative driver or route modifications');
        recommendations.push('Require real-time monitoring and intervention readiness');
    } else {
        recommendations.push('✗ NOT RECOMMENDED: Success probability too low');
        recommendations.push('Consider alternative driver assignment');
        recommendations.push('Or modify route requirements if driver assignment is necessary');
    }
    
    // Specific recommendations based on gaps
    if (skillMatch.fragile_handling_match < 0.5 && deliveryContext.goods_type === 'fragile') {
        recommendations.push('Driver has weak fragile handling skills for fragile goods delivery');
    }
    
    if (skillMatch.urgency_handling_match < 0.5 && deliveryContext.delivery_urgency === 'high') {
        recommendations.push('Driver has weak urgency handling for high-urgency delivery');
    }
    
    if (fatigueImpact.impact_level === 'severe') {
        recommendations.push('CRITICAL: Driver fatigue is too high. Recommend rest period or alternative driver.');
    } else if (fatigueImpact.impact_level === 'moderate') {
        recommendations.push('Monitor driver fatigue levels during delivery');
    }
    
    return recommendations;
}

/**
 * Get decision reasoning
 */
function getDecisionReasoning(successProbability, skillMatch, fatigueImpact) {
    if (successProbability >= 0.7) {
        return `High success probability (${(successProbability * 100).toFixed(1)}%) based on strong skill match and manageable route risk.`;
    } else if (successProbability >= 0.4) {
        return `Moderate success probability (${(successProbability * 100).toFixed(1)}%). Skill gaps or route challenges identified. Requires monitoring.`;
    } else {
        return `Low success probability (${(successProbability * 100).toFixed(1)}%). Significant skill-route mismatch or critical challenges. Not recommended without modifications.`;
    }
}

/**
 * Compare multiple drivers for a route
 * 
 * DECISION-SUPPORT: Helps operator choose best driver for a route
 * 
 * @param {Array<Object>} driverFitAnalyses - Array of driver-route fit analyses
 * @returns {Object} Comparison result with ranked recommendations
 */
function compareDriversForRoute(driverFitAnalyses) {
    if (driverFitAnalyses.length < 2) {
        return { error: 'Need at least 2 drivers to compare' };
    }
    
    // Sort by success probability (descending)
    const sorted = [...driverFitAnalyses].sort((a, b) => b.success_probability - a.success_probability);
    
    const comparison = {
        total_drivers: driverFitAnalyses.length,
        ranked_drivers: sorted.map((fit, idx) => ({
            rank: idx + 1,
            driver_id: fit.driver_id,
            success_probability: fit.success_probability,
            confidence_level: fit.confidence_level,
            fit_score: fit.fit_score,
            recommendation: idx === 0 ? 'BEST MATCH' : idx < 3 ? 'SUITABLE' : 'NOT RECOMMENDED'
        })),
        top_recommendation: sorted[0],
        alternative_options: sorted.slice(1, 3), // Top 3 alternatives
        explanation: `Compared ${driverFitAnalyses.length} drivers. Top recommendation: ${sorted[0].driver_id} with ${(sorted[0].success_probability * 100).toFixed(1)}% success probability.`
    };
    
    return comparison;
}

module.exports = {
    calculateDriverRouteFit,
    compareDriversForRoute,
    // Expose helper functions for testing
    calculateSkillMatch,
    calculateSuccessProbability,
    calculateFatigueImpact
};
