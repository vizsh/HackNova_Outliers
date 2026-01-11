# Logistics AI Enriched Dataset Schema Documentation

## Overview

This document describes the data schema and compatibility layer for the `logistics_ai_enriched_dataset.csv`. The adapter ensures backward compatibility with the existing prototype while allowing ingestion of enriched AI features for future ML model training.

## Dataset Structure

Each row in the CSV represents **one delivery attempt** with AI-enriched features.

### Core Identifiers

| CSV Field | Type | Maps To Existing System | Notes |
|-----------|------|------------------------|-------|
| `order_id` | string | `shipment.tracking_number` | Unique delivery ID |
| `order_date` | date | `shipment.created_at` | Delivery order date |
| `rider_id` | string | `shipment.driver_id` | Driver ID (format: "R4110", needs mapping to numeric ID) |
| `city` | string | `shipment.origin` | City name (part of origin) |
| `country` | string | `shipment.origin` | Country name (part of origin) |
| `pickup_lat` | float | `shipment.pickup_lat` | Pickup latitude |
| `pickup_lon` | float | `shipment.pickup_lng` | Pickup longitude |
| `drop_lat` | float | `shipment.drop_lat` | Drop-off latitude |
| `drop_lon` | float | `shipment.drop_lng` | Drop-off longitude |
| `vehicle_type` | string | `vehicle.type` | Vehicle type (bike/scooter/van → maps to 'road') |

### Driver Skill Dimensions (0-1 scale) - **NEW DATA**

These fields enhance the existing `driver_ratings` structure:

| CSV Field | Type | Range | Maps To | Future Use |
|-----------|------|-------|---------|------------|
| `skill_fragile_handling` | float | 0-1 | `driver_ratings._skill_dimensions.fragile_handling` | ML feature for fragile goods assignment |
| `skill_urgency_handling` | float | 0-1 | `driver_ratings._skill_dimensions.urgency_handling` | ML feature for urgent delivery assignment |
| `skill_night_driving` | float | 0-1 | `driver_ratings._skill_dimensions.night_driving` | ML feature for night shift assignment |
| `skill_weather_resilience` | float | 0-1 | `driver_ratings._skill_dimensions.weather_resilience` | ML feature for adverse weather assignment |

**Compatibility Note:** These skill dimensions are averaged and converted to a single `skill_index` (0-10 scale) for backward compatibility with existing UI. The original dimensions are preserved in `_skill_dimensions` for future ML use.

### Route & Environment Intelligence - **NEW DATA**

These fields are stored in shipment `_metadata` for ML training:

| CSV Field | Type | Range | Maps To | Future Use |
|-----------|------|-------|---------|------------|
| `route_difficulty_score` | float | 0-1 | `shipment._metadata.route_difficulty_score` | ML feature for route complexity prediction |
| `traffic_volatility` | float | 0-1 | `shipment._metadata.traffic_volatility` | ML feature for delay prediction |
| `weather_severity` | float | 0-1 | `shipment._metadata.weather_severity` | ML feature for weather impact prediction |

### Delivery Context

| CSV Field | Type | Values | Maps To | Notes |
|-----------|------|--------|---------|-------|
| `delivery_urgency` | string | low/medium/high | `shipment._metadata.delivery_urgency` | Stored in metadata for ML |
| `goods_type` | string | standard/fragile/high_value/perishable | `shipment.freight_type` | Maps to existing freight_type field |

**Mapping:**
- `goods_type: "standard"` → `freight_type: "Standard"`
- `goods_type: "fragile"` → `freight_type: "Fragile"`
- `goods_type: "high_value"` → `freight_type: "High Value"`
- `goods_type: "perishable"` → `freight_type: "Perishable"`

### Behavioral & Stress Signals - **NEW DATA**

Stored in shipment `_metadata` for ML training:

| CSV Field | Type | Range | Maps To | Future Use |
|-----------|------|-------|---------|------------|
| `fatigue_index` | float | 0-1 | `shipment._metadata.fatigue_index` | ML feature for driver fatigue prediction |
| `delay_recovery_time_min` | int | minutes | `shipment._metadata.delay_recovery_time_min` | ML feature for delay recovery analysis |
| `override_by_dispatch` | int | 0/1 | `shipment._metadata.override_by_dispatch` | ML feature for dispatch intervention analysis |

### Actual Delivery Metrics

| CSV Field | Type | Maps To | Notes |
|-----------|------|---------|-------|
| `scheduled_time_min` | int | `shipment._metadata.scheduled_time_min` | Scheduled delivery time |
| `actual_time_min` | int | `shipment._metadata.actual_time_min` | Actual delivery time |
| `base_distance_km` | float | `shipment._metadata.base_distance_km` | Route distance |
| `fuel_cost_est` | float | `shipment.invoice_amount` (estimated) | Used to estimate invoice amount |
| `delivery_status` | string | `shipment.status` | on-time/delayed → maps to delivered/pending/etc |

