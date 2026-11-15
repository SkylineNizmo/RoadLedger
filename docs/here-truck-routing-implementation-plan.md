# HERE truck routing implementation checklist (development only)

Status: NOT READY FOR NAVIGATION. Do not remove safety gates or deploy to production.

## Verified HERE Routing API v8 semantics
- Use `transportMode=truck` and `vehicle[parameter]=value`.
- `vehicle[height]`, `vehicle[width]`, and `vehicle[length]` are in centimeters; dimensions for towing should describe the complete combination.
- `vehicle[currentWeight]` is actual loaded weight including trailer and cargo, in kilograms.
- `vehicle[grossWeight]` is maximum permitted loaded weight of the combination, not the current measured load. **Do not derive it from actual weight.**
- `vehicle[trailerCount]=1` denotes one trailer.
- Axle loads are represented by `vehicle[weightPerAxle]` or `vehicle[weightPerAxleGroup]` (mutually exclusive); do not fabricate these values.
- Hazmat loads require explicit `vehicle[shippedHazardousGoods]` and possibly `vehicle[tunnelCategory]` inputs; do not assume no hazardous goods without user confirmation.
- Request `return=polyline,actions,instructions,summary` to obtain route geometry and maneuvers.
- Inspect critical notices and restriction violations; never claim a route is guaranteed safe.

Sources:
- https://docs.here.com/routing/docs/routing-v8-truck-routing
- https://docs.here.com/routing/docs/routing-v8-vehicle-properties
- https://docs.here.com/routing/reference/routing-api-v8-calculateroutes

## Existing implementation blockers
- `backend/navigation-here-route.cjs`: `buildTruckRequest` deliberately throws `HERE_PARAMETER_REVIEW_REQUIRED`.
- `backend/navigation-here-transport.cjs`: only geocoding is executed; route request is blocked.
- `backend/navigation-service.cjs`: only `disabled` and `local-mock` modes; real auth/provider and response contract are not wired.
- `backend/navigation-contract.cjs`: collects actual loaded weight, height, width, length, axles and trailers, but no distinct maximum gross weight, axle-group loading or hazardous-cargo configuration.

## Implementation sequence
1. Add explicit, validated combination gross weight, axle-load and hazardous cargo fields to the vehicle profile and request contract. Plan backward compatibility for existing saved profiles.
2. Verify API reference bounds and build an exact HERE v8 truck request serializer. Add unit and boundary tests; reject missing safety-critical fields.
3. Implement server-only HERE route HTTP execution with response limits, abort, timeouts, quota handling and no secret leakage. Keep geocoding intact.
4. Add a production-capable navigation service mode only after authentication and response contracts support real, non-simulated results; preserve request limits, idempotency and cancellation.
5. Wire route rendering, maneuvers, GPS follow and reroute into the driving UI, and test full-screen map and weather radar separately.
6. Test with mocked HERE fixtures and authorized live API credentials in staging. Verify notices and restrictions, error states and mobile layouts. Never mark routes guaranteed safe.
7. Report tests, credentials/configuration blockers, branch and commit. Do not deploy or merge to main without explicit approval.
