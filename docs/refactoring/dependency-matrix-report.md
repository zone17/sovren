# Dependency Matrix Analysis Report

Generated: 2025-10-27T02:57:19.662Z

## Summary

- **Total Services**: 28
- **Total Lines**: 22127
- **Average Lines/Service**: 790

## Services by Category

- **payment**: 6 services
- **content**: 3 services
- **auth**: 6 services
- **analytics**: 6 services
- **communication**: 2 services
- **integration**: 2 services

## Top 10 Most Coupled Services

1. **DatabaseSessionManager** (auth)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 655
2. **ai-enhanced-features-service** (other)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 1096
3. **ai-recommendation-service** (content)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 415
4. **analytics-integration-service** (analytics)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 1422
5. **content-management-service** (content)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 849
6. **creator-recommendation-service** (content)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 670
7. **email-integration-service-extended** (communication)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 945
8. **email-integration-service** (communication)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 1078
9. **engagement-analytics-service** (analytics)
   - Outgoing: 0
   - Incoming: 0
   - Lines: 1074
10. **enhanced-nostr-auth** (auth)

- Outgoing: 0
- Incoming: 0
- Lines: 684

## Circular Dependencies

None detected

## Missing Services

- keymanagementservice

## Recommendations

### LARGE_SERVICES (medium)

Consider breaking down large services into smaller, focused services
Services: [{"name":"DatabaseSessionManager","lines":655},{"name":"ai-enhanced-features-service","lines":1096},{"name":"analytics-integration-service","lines":1422},{"name":"content-management-service","lines":849},{"name":"creator-recommendation-service","lines":670},{"name":"email-integration-service-extended","lines":945},{"name":"email-integration-service","lines":1078},{"name":"engagement-analytics-service","lines":1074},{"name":"enhanced-nostr-auth","lines":684},{"name":"lightning-payment-service","lines":841},{"name":"lightning-service","lines":798},{"name":"nip05-analytics-service","lines":539},{"name":"nip05-verification-service","lines":729},{"name":"payout-management-service","lines":887},{"name":"quality-metrics-service","lines":1197},{"name":"rls-monitoring-service","lines":616},{"name":"session-service","lines":532},{"name":"social-media-integration-service","lines":1163},{"name":"subscription-management-service","lines":1064},{"name":"supabase-realtime-service","lines":845},{"name":"transaction-history-service","lines":1025},{"name":"unified-nostr-auth","lines":861},{"name":"user-service","lines":593}]
