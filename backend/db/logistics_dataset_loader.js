/**
 * Logistics Dataset Loader Utility
 * 
 * This is a utility script to load and validate the logistics_ai_enriched_dataset.csv
 * without modifying existing functionality.
 * 
 * Usage (from command line):
 *   node logistics_dataset_loader.js [options]
 * 
 * Options:
 *   --validate    Only validate the dataset, don't load
 *   --stats       Show dataset statistics
 *   --limit N     Load only first N rows (for testing)
 *   --skip-errors Skip invalid rows instead of failing
 */

const path = require('path');
const { loadDataset, getDatasetStats, validateDataset } = require('./logistics_dataset_adapter');

const DATASET_PATH = path.join(__dirname, 'logistics_ai_enriched_dataset.csv');

/**
 * Main function to load and process dataset
 */
async function main() {
    const args = process.argv.slice(2);
    const options = {
        validateOnly: args.includes('--validate'),
        showStats: args.includes('--stats'),
        limit: null,
        skipErrors: args.includes('--skip-errors')
    };
    
    // Parse --limit option
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
        options.limit = parseInt(args[limitIndex + 1]);
    }
    
    try {
        console.log('='.repeat(60));
        console.log('Logistics AI Enriched Dataset Loader');
        console.log('='.repeat(60));
        console.log(`Dataset Path: ${DATASET_PATH}\n`);
        
        // Validate dataset file exists
        const fs = require('fs');
        if (!fs.existsSync(DATASET_PATH)) {
            throw new Error(`Dataset file not found: ${DATASET_PATH}`);
        }
        
        // Show statistics
        if (options.showStats || options.validateOnly) {
            console.log('Getting dataset statistics...\n');
            const stats = await getDatasetStats(DATASET_PATH);
            console.log('Dataset Statistics:');
            console.log(`  Total Rows: ${stats.totalRows}`);
            console.log(`  Columns: ${stats.columns.length}`);
            console.log(`  File Size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
            console.log(`  Columns: ${stats.columns.join(', ')}\n`);
        }
        
        // Validate dataset structure
        if (options.validateOnly) {
            console.log('Validating dataset structure...\n');
            const validation = await validateDataset(DATASET_PATH);
            
            if (validation.valid) {
                console.log('✓ Dataset structure is valid\n');
            } else {
                console.log('✗ Dataset structure validation failed:\n');
                validation.issues.forEach(issue => {
                    console.log(`  ERROR: ${issue}`);
                });
            }
            
            if (validation.warnings.length > 0) {
                console.log('\nWarnings:');
                validation.warnings.forEach(warning => {
                    console.log(`  WARNING: ${warning}`);
                });
            }
            
            return;
        }
        
        // Load dataset
        console.log('Loading dataset...');
        if (options.limit) {
            console.log(`  (Limited to first ${options.limit} rows)\n`);
        }
        console.log('  (This may take a moment for large datasets...)\n');
        
        const result = await loadDataset(DATASET_PATH, {
            limit: options.limit,
            validate: true,
            skipErrors: options.skipErrors,
            defaultCustomerId: 3 // Default customer ID for unmapped shipments
        });
        
        // Display results
        console.log('='.repeat(60));
        console.log('Dataset Loaded Successfully');
        console.log('='.repeat(60));
        console.log(`\nStatistics:`);
        console.log(`  Total Rows Processed: ${result.stats.totalRows}`);
        console.log(`  Valid Shipments: ${result.stats.validRows}`);
        console.log(`  Unique Drivers: ${result.stats.uniqueDrivers}`);
        console.log(`  Feedbacks with Ratings: ${result.stats.feedbacksWithRating}`);
        console.log(`  Errors: ${result.stats.errorRows}`);
        
        if (result.errors.length > 0) {
            console.log(`\n⚠  ${result.errors.length} rows had errors:`);
            result.errors.slice(0, 10).forEach(error => {
                console.log(`  Row ${error.row}: ${error.errors?.join(', ') || error.error}`);
            });
            if (result.errors.length > 10) {
                console.log(`  ... and ${result.errors.length - 10} more errors`);
            }
        }
        
        // Show sample data
        console.log(`\nSample Shipment (first row):`);
        if (result.shipments.length > 0) {
            const sample = result.shipments[0];
            console.log(`  Tracking Number: ${sample.tracking_number}`);
            console.log(`  Status: ${sample.status}`);
            console.log(`  Origin: ${sample.origin}`);
            console.log(`  Destination: ${sample.destination}`);
            console.log(`  Driver ID: ${sample.driver_id || 'N/A'}`);
            if (sample._metadata) {
                console.log(`  Route Difficulty: ${sample._metadata.route_difficulty_score}`);
                console.log(`  Traffic Volatility: ${sample._metadata.traffic_volatility}`);
                console.log(`  Weather Severity: ${sample._metadata.weather_severity}`);
            }
        }
        
        console.log(`\nSample Driver Skills (first driver):`);
        if (result.driverSkills.length > 0) {
            const sample = result.driverSkills[0];
            console.log(`  Driver ID: ${sample.driver_id}`);
            console.log(`  Skill Index: ${sample.skill_index.toFixed(2)}`);
            console.log(`  Level: ${sample.level}`);
            if (sample._skill_dimensions) {
                console.log(`  Skill Dimensions:`);
                console.log(`    Fragile Handling: ${sample._skill_dimensions.fragile_handling.toFixed(2)}`);
                console.log(`    Urgency Handling: ${sample._skill_dimensions.urgency_handling.toFixed(2)}`);
                console.log(`    Night Driving: ${sample._skill_dimensions.night_driving.toFixed(2)}`);
                console.log(`    Weather Resilience: ${sample._skill_dimensions.weather_resilience.toFixed(2)}`);
            }
        }
        
        console.log(`\nSample Feedback (first feedback):`);
        if (result.feedbacks.length > 0) {
            const sample = result.feedbacks[0];
            console.log(`  Driver ID: ${sample.driver_id}`);
            console.log(`  Rating: ${sample.rating}/5`);
            console.log(`  Comment: ${sample.comment.substring(0, 100)}...`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('Note: This utility only loads and validates data.');
        console.log('To actually ingest data into the database, use the ingestion API.');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n✗ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run main function if script is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };
