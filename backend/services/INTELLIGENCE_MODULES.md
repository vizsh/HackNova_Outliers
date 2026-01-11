# Intelligence Modules Documentation

## Overview

This document describes the intelligence modules added to the logistics prototype. All modules are **DECISION-SUPPORT ONLY** - they provide explainable recommendations but do NOT auto-execute decisions. Operators always have final control.

## Architecture

```
backend/services/
├── driverSkillProfile.js       # Module 1: Driver Skill Profile Engine
├── routeRiskAnalyzer.js        # Module 2: Route Difficulty & Risk Analyzer
├── driverRouteFit.js           # Module 3: Driver × Route Fit Model
├── delayPrediction.js          # Module 4: Delay Prediction Module
├── feedbackAttribution.js      # Module 5: Customer Feedback Attribution
├── overrideLearning.js         # Module 6: Human Override Learning Signal
└── intelligenceCoordinator.js  # Main coordinator orchestrating all modules
```

## Module 1: Driver Skill Profile Engine

### Purpose
Computes multi-dimensional skill vectors for drivers based on historical performance. **Preserves dimensions separately** for granular matching and explainability.

### Key Features
- **Multi-dimensional skills** (NOT collapsed into single score):
  - Fragile Handling (0-1)
  - Urgency Handling (0-1)
  - Night Driving (0-1)
  - Weather Resilience (0-1)
  - Consistency (0-1, derived from delay variance)
  - Stress Recovery (0-1, from delay_recovery_time_min)

### Output Structure
```javascript
{
    rider_id: "R4110",
    skill_vector: {
        fragile_handling: 0.61,
        urgency_handling: 0.61,
        night_driving: 0.70,
        weather_resilience: 0.66,
        consistency: 0.78,        // Derived from delay variance
        stress_recovery: 0.65     // Derived from delay_recovery_time_min
    },
    metadata: {
        total_deliveries: 15,
        delivery_success_rate: 0.93,
        avg_delay_minutes: 32.5,
        profile_confidence: 0.82   // Based on sample size
    },
    explanation: {
        summary: "Skill profile based on 15 historical deliveries",
        detailed_explanations: [...],
        key_highlights: [...]
    }
}
```

### Usage
```javascript
const { getDriverSkillProfile } = require('./services/driverSkillProfile');

const profile = getDriverSkillProfile(deliveryHistory, "R4110");
// Use profile.skill_vector for matching, NOT a single collapsed score
```

### Algorithm Notes
- **Consistency**: Calculated from delay variance using exponential decay
  - Lower variance = Higher consistency
  - Formula: `consistency = e^(-stdDev / 30)`
  
- **Stress Recovery**: Calculated from delay_recovery_time_min
  - Lower recovery time = Higher recovery score
  - Normalized with max recovery time of 60 minutes

- **Profile Confidence**: Increases with sample size (diminishing returns)
  - 1 delivery = 0.2 confidence
  - 50+ deliveries = 0.95 confidence

---

## Module 2: Route Difficulty & Risk Analyzer

### Purpose
Analyzes route characteristics and computes normalized risk scores with explainable breakdowns.

### Key Features
- **Risk Contributors** (preserved separately):
  - Route Difficulty (base risk)
  - Traffic Volatility (multiplicative amplifier)
  - Weather Severity (additive risk)
  - Delivery Urgency (modifier)

- **Risk Score Calculation**:
  ```
  baseRisk = route_difficulty * 0.4
  trafficImpact = baseRisk * traffic_volatility * 0.3
  weatherImpact = weather_severity * 0.2
  urgencyImpact = baseRisk * urgency_modifier * 0.1
  routeRiskScore = (baseRisk + trafficImpact + weatherImpact + urgencyImpact)
  ```

### Output Structure
```javascript
{
    route_risk_score: 0.65,  // 0-1, higher = more risky
    risk_level: "high",      // low/medium/high/critical
    normalized_difficulty: 0.69,
    risk_contributors: {
        route_difficulty: {
            raw_score: 0.69,
            contribution: 0.276,
            contribution_percentage: 42.5,
            impact: "high"
        },
        traffic_volatility: { ... },
        weather_severity: { ... },
        delivery_urgency: { ... }
    },
    key_contributors: [
        { factor: "route_difficulty", contribution_percentage: 42, impact: "high" },
        { factor: "traffic_volatility", contribution_percentage: 23, impact: "medium" }
    ],
    explanation: {
        summary: "Route risk: HIGH (65%)",
        detailed_breakdown: [...],
        recommendations: [...]
    }
}
```

### Risk Level Categorization
- **Low** (0-0.25): Standard route, typical challenges
- **Medium** (0.25-0.5): Moderate challenges, capable driver recommended
- **High** (0.5-0.75): Significant challenges, experienced driver recommended
- **Critical** (0.75-1.0): Extreme challenges, elite driver recommended or route review

---

## Module 3: Driver × Route Fit Model

### Purpose
Estimates probability of successful delivery by matching driver skills to route requirements.

### Key Features
- **Success Probability Calculation**:
  ```
  skillMatch = weighted_average(driver skills matched to route requirements)
  baseProbability = skillMatch * (1 - routeRisk)
  fatigueAdjusted = baseProbability * fatigue_multiplier
  successProbability = fatigueAdjusted * urgency_modifier
  ```

- **Skill Matching**:
  - Fragile goods → fragile_handling skill
  - Urgent delivery → urgency_handling skill
  - High route difficulty → consistency skill
  - High traffic volatility → stress_recovery skill
  - Severe weather → weather_resilience skill

### Output Structure
```javascript
{
    driver_id: "R4110",
    success_probability: 0.73,      // 0-1, probability of success
    confidence_level: 0.78,         // Confidence in prediction
    fit_score: 0.68,                // Overall skill-route match
    skill_match_breakdown: {
        fragile_handling_match: 0.61,
        urgency_handling_match: 0.61,
        weather_resilience_match: 0.66,
        consistency_match: 0.78,
        stress_recovery_match: 0.65,
        overall_match: 0.68
    },
    route_risk_score: 0.65,
    fatigue_impact: {
        fatigue_index: 0.12,
        impact_multiplier: 0.94,
        impact_level: "low"
    },
    explanation: {
        summary: "Driver-Route Fit: EXCELLENT (73% success probability)",
        detailed_explanations: [...],
        fit_interpretation: {...}
    },
    decision_support: {
        recommended: true,           // success_probability >= 0.7
        caution_required: false,     // success_probability < 0.6 && >= 0.4
        not_recommended: false,      // success_probability < 0.4
        reasoning: "..."
    }
}
```

### Success Probability Interpretation
- **≥70%**: Strongly recommended
- **50-70%**: Suitable with monitoring
- **40-50%**: Caution required, consider alternatives
- **<40%**: Not recommended without modifications

---

## Module 4: Delay Prediction Module

### Purpose
Predicts expected delay in minutes based on route characteristics and driver state.

### Key Features
- **Delay Components**:
  - Base Delay: From route difficulty, traffic, weather
  - Fatigue Delay: Additional delay from driver fatigue
  - Skill Adjustment: Reduction based on driver skills

- **Base Delay Formula**:
  ```
  difficultyDelay = route_difficulty * 30 (max ~30 min)
  trafficDelay = traffic_volatility * 20 (max ~20 min)
  weatherDelay = weather_severity * 25 (max ~25 min)
  baseDelay = difficultyDelay + trafficDelay + weatherDelay
  ```

### Output Structure
```javascript
{
    predicted_delay_minutes: 42,
    delay_risk_band: "medium",      // low/medium/high
    delay_components: {
        base_delay: 38,
        fatigue_delay: 4,
        skill_adjustment: -2        // Negative = delay reduction
    },
    prediction_confidence: 0.75,
    explanation: {
        summary: "Predicted delay: 42 minutes (MEDIUM risk)",
        detailed_breakdown: [...],
        risk_band_interpretation: {...}
    },
    recommendations: [...]
}
```

