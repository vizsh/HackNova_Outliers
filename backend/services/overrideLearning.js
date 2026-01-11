/**
 * Human Override Learning Signal Tracker
 * 
 * Tracks when operators override system recommendations (override_by_dispatch = 1).
 * This creates a learning signal for future model improvement and trust calibration.
 * 
 * DECISION-SUPPORT ONLY: Tracks overrides for learning, but does NOT prevent overrides.
 * All override signals are stored for future analysis and model improvement.
 * 
 * IMPORTANT: This is a tracking/learning module, not a control mechanism.
 * Operators can always override system recommendations.
 */

/**
 * Track an override event
 * 
 * @param {Object} overrideEvent - Override event details
 * @param {Object} originalRecommendation - Original system recommendation that was overridden
 * @param {Object} actualDecision - What operator actually decided
 * @returns {Object} Override learning signal
 */
function trackOverride(overrideEvent, originalRecommendation, actualDecision) {
    const {
        delivery_id = null,
        driver_id = null,
        override_reason = null,
        override_timestamp = new Date().toISOString(),
        operator_id = null
    } = overrideEvent;
    
    // Calculate trust gap signal
    const trustGap = calculateTrustGap(originalRecommendation, actualDecision);
    
    // Analyze override context
    const overrideContext = analyzeOverrideContext(originalRecommendation, actualDecision);
    
    // Generate override reason placeholder (for future labeling)
    const overrideReasonPlaceholder = generateOverrideReasonPlaceholder(
        originalRecommendation,
        actualDecision,
        override_reason
    );
    
    // Build learning signal
    const learningSignal = buildLearningSignal(
        overrideEvent,
        originalRecommendation,
        actualDecision,
        trustGap,
        overrideContext,
        overrideReasonPlaceholder
    );
    
    return learningSignal;
}

/**
 * Calculate trust gap signal
 * 
 * Trust gap measures the difference between system recommendation and operator decision:
 * - Large gap = Low trust in system recommendation
 * - Small gap = High trust (or minor adjustment)
 * - Gap analysis helps identify when/why operators override
 * 
 * @param {Object} originalRecommendation - Original system recommendation
 * @param {Object} actualDecision - What operator actually decided
 * @returns {Object} Trust gap analysis
 */
function calculateTrustGap(originalRecommendation, actualDecision) {
    // Extract recommendation scores/probabilities
    const recommendationScore = extractRecommendationScore(originalRecommendation);
    const decisionScore = extractDecisionScore(actualDecision);
    
    // Calculate gap magnitude
    const gapMagnitude = Math.abs(recommendationScore - decisionScore);
    
    // Determine gap direction
    let gapDirection = 'neutral';
    if (decisionScore > recommendationScore + 0.2) {
        gapDirection = 'operator_more_optimistic'; // Operator chose riskier/optimistic option
    } else if (decisionScore < recommendationScore - 0.2) {
        gapDirection = 'operator_more_conservative'; // Operator chose safer/conservative option
    } else {
        gapDirection = 'minor_adjustment'; // Small gap, minor adjustment
    }
    
    // Categorize gap severity
    let gapSeverity = 'none';
    if (gapMagnitude >= 0.4) gapSeverity = 'high';
    else if (gapMagnitude >= 0.2) gapSeverity = 'medium';
    else if (gapMagnitude >= 0.1) gapSeverity = 'low';
    
    return {
        gap_magnitude: Math.round(gapMagnitude * 100) / 100,
        gap_direction: gapDirection,
        gap_severity: gapSeverity,
        recommendation_score: recommendationScore,
        decision_score: decisionScore,
        interpretation: interpretTrustGap(gapMagnitude, gapDirection)
    };
}

/**
 * Extract recommendation score from original recommendation
 * 
 * Handles different recommendation formats (fit score, success probability, etc.)
 * 
 * @param {Object} recommendation - Original recommendation object
 * @returns {number} Recommendation score (0-1)
 */
function extractRecommendationScore(recommendation) {
    // Try different possible score fields
    if (recommendation.success_probability !== undefined) {
        return recommendation.success_probability;
    }
    if (recommendation.fit_score !== undefined) {
        return recommendation.fit_score;
    }
    if (recommendation.recommendation_score !== undefined) {
        return recommendation.recommendation_score;
    }
    if (recommendation.driver_route_fit?.success_probability !== undefined) {
        return recommendation.driver_route_fit.success_probability;
    }
    
    // Default if no score found
    return 0.5;
}

