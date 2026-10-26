# TimescaleDB Reporting Skill — AirSunBox

## Purpose

Use this skill when working with AirSunBox reports, historical sensor data, date-range filtering, temporal aggregations, or analytical queries over TimescaleDB/PostgreSQL.

The main time-series table is `dots`.

Core columns:
- `time`: `TIMESTAMPTZ`, measurement timestamp.
- `device_id`: monitoring station/device identifier.
- `variable`: measured variable name.
- `value`: numeric measurement.
- `context`: optional `JSONB` metadata.

Related tables include:
- `devices`: station/device information.
- `variables`: configured variables and latest values.
- `device_variables`: device-variable relationships.
- `organizations`: organization ownership.
- `alerts`: configured thresholds and alert state.
- `incidents`: detected environmental incidents.

## Date and Time Filtering

Always treat `dots.time` as a timezone-aware timestamp.

For inclusive/exclusive date ranges, prefer:

WHERE time >= $start
  AND time < $end

When the user selects a calendar end date, use the following day as the exclusive upper boundary when appropriate.

Example:

WHERE time >= '2026-09-10 00:00:00+00'
  AND time <  '2026-09-15 00:00:00+00'

Do not compare timestamps as plain strings.

Preserve the selected date range throughout the complete report flow:

API query -> calculations -> frontend -> PDF/Excel export.

## TimescaleDB Aggregation

Prefer TimescaleDB `time_bucket()` for temporal aggregation when the report requires hourly, daily, or other time-based grouping.

Examples:

time_bucket('1 hour', time)
time_bucket('1 day', time)

Choose the bucket size according to the report requirement.

Common aggregations include:

AVG(value)
MIN(value)
MAX(value)
COUNT(*)

For station summaries, group by `device_id` and resolve station metadata through the `devices` table.

Do not confuse a latest measurement with a historical average.

## Report Data Integrity

Report queries must:

1. Respect the selected organization.
2. Respect selected stations.
3. Respect selected variables.
4. Respect the selected date range.
5. Use measurements that actually exist in `dots`.
6. Never invent measurements.
7. Never silently replace historical values with current values.
8. Preserve the relationship between measurements and their device.
9. Handle empty date ranges explicitly.

Before modifying an existing report query, inspect the current backend endpoint and frontend data transformation.

Reuse existing report calculations whenever possible.

## Heat Islands Reports

Heat Islands reports are based primarily on temperature and humidity data.

The report should preserve:

- Station name.
- Station/device identifier.
- Latitude and longitude.
- Selected date range.
- Average temperature.
- Minimum temperature.
- Maximum temperature.
- Average humidity.
- Map/station data used by the frontend.

Historical values must be calculated only from measurements inside the requested date range.

Do not use the latest station value when the user requested a historical period.

## Respiratory Risk Reports

Respiratory Risk reports may use environmental variables such as:

- `pm25`
- `pm10`
- `so2`
- `no2`
- `co`
- `co2`
- `humidity`
- `temperatura`

Only use variables actually configured and returned by the application.

Keep raw measurements and aggregate values separate from derived risk classifications.

Risk level, score, disease/category, and recommendations must follow the existing project calculation rules.

Do not invent new thresholds or classification rules unless explicitly requested.

If the API returns nested variable data, flatten it carefully for Excel export without changing its meaning.

## Query Safety

Prefer parameterized SQL queries.

Exploratory queries should be read-only.

Do not perform destructive operations unless explicitly requested.

For test data generation:

- Use existing devices.
- Use existing variables.
- Insert only the requested test range.
- Avoid duplicate measurements.
- Verify inserted rows afterward.
- Do not modify existing historical measurements unnecessarily.

## Validation

After changing or creating report queries, verify:

SELECT
    MIN(time),
    MAX(time),
    COUNT(*),
    COUNT(DISTINCT device_id),
    COUNT(DISTINCT variable)
FROM dots;

For a specific report range, verify the same metrics with the corresponding date filter.

Test at least:

1. A short date range.
2. A multi-day date range.
3. A range containing the existing historical data.
4. A range containing newly inserted test data.
5. An empty date range.

Compare report aggregates against raw measurements when validating results.

## Reporting and Export

PDF and Excel exports must represent the same filtered dataset shown by the report whenever possible.

Exports should preserve:

- Report title.
- Selected date range.
- Selected station(s).
- Relevant variables.
- Summary metrics.
- Detailed report data.
- Risk classifications where applicable.
- Station identity and location where applicable.

The export layer must not change the meaning of the report data.

For Excel, prefer structured sheets such as:

- Report Information / Filters.
- Summary.
- Station Details.
- Risk Details when applicable.

For PDF, preserve a professional report structure with:

- Title.
- Date/filter information.
- Summary metrics.
- Main visualization or table.
- Detailed results.
- Conclusions or interpretation already provided by the application.

## Existing Application Integration

Before implementing new report functionality, inspect:

- Backend report endpoints.
- Existing report calculation helpers.
- Frontend report state and filters.
- Existing CSV/export utilities.
- Existing report visualizations.

Prefer extending the existing architecture instead of duplicating report logic.

PDF and Excel exports should consume the same filtered report data already used by the frontend.

Do not rewrite working report calculations only to add export functionality.

## Implementation Principle

Prefer the smallest reliable change that:

1. Reuses existing API endpoints.
2. Reuses existing SQL queries.
3. Reuses existing report calculation helpers.
4. Preserves current filtering behavior.
5. Adds export functionality without changing report semantics.
6. Keeps database operations safe and verifiable.

When investigating a reporting problem, first identify whether the issue is in:

- SQL/date filtering.
- Backend aggregation.
- Frontend filtering/transformation.
- Visualization.
- PDF export.
- Excel export.

Fix the actual layer responsible for the problem instead of rewriting the entire reporting flow.

## MCP Usage

When a PostgreSQL MCP server is available, use it for read-only inspection and validation of reporting data when appropriate.

The MCP may be used to verify:

- Current database schema.
- Available stations.
- Available variables.
- Measurement counts.
- Minimum and maximum timestamps.
- Report data for selected date ranges.
- Aggregated values used by reports.

Prefer read-only MCP operations for investigation and validation.

Do not use the MCP to modify production or test data unless the user explicitly requests a database modification.

## Test Data Verification

When test measurements are inserted specifically to validate report filtering, verify:

SELECT
    MIN(time) AS min_time,
    MAX(time) AS max_time,
    COUNT(*) AS total_rows,
    COUNT(DISTINCT device_id) AS stations,
    COUNT(DISTINCT variable) AS variables
FROM dots;

Then verify the inserted timestamps and station relationships:

SELECT
    d.time,
    dev.label AS station,
    d.variable,
    d.value
FROM dots d
JOIN devices dev ON dev.id = d.device_id
ORDER BY d.time, dev.label, d.variable;

Test date ranges that include:

- Only newly inserted data.
- Only existing historical data.
- Both existing and newly inserted data.
- No matching data.

The report must return only measurements inside the selected range.

## Export Consistency

The PDF and Excel export must use the same filtered dataset and calculated values shown in the corresponding report view.

Do not independently query a different date range during export.

Do not calculate different averages, risk levels, or classifications in the export layer.

If the frontend already receives calculated report data from the backend, reuse that data for export.

The export should be considered a presentation layer, not a second reporting engine.

## Error Handling

Handle these cases explicitly:

- No measurements found.
- Invalid date range.
- End date earlier than start date.
- Unknown station.
- Unknown variable.
- Missing station metadata.
- Missing measurements for one or more variables.
- Export attempted before report data is available.

Do not silently display misleading zero values when data is missing.

Use clear empty-state behavior instead.

## Performance

Avoid retrieving unnecessary raw measurements when an aggregate query is sufficient.

For large date ranges:

- Filter by timestamp first.
- Filter by device and variable when applicable.
- Aggregate in the database when possible.
- Avoid loading the entire `dots` table into the frontend.
- Reuse existing backend aggregation endpoints.

Use `time_bucket()` when a report requires temporal trends instead of returning every individual measurement.

## Security and Scope

Respect organization ownership and authorization rules already implemented by the application.

Do not expose measurements from another organization.

Do not bypass backend authorization simply to generate an export.

Exports must contain only data the authenticated user is already allowed to view.

## Development Workflow

Before modifying reporting functionality:

1. Inspect the existing backend endpoint.
2. Inspect the SQL query or calculation helper.
3. Inspect frontend filters and state.
4. Identify the exact data structure received by the frontend.
5. Verify date filtering with database queries.
6. Implement the smallest required change.
7. Test the report in the frontend.
8. Test PDF export.
9. Test Excel export.
10. Compare exported values against the displayed report.

Keep existing functionality working while adding export capabilities.

## Final Principle

AirSunBox reporting must be deterministic and traceable.

For every displayed or exported value, it should be possible to determine:

- Which station produced it.
- Which variable produced it.
- Which measurements were included.
- Which date range was applied.
- Which aggregation was used.
- Which existing project rule produced any derived classification.

Never hide changes to filtering, aggregation, or interpretation inside the export layer.