### Delay Risk Band
- **Low**: <15% of scheduled time or <20 minutes
- **Medium**: 15-30% of scheduled time or 20-45 minutes
- **High**: >30% of scheduled time or >45 minutes

---

## Module 5: Customer Feedback Attribution (NLP-light)

### Purpose
Processes customer feedback to separate driver-related issues from system-related issues. **Ensures drivers are NOT penalized for system faults.**

### Key Features
- **Driver Sentiment Extraction**:
  - Positive keywords: "polite", "professional", "careful", "excellent"
  - Negative keywords: "rude", "careless", "poor communication"
  - Sentiment score: -1 to +1, normalized to 0-1

- **System Issues Extraction**:
  - Delay keywords: "late", "delayed", "took too long"
  - Routing issues: "wrong address", "inefficient route"
  - Infrastructure: "traffic", "weather", "road conditions"
  - System service: "tracking", "notification", "app issue"

### Output Structure
```javascript
{
    feedback_text: "Excellent service under tough conditions",
    driver_attribution: {
        sentiment_score: 0.85,
        sentiment_category: "positive",
        positive_mentions: 2,
        negative_mentions: 0,
        aspects: {
            behavior: { mentioned: true, keywords_found: ["excellent"] },
            skills: { mentioned: false },
            communication: { mentioned: false }
        },
        driver_related: true
    },
    system_attribution: {
        system_issue_score: 0.0,
        system_category: "none",
        issue_breakdown: {
            delays: 0,
            routing: 0,
            infrastructure: 0,
            system_service: 0
        },
        has_actual_delay: false,
        system_related: false
    },
    overall_attribution: {
        driver_contribution: 1.0,
        system_contribution: 0.0,
        primary_attribution: "driver",
        fairness_flag: false,
        should_penalize_driver: true,  // Only if driver-related AND no system issues
        explanation: "Feedback is primarily driver-related (100%). Driver performance feedback applicable."
    },
    fairness_flag: null,  // Only set if system issues detected
    recommendations: [
        "✓ Positive driver feedback - consider recognition or reward"
    ]
}
```

### Fairness Rules
- **fairness_flag**: Set to 'SYSTEM_ISSUE' if system_contribution > 0.5
- **should_penalize_driver**: Only true if driver-related AND fairness_flag is false
- **Critical**: If major system issues detected, driver should NEVER be penalized

---

## Module 6: Human Override Learning Signal

### Purpose
Tracks when operators override system recommendations (override_by_dispatch = 1) for future model improvement and trust calibration.

### Key Features
- **Trust Gap Calculation**:
  - Gap magnitude: Difference between recommendation and decision scores
  - Gap direction: Operator more optimistic/conservative than system
  - Gap severity: None/Low/Medium/High

- **Override Context Analysis**:
  - Identifies likely reasons for override
  - Analyzes recommendation quality/confidence
  - Tracks decision patterns

### Output Structure
```javascript
{
    event_id: "override_1704567890_b1ab8464",
    delivery_id: "b1ab8464",
    driver_id: "R4110",
    operator_id: 1,
    override_timestamp: "2026-01-06T10:30:00Z",
    
    original_recommendation: {
        driver_id: "R6040",
        recommendation_score: 0.65,
        recommendation_details: {...}
    },
    
    actual_decision: {
        driver_id: "R4110",
        decision_type: "driver_assignment",
        decision_details: {...}
    },
    
    trust_gap_signal: {
        gap_magnitude: 0.15,
        gap_direction: "operator_more_optimistic",
        gap_severity: "low",
        interpretation: "Minor gap (15%): Operator made slight adjustment"
    },
    
    override_context: {
        recommendation_confidence: 0.68,
        route_risk_level: 0.65,
        recommendation_strength: "conditional_recommendation",
        decision_type: "driver_assignment",
        likely_reasons: ["low_confidence_in_recommendation", "high_route_risk"]
    },
    
    override_reason_placeholder: {
        operator_provided_reason: null,
        inferred_reason_categories: ["low_confidence_in_recommendation"],
        recommendation_summary: "System recommendation: R6040 with 65% success probability",
        decision_summary: "Operator assigned: Driver R4110",
        difference_summary: "Minor gap (15%): Operator made slight adjustment",
        requires_labeling: true,  // Flag for future manual annotation
        labeling_priority: "medium"
    },
    
    learning_metadata: {
        signal_quality: "medium",
        useful_for_training: true,
        requires_followup: false,
        data_completeness: { score: 0.75, level: "complete" }
    }
}
```

### Learning Signal Quality
- **High**: Large gap, clear context, specific reasons
- **Medium**: Moderate gap or some context
- **Low**: Small gap or unclear context

### Future Use
Learning signals can be used for:
- Model recalibration
- Trust calibration
- Understanding operator decision patterns
- Improving recommendation accuracy

---

## Intelligence Coordinator

### Purpose
Main coordinator service that orchestrates all intelligence modules for unified decision-support.

### Main Function: `getComprehensiveAnalysis()`

Combines all modules to provide complete analysis:

```javascript
const analysis = intelligence.getComprehensiveAnalysis({
    delivery: deliveryRecord,
    driverHistory: [...],
    allDeliveries: [...],
    driverId: "R4110"
});

// Returns:
{
    delivery_id: "b1ab8464",
    route_analysis: {...},        // Module 2
    driver_profile: {...},        // Module 1
    driver_route_fit: {...},      // Module 3
    delay_prediction: {...},      // Module 4
    recommendation: {
        overall_assessment: "positive",
        risk_level: "high",
        confidence: 0.78,
        key_factors: [...],
        recommendations: [...],
        warnings: [],
        decision_support: {
            proceed: true,          // Advisory only
            caution_required: false,
            alternative_suggested: false
        }
    }
}
```

---

## API Endpoints

### POST `/api/intelligence/comprehensive-analysis`
Get comprehensive analysis combining all modules.

**Body:**
```json
{
    "delivery": {
        "order_id": "b1ab8464",
        "pickup_lat": 27.08,
        "pickup_lon": 71.41,
        "drop_lat": 23.40,
        "drop_lon": 88.13,
        "route_difficulty_score": 0.69,
        "traffic_volatility": 0.53,
        "weather_severity": 0.91,
        "delivery_urgency": "low",
        "goods_type": "fragile",
        "fatigue_index": 0.12
    },
    "driverId": "R4110"  // Optional
}
```

### POST `/api/intelligence/driver-skill-profile`
Get multi-dimensional driver skill profile.

**Body:**
```json
{
    "driverId": "R4110"
}
```

### POST `/api/intelligence/route-risk-analysis`
Analyze route risk.

**Body:**
```json
{
    "delivery": {
        "route_difficulty_score": 0.69,
        "traffic_volatility": 0.53,
        "weather_severity": 0.91,
        "delivery_urgency": "low"
    }
}
```

### POST `/api/intelligence/driver-route-fit`
Calculate driver-route fit.

**Body:**
```json
{
    "driverProfile": {...},
    "routeAnalysis": {...},
    "deliveryContext": {
        "delivery_urgency": "medium",
        "fatigue_index": 0.12,
        "goods_type": "fragile"
    }
}
```

### POST `/api/intelligence/delay-prediction`
Predict delivery delay.

**Body:**
```json
{
    "routeAnalysis": {...},
    "driverProfile": {...},  // Optional
    "deliveryContext": {
        "fatigue_index": 0.12,
        "base_distance_km": 91.05,
        "scheduled_time_min": 275
    }
}
```

### POST `/api/intelligence/compare-drivers`
Compare multiple drivers for a delivery.

**Body:**
```json
{
    "delivery": {...},
    "driverIds": ["R4110", "R6040", "R5686"]
}
```

### POST `/api/intelligence/feedback-attribution`
Analyze customer feedback attribution.

**Body:**
```json
{
    "feedback": {
        "customer_feedback_text": "Excellent service under tough conditions",
        "customer_rating": 4.4
    },
    "deliveryContext": {
        "delay_minutes": 54,
        "delivery_urgency": "low"
    }
}
```

### POST `/api/intelligence/track-override`
Track operator override for learning.

**Body:**
```json
{
    "overrideEvent": {
        "delivery_id": "b1ab8464",
        "driver_id": "R4110",
        "override_reason": "Preferred driver availability"
    },
    "originalRecommendation": {...},
    "actualDecision": {
        "driver_id": "R4110"
    }
}
```

---

## Decision-Support Philosophy

### Key Principles

1. **Explainability First**: All outputs include human-readable explanations
2. **No Automation**: Recommendations are advisory only, operators make final decisions
3. **Fair Attribution**: Drivers never penalized for system issues
4. **Dimension Preservation**: Skills preserved separately, not collapsed
5. **Learning Signals**: Overrides tracked for continuous improvement

### Example Usage Flow

```javascript
// 1. Get comprehensive analysis
const analysis = await POST('/api/intelligence/comprehensive-analysis', {
    delivery: newDeliveryRequest,
    driverId: "R4110"
});

// 2. Review recommendations (DECISION-SUPPORT, not auto-execute)
if (analysis.recommendation.decision_support.proceed) {
    console.log("✓ System recommends proceeding");
    console.log("Success probability:", analysis.driver_route_fit.success_probability);
    console.log("Predicted delay:", analysis.delay_prediction.predicted_delay_minutes);
} else {
    console.log("⚠ System recommends caution");
    console.log("Warnings:", analysis.recommendation.warnings);
}

// 3. Operator makes decision (manual)
// const operatorDecision = { driver_id: "R4110", ... };

// 4. Track override if different from recommendation
if (operatorDecision.driver_id !== analysis.driver_profile.rider_id) {
    await POST('/api/intelligence/track-override', {
        overrideEvent: { delivery_id: "...", driver_id: operatorDecision.driver_id },
        originalRecommendation: analysis.recommendation,
        actualDecision: operatorDecision
    });
}
```

---

## Integration Notes

### Backward Compatibility

- ✅ All existing APIs unchanged
- ✅ All existing routes unchanged
- ✅ All existing UI components unchanged
- ✅ New endpoints are additive only

### Data Flow

1. **Dataset Loading**: CSV loaded via `logistics_dataset_adapter`
2. **Skill Profiling**: Uses raw delivery history from CSV
3. **Route Analysis**: Uses delivery metadata
4. **Fit Calculation**: Combines profile + route analysis
5. **Delay Prediction**: Uses route + driver state
6. **Feedback Attribution**: Processes feedback text
7. **Override Tracking**: Stores learning signals

### Future ML Integration

All modules are **ML-ready**:
- Heuristic formulas can be replaced with trained models
- Input/output interfaces remain the same
- Training targets preserved in dataset (`delivery_success`, `delay_minutes`)
- Learning signals can be used for supervised learning

---

## Testing

### Test Driver Skill Profile
```javascript
const { getDriverSkillProfile } = require('./services/driverSkillProfile');
const deliveries = [...]; // Load from CSV
const profile = getDriverSkillProfile(deliveries, "R4110");
console.log(profile.skill_vector); // All dimensions preserved separately
```

### Test Route Risk
```javascript
const { analyzeRouteRisk } = require('./services/routeRiskAnalyzer');
const risk = analyzeRouteRisk({
    route_difficulty_score: 0.69,
    traffic_volatility: 0.53,
    weather_severity: 0.91,
    delivery_urgency: "low"
});
console.log(risk.route_risk_score, risk.key_contributors);
```

### Test Driver-Route Fit
```javascript
const { calculateDriverRouteFit } = require('./services/driverRouteFit');
const fit = calculateDriverRouteFit(driverProfile, routeAnalysis, deliveryContext);
console.log(fit.success_probability, fit.explanation.summary);
```

---

## Notes

- All modules are **stateless** and can be called independently
- All outputs are **explainable** with human-readable text
- No **automation** - all decisions are operator-controlled
- All **dimensions preserved** - no collapsing of multi-dimensional data
- **Fair attribution** - system issues don't penalize drivers
- **Learning signals** tracked for continuous improvement