/**
 * Extract decision score from actual decision
 * 
 * @param {Object} actualDecision - Actual decision object
 * @returns {number} Decision score (0-1), inferred from decision
 */
function extractDecisionScore(actualDecision) {
    // If decision includes a driver assignment, infer score from driver profile
    if (actualDecision.driver_id) {
        // Could look up driver profile and estimate score
        // For now, default to moderate score (operator chose this driver, so likely acceptable)
        return 0.6;
    }
    
    // If decision includes explicit override reason indicating confidence
    if (actualDecision.confidence) {
        return actualDecision.confidence;
    }
    
    // Default: operator decision implies moderate confidence
    return 0.6;
}

/**
 * Interpret trust gap
 */
function interpretTrustGap(gapMagnitude, gapDirection) {
    if (gapMagnitude < 0.1) {
        return 'Minimal gap: Operator mostly aligned with system recommendation';
    } else if (gapMagnitude < 0.2) {
        return `Minor gap (${(gapMagnitude * 100).toFixed(0)}%): Operator made slight adjustment`;
    } else if (gapMagnitude < 0.4) {
        if (gapDirection === 'operator_more_optimistic') {
            return `Moderate gap (${(gapMagnitude * 100).toFixed(0)}%): Operator chose more optimistic option than system recommended`;
        } else {
            return `Moderate gap (${(gapMagnitude * 100).toFixed(0)}%): Operator chose more conservative option than system recommended`;
        }
    } else {
        if (gapDirection === 'operator_more_optimistic') {
            return `Large gap (${(gapMagnitude * 100).toFixed(0)}%): Significant override - operator much more optimistic than system`;
        } else {
            return `Large gap (${(gapMagnitude * 100).toFixed(0)}%): Significant override - operator much more conservative than system`;
        }
    }
}

/**
 * Analyze override context
 * 
 * Understands why override might have occurred by analyzing:
 * - Recommendation quality/confidence
 * - Route characteristics
 * - Driver availability
 * - Historical patterns
 * 
 * @param {Object} originalRecommendation - Original recommendation
 * @param {Object} actualDecision - Actual decision
 * @returns {Object} Override context analysis
 */
function analyzeOverrideContext(originalRecommendation, actualDecision) {
    const context = {
        recommendation_confidence: originalRecommendation.confidence_level || 0.5,
        route_risk_level: originalRecommendation.route_risk_score || 0.5,
        recommendation_strength: determineRecommendationStrength(originalRecommendation),
        decision_type: inferDecisionType(actualDecision),
        likely_reasons: []
    };
    
    // Infer likely override reasons
    if (context.recommendation_confidence < 0.6) {
        context.likely_reasons.push('low_confidence_in_recommendation');
    }
    
    if (context.route_risk_level >= 0.7) {
        context.likely_reasons.push('high_route_risk');
    }
    
    if (originalRecommendation.recommendations && originalRecommendation.recommendations.some(r => r.includes('NOT RECOMMENDED'))) {
        context.likely_reasons.push('system_not_recommended_driver');
    }
    
    if (actualDecision.driver_id && originalRecommendation.driver_id && actualDecision.driver_id !== originalRecommendation.driver_id) {
        context.likely_reasons.push('different_driver_selected');
    }
    
    // If no specific reasons found, mark as general override
    if (context.likely_reasons.length === 0) {
        context.likely_reasons.push('general_override');
    }
    
    return context;
}

/**
 * Determine recommendation strength
 */
function determineRecommendationStrength(recommendation) {
    if (recommendation.decision_support?.recommended === true) {
        return 'strong_recommendation';
    } else if (recommendation.decision_support?.not_recommended === true) {
        return 'strong_rejection';
    } else if (recommendation.decision_support?.caution_required === true) {
        return 'conditional_recommendation';
    }
    
    return 'neutral';
}

/**
 * Infer decision type from actual decision
 */
function inferDecisionType(actualDecision) {
    if (actualDecision.driver_id) {
        return 'driver_assignment';
    }
    if (actualDecision.route_modification) {
        return 'route_modification';
    }
    if (actualDecision.status_change) {
        return 'status_change';
    }
    
    return 'general_decision';
}

/**
 * Generate override reason placeholder
 * 
 * Creates a structured placeholder for future manual labeling/annotation.
 * This can be used for supervised learning to understand override patterns.
 * 
 * @param {Object} originalRecommendation - Original recommendation
 * @param {Object} actualDecision - Actual decision
 * @param {string} providedReason - Operator-provided reason (if any)
 * @returns {Object} Override reason placeholder
 */
