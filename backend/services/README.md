# Intelligence Services - Quick Start

## Overview

Intelligence modules for decision-support in logistics management. All modules provide explainable recommendations but **DO NOT auto-execute decisions**. Operators maintain full control.

## Quick Access

### Main Coordinator
```javascript
const intelligence = require('./intelligenceCoordinator');

// Get comprehensive analysis
const analysis = intelligence.getComprehensiveAnalysis({
    delivery: deliveryRecord,
    allDeliveries: [...],
    driverId: "R4110"
});
```

### Individual Modules

1. **Driver Skill Profile**: `./driverSkillProfile.js`
2. **Route Risk Analyzer**: `./routeRiskAnalyzer.js`
3. **Driver-Route Fit**: `./driverRouteFit.js`
4. **Delay Prediction**: `./delayPrediction.js`
5. **Feedback Attribution**: `./feedbackAttribution.js`
6. **Override Learning**: `./overrideLearning.js`

## API Endpoints

All endpoints are under `/api/intelligence/*`:

- `POST /comprehensive-analysis` - Full analysis combining all modules
- `POST /driver-skill-profile` - Get driver skill vector
- `POST /route-risk-analysis` - Analyze route risk
- `POST /driver-route-fit` - Calculate success probability
- `POST /delay-prediction` - Predict delay
- `POST /compare-drivers` - Compare multiple drivers
- `POST /feedback-attribution` - Analyze feedback (driver vs system)
- `POST /track-override` - Track operator overrides for learning

## Key Rules

✅ **DO**: Use outputs for decision-support
✅ **DO**: Explain recommendations to operators
✅ **DO**: Track overrides for learning
✅ **DO**: Preserve all skill dimensions separately

❌ **DON'T**: Auto-execute decisions
❌ **DON'T**: Collapse multi-dimensional skills into single score
❌ **DON'T**: Penalize drivers for system issues
❌ **DON'T**: Modify existing functionality

## Documentation

See `INTELLIGENCE_MODULES.md` for complete documentation.

## Testing

```bash
# Test with sample data
node -e "
const intelligence = require('./intelligenceCoordinator');
const routeAnalyzer = require('./routeRiskAnalyzer');

const route = routeAnalyzer.analyzeRouteRisk({
    route_difficulty_score: 0.69,
    traffic_volatility: 0.53,
    weather_severity: 0.91,
    delivery_urgency: 'low'
});

console.log(JSON.stringify(route, null, 2));
"
```

## Integration

Modules are integrated into the backend via `/routes/intelligence.js` and mounted at `/api/intelligence` in `server.js`.

All existing functionality remains unchanged.