**Status Mapping:**
- `delivery_status: "on-time"` → `status: "delivered"`
- `delivery_status: "delayed"` → `status: "delivered"`
- Other statuses map directly

### Customer Feedback

| CSV Field | Type | Maps To | Notes |
|-----------|------|---------|-------|
| `customer_rating` | float | `feedback.rating` | Rating 0-5, maps to existing feedback system |
| `customer_feedback_text` | string | `feedback.comment` | Free text feedback, maps to existing feedback system |

### Training Targets - **NOT STORED IN PRODUCTION**

These fields are used for ML model training only and are NOT ingested into the production database:

| CSV Field | Type | Purpose | Notes |
|-----------|------|---------|-------|
| `delivery_success` | int | Target variable (0/1) | Binary classification target |
| `delay_minutes` | float | Target variable | Regression target for delay prediction |

**Note:** Training targets are accessible during data loading but are not stored in the production database to maintain clean separation between training data and operational data.

## Data Mapping Functions

### `mapToShipment(datasetRow, options)`

Converts a CSV row to an existing shipment structure:

```javascript
const shipment = mapToShipment(datasetRow, {
    customer_id: 3,
    riderIdMapper: (riderId) => parseInt(riderId.replace('R', ''))
});
```

**Returns:** Shipment object compatible with existing `shipments` array structure.

### `mapToDriverSkills(datasetRow, riderIdMapper)`

Converts driver skill dimensions to enhanced driver ratings:

```javascript
const driverSkills = mapToDriverSkills(datasetRow, riderIdMapper);
```

**Returns:** Driver ratings object with:
- `skill_index`: Calculated from skill dimensions (0-10 scale) for backward compatibility
- `level`: Standard/Intermediate/Advanced/ELITE based on skill_index
- `_skill_dimensions`: Original skill dimensions preserved for ML

### `mapToFeedback(datasetRow, shipmentId, riderIdMapper)`

Converts customer feedback to existing feedback structure:

```javascript
const feedback = mapToFeedback(datasetRow, shipmentId, riderIdMapper);
```

**Returns:** Feedback object compatible with existing `feedback` array structure.

## Validation Rules

The adapter validates:

1. **Required Fields:** order_id, rider_id, coordinates
2. **Coordinate Ranges:** Lat (-90 to 90), Lon (-180 to 180)
3. **Skill Dimensions:** 0-1 scale validation
4. **Enum Values:** delivery_urgency, goods_type, delivery_status
5. **Customer Rating:** 0-5 range if present

## Usage Examples

### Basic Loading

```javascript
const { loadDataset } = require('./logistics_dataset_adapter');

const result = await loadDataset('path/to/dataset.csv', {
    limit: 100, // Load first 100 rows (for testing)
    validate: true,
    defaultCustomerId: 3
});

console.log(`Loaded ${result.shipments.length} shipments`);
console.log(`Found ${result.driverSkills.length} unique drivers`);
```

### Validation Only

```javascript
const { validateDataset } = require('./logistics_dataset_adapter');

const validation = await validateDataset('path/to/dataset.csv');
if (validation.valid) {
    console.log('Dataset is valid!');
} else {
    console.error('Validation errors:', validation.issues);
}
```

### Get Statistics

```javascript
const { getDatasetStats } = require('./logistics_dataset_adapter');

const stats = await getDatasetStats('path/to/dataset.csv');
console.log(`Total rows: ${stats.totalRows}`);
console.log(`Columns: ${stats.columns.join(', ')}`);
```

## Backward Compatibility

### Existing APIs

All existing APIs and routes remain **unchanged**. The adapter creates data structures that are compatible with:

- ✅ `GET /api/data/shipments` - Returns shipments with optional `_metadata`
- ✅ `GET /api/data/drivers/:id/stats` - Returns driver stats with optional `_skill_dimensions`
- ✅ `GET /api/data/shipments/:id/feedback` - Returns feedback as before

### Existing UI Components

All existing UI components continue to work because:

- Core fields (tracking_number, status, origin, destination) map directly
- New fields are in `_metadata` which UI can ignore
- Driver skill_index is calculated for backward compatibility

### Future ML Integration

The enriched fields are stored in:
- `shipment._metadata.*` - For route/environment/behavioral features
- `driver_ratings._skill_dimensions.*` - For driver skill features

These can be used for ML training without modifying existing functionality.

## File Structure

```
backend/db/
├── logistics_ai_enriched_dataset.csv     # Source CSV file
├── logistics_dataset_schema.js           # Schema definitions and mapping functions
├── logistics_dataset_adapter.js          # CSV parser and ingestion logic
├── logistics_dataset_loader.js           # Utility script for loading/validating
└── LOGISTICS_DATASET_SCHEMA.md          # This documentation file
```

## Next Steps (Not Implemented Yet)

The following are **NOT** implemented in this step (as per requirements):

1. ❌ Database ingestion (data loading only, not DB insertion)
2. ❌ ML model training
3. ❌ New UI features
4. ❌ API endpoint changes
5. ❌ Real-time data processing

These will be implemented in future steps.