function generateOverrideReasonPlaceholder(originalRecommendation, actualDecision, providedReason = null) {
    const placeholder = {
        operator_provided_reason: providedReason || null,
        inferred_reason_categories: [],
        recommendation_summary: null,
        decision_summary: null,
        difference_summary: null,
        requires_labeling: !providedReason, // If no reason provided, flag for future labeling
        labeling_priority: 'medium'
    };
    
    // Summarize recommendation
    if (originalRecommendation.explanation?.summary) {
        placeholder.recommendation_summary = originalRecommendation.explanation.summary;
    } else {
        placeholder.recommendation_summary = `System recommendation: ${originalRecommendation.driver_id || 'N/A'} with ${(extractRecommendationScore(originalRecommendation) * 100).toFixed(0)}% success probability`;
    }
    
    // Summarize decision
    if (actualDecision.driver_id) {
        placeholder.decision_summary = `Operator assigned: Driver ${actualDecision.driver_id}`;
    } else {
        placeholder.decision_summary = 'Operator made alternative decision';
    }
    
    // Summarize difference
    const gap = calculateTrustGap(originalRecommendation, actualDecision);
    placeholder.difference_summary = gap.interpretation;
    
    // Infer reason categories for future labeling
    const context = analyzeOverrideContext(originalRecommendation, actualDecision);
    placeholder.inferred_reason_categories = context.likely_reasons;
    
    // Set labeling priority based on gap severity
    if (gap.gap_severity === 'high') {
        placeholder.labeling_priority = 'high'; // Large overrides are more important to understand
    } else if (gap.gap_severity === 'low') {
        placeholder.labeling_priority = 'low';
    }
    
    return placeholder;
}

/**
 * Build complete learning signal
 * 
 * @param {Object} overrideEvent - Override event details
 * @param {Object} originalRecommendation - Original recommendation
 * @param {Object} actualDecision - Actual decision
 * @param {Object} trustGap - Trust gap analysis
 * @param {Object} overrideContext - Override context
 * @param {Object} overrideReasonPlaceholder - Reason placeholder
 * @returns {Object} Complete learning signal
 */
function buildLearningSignal(overrideEvent, originalRecommendation, actualDecision, trustGap, overrideContext, overrideReasonPlaceholder) {
    return {
        event_id: `override_${Date.now()}_${overrideEvent.delivery_id || 'unknown'}`,
        delivery_id: overrideEvent.delivery_id,
        driver_id: overrideEvent.driver_id || actualDecision.driver_id,
        operator_id: overrideEvent.operator_id,
        override_timestamp: overrideEvent.override_timestamp,
        
        original_recommendation: {
            driver_id: originalRecommendation.driver_id,
            recommendation_score: extractRecommendationScore(originalRecommendation),
            recommendation_details: originalRecommendation
        },
        
        actual_decision: {
            driver_id: actualDecision.driver_id,
            decision_type: overrideContext.decision_type,
            decision_details: actualDecision
        },
        
        trust_gap_signal: trustGap,
        override_context: overrideContext,
        override_reason_placeholder: overrideReasonPlaceholder,
        
        learning_metadata: {
            signal_quality: determineSignalQuality(trustGap, overrideContext),
            useful_for_training: trustGap.gap_severity !== 'none' && !overrideContext.likely_reasons.includes('general_override'),
            requires_followup: overrideReasonPlaceholder.requires_labeling && trustGap.gap_severity === 'high',
            data_completeness: calculateDataCompleteness(overrideEvent, originalRecommendation, actualDecision)
        },
        
        timestamp: new Date().toISOString()
    };
}

/**
 * Determine signal quality for learning
 */
function determineSignalQuality(trustGap, overrideContext) {
    // High quality: Large gap, clear context, specific reasons
    if (trustGap.gap_severity === 'high' && overrideContext.likely_reasons.length > 0 && !overrideContext.likely_reasons.includes('general_override')) {
        return 'high';
    }
    
    // Medium quality: Moderate gap or some context
    if (trustGap.gap_severity === 'medium' || overrideContext.likely_reasons.length > 1) {
        return 'medium';
    }
    
    // Low quality: Small gap or unclear context
    return 'low';
}

/**
 * Calculate data completeness for learning signal
 */
function calculateDataCompleteness(overrideEvent, originalRecommendation, actualDecision) {
    let completeness = 0;
    let totalFields = 4;
    
    if (overrideEvent.delivery_id) completeness++;
    if (originalRecommendation && Object.keys(originalRecommendation).length > 0) completeness++;
    if (actualDecision && Object.keys(actualDecision).length > 0) completeness++;
    if (overrideEvent.operator_id) completeness++;
    
    const completenessScore = completeness / totalFields;
    
    return {
        score: Math.round(completenessScore * 100) / 100,
        level: completenessScore >= 0.75 ? 'complete' : completenessScore >= 0.5 ? 'partial' : 'incomplete',
        missing_fields: []
    };
}

/**
 * Batch track multiple overrides
 * 
 * @param {Array<Object>} overrideEvents - Array of override events
 * @returns {Array} Array of learning signals
 */
function trackBatchOverrides(overrideEvents) {
    return overrideEvents.map(event => {
        // For batch processing, we need original recommendation and actual decision
        // These should be provided in the event object
        return trackOverride(
            event,
            event.original_recommendation || {},
            event.actual_decision || {}
        );
    });
}

/**
 * Aggregate override patterns for analysis
 * 
 * DECISION-SUPPORT: Provides insights into override patterns
 * 
 * @param {Array<Object>} learningSignals - Array of override learning signals
 * @returns {Object} Aggregated override patterns
 */
function analyzeOverridePatterns(learningSignals) {
    if (learningSignals.length === 0) {
        return { error: 'No override signals to analyze' };
    }
    
    const patterns = {
        total_overrides: learningSignals.length,
        trust_gap_distribution: {
            high: 0,
            medium: 0,
            low: 0,
            none: 0
        },
        override_reasons: {},
        gap_directions: {
            operator_more_optimistic: 0,
            operator_more_conservative: 0,
            minor_adjustment: 0
        },
        recommendation_confidence_impact: {
            low_confidence_overrides: 0,
            high_confidence_overrides: 0
        },
        insights: []
    };
    
    learningSignals.forEach(signal => {
        // Count gap severities
        const gapSeverity = signal.trust_gap_signal?.gap_severity || 'none';
        patterns.trust_gap_distribution[gapSeverity]++;
        
        // Count gap directions
        const gapDirection = signal.trust_gap_signal?.gap_direction || 'neutral';
        if (patterns.gap_directions[gapDirection] !== undefined) {
            patterns.gap_directions[gapDirection]++;
        }
        
        // Count override reasons
        const reasons = signal.override_reason_placeholder?.inferred_reason_categories || [];
        reasons.forEach(reason => {
            patterns.override_reasons[reason] = (patterns.override_reasons[reason] || 0) + 1;
        });
        
        // Analyze confidence impact
        const recConfidence = signal.original_recommendation?.recommendation_details?.confidence_level || 0.5;
        if (recConfidence < 0.6) {
            patterns.recommendation_confidence_impact.low_confidence_overrides++;
        } else {
            patterns.recommendation_confidence_impact.high_confidence_overrides++;
        }
    });
    
    // Generate insights
    if (patterns.trust_gap_distribution.high > patterns.total_overrides * 0.3) {
        patterns.insights.push('High frequency of large trust gaps detected. System recommendations may need calibration.');
    }
    
    if (patterns.gap_directions.operator_more_optimistic > patterns.total_overrides * 0.4) {
        patterns.insights.push('Operators frequently choose more optimistic options. System may be too conservative.');
    }
    
    if (patterns.gap_directions.operator_more_conservative > patterns.total_overrides * 0.4) {
        patterns.insights.push('Operators frequently choose more conservative options. System may be too optimistic.');
    }
    
    if (patterns.recommendation_confidence_impact.low_confidence_overrides > patterns.total_overrides * 0.5) {
        patterns.insights.push('Most overrides occur when system confidence is low. Consider improving confidence calibration.');
    }
    
    const topReasons = Object.entries(patterns.override_reasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason, count]) => ({ reason, count, percentage: (count / patterns.total_overrides * 100).toFixed(1) }));
    
    patterns.top_override_reasons = topReasons;
    
    return patterns;
}

module.exports = {
    trackOverride,
    trackBatchOverrides,
    analyzeOverridePatterns,
    // Expose helper functions for testing
    calculateTrustGap,
    analyzeOverrideContext,
    generateOverrideReasonPlaceholder
};
